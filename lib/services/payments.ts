import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { verifyCheckoutSession, verifyPaymentIntent } from '@/lib/paymongo';
import { notifyOrganizerOfNewBooking } from '@/lib/notifications';

export type VerifyPaymentResult =
  | { success: true; status: 'confirmed' | 'pending' }
  | { success: false; error: string };

/**
 * Confirm a booking after checking its payment with PayMongo.
 *
 * Not a Server Action: the caller must already have authenticated the traveler and passes their
 * user_profiles.id, which must own the booking. Only a `pending` booking can become `confirmed`;
 * a payment that arrives for a canceled/refunded/expired booking is reported for manual follow-up
 * instead of silently re-confirming it (AGENTS.md §4.3).
 */
export async function verifyBookingPayment(bookingId: string, travelerProfileId: string): Promise<VerifyPaymentResult> {
  // Service role: payment-driven status change + ledger write (AGENTS.md §5.3). Ownership checked below.
  const admin = createAdminClient({ admin: true });

  const { data: booking, error: bookingError } = await admin
    .from('bookings')
    .select(`
      id,
      status,
      traveler_id,
      total_amount,
      paymongo_session_id,
      booking_ref,
      tour_schedules (
        id,
        tours (organizer_id)
      )
    `)
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking || booking.traveler_id !== travelerProfileId) {
    return { success: false, error: 'Booking not found' };
  }

  if (booking.status === 'confirmed') {
    return { success: true, status: 'confirmed' };
  }

  if (!booking.paymongo_session_id) {
    return { success: false, error: 'No PayMongo session linked to this booking' };
  }

  let isPaid = false;
  if (booking.paymongo_session_id.startsWith('pi_')) {
    const intentRes = await verifyPaymentIntent(booking.paymongo_session_id);
    isPaid = intentRes.status === 'succeeded';
  } else {
    const paymongoRes = await verifyCheckoutSession(booking.paymongo_session_id);
    isPaid = paymongoRes.status === 'paid';
  }

  if (!isPaid) {
    return { success: true, status: 'pending' };
  }

  if (booking.status !== 'pending') {
    // Paid, but the booking expired or was canceled/refunded first. Flag it; never re-confirm.
    captureException(new Error('Payment received for a booking that is not pending'), {
      action: 'verifyBookingPayment late payment',
      bookingId,
      status: booking.status,
    });
    return {
      success: false,
      error: `This booking is ${booking.status} and can no longer be confirmed. If you were charged, contact support with reference ${booking.booking_ref}.`,
    };
  }

  // pending -> confirmed only. If another request confirmed it first, no rows match and we stop.
  const { data: updated, error: updateError } = await admin
    .from('bookings')
    .update({ status: 'confirmed' })
    .eq('id', booking.id)
    .eq('status', 'pending')
    .select('id');

  if (updateError) {
    captureException(updateError, { action: 'verifyBookingPayment confirm', bookingId });
    return { success: false, error: 'We received your payment but could not confirm the booking. Our team has been alerted.' };
  }
  if (!updated || updated.length === 0) {
    return { success: true, status: 'confirmed' };
  }

  // Ledger logic. Known defects FIN-01/FIN-02 (wrong wallet id, ledger type split) are fixed in Phase 2.
  const { data: settings } = await admin.from('platform_settings').select('organizer_fee_percent').limit(1).single();
  const feePercent = settings?.organizer_fee_percent || 3.0;

  const platformFee = booking.total_amount * (feePercent / 100);
  const organizerAmount = booking.total_amount - platformFee;
  const schedule = booking.tour_schedules as unknown as { tours: { organizer_id: string } } | null;
  const organizerProfileId = schedule?.tours.organizer_id;

  const { data: walletId } = await admin.rpc('ensure_user_wallet', { profile_id: organizerProfileId });

  if (walletId) {
    // Check if already logged to prevent duplicates if webhook fired at the exact same time
    const { data: existingTx } = await admin.from('wallet_transactions')
      .select('id')
      .eq('reference_id', booking.id)
      .eq('type', 'escrow_deposit')
      .maybeSingle();

    if (!existingTx) {
      await admin.from('wallet_transactions').insert({
        wallet_id: walletId,
        amount: organizerAmount,
        fee_amount: platformFee,
        type: 'escrow_deposit',
        balance_affected: 'escrow',
        reference_type: 'booking',
        reference_id: booking.id,
        description: `Revenue for booking ${booking.booking_ref}`
      });

      await admin.rpc('increment_escrow_balance', { w_id: walletId, amt: organizerAmount });
    }
  }

  await notifyOrganizerOfNewBooking(booking.id);

  return { success: true, status: 'confirmed' };
}
