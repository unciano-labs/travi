// Transactional email templates (BIZ-14, SEC-18). Pure functions: data in, `{ subject, html, text }` out.
// Every argument is RAW text; the layout escapes it, so callers never build HTML themselves and
// user-controlled strings (names, tour titles, reasons, locations) are always escaped.
// Send the result with sendEmail() from lib/email.ts. Build URLs with siteUrl() from lib/email.ts.
import { escapeHtml } from '@/lib/email';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

// Brand tokens (app/globals.css): inline styles only, email clients ignore stylesheets.
const NAVY = '#0C1A2E';
const BRAND = '#0EA5E9';
const CORAL = '#F97316';
const SLATE = '#334155';
const MUTED = '#64748B';
const BORDER = '#E2E8F0';
const FONT = "'Plus Jakarta Sans', 'Segoe UI', Helvetica, Arial, sans-serif";

// ─── Formatting ───

/** ₱1,234.00 */
export function formatPeso(amount: number): string {
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Sat, 24 Oct 2026" from a Postgres DATE (YYYY-MM-DD). Formatted in UTC so the day never shifts. */
export function formatDate(date: string): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(parsed);
}

export function formatDateRange(start: string, end?: string | null): string {
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return formatDate(start);
  return `${formatDate(start)} – ${formatDate(end)}`;
}

const greetingName = (name?: string | null) => (name && name.trim() ? name.trim() : 'there');

// ─── Layout ───

interface LayoutInput {
  subject: string;
  /** Inbox preview line. */
  preheader: string;
  heading: string;
  greeting: string;
  paragraphs: string[];
  /** Label/value rows shown as a receipt-style table. */
  details?: [string, string][];
  /** Highlighted note (e.g. refund information). */
  callout?: string;
  cta?: { label: string; url: string };
}

function render(input: LayoutInput): EmailContent {
  const p = (text: string) =>
    `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${SLATE};">${escapeHtml(text)}</p>`;

  const details = input.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border:1px solid ${BORDER};border-radius:8px;border-collapse:separate;">
        ${input.details
          .map(
            ([label, value], i) => `<tr>
              <td style="padding:10px 16px;font-size:13px;color:${MUTED};${i ? `border-top:1px solid ${BORDER};` : ''}">${escapeHtml(label)}</td>
              <td style="padding:10px 16px;font-size:14px;font-weight:600;color:${NAVY};text-align:right;${i ? `border-top:1px solid ${BORDER};` : ''}">${escapeHtml(value)}</td>
            </tr>`
          )
          .join('')}
      </table>`
    : '';

  const callout = input.callout
    ? `<div style="margin:0 0 24px;padding:14px 16px;background:#F0F9FF;border-left:4px solid ${BRAND};border-radius:4px;font-size:14px;line-height:1.5;color:${NAVY};">${escapeHtml(input.callout)}</div>`
    : '';

  const cta = input.cta
    ? `<p style="margin:8px 0 24px;"><a href="${escapeHtml(input.cta.url)}" style="display:inline-block;background:${CORAL};color:#ffffff;padding:12px 24px;border-radius:8px;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(input.cta.label)}</a></p>`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#F1F5F9;font-family:${FONT};">
  <span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.preheader)}</span>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F1F5F9;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${NAVY};padding:20px 28px;">
          <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:0.5px;">Travi</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${NAVY};">${escapeHtml(input.heading)}</h1>
          ${p(input.greeting)}
          ${input.paragraphs.map(p).join('\n          ')}
          ${details}
          ${callout}
          ${cta}
          <p style="margin:0;font-size:15px;line-height:1.6;color:${SLATE};">Salamat,<br>The Travi team</p>
        </td></tr>
        <tr><td style="padding:16px 28px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.5;color:${MUTED};">
          You are receiving this email because of activity on your Travi account.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    input.heading,
    '',
    input.greeting,
    '',
    ...input.paragraphs.flatMap((para) => [para, '']),
    ...(input.details?.length ? [...input.details.map(([label, value]) => `${label}: ${value}`), ''] : []),
    ...(input.callout ? [input.callout, ''] : []),
    ...(input.cta ? [`${input.cta.label}: ${input.cta.url}`, ''] : []),
    'Salamat,',
    'The Travi team',
  ].join('\n');

  return { subject: input.subject, html, text };
}

// ─── Traveler: bookings ───

export interface BookingSummary {
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  location?: string | null;
  startDate: string;
  endDate?: string | null;
  seats: number;
  amount: number;
}

/** Booking confirmed + payment receipt. */
export function bookingConfirmedEmail(b: BookingSummary & { bookingUrl: string }): EmailContent {
  return render({
    subject: `Booking confirmed: ${b.tourTitle} (${b.bookingRef})`,
    preheader: `Your payment was received and your seats are reserved for ${formatDateRange(b.startDate, b.endDate)}.`,
    heading: 'Your booking is confirmed',
    greeting: `Hi ${greetingName(b.travelerName)},`,
    paragraphs: ['We received your payment and your seats are reserved. Here is your receipt.'],
    details: [
      ['Booking reference', b.bookingRef],
      ['Tour', b.tourTitle],
      ...(b.location ? ([['Location', b.location]] as [string, string][]) : []),
      ['Dates', formatDateRange(b.startDate, b.endDate)],
      ['Guests', String(b.seats)],
      ['Amount paid', formatPeso(b.amount)],
    ],
    callout: 'You can view or cancel this booking from your Travi account. We will send you a reminder 2 days before the trip.',
    cta: { label: 'View booking', url: b.bookingUrl },
  });
}

export type PaymentReviewReason = 'amount_mismatch' | 'duplicate_payment' | 'late_payment_needs_refund' | 'booking_closed_needs_refund';

const REVIEW_COPY: Record<PaymentReviewReason, string> = {
  amount_mismatch: 'The amount we received does not match your booking total, so we could not confirm the booking automatically.',
  duplicate_payment: 'This booking was already paid, so your extra payment was not applied.',
  late_payment_needs_refund: 'Your payment arrived after the booking reservation expired, and the seats are no longer available.',
  booking_closed_needs_refund: 'This booking was already closed when your payment arrived, so it could not be applied.',
};

/** A payment was received but not applied (late, duplicate, wrong amount): a refund will follow. */
export function paymentNeedsReviewEmail(input: {
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  reason: PaymentReviewReason;
  bookingsUrl: string;
}): EmailContent {
  return render({
    subject: `We received your payment for ${input.bookingRef}: refund on the way`,
    preheader: 'Your payment could not be applied to your booking. Our team will refund it.',
    heading: 'Your payment needs our attention',
    greeting: `Hi ${greetingName(input.travelerName)},`,
    paragraphs: [
      REVIEW_COPY[input.reason],
      'You do not need to do anything. Our team has been alerted and will refund the payment to your original payment method. Refunds usually reach GCash or Maya within 5 to 10 business days.',
    ],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
    ],
    cta: { label: 'View my bookings', url: input.bookingsUrl },
  });
}

/** Booking canceled; `refundAmount` > 0 adds the refund notice. */
export function bookingCanceledEmail(input: {
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  startDate?: string | null;
  endDate?: string | null;
  refundAmount?: number | null;
  bookingsUrl: string;
}): EmailContent {
  const refunded = Boolean(input.refundAmount && input.refundAmount > 0);
  return render({
    subject: refunded
      ? `Booking canceled and refunded: ${input.tourTitle} (${input.bookingRef})`
      : `Booking canceled: ${input.tourTitle} (${input.bookingRef})`,
    preheader: refunded ? `A refund of ${formatPeso(input.refundAmount!)} has been issued.` : 'Your booking has been canceled.',
    heading: 'Your booking was canceled',
    greeting: `Hi ${greetingName(input.travelerName)},`,
    paragraphs: ['Your booking has been canceled and your seats were released.'],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
      ...(input.startDate ? ([['Dates', formatDateRange(input.startDate, input.endDate)]] as [string, string][]) : []),
      ...(refunded ? ([['Refund', formatPeso(input.refundAmount!)]] as [string, string][]) : []),
    ],
    callout: refunded
      ? `We issued a refund of ${formatPeso(input.refundAmount!)} to your original payment method. It usually reaches GCash or Maya within 5 to 10 business days.`
      : undefined,
    cta: { label: 'View my bookings', url: input.bookingsUrl },
  });
}

/** T-2 days trip reminder. */
export function tripReminderEmail(
  b: Omit<BookingSummary, 'amount'> & { organizerName?: string | null; bookingUrl: string }
): EmailContent {
  return render({
    subject: `Your trip is coming up: ${b.tourTitle} on ${formatDate(b.startDate)}`,
    preheader: `${b.tourTitle} starts ${formatDate(b.startDate)}. Here are your booking details.`,
    heading: 'Your trip is almost here',
    greeting: `Hi ${greetingName(b.travelerName)},`,
    paragraphs: [
      `${b.tourTitle} starts on ${formatDate(b.startDate)}. Bring a valid ID and your booking reference.`,
      'If you have questions about meeting points or what to bring, contact your organizer.',
    ],
    details: [
      ['Booking reference', b.bookingRef],
      ['Tour', b.tourTitle],
      ...(b.location ? ([['Location', b.location]] as [string, string][]) : []),
      ['Dates', formatDateRange(b.startDate, b.endDate)],
      ['Guests', String(b.seats)],
      ...(b.organizerName ? ([['Organizer', b.organizerName]] as [string, string][]) : []),
    ],
    cta: { label: 'View booking', url: b.bookingUrl },
  });
}

// ─── Disputes ───

export function disputeOpenedTravelerEmail(input: {
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  bookingsUrl: string;
}): EmailContent {
  return render({
    subject: `We received your dispute for ${input.bookingRef}`,
    preheader: 'Our team will review your dispute and get back to you.',
    heading: 'Your dispute was received',
    greeting: `Hi ${greetingName(input.travelerName)},`,
    paragraphs: [
      'Thank you for letting us know. Our team will review the booking with you and the organizer, and email you the outcome.',
      'The organizer will not be paid for this booking while the dispute is open.',
    ],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
    ],
    cta: { label: 'View my bookings', url: input.bookingsUrl },
  });
}

export function disputeOpenedOrganizerEmail(input: {
  organizerName?: string | null;
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  bookingsUrl: string;
}): EmailContent {
  return render({
    subject: `A traveler opened a dispute on ${input.bookingRef}`,
    preheader: 'The payout for this booking is on hold until the dispute is resolved.',
    heading: 'A dispute was opened on your booking',
    greeting: `Hi ${greetingName(input.organizerName)},`,
    paragraphs: [
      `${input.travelerName?.trim() || 'A traveler'} opened a dispute on a booking for ${input.tourTitle}.`,
      'The escrow release for this booking is on hold until our team resolves the dispute. We may contact you for details.',
    ],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
    ],
    cta: { label: 'View bookings', url: input.bookingsUrl },
  });
}

export function disputeResolvedEmail(input: {
  travelerName?: string | null;
  bookingRef: string;
  tourTitle: string;
  outcome: 'refunded' | 'denied';
  refundAmount?: number | null;
  bookingsUrl: string;
}): EmailContent {
  const refunded = input.outcome === 'refunded';
  return render({
    subject: refunded ? `Dispute resolved: refund issued for ${input.bookingRef}` : `Dispute resolved for ${input.bookingRef}`,
    preheader: refunded ? 'Your dispute was resolved in your favor and a refund was issued.' : 'Our team has reviewed your dispute.',
    heading: 'Your dispute has been resolved',
    greeting: `Hi ${greetingName(input.travelerName)},`,
    paragraphs: refunded
      ? ['Our team reviewed your dispute and decided in your favor.']
      : [
          'Our team reviewed your dispute and found that the booking was delivered as described, so no refund will be issued.',
          'If you have new information, reply to this email or contact support.',
        ],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
      ['Outcome', refunded ? 'Refunded' : 'Refund declined'],
      ...(refunded && input.refundAmount ? ([['Refund', formatPeso(input.refundAmount)]] as [string, string][]) : []),
    ],
    callout: refunded
      ? 'The refund goes to your original payment method and usually reaches GCash or Maya within 5 to 10 business days.'
      : undefined,
    cta: { label: 'View my bookings', url: input.bookingsUrl },
  });
}

// ─── Organizers and transporters ───

export function newBookingOrganizerEmail(input: {
  organizerName?: string | null;
  travelerName?: string | null;
  seats: number;
  tourTitle: string;
  bookingRef: string;
  bookingsUrl: string;
}): EmailContent {
  return render({
    subject: `New booking: ${input.tourTitle} (${input.bookingRef})`,
    preheader: `${input.seats} seat(s) booked and paid.`,
    heading: 'You have a new booking',
    greeting: `Hi ${greetingName(input.organizerName)},`,
    paragraphs: [`${input.travelerName?.trim() || 'A traveler'} booked and paid for ${input.seats} seat(s) on ${input.tourTitle}.`],
    details: [
      ['Booking reference', input.bookingRef],
      ['Tour', input.tourTitle],
      ['Guests', String(input.seats)],
    ],
    cta: { label: 'View bookings', url: input.bookingsUrl },
  });
}

export function transportRequestEmail(input: {
  transporterName?: string | null;
  startDate: string;
  endDate?: string | null;
  requestsUrl: string;
}): EmailContent {
  return render({
    subject: 'New transport request',
    preheader: `A tour organizer requested a vehicle for ${formatDateRange(input.startDate, input.endDate)}.`,
    heading: 'You have a new transport request',
    greeting: `Hi ${greetingName(input.transporterName)},`,
    paragraphs: [
      'A tour organizer has requested one of your vehicles for an upcoming tour schedule.',
      'Review the request, check your availability, and accept or decline it from your dashboard.',
    ],
    details: [['Dates', formatDateRange(input.startDate, input.endDate)]],
    cta: { label: 'View request', url: input.requestsUrl },
  });
}

export function transportRequestStatusEmail(input: {
  organizerName?: string | null;
  transporterName: string;
  status: 'accepted' | 'declined';
  scheduleUrl: string;
}): EmailContent {
  const accepted = input.status === 'accepted';
  return render({
    subject: `Transport request ${accepted ? 'accepted' : 'declined'}`,
    preheader: `${input.transporterName} ${input.status} your transport request.`,
    heading: `Transport request ${accepted ? 'accepted' : 'declined'}`,
    greeting: `Hi ${greetingName(input.organizerName)},`,
    paragraphs: [
      `${input.transporterName} has ${input.status} your transport request.`,
      accepted ? 'Your schedule now shows the transport as confirmed.' : 'You can request another transporter from your schedule.',
    ],
    cta: { label: 'View schedule', url: input.scheduleUrl },
  });
}

export function transportRequestCanceledEmail(input: {
  transporterName?: string | null;
  organizerName: string;
  tourTitle?: string | null;
  startDate: string;
  endDate?: string | null;
  wasAccepted: boolean;
  requestsUrl: string;
}): EmailContent {
  const details: [string, string][] = [['Dates', formatDateRange(input.startDate, input.endDate)]];
  if (input.tourTitle) details.unshift(['Tour', input.tourTitle]);
  return render({
    subject: 'Transport request canceled',
    preheader: `${input.organizerName} canceled a transport request for ${formatDateRange(input.startDate, input.endDate)}.`,
    heading: 'Transport request canceled',
    greeting: `Hi ${greetingName(input.transporterName)},`,
    paragraphs: [
      `${input.organizerName} canceled their transport request.`,
      input.wasAccepted
        ? 'The booked dates were released, so your vehicle is available for other requests again.'
        : 'No action is needed on your side.',
    ],
    details,
    cta: { label: 'View requests', url: input.requestsUrl },
  });
}

export function partnerAccountStatusEmail(input: {
  name?: string | null;
  partner: 'organizer' | 'transporter';
  status: 'activated' | 'deactivated';
  reason?: string | null;
  dashboardUrl: string;
}): EmailContent {
  const activated = input.status === 'activated';
  const next = input.partner === 'organizer' ? 'You can now start creating tours.' : 'You can now start managing your vehicles.';
  return render({
    subject: `Your ${input.partner} account was ${activated ? 'approved' : 'deactivated'}`,
    preheader: activated ? next : 'Your account has been deactivated.',
    heading: `Account ${activated ? 'approved' : 'deactivated'}`,
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: activated
      ? [`Your ${input.partner} account has been approved and activated. ${next}`]
      : [
          `Your ${input.partner} account has been deactivated.`,
          input.reason?.trim() ? `Reason: ${input.reason.trim()}` : 'Please contact support for more details.',
        ],
    cta: { label: 'Go to dashboard', url: input.dashboardUrl },
  });
}

// Admin tour moderation (actions/admin.ts adminUnpublishTour / adminRepublishTour).
export function tourModerationEmail(input: {
  name?: string | null;
  tourTitle: string;
  action: 'unpublished' | 'republished';
  reason?: string | null;
  toursUrl: string;
}): EmailContent {
  const unpublished = input.action === 'unpublished';
  return render({
    subject: unpublished ? `Your tour "${input.tourTitle}" was unpublished` : `Your tour "${input.tourTitle}" is live again`,
    preheader: unpublished ? 'The Travi team unpublished one of your tours.' : 'The Travi team re-published your tour.',
    heading: unpublished ? 'Your tour was unpublished' : 'Your tour is live again',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: unpublished
      ? [
          `The Travi team unpublished "${input.tourTitle}". Travelers can no longer find or book it. Existing bookings are not affected.`,
          ...(input.reason?.trim() ? [`Reason: ${input.reason.trim()}`] : []),
          'Please update the tour and contact support so we can review it again. It cannot be re-published until then.',
        ]
      : [`"${input.tourTitle}" has been reviewed and is published again. Travelers can find and book it.`],
    cta: { label: 'Go to my tours', url: input.toursUrl },
  });
}

// Partner review: admin asked for more information (actions/partner-review.ts requestMoreInfo).
export function partnerInfoRequestedEmail(input: {
  name?: string | null;
  partner: 'organizer' | 'transporter';
  note: string;
  profileUrl: string;
}): EmailContent {
  return render({
    subject: `We need more information about your ${input.partner} application`,
    preheader: 'Please update your details so we can finish reviewing your application.',
    heading: 'More information needed',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `We are reviewing your ${input.partner} application and need a little more information:`,
      input.note.trim(),
      'Please update your business details or upload the requested documents from your profile page.',
    ],
    cta: { label: 'Update my profile', url: input.profileUrl },
  });
}

// ─── Payouts (for actions/wallet.ts and actions/admin.ts) ───

export function payoutRequestedEmail(input: { name?: string | null; amount: number; methodName: string }): EmailContent {
  return render({
    subject: 'Payout request received',
    preheader: `We received your payout request for ${formatPeso(input.amount)}.`,
    heading: 'Payout request received',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [`We received your payout request for ${formatPeso(input.amount)} via ${input.methodName}. It will be processed within 24 to 48 hours.`],
  });
}

export function payoutPaidEmail(input: { name?: string | null; amount: number; reference: string }): EmailContent {
  return render({
    subject: 'Payout completed',
    preheader: `Your payout of ${formatPeso(input.amount)} has been sent.`,
    heading: 'Your payout was sent',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: ["Your payout has been processed. The funds should reflect in your account shortly, depending on your bank's processing times."],
    details: [
      ['Amount', formatPeso(input.amount)],
      ['Reference number', input.reference],
    ],
  });
}

export function payoutRejectedEmail(input: { name?: string | null; amount: number; reason?: string | null }): EmailContent {
  return render({
    subject: 'Payout request rejected',
    preheader: 'Your payout request was rejected and the funds were returned to your balance.',
    heading: 'Your payout request was rejected',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `Your payout request for ${formatPeso(input.amount)} was rejected. The funds have been returned to your Travi available balance.`,
      ...(input.reason?.trim() ? [`Reason: ${input.reason.trim()}`] : []),
      'If you have questions, please contact our support team.',
    ],
  });
}

// ─── Support and privacy requests (actions/support.ts, actions/privacy.ts) ───

// Internal: a /contact form message, sent to the support inbox. Every value is user-supplied (escaped).
export function supportMessageEmail(input: {
  name: string;
  email: string;
  topicLabel: string;
  bookingRef?: string | null;
  message: string;
  signedIn: boolean;
  adminUrl: string;
}): EmailContent {
  return render({
    subject: `[Support] ${input.topicLabel}${input.bookingRef ? ` (${input.bookingRef})` : ''}`,
    preheader: `New message from ${input.name} via the contact form.`,
    heading: 'New support message',
    greeting: 'Hi team,',
    paragraphs: [input.message],
    details: [
      ['From', input.name],
      ['Email', input.email],
      ['Topic', input.topicLabel],
      ...(input.bookingRef ? ([['Booking reference', input.bookingRef]] as [string, string][]) : []),
      ['Signed in', input.signedIn ? 'Yes' : 'No'],
    ],
    callout: 'Reply to the sender from the support inbox, then update the status in the admin console.',
    cta: { label: 'Open in admin', url: input.adminUrl },
  });
}

export function dataRequestReceivedEmail(input: { name?: string | null; typeLabel: string; retentionNote: string }): EmailContent {
  return render({
    subject: `We received your request: ${input.typeLabel}`,
    preheader: 'Our privacy team will review your request.',
    heading: 'We received your request',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `We received your request (${input.typeLabel}). Our privacy team will review it and may contact you at this email address to verify your identity.`,
      input.retentionNote,
    ],
  });
}

export function dataRequestUpdatedEmail(input: {
  name?: string | null;
  typeLabel: string;
  status: 'in_progress' | 'completed' | 'rejected';
  note?: string | null;
}): EmailContent {
  const statusText = { in_progress: 'is being processed', completed: 'has been completed', rejected: 'could not be completed' }[input.status];
  return render({
    subject: `Your request ${statusText}: ${input.typeLabel}`,
    preheader: `Your request (${input.typeLabel}) ${statusText}.`,
    heading: `Your request ${statusText}`,
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `Your request (${input.typeLabel}) ${statusText}.`,
      ...(input.note?.trim() ? [`Note from our privacy team: ${input.note.trim()}`] : []),
      'If you have questions, please write to us through the contact page on the Travi website.',
    ],
  });
}

// ─── Account security (for lib/otp.ts and actions/profile.ts) ───

export function otpCodeEmail(input: { name?: string | null; code: string; purpose: string; minutes: number }): EmailContent {
  return render({
    subject: 'Your Travi verification code',
    preheader: `Your verification code to ${input.purpose}.`,
    heading: 'Your verification code',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `Use this code to ${input.purpose}. It expires in ${input.minutes} minutes and can be used once.`,
      'Travi will never ask you for this code by phone, chat or email. If you did not request it, ignore this email and consider changing your password.',
    ],
    callout: `Verification code: ${input.code}`,
  });
}

export function emailChangedNoticeEmail(input: { name?: string | null; newEmailMasked: string }): EmailContent {
  return render({
    subject: 'Your Travi email address was changed',
    preheader: 'The email address on your Travi account was changed.',
    heading: 'Your email address was changed',
    greeting: `Hi ${greetingName(input.name)},`,
    paragraphs: [
      `The email address on your Travi account was changed to ${input.newEmailMasked}. From now on, sign in and receive messages there.`,
      'If you did not make this change, contact Travi support immediately so we can secure your account.',
    ],
  });
}
