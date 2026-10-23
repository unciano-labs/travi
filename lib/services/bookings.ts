import { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { createBookingSchema } from '@/lib/schemas/booking';
import { captureException } from '@/lib/logger';
import { assertEmailVerified } from '@/lib/auth-helpers';
import { manilaToday } from '@/lib/datetime';

type ScheduleForBooking = {
  id: string;
  status: string;
  start_date: string;
  capacity: number;
  booked_count: number | null;
  price_per_person: number | null;
  deleted_at: string | null;
  tours: { price_per_person: number | null; slug: string; title: string; format: 'joiner' | 'private' | 'solo'; status: string } | null;
};

/**
 * Seats and price for a booking request (decision D3): a private tour books the whole group, at the
 * per-person price x capacity. Mirrors booking_quote() / booking_seats() in the database, which are
 * the real guards; this exists to give friendly errors before the insert.
 */
export function quoteBooking(schedule: Pick<ScheduleForBooking, 'capacity' | 'booked_count' | 'price_per_person' | 'tours'>, requestedSeats: number) {
  const isPrivate = schedule.tours?.format === 'private';
  const seats = isPrivate ? schedule.capacity : requestedSeats;
  const pricePerPerson = Number(schedule.price_per_person ?? schedule.tours?.price_per_person ?? 0);
  return { isPrivate, seats, pricePerPerson, totalAmount: pricePerPerson * seats };
}

export async function createBookingService(
  supabase: SupabaseClient,
  travelerProfileId: string,
  validatedData: z.infer<typeof createBookingSchema>,
  // The authenticated traveler (from requireSession), for the BIZ-12 gate.
  traveler: { email_confirmed_at?: string | null }
) {
  // BIZ-12: only travelers with a verified email can book (every entry point goes through here).
  assertEmailVerified(traveler);

  const { data, error: scheduleError } = await supabase
    .from('tour_schedules')
    .select('id, status, start_date, capacity, booked_count, price_per_person, deleted_at, tours(price_per_person, slug, title, format, status)')
    .eq('id', validatedData.scheduleId)
    .single();

  const schedule = data as unknown as ScheduleForBooking | null;
  if (scheduleError || !schedule || !schedule.tours) {
    throw new Error('Schedule not found.');
  }

  // BIZ-01: friendly versions of booking_quote()'s checks.
  if (schedule.deleted_at || schedule.tours.status !== 'published') {
    throw new Error('This tour is not available for booking.');
  }
  if (schedule.status !== 'open') {
    throw new Error('This schedule is not open for booking.');
  }
  if (schedule.start_date <= manilaToday()) {
    throw new Error('This schedule has already started.');
  }

  const quote = quoteBooking(schedule, validatedData.seats);
  const booked = schedule.booked_count || 0;
  if (quote.isPrivate && booked > 0) {
    throw new Error('This private tour date is already booked.');
  }
  if (quote.seats > schedule.capacity - booked) {
    throw new Error('Not enough seats available.');
  }
  if (!quote.pricePerPerson) {
    throw new Error('Price not configured.');
  }

  // Pending until paid. The database recomputes seats (private), price and status (bookings_before_insert).
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      tour_schedule_id: validatedData.scheduleId,
      traveler_id: travelerProfileId,
      seats: quote.seats,
      total_amount: quote.totalAmount,
      status: 'pending'
    })
    .select('id, booking_ref, seats, total_amount')
    .single();

  if (bookingError) {
    // The capacity CHECK is the final guard under concurrency.
    if (bookingError.message.includes('check_capacity_not_exceeded')) {
      throw new Error('Not enough seats available.');
    }
    // booking_quote() raises user-facing messages (closed/started/unpublished/private-taken schedule).
    if (bookingError.code === 'P0001') {
      throw new Error(bookingError.message);
    }
    captureException(bookingError, { action: 'createBookingService', scheduleId: validatedData.scheduleId, seats: validatedData.seats });
    throw new Error('Failed to create the booking. Please try again.');
  }

  return {
    bookingId: booking.id as string,
    bookingRef: booking.booking_ref as string,
    seats: Number(booking.seats),
    totalAmount: Number(booking.total_amount),
    slug: schedule.tours.slug,
    title: schedule.tours.title
  };
}
