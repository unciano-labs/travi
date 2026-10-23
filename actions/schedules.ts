'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { ZodError } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { manilaToday } from '@/lib/datetime';
import {
  cancelScheduleSchema,
  parseScheduleForm,
  scheduleIdsSchema,
  type ScheduleFormInput,
} from '@/lib/schemas/schedule';
import type { ScheduleCancelFailure } from '@/lib/services/schedules';

type Failure = { success: false; error: string };

function toMessage(error: unknown, fallback: string): string {
  if (error instanceof ZodError) return error.issues[0]?.message ?? fallback;
  // Supabase errors are plain objects with a `message`.
  const raw = (error as { message?: unknown } | null)?.message;
  const message = typeof raw === 'string' ? raw : '';
  if (message.includes('check_capacity_not_exceeded')) return 'Capacity cannot be lower than the seats already booked.';
  // 55000: the transport trigger refuses date changes while a transporter has accepted the trip.
  if ((error as { code?: unknown } | null)?.code === '55000') {
    return message || 'A transporter has accepted this date, so its dates cannot change. Cancel the transport request first.';
  }
  return message || fallback;
}

function fail(error: unknown, action: string, context: Record<string, unknown>, fallback: string): Failure {
  captureException(error, { action, ...context });
  return { success: false, error: toMessage(error, fallback) };
}

/** Session + organizer role (+ rate limit) + ownership of the tour. Throws on any failure. */
async function organizerTour(tourId: string, { rateLimit = true } = {}) {
  const { user, profile, supabase } = await requireSession();
  await assertRole(user.id, 'organizer');
  if (rateLimit) await assertRateLimit(profile.id, 'mutation');

  const { data: organizer } = await supabase
    .from('organizer_profiles')
    .select('id')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!organizer) throw new Error('Organizer profile not found.');

  const { data: tour } = await supabase
    .from('tours')
    .select('id, organizer_id, format, deleted_at')
    .eq('id', tourId)
    .eq('organizer_id', organizer.id)
    .maybeSingle();
  if (!tour) throw new Error('Tour not found.');

  return { profile, supabase, organizerId: organizer.id as string, tour };
}

function transportStatusFor(type: ScheduleFormInput['transport_type']) {
  if (type === 'none') return 'not_required';
  if (type === 'self_provided') return 'self_provided';
  return 'unresolved';
}

function revalidateSchedulePages(tourId: string, scheduleId?: string) {
  updateTag('tours');
  revalidatePath(`/dashboard/organizer/tours/${tourId}/edit`);
  if (scheduleId) revalidatePath(`/dashboard/organizer/tours/${tourId}/schedules/${scheduleId}`);
}

export async function createSchedule(tourId: string, formData: FormData): Promise<{ success: true } | Failure> {
  try {
    const data = parseScheduleForm(formData);
    const { tourId: id } = scheduleIdsSchema.pick({ tourId: true }).parse({ tourId });
    const ctx = await organizerTour(id);
    if (ctx.tour.deleted_at) throw new Error('This tour is archived. Restore it before adding dates.');
    if (data.startDate <= manilaToday()) throw new Error('New schedules must start after today.');

    const { data: schedule, error } = await ctx.supabase
      .from('tour_schedules')
      .insert({
        tour_id: id,
        start_date: data.startDate,
        end_date: data.endDate,
        capacity: data.capacity,
        price_per_person: data.price_per_person ?? null,
        original_price: data.original_price ?? null,
        transport_type: data.transport_type,
        transport_status: transportStatusFor(data.transport_type),
        status: 'open',
      })
      .select('id')
      .single();
    if (error) throw error;

    revalidateSchedulePages(id, schedule.id);
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'createSchedule', { tourId }, 'Failed to create the schedule.');
  }
}

export async function updateSchedule(
  scheduleId: string,
  tourId: string,
  formData: FormData
): Promise<{ success: true } | Failure> {
  try {
    const data = parseScheduleForm(formData);
    const ids = scheduleIdsSchema.parse({ scheduleId, tourId });
    const ctx = await organizerTour(ids.tourId);

    const { data: schedule } = await ctx.supabase
      .from('tour_schedules')
      .select('id, status, deleted_at, capacity, booked_count, transport_type, transport_status')
      .eq('id', ids.scheduleId)
      .eq('tour_id', ids.tourId)
      .maybeSingle();
    if (!schedule || schedule.deleted_at) throw new Error('Schedule not found.');
    if (schedule.status === 'cancelled') throw new Error('This schedule is cancelled and can no longer be edited.');

    // BIZ-19: friendly versions of the DB guards (check_capacity_not_exceeded stays the real one).
    const booked = Number(schedule.booked_count) || 0;
    if (data.capacity < booked) {
      throw new Error(`${booked} seat${booked === 1 ? ' is' : 's are'} already booked on this date, so capacity can't be lower than ${booked}.`);
    }
    if (ctx.tour.format === 'private' && booked > 0 && data.capacity !== schedule.capacity) {
      throw new Error(`This private date is already booked for a group of ${schedule.capacity}. Its capacity can't change.`);
    }

    // Keep the transport status (e.g. a confirmed vehicle) unless the transport type changes, and
    // never drop a pending/confirmed vehicle request by switching the type.
    const typeChanged = data.transport_type !== schedule.transport_type;
    if (typeChanged && (schedule.transport_status === 'pending' || schedule.transport_status === 'confirmed')) {
      throw new Error('This date has an active vehicle request. Cancel it before changing the transport type.');
    }
    const transportStatus = typeChanged ? transportStatusFor(data.transport_type) : schedule.transport_status;

    const { error } = await ctx.supabase
      .from('tour_schedules')
      .update({
        start_date: data.startDate,
        end_date: data.endDate,
        capacity: data.capacity,
        price_per_person: data.price_per_person ?? null,
        original_price: data.original_price ?? null,
        transport_type: data.transport_type,
        transport_status: transportStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ids.scheduleId)
      .eq('tour_id', ids.tourId);
    if (error) throw error;

    revalidateSchedulePages(ids.tourId, ids.scheduleId);
    return { success: true };
  } catch (error: unknown) {
    return fail(error, 'updateSchedule', { scheduleId, tourId }, 'Failed to update the schedule.');
  }
}

export interface ScheduleCancellationBooking {
  id: string;
  bookingRef: string | null;
  status: 'pending' | 'confirmed';
  seats: number;
  totalAmount: number;
  travelerName: string | null;
}

/** Bookings a cancellation would affect, for the confirmation dialog. Organizer-owned schedules only. */
export async function getScheduleCancellationPreview(
  scheduleId: string,
  tourId: string
): Promise<{ success: true; bookings: ScheduleCancellationBooking[]; startDate: string; endDate: string; status: string } | Failure> {
  try {
    const ids = scheduleIdsSchema.parse({ scheduleId, tourId });
    const ctx = await organizerTour(ids.tourId, { rateLimit: false });

    const { data: schedule } = await ctx.supabase
      .from('tour_schedules')
      .select('id, start_date, end_date, status, deleted_at')
      .eq('id', ids.scheduleId)
      .eq('tour_id', ids.tourId)
      .maybeSingle();
    if (!schedule || schedule.deleted_at) throw new Error('Schedule not found.');

    const { data: rows, error } = await ctx.supabase
      .from('bookings')
      .select('id, booking_ref, status, seats, total_amount, traveler:user_profiles!traveler_id ( full_name )')
      .eq('tour_schedule_id', ids.scheduleId)
      .in('status', ['pending', 'confirmed'])
      .order('created_at', { ascending: true });
    if (error) throw error;

    const bookings = (rows ?? []).map((b) => {
      const traveler = Array.isArray(b.traveler) ? b.traveler[0] : b.traveler;
      return {
        id: b.id as string,
        bookingRef: (b.booking_ref as string | null) ?? null,
        status: b.status as 'pending' | 'confirmed',
        seats: Number(b.seats),
        totalAmount: Number(b.total_amount),
        travelerName: (traveler as { full_name?: string | null } | null)?.full_name ?? null,
      };
    });

    return { success: true, bookings, startDate: schedule.start_date, endDate: schedule.end_date, status: schedule.status };
  } catch (error: unknown) {
    unstable_rethrow(error);
    return fail(error, 'getScheduleCancellationPreview', { scheduleId, tourId }, 'Could not load the bookings for this schedule.');
  }
}

/**
 * Organizer "Cancel schedule" (BIZ-04): the schedule is cancelled, unpaid bookings are canceled and
 * paid ones fully refunded, and every traveler is told. Safe to call again to retry failed refunds.
 */
export async function cancelSchedule(
  input: unknown
): Promise<{ success: true; canceled: number; refunded: number } | (Failure & { failed?: ScheduleCancelFailure[] })> {
  let ids: { scheduleId: string; tourId: string } | null = null;
  try {
    const data = cancelScheduleSchema.parse(input);
    ids = { scheduleId: data.scheduleId, tourId: data.tourId };
    const ctx = await organizerTour(data.tourId);

    const { data: schedule } = await ctx.supabase
      .from('tour_schedules')
      .select('id, start_date, status, deleted_at')
      .eq('id', data.scheduleId)
      .eq('tour_id', data.tourId)
      .maybeSingle();
    if (!schedule || schedule.deleted_at) throw new Error('Schedule not found.');

    const { count: active } = await ctx.supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('tour_schedule_id', data.scheduleId)
      .in('status', ['pending', 'confirmed']);
    if ((active ?? 0) > 0 && schedule.start_date <= manilaToday()) {
      throw new Error('This trip has already started, so it can no longer be cancelled here. Please contact support.');
    }

    const { cancelScheduleWithBookings } = await import('@/lib/services/schedules');
    const result = await cancelScheduleWithBookings(data.scheduleId, ctx.profile.id, 'organizer');

    await logMutation({
      adminProfileId: ctx.profile.id,
      entityType: 'tour_schedule',
      entityId: data.scheduleId,
      action: 'schedule_cancelled',
      notes: data.reason || 'Cancelled by organizer',
      diff: { canceled: result.canceled, refunded: result.refunded, failed: result.failed.map((f) => f.bookingId) },
    });

    revalidateSchedulePages(data.tourId, data.scheduleId);
    revalidatePath('/dashboard/organizer/bookings');
    revalidatePath('/dashboard/traveler/bookings');

    if (result.failed.length > 0) {
      return {
        success: false,
        error: `The schedule is cancelled, but ${result.failed.length} booking${result.failed.length === 1 ? '' : 's'} could not be refunded yet. Try again; if it keeps failing, contact support.`,
        failed: result.failed,
      };
    }
    return { success: true, canceled: result.canceled, refunded: result.refunded };
  } catch (error: unknown) {
    return fail(error, 'cancelSchedule', { ...(ids ?? {}) }, 'Failed to cancel the schedule.');
  }
}
