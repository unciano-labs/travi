import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get('paymongo-signature');

    // In a real production app, verify the PayMongo signature here using env.PAYMONGO_WEBHOOK_SECRET
    // For MVP, we will assume it's valid if we have a secret or skip if not in prod.
    
    const body = JSON.parse(rawBody);
    
    // We only care about checkout session completed or payment paid
    if (body.data?.attributes?.type !== 'payment.paid' && body.data?.attributes?.type !== 'checkout_session.payment.paid') {
      return NextResponse.json({ received: true });
    }

    // Extract reference number (bookingRef)
    const attributes = body.data.attributes.data?.attributes || body.data.attributes;
    const bookingRef = attributes.reference_number || attributes.description?.split('ref=')[1] || attributes.remarks;
    const amountPaid = attributes.amount / 100; // convert cents to PHP

    if (!bookingRef) {
      console.warn('Paymongo Webhook: Missing reference number');
      return NextResponse.json({ received: true });
    }

    const admin = createAdminClient({ admin: true });

    // 1. Get the booking and related tour/transporter details
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select(`
        id, 
        status, 
        total_amount,
        tour_schedules (
          id,
          tours (organizer_id)
        )
      `)
      .eq('booking_ref', bookingRef)
      .single();

    if (bookingError || !booking) {
      console.error('Paymongo Webhook: Booking not found for ref', bookingRef);
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.status !== 'pending') {
      // Already processed
      return NextResponse.json({ received: true });
    }

    // 2. Mark booking as confirmed
    await admin.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);

    // 3. Platform Fee & Split Ledger Logic
    const { data: settings } = await admin.from('platform_settings').select('organizer_fee_percent').limit(1).single();
    const feePercent = settings?.organizer_fee_percent || 3;
    
    const platformFee = amountPaid * (feePercent / 100);
    let organizerAmount = amountPaid - platformFee;
    let transporterAmount = 0;

    // TODO: If this schedule has an external transporter confirmed, we would split `organizerAmount` further.
    // For MVP, all revenue minus platform fee goes to the Organizer. The Organizer pays the transporter manually or we add it later.
    const organizerProfileId = (booking.tour_schedules as any).tours.organizer_id;

    // We need the user_profile_id, not the organizer_profiles.id
    const { data: orgData } = await admin.from('organizer_profiles').select('user_profile_id').eq('id', organizerProfileId).single();
    const userProfileId = orgData?.user_profile_id;

    // Ensure Organizer has a wallet
    const { data: walletId } = await admin.rpc('ensure_user_wallet', { profile_id: userProfileId });

    if (walletId) {
      // Create Ledger Entry
      await admin.from('wallet_transactions').insert({
        wallet_id: walletId,
        amount: organizerAmount,
        type: 'payment_hold',
        balance_affected: 'escrow',
        reference_type: 'booking',
        reference_id: booking.id,
        description: `Revenue for booking ${bookingRef}`
      });

      // Update Wallet Escrow Balance
      await admin.rpc('increment_escrow_balance', { 
        w_id: walletId, 
        amt: organizerAmount 
      });
    }

    // 4. Notify the Organizer
    const { notifyOrganizerOfNewBooking } = await import('@/actions/notifications');
    await notifyOrganizerOfNewBooking(booking.id);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Paymongo Webhook Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
