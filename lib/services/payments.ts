import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { getPaymentIntent, type PaymongoPayment } from '@/lib/paymongo';
import {
  notifyOrganizerOfNewBooking,
  notifySuperAdmin,
  notifyTravelerBookingConfirmed,
  notifyTravelerPaymentNeedsReview,
  type PaymentReviewReason,
} from '@/lib/notifications';

export type VerifyPaymentResult =
  | { success: true; status: 'confirmed' | 'pending' }
  | { success: false; error: string };

// Outcomes returned by the confirm_booking_payment() database function.
type ConfirmOutcome =
  | 'confirmed'
  | 'already_applied'
  | 'amount_mismatch'
  | 'duplicate_payment'
  | 'late_payment_needs_refund'
  | 'booking_closed_needs_refund';

const NEEDS_REVIEW: Record<string, string> = {
  amount_mismatch: 'The amount paid does not match the booking total.',
  duplicate_payment: 'This booking was already paid; the extra payment will be refunded.',
  late_payment_needs_refund: 'Your payment arrived after the booking expired and no seats are left. It will be refunded.',
  booking_closed_needs_refund: 'This booking is closed; the payment will be refunded.',
};

/**
 * Apply a PayMongo payment to a booking: confirm it, record the payment, and credit the organizer's
 * escrow, all inside the confirm_booking_payment() database function (atomic and idempotent, so the
 * success page and the webhook can both call this for the same payment).
 * `payment` must come from PayMongo's API, never from a request body.
 */
export async function applyPaidPayment(
  bookingId: string,
  intentId: string,
  payment: PaymongoPayment,
  expectedCentavos: number,
  source: 'return' | 'webhook'
): Promise<ConfirmOutcome> {
  // Service role: confirm_booking_payment() is not callable by end users (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const { data, error } = await admin.rpc('confirm_booking_payment', {
    p_booking_id: bookingId,
    p_payment_intent_id: intentId,
    p_provider_payment_id: payment.id,
    // Mock mode (dev only) has no amount; production always uses PayMongo's figure.
    p_amount_centavos: payment.amount ?? expectedCentavos,
    p_fee_centavos: payment.fee,
    p_source: source,
  });
  if (error) throw error;

  const outcome = data as ConfirmOutcome;
  // Notification helpers never throw: a failed email must not fail a confirmed payment.
  if (outcome === 'confirmed') {
    await Promise.all([notifyOrganizerOfNewBooking(bookingId), notifyTravelerBookingConfirmed(bookingId)]);
  } else if (outcome in NEEDS_REVIEW) {
    // The success page and the webhook both report the same payment: alert only on the first report.
    const firstReport = await notifyTravelerPaymentNeedsReview(bookingId, payment.id, outcome as PaymentReviewReason);
    if (firstReport) {
      captureException(new Error(`Payment needs review: ${outcome}`), { action: 'applyPaidPayment', bookingId, outcome, source });
      await notifySuperAdmin(
        'Payment needs review',
        `PayMongo payment ${payment.id} for booking ${bookingId}: ${outcome}. Refund or resolve it in PayMongo.`,
        'payment_review',
        '/admin/bookings'
      );
    }
  }
  return outcome;
}

/**
 * Verify a booking's payment when the traveler returns from PayMongo.
 * Not a Server Action: the caller must already have authenticated the traveler and passes their
 * user_profiles.id, which must own the booking.
 */
export async function verifyBookingPayment(bookingId: string, travelerProfileId: string): Promise<VerifyPaymentResult> {
  // Service role: read across RLS for the ownership check below (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select('id, status, traveler_id, total_amount, paymongo_session_id, booking_ref')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking || booking.traveler_id !== travelerProfileId) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status === 'confirmed' || booking.status === 'completed') {
    return { success: true, status: 'confirmed' };
  }

  if (!booking.paymongo_session_id) {
    return { success: false, error: 'No payment has been started for this booking.' };
  }
  if (!booking.paymongo_session_id.startsWith('pi_')) {
    return { success: false, error: `We could not verify this payment automatically. Contact support with reference ${booking.booking_ref}.` };
  }

  try {
    const intent = await getPaymentIntent(booking.paymongo_session_id);
    const paid = intent.payments.find((p) => p.status === 'paid');
    if (intent.status !== 'succeeded' || !paid) {
      return { success: true, status: 'pending' };
    }

    const outcome = await applyPaidPayment(booking.id, intent.id, paid, Math.round(booking.total_amount * 100), 'return');
    if (outcome === 'confirmed' || outcome === 'already_applied') {
      return { success: true, status: 'confirmed' };
    }
    return {
      success: false,
      error: `${NEEDS_REVIEW[outcome] ?? 'Your payment needs manual review.'} Reference: ${booking.booking_ref}.`,
    };
  } catch (error: unknown) {
    captureException(error, { action: 'verifyBookingPayment', bookingId });
    return { success: false, error: 'We received your payment but could not confirm the booking yet. Our team has been alerted.' };
  }
}
