'use server';

import { z, ZodError } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, assertRole, assertEmailVerified } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { notifySuperAdmin } from '@/lib/notifications';
import {
  adminCancelBookingSchema,
  bookingIdSchema,
  createBookingSchema,
  openDisputeSchema,
  resolveDisputeSchema,
} from '@/lib/schemas/booking';

type Failure = { success: false; error: string };

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  const raw = (error as { message?: unknown } | null)?.message;
  return typeof raw === 'string' && raw ? raw : fallback;
}

function revalidateBookingPages(bookingId?: string) {
  revalidatePath('/dashboard/traveler/bookings');
  if (bookingId) revalidatePath(`/dashboard/traveler/bookings/${bookingId}`);
  revalidatePath('/dashboard/organizer/bookings');
  revalidatePath('/admin/bookings');
}

export async function createBooking(scheduleId: string, seats: number) {
  try {
    const validated = createBookingSchema.parse({ scheduleId, seats });

    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');
    // BIZ-12: friendly error before any work (the service enforces it too).
    assertEmailVerified(user);

    const { createBookingService } = await import('@/lib/services/bookings');
    const result = await createBookingService(supabase, profile.id, validated, user);

    // Relative URL to the in-app payment page (not PayMongo Hosted Checkout).
    const checkoutUrl = `/tours/${result.slug}/booking/${result.bookingId}/pay`;

    // Revalidate paths and tags to update the dashboard and tour page UI
    const { updateTag } = await import('next/cache');
    updateTag('tours');
    revalidatePath(`/tours/${result.slug}`);
    revalidatePath('/dashboard/traveler/bookings');

    await notifySuperAdmin(
      'New Booking Created',
      `A traveler booked ${result.seats} seat${result.seats === 1 ? '' : 's'}. Awaiting payment.`,
      'booking_created',
      '/admin/bookings'
    );

    return {
      success: true as const,
      bookingId: result.bookingId,
      checkoutUrl,
    };
  } catch (error: unknown) {
    captureException(error, { action: 'createBooking', scheduleId, seats });
    const message = errorMessage(error, 'An unexpected error occurred.');
    return {
      success: false as const,
      error: message,
      code: message === 'Unauthorized' ? 'unauthorized' as const : undefined,
    };
  }
}

const updateBookingStatusSchema = z.object({
  bookingId: z.string().uuid(),
  // Organizers may only decline a pending booking. Confirmation happens only through a verified
  // payment, and canceling a paid booking must go through the refund flow.
  status: z.literal('canceled'),
});

export async function updateBookingStatus(bookingId: string, status: 'canceled') {
  try {
    const data = updateBookingStatusSchema.parse({ bookingId, status });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    // Get Organizer Profile ID
    const { data: orgProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    if (!orgProfile) throw new Error('Unauthorized');

    // Verify ownership of the tour
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, tour_schedules!inner(tours!inner(organizer_id))')
      .eq('id', data.bookingId)
      .eq('tour_schedules.tours.organizer_id', orgProfile.id)
      .single();

    if (!booking) {
      throw new Error('Unauthorized or booking not found.');
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: organizers have no UPDATE policy on bookings. Ownership verified above.
    const admin = createAdminClient({ admin: true });
    const { data: updated, error } = await admin
      .from('bookings')
      .update({ status: data.status })
      .eq('id', data.bookingId)
      .eq('status', 'pending')
      .select('id');

    if (error) throw error;
    if (!updated || updated.length === 0) {
      throw new Error('Only pending bookings can be declined. Contact support to cancel a paid booking.');
    }

    revalidatePath('/dashboard/organizer/bookings');

    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'updateBookingStatus', bookingId, status });
    return { success: false as const, error: errorMessage(error, 'An unexpected error occurred.') };
  }
}

const processPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(['gcash', 'paymaya']),
  // LEG-01/03: the checkout terms checkbox (Terms of Service + Refund & Cancellation Policy).
  acceptedTerms: z.literal(true, { error: 'Please agree to the Terms of Service and the Refund & Cancellation Policy before paying.' }),
});

// PaymentIntent states in which a new payment method can still be attached (BIZ-18 "Pay now").
const REUSABLE_INTENT_STATES = new Set(['awaiting_payment_method', 'awaiting_next_action']);

export async function processPayment(
  bookingId: string,
  method: 'gcash' | 'paymaya',
  acceptedTerms: boolean
): Promise<{ success: true; redirectUrl: string } | Failure> {
  try {
    const data = processPaymentSchema.parse({ bookingId, method, acceptedTerms });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: writes the PayMongo intent id. Ownership and status checked below.
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin
      .from('bookings')
      .select('id, status, traveler_id, total_amount, booking_ref, paymongo_session_id, tour_schedules ( tours ( slug ) )')
      .eq('id', data.bookingId)
      .single();

    if (!booking || booking.traveler_id !== profile.id) throw new Error('Booking not found');
    if (booking.status !== 'pending') {
      throw new Error(`This booking is ${booking.status} and can no longer be paid.`);
    }

    const schedule = booking.tour_schedules as unknown as { tours: { slug: string } } | null;
    const slug = schedule?.tours.slug;
    if (!slug) throw new Error('Booking not found');

    // Record the checkout acceptance before any money moves (user's RLS client; the DB checks the
    // booking is the caller's own). No record, no payment.
    const { recordAcceptance } = await import('@/lib/legal/consent');
    await recordAcceptance(supabase, { userProfileId: profile.id, document: 'checkout_terms', referenceId: booking.id });

    // Build the return URL on the server so it can never point off-site.
    const { headers } = await import('next/headers');
    const { env } = await import('@/lib/env');
    const headerList = await headers();
    const origin = env.NEXT_PUBLIC_SITE_URL
      ?? `${headerList.get('x-forwarded-proto') ?? 'https'}://${headerList.get('host')}`;
    const returnUrl = `${origin}/tours/${slug}/booking/${booking.id}/success`;

    const { createPaymentIntent, createPaymentMethod, attachPaymentIntent, getPaymentIntent } = await import('@/lib/paymongo');

    // Reuse the booking's live PaymentIntent when the traveler comes back to pay, so one booking
    // never has two payable intents (and can't be paid twice).
    let intentId: string | null = null;
    const existingIntent = booking.paymongo_session_id as string | null;
    if (existingIntent?.startsWith('pi_')) {
      let status: string | null = null;
      try {
        status = (await getPaymentIntent(existingIntent)).status;
      } catch (error: unknown) {
        // PayMongo unreachable or unknown intent: fall back to a fresh intent.
        captureException(error, { action: 'processPayment getPaymentIntent', bookingId });
      }
      if (status === 'succeeded') {
        // Already paid: the success page verifies it with PayMongo and confirms the booking.
        return { success: true, redirectUrl: returnUrl };
      }
      if (status === 'processing') {
        throw new Error('Your last payment is still being processed. Please check your bookings again in a few minutes.');
      }
      if (status && REUSABLE_INTENT_STATES.has(status)) intentId = existingIntent;
    }

    if (!intentId) {
      const amountCents = Math.round(Number(booking.total_amount) * 100);
      const intent = await createPaymentIntent(amountCents, `Travi Booking: ${booking.booking_ref}`, {
        booking_id: booking.id,
        booking_ref: booking.booking_ref,
      });
      intentId = intent.id;
      // Save the intent id so we can verify it later (still pending, so nothing paid is overwritten).
      const { error: saveError } = await admin
        .from('bookings')
        .update({ paymongo_session_id: intent.id })
        .eq('id', booking.id)
        .eq('status', 'pending');
      if (saveError) throw saveError;
    }

    const pm = await createPaymentMethod(data.method, {
      email: user.email,
      name: user.user_metadata?.full_name || 'Traveler'
    });

    const attachResult = await attachPaymentIntent(intentId, pm.id, returnUrl);

    if (attachResult.next_action?.type === 'redirect') {
      return { success: true, redirectUrl: attachResult.next_action.redirect.url as string };
    }
    if (attachResult.status === 'succeeded') {
      return { success: true, redirectUrl: returnUrl }; // It was instantly paid
    }

    throw new Error('Failed to start the payment. Please try again.');
  } catch (error: unknown) {
    captureException(error, { action: 'processPayment', bookingId, method });
    return { success: false, error: errorMessage(error, 'Payment initialization failed. Please try again.') };
  }
}

export async function cancelBookingAsTraveler(bookingId: string): Promise<{ success: true; status: 'canceled' } | Failure> {
  try {
    const id = bookingIdSchema.parse(bookingId);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');
    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: travelers have no UPDATE on bookings. Ownership checked below.
    const admin = createAdminClient({ admin: true });

    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select('id, status, traveler_id, tour_schedules ( start_date )')
      .eq('id', id)
      .single();

    if (bookingError || !booking || booking.traveler_id !== profile.id) throw new Error('Booking not found');

    const schedule = booking.tour_schedules as unknown as { start_date: string } | null;
    const { manilaToday } = await import('@/lib/datetime');
    if (!schedule || schedule.start_date <= manilaToday()) {
      throw new Error('Cannot cancel a tour that has already started or ended');
    }

    if (booking.status === 'pending') {
      // Unpaid: release the seats. A payment that still arrives is handled as a late payment.
      const { data: updated, error } = await admin
        .from('bookings')
        .update({ status: 'canceled' })
        .eq('id', id)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('This booking changed; refresh and try again.');
      const { notifyTravelerBookingCanceled } = await import('@/lib/notifications');
      await notifyTravelerBookingCanceled(id);
    } else if (booking.status === 'confirmed') {
      // Paid: full refund (current policy, see AGENTS.md §4.3), escrow reversal, booking canceled.
      // refundBooking() tells the traveler.
      const { refundBooking } = await import('@/lib/services/refunds');
      await refundBooking({
        bookingId: id,
        reason: 'traveler_cancel',
        initiatedBy: profile.id,
        initiatedRole: 'traveler',
        bookingStatus: 'canceled',
      });
    } else {
      throw new Error('Booking cannot be canceled in its current status');
    }

    revalidateBookingPages(id);
    return { success: true, status: 'canceled' };
  } catch (error: unknown) {
    captureException(error, { action: 'cancelBookingAsTraveler', bookingId });
    return { success: false, error: errorMessage(error, 'Failed to cancel the booking.') };
  }
}

/** Traveler opens a dispute with a reason (BIZ-17). */
export async function openDispute(input: unknown): Promise<{ success: true; disputeStatus: 'open' } | Failure> {
  let bookingId: string | undefined;
  try {
    const data = openDisputeSchema.parse(input);
    bookingId = data.bookingId;
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');
    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: open_booking_dispute() checks ownership, status, the window and the reason under a row lock.
    const admin = createAdminClient({ admin: true });

    const { error } = await admin.rpc('open_booking_dispute', {
      p_booking_id: data.bookingId,
      p_traveler_profile_id: profile.id,
      p_reason: data.reason,
    });
    if (error) throw new Error(error.message);

    const { notifyDisputeOpened } = await import('@/lib/notifications');
    await Promise.all([
      notifyDisputeOpened(data.bookingId),
      notifySuperAdmin('Dispute opened', `A traveler opened a dispute on booking ${data.bookingId}.`, 'dispute_opened', '/admin/bookings'),
    ]);

    revalidateBookingPages(data.bookingId);
    return { success: true, disputeStatus: 'open' };
  } catch (error: unknown) {
    captureException(error, { action: 'openDispute', bookingId });
    return { success: false, error: errorMessage(error, 'Failed to open the dispute.') };
  }
}

export async function resolveDispute(
  bookingId: string,
  decision: 'refund' | 'deny'
): Promise<{ success: true; status: string; disputeStatus: string; refundAmount: number | null } | Failure> {
  try {
    const data = resolveDisputeSchema.parse({ bookingId, decision });
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: dispute resolution is an admin money operation (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin.from('bookings').select('dispute_status').eq('id', data.bookingId).single();
    if (!booking || booking.dispute_status !== 'open') throw new Error('No open dispute to resolve');

    const { notifyDisputeResolved } = await import('@/lib/notifications');
    let result: { status: string; disputeStatus: string; refundAmount: number | null };
    if (data.decision === 'refund') {
      // complete_booking_refund() writes the admin audit row.
      const { refundBooking } = await import('@/lib/services/refunds');
      const refund = await refundBooking({
        bookingId: data.bookingId,
        reason: 'dispute_refund',
        initiatedBy: profile.id,
        initiatedRole: 'admin',
        bookingStatus: 'refunded',
      });
      await notifyDisputeResolved(data.bookingId, 'refunded', { refundAmount: refund.amount });
      result = { status: 'refunded', disputeStatus: 'resolved_refunded', refundAmount: refund.amount };
    } else {
      // deny_booking_dispute() writes the admin audit row.
      const { error } = await admin.rpc('deny_booking_dispute', { p_booking_id: data.bookingId, p_admin_profile_id: profile.id });
      if (error) throw new Error(error.message);
      await notifyDisputeResolved(data.bookingId, 'denied');
      result = { status: 'confirmed', disputeStatus: 'resolved_denied', refundAmount: null };
    }

    revalidateBookingPages(data.bookingId);
    return { success: true, ...result };
  } catch (error: unknown) {
    captureException(error, { action: 'resolveDispute', bookingId, decision });
    return { success: false, error: errorMessage(error, 'Failed to resolve the dispute.') };
  }
}

/**
 * Admin "Cancel & refund" outside disputes (OPS-06). Pending (unpaid) bookings are just canceled;
 * confirmed ones are refunded in full or in part and canceled.
 */
export async function adminCancelBooking(
  input: unknown
): Promise<{ success: true; status: 'canceled'; refundAmount: number | null } | Failure> {
  let bookingId: string | undefined;
  try {
    const data = adminCancelBookingSchema.parse(input);
    bookingId = data.bookingId;
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: admin money operation (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin
      .from('bookings')
      .select('id, status, total_amount, booking_ref')
      .eq('id', data.bookingId)
      .single();
    if (!booking) throw new Error('Booking not found');

    let refundAmount: number | null = null;
    if (booking.status === 'pending') {
      if (data.amount) throw new Error('This booking is unpaid, so there is nothing to refund.');
      const { data: updated, error } = await admin
        .from('bookings')
        .update({ status: 'canceled' })
        .eq('id', data.bookingId)
        .eq('status', 'pending')
        .select('id');
      if (error) throw error;
      if (!updated || updated.length === 0) throw new Error('This booking changed; refresh and try again.');
      const { notifyTravelerBookingCanceled } = await import('@/lib/notifications');
      await notifyTravelerBookingCanceled(data.bookingId);
    } else if (booking.status === 'confirmed') {
      if (data.amount && data.amount > Number(booking.total_amount)) {
        throw new Error('The refund cannot be more than the amount paid.');
      }
      // refundBooking() tells the traveler; complete_booking_refund() writes an audit row for the refund.
      const { refundBooking } = await import('@/lib/services/refunds');
      const refund = await refundBooking({
        bookingId: data.bookingId,
        amount: data.amount,
        reason: 'admin_refund',
        initiatedBy: profile.id,
        initiatedRole: 'admin',
        bookingStatus: 'canceled',
      });
      refundAmount = refund.amount;
    } else {
      throw new Error(`A ${booking.status} booking cannot be canceled.`);
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'booking',
      entityId: data.bookingId,
      action: 'admin_cancel',
      notes: data.reason,
      diff: { from: booking.status, to: 'canceled', refundAmount },
    });

    revalidateBookingPages(data.bookingId);
    return { success: true, status: 'canceled', refundAmount };
  } catch (error: unknown) {
    captureException(error, { action: 'adminCancelBooking', bookingId });
    return { success: false, error: errorMessage(error, 'Failed to cancel the booking.') };
  }
}
