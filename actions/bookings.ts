'use server';

import { createClient } from '@/lib/supabase/server';
import { getUserRoles } from './auth';

export async function createBooking(scheduleId: string, seats: number) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: 'Unauthorized', code: 'unauthorized' };
    }

    // Ensure user has traveler role
    const roles = await getUserRoles();
    if (!roles.includes('traveler')) {
      return { success: false, error: 'Only travelers can book tours.' };
    }

    // Fetch the schedule to calculate amount and check capacity
    const { data: schedule, error: scheduleError } = await supabase
      .from('tour_schedules')
      .select('*, tours(price_per_person, slug)')
      .eq('id', scheduleId)
      .single();

    if (scheduleError || !schedule) {
      return { success: false, error: 'Schedule not found.' };
    }

    const remaining = schedule.capacity - (schedule.booked_count || 0);
    if (seats > remaining) {
      return { success: false, error: 'Not enough seats available.' };
    }

    const pricePerPerson = schedule.price_per_person ?? schedule.tours?.price_per_person;
    if (!pricePerPerson) {
      return { success: false, error: 'Price not configured.' };
    }

    const totalAmount = pricePerPerson * seats;

    // Ensure user has a profile
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!profile) {
      return { success: false, error: 'User profile not found.' };
    }

    // Create booking
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert({
        tour_schedule_id: scheduleId,
        traveler_id: profile.id,
        seats,
        total_amount: totalAmount,
        status: 'confirmed'
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Booking error:', bookingError);
      return { success: false, error: `Failed to create booking: ${bookingError.message} / ${bookingError.details}` };
    }

    // Update the booked_count in tour_schedules using admin client (bypasses RLS since traveler can't update schedule)
    const { createClient: createAdminClient } = await import('@supabase/supabase-js');
    const adminSupabase = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!
    );
    
    await adminSupabase
      .from('tour_schedules')
      .update({ booked_count: (schedule.booked_count || 0) + seats })
      .eq('id', scheduleId);

    // Revalidate paths to update the dashboard and tour page UI
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard', 'layout');
    revalidatePath(`/tours/${schedule.tours.slug}`, 'page');

    return { 
      success: true, 
      bookingId: booking.id,
      slug: schedule.tours.slug // returning slug to help with redirect if needed
    };
  } catch (error: any) {
    console.error('Booking exception:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
}
