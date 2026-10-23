import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { refundBooking } from '@/lib/services/refunds';
import { notifyTransporterOfCancellation, notifyTravelerBookingCanceled } from '@/lib/notifications';

export interface ScheduleCancelFailure {
  bookingId: string;
  bookingRef: string | null;
  error: string;
}

export interface ScheduleCancelResult {
  /** Unpaid (pending) bookings canceled. */
  canceled: number;
  /** Paid bookings canceled with a full refund. */
  refunded: number;
  /** Bookings still active; calling this again retries only these. */
  failed: ScheduleCancelFailure[];
  /** Transport requests canceled. */
  transportCanceled: number;
}

/**
 * Cancel a tour schedule and every active booking on it (BIZ-04). Not a Server Action: the caller
 * must already have checked that `initiatedBy` may cancel this schedule.
 *
 * 1. The schedule becomes `cancelled` first, so no new booking can be made (booking_quote() refuses)
 *    and any payment that still arrives is flagged for refund (confirm_booking_payment()).
 * 2. Pending bookings are canceled (status-guarded) and the traveler is told.
 * 3. Confirmed bookings get a full refund through refundBooking(), which also tells the traveler.
 * 4. Any pending/accepted transport request is canceled (the DB releases the vehicle's dates) and the
 *    transporter is told.
 *
 * Idempotent per booking: a booking that already left pending/confirmed is skipped, and a refund that
 * is already in progress fails cleanly in begin_booking_refund(). Failures are returned, not thrown,
 * so one bad refund does not stop the others; run it again to retry.
 */
export async function cancelScheduleWithBookings(
  scheduleId: string,
  initiatedBy: string,
  initiatedRole: 'organizer' | 'admin'
): Promise<ScheduleCancelResult> {
  // Service role: cancels other users' bookings and moves money (AGENTS.md §5.3). Callers authorize.
  const admin = createAdminClient({ admin: true });

  const { error: scheduleError } = await admin
    .from('tour_schedules')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', scheduleId);
  if (scheduleError) throw scheduleError;

  const { data: bookings, error: bookingsError } = await admin
    .from('bookings')
    .select('id, booking_ref, status')
    .eq('tour_schedule_id', scheduleId)
    .in('status', ['pending', 'confirmed'])
    .order('created_at', { ascending: true });
  if (bookingsError) throw bookingsError;

  const result: ScheduleCancelResult = { canceled: 0, refunded: 0, failed: [], transportCanceled: 0 };

  for (const booking of bookings ?? []) {
    try {
      let status = booking.status as string;

      if (status === 'pending') {
        const { data: updated, error } = await admin
          .from('bookings')
          .update({ status: 'canceled', updated_at: new Date().toISOString() })
          .eq('id', booking.id)
          .eq('status', 'pending')
          .select('id');
        if (error) throw error;
        if (updated && updated.length > 0) {
          result.canceled += 1;
          await notifyTravelerBookingCanceled(booking.id);
          continue;
        }
        // It changed under us (most likely a payment just confirmed it): look again.
        const { data: fresh } = await admin.from('bookings').select('status').eq('id', booking.id).single();
        status = (fresh?.status as string | undefined) ?? 'unknown';
      }

      if (status === 'confirmed') {
        await refundBooking({
          bookingId: booking.id,
          reason: 'organizer_cancel',
          initiatedBy,
          initiatedRole,
          bookingStatus: 'canceled',
        });
        result.refunded += 1;
      }
    } catch (error: unknown) {
      captureException(error, { action: 'cancelScheduleWithBookings', scheduleId, bookingId: booking.id });
      result.failed.push({
        bookingId: booking.id,
        bookingRef: (booking.booking_ref as string | null) ?? null,
        error: error instanceof Error ? error.message : 'Refund failed',
      });
    }
  }

  result.transportCanceled = await cancelScheduleTransport(admin, scheduleId);
  return result;
}

// Cancel the schedule's active vehicle request so the transporter is not left holding the dates.
async function cancelScheduleTransport(admin: ReturnType<typeof createAdminClient>, scheduleId: string) {
  try {
    const { data: requests } = await admin
      .from('transport_bookings')
      .select('id, status, transporter_id, tour_schedules ( start_date, end_date, tours ( title, organizer_profiles ( display_name, company_name ) ) )')
      .eq('tour_schedule_id', scheduleId)
      .in('status', ['pending', 'accepted'])
      .is('deleted_at', null);

    let canceled = 0;
    for (const request of requests ?? []) {
      const { data: updated, error } = await admin
        .from('transport_bookings')
        .update({ status: 'canceled', updated_at: new Date().toISOString() })
        .eq('id', request.id)
        .in('status', ['pending', 'accepted'])
        .select('id');
      if (error) {
        captureException(error, { action: 'cancelScheduleTransport', scheduleId, transportBookingId: request.id });
        continue;
      }
      if (!updated || updated.length === 0) continue;
      canceled += 1;

      const schedule = request.tour_schedules as unknown as {
        start_date: string;
        end_date: string;
        tours: { title: string; organizer_profiles: { display_name: string | null; company_name: string | null } | null } | null;
      } | null;
      const organizer = schedule?.tours?.organizer_profiles;
      await notifyTransporterOfCancellation(request.transporter_id as string, {
        organizerName: organizer?.display_name || organizer?.company_name || 'The organizer',
        tourTitle: schedule?.tours?.title ?? null,
        startDate: schedule?.start_date ?? '',
        endDate: schedule?.end_date ?? null,
        wasAccepted: request.status === 'accepted',
      });
    }
    return canceled;
  } catch (error: unknown) {
    captureException(error, { action: 'cancelScheduleTransport', scheduleId });
    return 0;
  }
}
