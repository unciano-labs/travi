// Internal notification senders (in-app row + email). Server-only helpers, deliberately NOT
// Server Actions: an exported 'use server' function is a public endpoint (AGENTS.md §3.2).
// Callers must authenticate and authorize before calling these. Every function here swallows and
// reports its own errors: a failed notification must never fail the payment, refund or action
// that triggered it.
//
// Email goes only through sendEmail() (lib/email.ts); bodies come from lib/email-templates.ts, which
// escapes user-supplied text. In-app rows are keyed by the AUTH user id (notifications.user_id).
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { captureException, logger } from '@/lib/logger';
import { sendEmail, siteUrl } from '@/lib/email';
import {
  bookingCanceledEmail,
  bookingConfirmedEmail,
  disputeOpenedOrganizerEmail,
  disputeOpenedTravelerEmail,
  disputeResolvedEmail,
  formatDate,
  formatPeso,
  newBookingOrganizerEmail,
  partnerAccountStatusEmail,
  paymentNeedsReviewEmail,
  transportRequestEmail,
  transportRequestStatusEmail,
  tripReminderEmail,
  type EmailContent,
  type PaymentReviewReason,
} from '@/lib/email-templates';

export type { PaymentReviewReason } from '@/lib/email-templates';

// Service role: notifications are cross-user rows, and recipients' emails are not readable under
// RLS by the user who triggers the message (AGENTS.md §5.3).
const admin = () => createAdminClient({ admin: true });

const TRAVELER_BOOKINGS_PATH = '/dashboard/traveler/bookings';
const ORGANIZER_BOOKINGS_PATH = '/dashboard/organizer/bookings';

// ─── Core ───

/** Insert one in-app notification. `userId` is the auth user id. Returns whether it was stored. */
export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: string,
  link?: string
): Promise<boolean> {
  try {
    const { error } = await admin().from('notifications').insert({ user_id: userId, title, message, type, link });
    if (error) {
      captureException(error, { action: 'createNotification', type });
      return false;
    }
    return true;
  } catch (error: unknown) {
    captureException(error, { action: 'createNotification', type });
    return false;
  }
}

interface Recipient {
  userId: string | null;
  email: string | null;
  name: string | null;
}

interface InApp {
  title: string;
  message: string;
  type: string;
  link?: string;
}

/** In-app row + email to one recipient. Returns true if at least one channel succeeded. */
async function deliver(recipient: Recipient, inApp: InApp, email: EmailContent): Promise<boolean> {
  const [stored, sent] = await Promise.all([
    recipient.userId ? createNotification(recipient.userId, inApp.title, inApp.message, inApp.type, inApp.link) : false,
    recipient.email ? sendEmail({ to: recipient.email, ...email }).then((r) => r.success) : false,
  ]);
  return stored || sent;
}

// Supabase returns a to-one embed as an object, or as an array when it cannot infer the relation.
function single<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

interface ProfileEmbed {
  user_id: string | null;
  email: string | null;
  full_name?: string | null;
}

interface PartnerRow {
  display_name: string | null;
  company_name: string | null;
  user_profile: ProfileEmbed | ProfileEmbed[] | null;
}

async function loadPartner(table: 'organizer_profiles' | 'transporter_profiles', id: string): Promise<Recipient | null> {
  const { data, error } = await admin()
    .from(table)
    .select('display_name, company_name, user_profile:user_profiles ( user_id, email, full_name )')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as PartnerRow;
  const profile = single(row.user_profile);
  return {
    userId: profile?.user_id ?? null,
    email: profile?.email ?? null,
    name: row.display_name || row.company_name || profile?.full_name || null,
  };
}

interface BookingContext {
  id: string;
  bookingRef: string;
  seats: number;
  amount: number;
  status: string;
  traveler: Recipient;
  tour: { title: string; slug: string; location: string | null; organizerId: string | null };
  schedule: { startDate: string; endDate: string | null };
}

interface BookingRow {
  id: string;
  booking_ref: string | null;
  seats: number;
  total_amount: number | string;
  status: string;
  traveler: ProfileEmbed | ProfileEmbed[] | null;
  tour_schedules:
    | {
        start_date: string;
        end_date: string | null;
        tours: { title: string; slug: string; location: string | null; organizer_id: string | null } | null;
      }
    | null;
}

async function loadBooking(bookingId: string): Promise<BookingContext | null> {
  const { data, error } = await admin()
    .from('bookings')
    .select(`
      id, booking_ref, seats, total_amount, status,
      traveler:user_profiles!traveler_id ( user_id, email, full_name ),
      tour_schedules ( start_date, end_date, tours ( title, slug, location, organizer_id ) )
    `)
    .eq('id', bookingId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const row = data as unknown as BookingRow;
  const schedule = single(row.tour_schedules);
  const tour = single(schedule?.tours ?? null);
  const traveler = single(row.traveler);
  if (!schedule || !tour) return null;

  return {
    id: row.id,
    bookingRef: row.booking_ref ?? row.id.slice(0, 8).toUpperCase(),
    seats: row.seats,
    amount: Number(row.total_amount),
    status: row.status,
    traveler: { userId: traveler?.user_id ?? null, email: traveler?.email ?? null, name: traveler?.full_name ?? null },
    tour: { title: tour.title, slug: tour.slug, location: tour.location, organizerId: tour.organizer_id },
    schedule: { startDate: schedule.start_date, endDate: schedule.end_date },
  };
}

const bookingPageUrl = (b: BookingContext) => siteUrl(`/tours/${encodeURIComponent(b.tour.slug)}/booking/${b.id}`);

// Send-once claims (booking_notifications_sent): the row is written before sending, and removed if
// every channel failed so a later attempt retries.
type SendOnceKind = 'trip_reminder' | 'payment_review';

async function claimOnce(bookingId: string, kind: SendOnceKind, dedupeKey = ''): Promise<boolean> {
  const { data, error } = await admin()
    .from('booking_notifications_sent')
    .upsert({ booking_id: bookingId, kind, dedupe_key: dedupeKey }, { onConflict: 'booking_id,kind,dedupe_key', ignoreDuplicates: true })
    .select('id');
  if (error) throw error;
  return Boolean(data && data.length > 0);
}

async function releaseClaim(bookingId: string, kind: SendOnceKind, dedupeKey = '') {
  const { error } = await admin()
    .from('booking_notifications_sent')
    .delete()
    .eq('booking_id', bookingId)
    .eq('kind', kind)
    .eq('dedupe_key', dedupeKey);
  if (error) captureException(error, { action: 'releaseClaim', bookingId, kind });
}

// ─── Traveler: bookings (BIZ-14) ───

/** Booking confirmed + receipt email. Called once per booking, when the payment is applied. */
export async function notifyTravelerBookingConfirmed(bookingId: string): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    await deliver(
      b.traveler,
      {
        title: 'Booking confirmed',
        message: `Your booking ${b.bookingRef} for ${b.tour.title} on ${formatDate(b.schedule.startDate)} is confirmed. Amount paid: ${formatPeso(b.amount)}.`,
        type: 'booking_confirmed',
        link: TRAVELER_BOOKINGS_PATH,
      },
      bookingConfirmedEmail({
        travelerName: b.traveler.name,
        bookingRef: b.bookingRef,
        tourTitle: b.tour.title,
        location: b.tour.location,
        startDate: b.schedule.startDate,
        endDate: b.schedule.endDate,
        seats: b.seats,
        amount: b.amount,
        bookingUrl: bookingPageUrl(b),
      })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyTravelerBookingConfirmed', bookingId });
  }
}

/**
 * A payment was received but not applied (late, duplicate, wrong amount, closed booking); tells the
 * traveler a refund will follow. Sent once per PayMongo payment, however many times it is reported.
 * Returns true only the first time for that payment (callers can gate their own alerts on it).
 */
export async function notifyTravelerPaymentNeedsReview(
  bookingId: string,
  providerPaymentId: string,
  reason: PaymentReviewReason
): Promise<boolean> {
  try {
    if (!(await claimOnce(bookingId, 'payment_review', providerPaymentId))) return false;
    const b = await loadBooking(bookingId);
    if (!b) return true;
    const delivered = await deliver(
      b.traveler,
      {
        title: 'Payment needs review',
        message: `We received a payment for booking ${b.bookingRef} that could not be applied. It will be refunded to your original payment method.`,
        type: 'payment_review',
        link: TRAVELER_BOOKINGS_PATH,
      },
      paymentNeedsReviewEmail({
        travelerName: b.traveler.name,
        bookingRef: b.bookingRef,
        tourTitle: b.tour.title,
        reason,
        bookingsUrl: siteUrl(TRAVELER_BOOKINGS_PATH),
      })
    );
    if (!delivered) await releaseClaim(bookingId, 'payment_review', providerPaymentId);
    return true;
  } catch (error: unknown) {
    captureException(error, { action: 'notifyTravelerPaymentNeedsReview', bookingId, reason });
    return true; // Unknown state: let the caller alert the admin rather than stay silent.
  }
}

/**
 * Booking canceled. Pass `refundAmount` (pesos) when a refund was issued; omit it for an unpaid
 * (pending) booking.
 */
export async function notifyTravelerBookingCanceled(
  bookingId: string,
  options: { refundAmount?: number | null } = {}
): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const refund = options.refundAmount && options.refundAmount > 0 ? options.refundAmount : null;
    await deliver(
      b.traveler,
      {
        title: refund ? 'Booking canceled and refunded' : 'Booking canceled',
        message: refund
          ? `Your booking ${b.bookingRef} for ${b.tour.title} was canceled. A refund of ${formatPeso(refund)} was issued to your original payment method.`
          : `Your booking ${b.bookingRef} for ${b.tour.title} was canceled.`,
        type: 'booking_canceled',
        link: TRAVELER_BOOKINGS_PATH,
      },
      bookingCanceledEmail({
        travelerName: b.traveler.name,
        bookingRef: b.bookingRef,
        tourTitle: b.tour.title,
        startDate: b.schedule.startDate,
        endDate: b.schedule.endDate,
        refundAmount: refund,
        bookingsUrl: siteUrl(TRAVELER_BOOKINGS_PATH),
      })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyTravelerBookingCanceled', bookingId });
  }
}

// ─── Disputes (called from actions/bookings.ts) ───

/** Dispute opened: confirmation to the traveler and a heads-up to the organizer. */
export async function notifyDisputeOpened(bookingId: string): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const organizer = b.tour.organizerId ? await loadPartner('organizer_profiles', b.tour.organizerId) : null;

    await Promise.all([
      deliver(
        b.traveler,
        {
          title: 'Dispute received',
          message: `We received your dispute for booking ${b.bookingRef}. Our team will review it and let you know the outcome.`,
          type: 'dispute_opened',
          link: TRAVELER_BOOKINGS_PATH,
        },
        disputeOpenedTravelerEmail({
          travelerName: b.traveler.name,
          bookingRef: b.bookingRef,
          tourTitle: b.tour.title,
          bookingsUrl: siteUrl(TRAVELER_BOOKINGS_PATH),
        })
      ),
      organizer
        ? deliver(
            organizer,
            {
              title: 'Dispute opened',
              message: `A traveler opened a dispute on booking ${b.bookingRef} (${b.tour.title}). Its payout is on hold until the dispute is resolved.`,
              type: 'dispute_opened',
              link: ORGANIZER_BOOKINGS_PATH,
            },
            disputeOpenedOrganizerEmail({
              organizerName: organizer.name,
              travelerName: b.traveler.name,
              bookingRef: b.bookingRef,
              tourTitle: b.tour.title,
              bookingsUrl: siteUrl(ORGANIZER_BOOKINGS_PATH),
            })
          )
        : Promise.resolve(false),
    ]);
  } catch (error: unknown) {
    captureException(error, { action: 'notifyDisputeOpened', bookingId });
  }
}

/** Dispute resolved, to the traveler. `refundAmount` (pesos) is shown when outcome is 'refunded'. */
export async function notifyDisputeResolved(
  bookingId: string,
  outcome: 'refunded' | 'denied',
  options: { refundAmount?: number | null } = {}
): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b) return;
    const refund = outcome === 'refunded' ? options.refundAmount ?? null : null;
    await deliver(
      b.traveler,
      {
        title: 'Dispute resolved',
        message:
          outcome === 'refunded'
            ? `Your dispute for booking ${b.bookingRef} was resolved in your favor. ${refund ? `A refund of ${formatPeso(refund)}` : 'A refund'} was issued.`
            : `Your dispute for booking ${b.bookingRef} was reviewed and the refund was declined.`,
        type: 'dispute_resolved',
        link: TRAVELER_BOOKINGS_PATH,
      },
      disputeResolvedEmail({
        travelerName: b.traveler.name,
        bookingRef: b.bookingRef,
        tourTitle: b.tour.title,
        outcome,
        refundAmount: refund,
        bookingsUrl: siteUrl(TRAVELER_BOOKINGS_PATH),
      })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyDisputeResolved', bookingId, outcome });
  }
}

// ─── Trip reminder (GET /api/cron/trip-reminders) ───

export type TripReminderResult = 'sent' | 'skipped' | 'failed';

/**
 * T-2 days reminder to the traveler. Idempotent: claims booking_notifications_sent first, so a
 * booking is reminded at most once; the claim is released if nothing could be delivered.
 */
export async function sendTripReminder(bookingId: string): Promise<TripReminderResult> {
  let claimed = false;
  try {
    claimed = await claimOnce(bookingId, 'trip_reminder');
    if (!claimed) return 'skipped';

    const b = await loadBooking(bookingId);
    if (!b || b.status !== 'confirmed') return 'skipped'; // keep the claim: nothing to remind

    const organizer = b.tour.organizerId ? await loadPartner('organizer_profiles', b.tour.organizerId) : null;
    const delivered = await deliver(
      b.traveler,
      {
        title: 'Your trip is coming up',
        message: `${b.tour.title} starts on ${formatDate(b.schedule.startDate)}. Booking ${b.bookingRef}, ${b.seats} guest(s).`,
        type: 'trip_reminder',
        link: TRAVELER_BOOKINGS_PATH,
      },
      tripReminderEmail({
        travelerName: b.traveler.name,
        bookingRef: b.bookingRef,
        tourTitle: b.tour.title,
        location: b.tour.location,
        startDate: b.schedule.startDate,
        endDate: b.schedule.endDate,
        seats: b.seats,
        organizerName: organizer?.name ?? null,
        bookingUrl: bookingPageUrl(b),
      })
    );
    if (!delivered) {
      await releaseClaim(bookingId, 'trip_reminder');
      return 'failed';
    }
    return 'sent';
  } catch (error: unknown) {
    captureException(error, { action: 'sendTripReminder', bookingId });
    if (claimed) await releaseClaim(bookingId, 'trip_reminder');
    return 'failed';
  }
}

// ─── Organizers and transporters ───

export async function notifyTransporterOfRequest(transporterId: string, startDate: string, endDate: string): Promise<void> {
  try {
    const transporter = await loadPartner('transporter_profiles', transporterId);
    if (!transporter) return;
    const path = '/dashboard/transporter/requests';
    await deliver(
      transporter,
      {
        title: 'New Vehicle Request',
        message: `You have a new transport request for a tour schedule from ${startDate} to ${endDate}.`,
        type: 'transport_request',
        link: path,
      },
      transportRequestEmail({ transporterName: transporter.name, startDate, endDate, requestsUrl: siteUrl(path) })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyTransporterOfRequest', transporterId });
  }
}

export async function notifyOrganizerOfStatusChange(
  organizerId: string,
  tourId: string,
  tourScheduleId: string,
  transporterName: string,
  status: 'accepted' | 'declined'
): Promise<void> {
  try {
    const organizer = await loadPartner('organizer_profiles', organizerId);
    if (!organizer) return;
    const path = `/dashboard/organizer/tours/${tourId}/schedules/${tourScheduleId}`;
    await deliver(
      organizer,
      {
        title: `Transport Request ${status === 'accepted' ? 'Accepted' : 'Declined'}`,
        message: `${transporterName} has ${status} your transport request.`,
        type: `transport_${status}`,
        link: path,
      },
      transportRequestStatusEmail({ organizerName: organizer.name, transporterName, status, scheduleUrl: siteUrl(path) })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyOrganizerOfStatusChange', organizerId });
  }
}

async function notifyPartnerAccountStatus(
  partner: 'organizer' | 'transporter',
  profileId: string,
  status: 'activated' | 'deactivated',
  reason?: string
): Promise<void> {
  try {
    const recipient = await loadPartner(partner === 'organizer' ? 'organizer_profiles' : 'transporter_profiles', profileId);
    if (!recipient) return;
    const path = `/dashboard/${partner}`;
    const activated = status === 'activated';
    await deliver(
      recipient,
      {
        title: `Account ${activated ? 'Activated' : 'Deactivated'}`,
        message: activated
          ? `Your ${partner} account has been approved and activated!`
          : `Your ${partner} account has been deactivated. ${reason ? `Reason: ${reason}` : 'Please contact support for more details.'}`,
        type: `account_${status}`,
        link: path,
      },
      partnerAccountStatusEmail({ name: recipient.name, partner, status, reason, dashboardUrl: siteUrl(path) })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyPartnerAccountStatus', partner, profileId });
  }
}

export async function notifyOrganizerAccountStatus(organizerId: string, status: 'activated' | 'deactivated', reason?: string) {
  await notifyPartnerAccountStatus('organizer', organizerId, status, reason);
}

export async function notifyTransporterAccountStatus(transporterId: string, status: 'activated' | 'deactivated', reason?: string) {
  await notifyPartnerAccountStatus('transporter', transporterId, status, reason);
}

/** New paid booking, to the organizer. */
export async function notifyOrganizerOfNewBooking(bookingId: string): Promise<void> {
  try {
    const b = await loadBooking(bookingId);
    if (!b?.tour.organizerId) return;
    const organizer = await loadPartner('organizer_profiles', b.tour.organizerId);
    if (!organizer) return;
    const travelerName = b.traveler.name || 'A traveler';
    await deliver(
      organizer,
      {
        title: 'New Booking! 🎉',
        message: `${travelerName} just booked ${b.seats} seat(s) for ${b.tour.title}.`,
        type: 'booking_new',
        link: ORGANIZER_BOOKINGS_PATH,
      },
      newBookingOrganizerEmail({
        organizerName: organizer.name,
        travelerName,
        seats: b.seats,
        tourTitle: b.tour.title,
        bookingRef: b.bookingRef,
        bookingsUrl: siteUrl(ORGANIZER_BOOKINGS_PATH),
      })
    );
  } catch (error: unknown) {
    captureException(error, { action: 'notifyOrganizerOfNewBooking', bookingId });
  }
}

// ─── Platform admin ───

/** In-app notification to the super admin (the user whose email is ADMIN_EMAIL). */
export async function notifySuperAdmin(title: string, message: string, type: string, link?: string): Promise<void> {
  try {
    if (!env.ADMIN_EMAIL) {
      logger.warn({ type }, 'ADMIN_EMAIL not set, skipping super admin notification');
      return;
    }
    const { data: profile, error } = await admin()
      .from('user_profiles')
      .select('user_id')
      .eq('email', env.ADMIN_EMAIL)
      .maybeSingle();
    if (error) throw error;
    if (profile?.user_id) await createNotification(profile.user_id, title, message, type, link);
  } catch (error: unknown) {
    captureException(error, { action: 'notifySuperAdmin', type });
  }
}
