'use server';

import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';

const createBookingSchema = z.object({
  scheduleId: z.string().uuid('Invalid schedule ID'),
  seats: z.number().int().min(1, 'Must book at least 1 seat')
});

export async function createBooking(scheduleId: string, seats: number) {
  try {
    const validated = createBookingSchema.parse({ scheduleId, seats });
    
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'traveler');
    await assertRateLimit(profile.id, 'mutation');

    // Fetch the schedule to calculate amount and check capacity
    const { data: schedule, error: scheduleError } = await supabase
      .from('tour_schedules')
      .select('*, tours(price_per_person, slug)')
      .eq('id', validated.scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return { success: false, error: 'Schedule not found.' };
    }

    const remaining = schedule.capacity - (schedule.booked_count || 0);
    if (validated.seats > remaining) {
      return { success: false, error: 'Not enough seats available.' };
    }

    const pricePerPerson = schedule.price_per_person ?? schedule.tours?.price_per_person;
    if (!pricePerPerson) {
      return { success: false, error: 'Price not configured.' };
    }

    const totalAmount = pricePerPerson * validated.seats;

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        tour_schedule_id: validated.scheduleId,
        traveler_id: profile.id,
        seats: validated.seats,
        total_amount: totalAmount,
        status: 'confirmed'
      })
      .select()
      .single();

    if (bookingError) {
      captureException(bookingError, { action: 'createBooking', scheduleId, seats });
      return { success: false, error: `Failed to create booking: ${bookingError.message} / ${bookingError.details}` };
    }

    // Update the booked_count in tour_schedules using admin client (bypasses RLS since traveler can't update schedule)
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase = createAdminClient({ admin: true });

    await adminSupabase
      .from('tour_schedules')
      .update({ booked_count: (schedule.booked_count || 0) + validated.seats })
      .eq('id', validated.scheduleId);

    // Revalidate paths and tags to update the dashboard and tour page UI
    const { revalidatePath, updateTag } = await import('next/cache');
    updateTag('tours');
    revalidatePath('/dashboard', 'layout');
    revalidatePath(`/tours/${schedule.tours.slug}`, 'page');

    return {
      success: true,
      bookingId: booking.id,
      slug: schedule.tours.slug
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
