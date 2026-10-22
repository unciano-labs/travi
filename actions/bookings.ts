'use server';

import { z } from 'zod';
import { requireSession, assertRole, assertEmailVerified } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from '@/lib/notifications';

import { createBookingSchema } from '@/lib/schemas/booking';

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

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/organizer/bookings');

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'updateBookingStatus exception', bookingId, status });
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}

const processPaymentSchema = z.object({
  bookingId: z.string().uuid(),
  method: z.enum(['gcash', 'paymaya']),
});

export async function processPayment(bookingId: string, method: 'gcash' | 'paymaya') {
  try {
    const data = processPaymentSchema.parse({ bookingId, method });
    const { user, profile } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: writes the PayMongo intent id. Ownership and status checked below.
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin
      .from('bookings')
      .select('id, status, traveler_id, total_amount, booking_ref, tour_schedules ( tours ( slug ) )')
      .eq('id', data.bookingId)
      .single();

    if (!booking || booking.traveler_id !== profile.id) throw new Error('Booking not found');
    if (booking.status !== 'pending') {
      throw new Error(`This booking is ${booking.status} and can no longer be paid.`);
    }

    const schedule = booking.tour_schedules as unknown as { tours: { slug: string } } | null;
    const slug = schedule?.tours.slug;
    if (!slug) throw new Error('Booking not found');

    // Build the return URL on the server so it can never point off-site.
    const { headers } = await import('next/headers');
    const { env } = await import('@/lib/env');
    const headerList = await headers();
    const origin = env.NEXT_PUBLIC_SITE_URL
      ?? `${headerList.get('x-forwarded-proto') ?? 'https'}://${headerList.get('host')}`;
    const returnUrl = `${origin}/tours/${slug}/booking/${booking.id}/success`;

    const { createPaymentIntent, createPaymentMethod, attachPaymentIntent } = await import('@/lib/paymongo');

    // Create Intent
    const amountCents = Math.round(booking.total_amount * 100);
    const intent = await createPaymentIntent(amountCents, `Travi Booking: ${booking.booking_ref}`, {
      booking_id: booking.id,
      booking_ref: booking.booking_ref,
    });

    // Save the Intent ID to the booking so we can verify it later (still pending, so nothing paid is overwritten)
    await admin.from('bookings').update({ paymongo_session_id: intent.id }).eq('id', booking.id).eq('status', 'pending');

    // Create Method
    const pm = await createPaymentMethod(data.method, {
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
    captureException(error, { action: 'processPayment', bookingId, method });
    return { success: false, error: error.message };
  }
}

const bookingIdSchema = z.string().uuid();
const disputeDecisionSchema = z.enum(['refund', 'deny']);

export async function cancelBookingAsTraveler(bookingId: string) {
  try {
    const id = bookingIdSchema.parse(bookingId);
    const { profile } = await requireSession();
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
    } else if (booking.status === 'confirmed') {
      // Paid: full refund (current policy, see AGENTS.md §4.3), escrow reversal, booking canceled.
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

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/traveler/bookings');

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'cancelBookingAsTraveler', bookingId });
    return { success: false, error: error.message };
  }
}

export async function openDispute(bookingId: string) {
  try {
    const id = bookingIdSchema.parse(bookingId);
    const { profile } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');
    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: open_booking_dispute() checks ownership, status and the dispute window under a row lock.
    const admin = createAdminClient({ admin: true });

    const { error } = await admin.rpc('open_booking_dispute', { p_booking_id: id, p_traveler_profile_id: profile.id });
    if (error) throw new Error(error.message);

    await notifySuperAdmin('Dispute opened', `A traveler opened a dispute on booking ${id}.`, 'dispute_opened', '/admin/bookings');

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/traveler/bookings');

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'openDispute', bookingId });
    return { success: false, error: error.message };
  }
}

export async function resolveDispute(bookingId: string, decision: 'refund' | 'deny') {
  try {
    const id = bookingIdSchema.parse(bookingId);
    const verdict = disputeDecisionSchema.parse(decision);
    const { user, profile } = await requireSession();
    await assertRole(user.id, 'admin');
    await assertRateLimit(profile.id, 'mutation');

    const { createAdminClient } = await import('@/lib/supabase/admin');
    // Service role: dispute resolution is an admin money operation (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });

    const { data: booking } = await admin.from('bookings').select('dispute_status').eq('id', id).single();
    if (!booking || booking.dispute_status !== 'open') throw new Error('No open dispute to resolve');

    if (verdict === 'refund') {
      const { refundBooking } = await import('@/lib/services/refunds');
      await refundBooking({
        bookingId: id,
        reason: 'dispute_refund',
        initiatedBy: profile.id,
        initiatedRole: 'admin',
        bookingStatus: 'refunded',
      });
    } else {
      const { error } = await admin.rpc('deny_booking_dispute', { p_booking_id: id, p_admin_profile_id: profile.id });
      if (error) throw new Error(error.message);
    }

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/admin/bookings');

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'resolveDispute', bookingId, decision });
    return { success: false, error: error.message };
  }
}
