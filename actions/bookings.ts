'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from './notifications';

import { createBookingSchema } from '@/lib/schemas/booking';

export async function createBooking(scheduleId: string, seats: number) {
  try {
    const validated = createBookingSchema.parse({ scheduleId, seats });
    
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');

    const { createBookingService } = await import('@/lib/services/bookings');
    const result = await createBookingService(supabase, profile.id, validated);

    // Generate PayMongo Checkout URL
    const host = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    // Redirect to custom in-app payment page instead of PayMongo Hosted Checkout
    const checkoutUrl = `${host}/tours/${result.slug}/booking/${result.bookingId}/pay`;

    // Revalidate paths and tags to update the dashboard and tour page UI
    const { revalidatePath, updateTag } = await import('next/cache');
    updateTag('tours');
    revalidatePath(`/tours/${result.slug}`);
    revalidatePath('/dashboard/traveler/bookings');
    
    await notifySuperAdmin(
      'New Booking Created',
      `A traveler booked ${seats} seats. Awaiting payment.`,
      'booking_created',
      '/admin/bookings'
    );

    return {
      success: true,
      bookingId: result.bookingId,
      checkoutUrl
    };
  } catch (error: any) {
    captureException(error, { action: 'createBooking exception', scheduleId, seats });
    return { 
      success: false, 
      error: error.message || 'An unexpected error occurred.',
      code: error.message === 'Unauthorized' ? 'unauthorized' : undefined
    };
  }
}

export async function updateBookingStatus(bookingId: string, status: 'confirmed' | 'canceled' | 'completed') {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');

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
      .eq('id', bookingId)
      .eq('tour_schedules.tours.organizer_id', orgProfile.id)
      .single();

    if (!booking) {
      throw new Error('Unauthorized or booking not found.');
    }

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });
    const { error } = await admin
      .from('bookings')
      .update({ status })
      .eq('id', bookingId);

    if (error) throw error;

    if (status === 'confirmed') {
      const { notifyOrganizerOfNewBooking } = await import('@/actions/notifications');
      await notifyOrganizerOfNewBooking(bookingId);
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/organizer/bookings');

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'updateBookingStatus exception', bookingId, status });
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

export async function verifyPaymentAndUpdateBooking(bookingId: string) {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });

    // 1. Get the booking
    const { data: booking, error: bookingError } = await admin
      .from('bookings')
      .select(`
        id, 
        status, 
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

    if (bookingError || !booking) throw new Error('Booking not found');

    if (booking.status === 'confirmed') {
      return { success: true, status: 'confirmed' };
    }

    if (!booking.paymongo_session_id) {
      return { success: false, error: 'No PayMongo session linked to this booking' };
    }

    // 2. Verify with PayMongo
    const { verifyCheckoutSession, verifyPaymentIntent } = await import('@/lib/paymongo');
    
    let isPaid = false;
    
    if (booking.paymongo_session_id.startsWith('pi_')) {
      const intentRes = await verifyPaymentIntent(booking.paymongo_session_id);
      isPaid = intentRes.status === 'succeeded';
    } else {
      const paymongoRes = await verifyCheckoutSession(booking.paymongo_session_id);
      isPaid = paymongoRes.status === 'paid';
    }

    if (isPaid) {
      // 3. Update to confirmed
      await admin.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id);

      // 4. Run ledger logic
      const { data: settings } = await admin.from('platform_settings').select('platform_fee_percent').limit(1).single();
      const feePercent = settings?.platform_fee_percent || 10;
      
      const platformFee = booking.total_amount * (feePercent / 100);
      const organizerAmount = booking.total_amount - platformFee;
      const organizerProfileId = (booking.tour_schedules as any).tours.organizer_id;

      const { data: walletId } = await admin.rpc('ensure_user_wallet', { profile_id: organizerProfileId });

      if (walletId) {
        // Check if already logged to prevent duplicates if webhook fired at the exact same time
        const { data: existingTx } = await admin.from('wallet_transactions')
          .select('id').eq('reference_id', booking.id).eq('type', 'payment_hold').maybeSingle();

        if (!existingTx) {
          await admin.from('wallet_transactions').insert({
            wallet_id: walletId,
            amount: organizerAmount,
            type: 'payment_hold',
            balance_affected: 'escrow',
            reference_type: 'booking',
            reference_id: booking.id,
            description: `Revenue for booking ${booking.booking_ref}`
          });
          await admin.rpc('increment_escrow_balance', { w_id: walletId, amt: organizerAmount });
        }
      }

      const { notifyOrganizerOfNewBooking } = await import('@/actions/notifications');
      await notifyOrganizerOfNewBooking(booking.id);

      return { success: true, status: 'confirmed' };
    }

    return { success: true, status: 'pending' };
  } catch (error: any) {
    captureException(error, { action: 'verifyPaymentAndUpdateBooking', bookingId });
    return { success: false, error: error.message };
  }
}

export async function processPayment(bookingId: string, method: 'gcash' | 'paymaya', returnUrl: string) {
  try {
    const { requireSession } = await import('@/lib/auth-helpers');
    const { user } = await requireSession();

    const { createAdminClient } = await import('@/lib/supabase/admin');
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin
      .from('bookings')
      .select('id, total_amount, booking_ref, paymongo_session_id')
      .eq('id', bookingId)
      .single();

    if (!booking) throw new Error('Booking not found');

    const { createPaymentIntent, createPaymentMethod, attachPaymentIntent } = await import('@/lib/paymongo');
    
    // Create Intent
    const amountCents = Math.round(booking.total_amount * 100);
    const intent = await createPaymentIntent(amountCents, `Travi Booking: ${booking.booking_ref}`);
    
    // Save the Intent ID to the booking so we can verify it later
    await admin.from('bookings').update({ paymongo_session_id: intent.id }).eq('id', booking.id);

    // Create Method
    const pm = await createPaymentMethod(method, {
      email: user.email,
      name: user.user_metadata?.full_name || 'Traveler'
    });

    // Attach
    const attachResult = await attachPaymentIntent(intent.id, pm.id, returnUrl);

    if (attachResult.next_action?.type === 'redirect') {
      return { success: true, redirectUrl: attachResult.next_action.redirect.url };
    }

    if (attachResult.status === 'succeeded') {
      return { success: true, redirectUrl: returnUrl }; // It was instantly paid
    }

    throw new Error('Failed to process payment attachment');
  } catch (error: any) {
    const { captureException } = await import('@/lib/logger');
    captureException(error, { action: 'processPayment', bookingId, method });
    return { success: false, error: error.message };
  }
}
