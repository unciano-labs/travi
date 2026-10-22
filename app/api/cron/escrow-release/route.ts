import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { subDays, formatISO } from 'date-fns';
import { captureException } from '@/lib/logger';

function isAuthorizedCron(authHeader: string | null) {
  if (!env.CRON_SECRET || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(authHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export async function GET(request: Request) {
  // 1. Verify cron secret. Fail closed: with no secret configured, nobody can run the job.
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const admin = createAdminClient({ admin: true });

    // 2. Fetch Platform Settings
    const { data: settings, error: settingsError } = await admin
      .from('platform_settings')
      .select('escrow_holding_days, transporter_fee_percent')
      .limit(1)
      .single();

    if (settingsError) throw new Error(`Failed to fetch platform settings: ${settingsError.message}`);

    const holdingDays = settings?.escrow_holding_days || 3;
    const transporterFeePercent = settings?.transporter_fee_percent || 3.0;

    // Calculate threshold date (bookings ending on or before this date should be released)
    const thresholdDate = formatISO(subDays(new Date(), holdingDays), { representation: 'date' });

    // 3. Process Escrow Releases for Bookings
    const { data: bookings, error: bookingsError } = await admin
      .from('bookings')
      .select(`
        id, 
        booking_ref,
        total_amount,
        tour_schedules!inner (
          id,
          end_date,
          tours (organizer_id)
        )
      `)
      .eq('status', 'confirmed')
      .in('dispute_status', ['none', 'resolved_denied'])
      .lte('tour_schedules.end_date', thresholdDate);

    if (bookingsError) throw new Error(`Failed to fetch bookings: ${bookingsError.message}`);
    console.log(`Cron query returned ${bookings?.length} bookings. Threshold date: ${thresholdDate}`);

    const results = {
      bookingsFound: bookings?.length || 0,
      thresholdDate: thresholdDate,
      bookingsProcessed: 0,
      transporterPaymentsProcessed: 0,
      errors: [] as string[]
    };

    for (const booking of bookings || []) {
      try {
        const organizerProfileId = (booking.tour_schedules as any).tours.organizer_id;
        const { data: orgData } = await admin.from('organizer_profiles').select('user_profile_id').eq('id', organizerProfileId).single();
        const userProfileId = orgData?.user_profile_id;
        
        const { data: walletId } = await admin.rpc('ensure_user_wallet', { profile_id: userProfileId });

        if (!walletId) throw new Error(`Wallet not found for organizer ${organizerProfileId}`);

        // Find the original escrow deposit
        const { data: depositTx } = await admin
          .from('wallet_transactions')
          .select('amount, id')
          .eq('reference_id', booking.id)
          .eq('type', 'payment_hold')
          .single();

        if (depositTx) {
          const releaseAmount = depositTx.amount;

          // Check if already released
          const { data: existingRelease } = await admin
            .from('wallet_transactions')
            .select('id')
            .eq('reference_id', booking.id)
            .eq('type', 'escrow_release')
            .maybeSingle();

          if (!existingRelease) {
            // Deduct from escrow
            await admin.rpc('increment_escrow_balance', { w_id: walletId, amt: -releaseAmount });
            // Add to available
            await admin.rpc('increment_available_balance', { w_id: walletId, amt: releaseAmount });

            // Record release transaction
            await admin.from('wallet_transactions').insert({
              wallet_id: walletId,
              amount: releaseAmount,
              type: 'escrow_release',
              balance_affected: 'available',
              reference_type: 'booking',
              reference_id: booking.id,
              description: `Escrow release for booking ${booking.booking_ref}`
            });

            // Mark booking as completed
            await admin.from('bookings').update({ status: 'completed' }).eq('id', booking.id);
            results.bookingsProcessed++;
          }
        }
      } catch (err: any) {
        captureException(err, { action: 'cron_escrow_release', bookingId: booking.id });
        results.errors.push(`Booking ${booking.id}: ${err.message}`);
      }
    }

    // 4. Process Transporter Payments
    // Find all accepted transport bookings where the tour ended past the threshold
    const { data: transportBookings, error: transportError } = await admin
      .from('transport_bookings')
      .select(`
        id,
        organizer_id,
        transporter_id,
        estimated_price,
        tour_schedules!inner (
          id,
          end_date
        )
      `)
      .eq('status', 'accepted')
      .lte('tour_schedules.end_date', thresholdDate);

    if (transportError) throw new Error(`Failed to fetch transport bookings: ${transportError.message}`);

    for (const tb of transportBookings || []) {
      if (!tb.estimated_price) continue;

      try {
        const { data: orgData } = await admin.from('organizer_profiles').select('user_profile_id').eq('id', tb.organizer_id).single();
        const { data: transData } = await admin.from('transporter_profiles').select('user_profile_id').eq('id', tb.transporter_id).single();

        const { data: orgWalletId } = await admin.rpc('ensure_user_wallet', { profile_id: orgData?.user_profile_id });
        const { data: transWalletId } = await admin.rpc('ensure_user_wallet', { profile_id: transData?.user_profile_id });

        if (!orgWalletId || !transWalletId) throw new Error('Missing wallets for transport split');

        // Check if this transport booking was already processed
        const { data: existingPayout } = await admin
          .from('wallet_transactions')
          .select('id')
          .eq('reference_id', tb.id)
          .eq('reference_type', 'transport_booking')
          .eq('type', 'manual_adjustment')
          .maybeSingle();

        if (!existingPayout) {
          const totalTransportCost = tb.estimated_price;
          const isSameUser = orgData?.user_profile_id === transData?.user_profile_id;
          const platformFee = isSameUser ? 0 : (totalTransportCost * (transporterFeePercent / 100));
          const transporterAmount = totalTransportCost - platformFee;

          // Deduct from Organizer Available Balance
          await admin.rpc('increment_available_balance', { w_id: orgWalletId, amt: -totalTransportCost });
          await admin.from('wallet_transactions').insert({
            wallet_id: orgWalletId,
            amount: -totalTransportCost,
            type: 'manual_adjustment',
            balance_affected: 'available',
            reference_type: 'transport_booking',
            reference_id: tb.id,
            description: `Payment deducted for transport service on schedule ${(tb.tour_schedules as any).id}`
          });

          // Add to Transporter Available Balance
          await admin.rpc('increment_available_balance', { w_id: transWalletId, amt: transporterAmount });
          await admin.from('wallet_transactions').insert({
            wallet_id: transWalletId,
            amount: transporterAmount,
            fee_amount: platformFee,
            type: 'manual_adjustment', // Or another type like transport_payment if added to DB
            balance_affected: 'available',
            reference_type: 'transport_booking',
            reference_id: tb.id,
            description: `Revenue for providing transport service on schedule ${(tb.tour_schedules as any).id}`
          });

          // Mark transport booking as completed
          await admin.from('transport_bookings').update({ status: 'completed' }).eq('id', tb.id);
          results.transporterPaymentsProcessed++;
        }
      } catch (err: any) {
        captureException(err, { action: 'cron_transport_payment', transportBookingId: tb.id });
        results.errors.push(`TransportBooking ${tb.id}: ${err.message}`);
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    captureException(error, { action: 'cron_escrow_release_route' });
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
