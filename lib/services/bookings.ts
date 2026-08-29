import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createBookingSchema } from '@/lib/schemas/booking';
import { captureException } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createBookingService(
  supabase: SupabaseClient,
  travelerProfileId: string,
  validatedData: z.infer<typeof createBookingSchema>
) {
  // Fetch the schedule to calculate amount and check capacity
  const { data: schedule, error: scheduleError } = await supabase
    .from('tour_schedules')
    .select('*, tours(price_per_person, slug, title)')
    .eq('id', validatedData.scheduleId)
    .single();

  if (scheduleError || !schedule) {
    throw new Error('Schedule not found.');
  }

  const remaining = schedule.capacity - (schedule.booked_count || 0);
  if (validatedData.seats > remaining) {
    throw new Error('Not enough seats available.');
  }

  const pricePerPerson = schedule.price_per_person ?? schedule.tours?.price_per_person;
  if (!pricePerPerson) {
    throw new Error('Price not configured.');
  }

  const totalAmount = pricePerPerson * validatedData.seats;

  // Create booking as pending
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tour_schedule_id: validatedData.scheduleId,
      traveler_id: travelerProfileId,
      seats: validatedData.seats,
      total_amount: totalAmount,
      status: 'pending' // Changed to pending for PayMongo integration
    })
    .select()
    .single();

  if (bookingError) {
    // If the database trigger / check constraint fails due to capacity, it throws a specific error
    if (bookingError.message.includes('check_capacity_not_exceeded')) {
      throw new Error('Not enough seats available.');
    }
    captureException(bookingError, { action: 'createBookingService', scheduleId: validatedData.scheduleId, seats: validatedData.seats });
    throw new Error(`Failed to create booking: ${bookingError.message} / ${bookingError.details}`);
  }

  return {
    bookingId: booking.id,
    bookingRef: booking.booking_ref,
    totalAmount,
    slug: schedule.tours.slug,
    title: schedule.tours.title
  };
}

