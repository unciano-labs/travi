import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { createRefund, getPaymentIntent } from '@/lib/paymongo';

export interface RefundBookingInput {
  bookingId: string;
  /** Pesos. Omit for a full refund. */
  amount?: number;
  reason: 'traveler_cancel' | 'dispute_refund' | 'organizer_cancel' | 'admin_refund';
  initiatedBy: string;            // user_profiles.id
  initiatedRole: 'traveler' | 'organizer' | 'admin' | 'system';
  /** Status the booking ends in: 'canceled' for cancellations, 'refunded' for dispute refunds. */
  bookingStatus: 'canceled' | 'refunded';
}

/**
 * Refund a confirmed booking through PayMongo. Not a Server Action: callers authorize first.
 *
 * 1. begin_booking_refund() locks the booking and records a pending refund; a second concurrent
 *    attempt fails there, so the customer can never be refunded twice.
 * 2. PayMongo refund.
 * 3. complete_booking_refund() reverses the organizer's escrow and closes the booking in one
 *    transaction, or fail_booking_refund() frees the booking for a retry.
 */
export async function refundBooking(input: RefundBookingInput) {
  // Service role: refund functions are not callable by end users (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });

  const { data: refundId, error: beginError } = await admin.rpc('begin_booking_refund', {
    p_booking_id: input.bookingId,
    p_amount: input.amount ?? null,
    p_reason: input.reason,
    p_initiated_by: input.initiatedBy,
    p_initiated_role: input.initiatedRole,
  });
  if (beginError) throw new Error(beginError.message);

  try {
    const { data: refund } = await admin.from('booking_refunds').select('amount').eq('id', refundId).single();
    const paymentId = await findPaidPaymentId(input.bookingId);
    const providerRefund = await createRefund(
      paymentId,
      Math.round(Number(refund?.amount) * 100),
      input.reason === 'dispute_refund' ? 'others' : 'requested_by_customer',
      { booking_id: input.bookingId, refund_id: String(refundId) }
    );

    const { error: completeError } = await admin.rpc('complete_booking_refund', {
      p_refund_id: refundId,
      p_provider_refund_id: providerRefund.id,
      p_booking_status: input.bookingStatus,
    });
    if (completeError) {
      // The money left PayMongo but the ledger did not record it: must be fixed by hand.
      captureException(completeError, { action: 'refundBooking complete', bookingId: input.bookingId, refundId, providerRefundId: providerRefund.id });
      throw new Error('The refund was sent but could not be recorded. Our team has been alerted.');
    }
    return { refundId: String(refundId), providerRefundId: providerRefund.id };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Refund failed';
    // Only release the booking for retry if PayMongo did not refund (complete_* errors are handled above).
    if (!message.startsWith('The refund was sent')) {
      await admin.rpc('fail_booking_refund', { p_refund_id: refundId, p_error: message });
    }
    throw error;
  }
}

// The PayMongo payment to refund: the one recorded when the booking was confirmed, or (for bookings
// confirmed before booking_payments existed) the paid payment on the stored intent.
async function findPaidPaymentId(bookingId: string) {
  const admin = createAdminClient({ admin: true });
  const { data: recorded } = await admin
    .from('booking_payments')
    .select('provider_payment_id')
    .eq('booking_id', bookingId)
    .eq('status', 'applied')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recorded?.provider_payment_id) return recorded.provider_payment_id as string;

  const { data: booking } = await admin.from('bookings').select('paymongo_session_id').eq('id', bookingId).single();
  if (!booking?.paymongo_session_id?.startsWith('pi_')) {
    throw new Error('No PayMongo payment found for this booking.');
  }
  const intent = await getPaymentIntent(booking.paymongo_session_id);
  const paid = intent.payments.find((p) => p.status === 'paid');
  if (!paid) throw new Error('No paid PayMongo payment found for this booking.');
  return paid.id;
}
