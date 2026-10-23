'use server';

// Transport coordination (decision D2: no on-platform transport payments; BIZ-23, BIZ-24).
// The database is the real guard (20261025110000_transport_coordination.sql + Phase 1 RLS):
// overlap checks, the booked availability row on accept, releases on decline/cancel, the
// completion date and frozen schedule dates. These actions add ownership pre-checks and friendly
// messages, keep tour_schedules.transport_status in step, notify, and audit.
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { createAdminClient } from '@/lib/supabase/admin';
import { formatBusinessDate, manilaDateOf, manilaDateTimeToIso, manilaToday } from '@/lib/datetime';
import {
  notifyOrganizerOfStatusChange,
  notifyTransporterOfCancellation,
  notifyTransporterOfRequest,
} from '@/lib/notifications';
import {
  declineTransportRequestSchema,
  sendTransportRequestSchema,
  transportRequestIdSchema,
  transportStatusFilterSchema,
  type TransportRequestView,
  type TransportStatus,
} from '@/lib/schemas/transport';
import {
  TransportError,
  isExpectedTransportError,
  loadPartnerContacts,
  requireOwnOrganizerId,
  requireOwnTransporterId,
  throwTransportDbError,
  toTransportFailure,
  transportCompletableFrom,
  type PartnerContact,
  type TransportFailure,
} from '@/lib/transport';

type ActionResult<T extends object = object> = ({ success: true } & T) | TransportFailure;

// ─── Reads ───

const REQUEST_SELECT = `
  id, status, created_at, pickup_location, dropoff_location, pickup_datetime, return_datetime,
  seats_required, organizer_id, transporter_id,
  vehicle:public_vehicles ( id, name, vehicle_type, plate_number, seat_capacity ),
  tour_schedule:tour_schedules ( id, start_date, end_date, tour:tours ( id, title, location ) ),
  organizer:public_organizer_profiles ( id, display_name, company_name ),
  transporter:public_transporter_profiles ( id, display_name, company_name )
`;

type One<T> = T | T[] | null;
const single = <T,>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

interface PartyRow {
  id: string;
  display_name: string | null;
  company_name: string | null;
}

interface RequestRow {
  id: string;
  status: TransportStatus;
  created_at: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  return_datetime: string | null;
  seats_required: number;
  organizer_id: string;
  transporter_id: string;
  vehicle: One<{ id: string; name: string; vehicle_type: string | null; plate_number: string | null; seat_capacity: number | null }>;
  tour_schedule: One<{
    id: string;
    start_date: string;
    end_date: string | null;
    tour: One<{ id: string; title: string; location: string | null }>;
  }>;
  organizer: One<PartyRow>;
  transporter: One<PartyRow>;
}

function toView(
  row: RequestRow,
  counterpartySide: 'organizer' | 'transporter',
  contacts: Map<string, PartnerContact>,
  showContact: boolean
): TransportRequestView {
  const vehicle = single(row.vehicle);
  const schedule = single(row.tour_schedule);
  const tour = single(schedule?.tour ?? null);
  const party = single(counterpartySide === 'organizer' ? row.organizer : row.transporter);
  const partyId = counterpartySide === 'organizer' ? row.organizer_id : row.transporter_id;
  const contact = showContact ? contacts.get(partyId) : undefined;

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    pickupLocation: row.pickup_location,
    dropoffLocation: row.dropoff_location,
    pickupDatetime: row.pickup_datetime,
    returnDatetime: row.return_datetime,
    seatsRequired: row.seats_required,
    completableFrom: transportCompletableFrom(schedule?.end_date, row.pickup_datetime, row.return_datetime),
    vehicle: vehicle
      ? {
          id: vehicle.id,
          name: vehicle.name,
          vehicleType: vehicle.vehicle_type,
          plateNumber: vehicle.plate_number,
          seatCapacity: vehicle.seat_capacity,
        }
      : null,
    schedule: schedule
      ? {
          id: schedule.id,
          startDate: schedule.start_date,
          endDate: schedule.end_date,
          tourId: tour?.id ?? null,
          tourTitle: tour?.title ?? null,
          tourLocation: tour?.location ?? null,
        }
      : null,
    counterparty: {
      id: partyId,
      name: party?.company_name || party?.display_name || (counterpartySide === 'organizer' ? 'Tour organizer' : 'Transporter'),
      phone: contact?.phone ?? null,
      email: contact?.email ?? null,
    },
  };
}

/**
 * The logged-in transporter's requests. Organizer contact details are included while the request
 * is pending or accepted (the transporter needs them to coordinate).
 */
export async function getTransporterRequests(statusFilter?: string): Promise<TransportRequestView[]> {
  try {
    const status = transportStatusFilterSchema.parse(statusFilter);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    let query = supabase
      .from('transport_bookings')
      .select(REQUEST_SELECT)
      .eq('transporter_id', transporterId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (status && status !== 'all') query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data ?? []) as unknown as RequestRow[];
    const withContact = (r: RequestRow) => r.status === 'pending' || r.status === 'accepted';
    const contacts = await loadPartnerContacts('organizer_profiles', rows.filter(withContact).map((r) => r.organizer_id));
    return rows.map((r) => toView(r, 'organizer', contacts, withContact(r)));
  } catch (error: unknown) {
    unstable_rethrow(error);
    captureException(error, { action: 'getTransporterRequests' });
    return [];
  }
}

/** The logged-in organizer's requests. Transporter contact details only for accepted requests. */
export async function getOrganizerTransportRequests(): Promise<TransportRequestView[]> {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    const organizerId = await requireOwnOrganizerId(supabase, profile.id);

    const { data, error } = await supabase
      .from('transport_bookings')
      .select(REQUEST_SELECT)
      .eq('organizer_id', organizerId)
      .is('deleted_at', null)
      .order('pickup_datetime', { ascending: false });
    if (error) throw error;

    const rows = (data ?? []) as unknown as RequestRow[];
    const withContact = (r: RequestRow) => r.status === 'accepted';
    const contacts = await loadPartnerContacts('transporter_profiles', rows.filter(withContact).map((r) => r.transporter_id));
    return rows.map((r) => toView(r, 'transporter', contacts, withContact(r)));
  } catch (error: unknown) {
    unstable_rethrow(error);
    captureException(error, { action: 'getOrganizerTransportRequests' });
    return [];
  }
}

// ─── Helpers ───

interface OwnedRequest {
  id: string;
  status: TransportStatus;
  organizer_id: string;
  transporter_id: string;
  tour_schedule_id: string;
  vehicle_id: string;
  pickup_datetime: string;
  return_datetime: string | null;
  tour_schedule: One<{ start_date: string; end_date: string | null; tour_id: string | null; tour: One<{ title: string }> }>;
}

async function loadOwnedRequest(
  supabase: Awaited<ReturnType<typeof requireSession>>['supabase'],
  requestId: string,
  owner: { column: 'transporter_id' | 'organizer_id'; id: string }
): Promise<OwnedRequest> {
  const { data, error } = await supabase
    .from('transport_bookings')
    .select(`
      id, status, organizer_id, transporter_id, tour_schedule_id, vehicle_id, pickup_datetime, return_datetime,
      tour_schedule:tour_schedules ( start_date, end_date, tour_id, tour:tours ( title ) )
    `)
    .eq('id', requestId)
    .eq(owner.column, owner.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new TransportError('Transport request not found.');
  return data as unknown as OwnedRequest;
}

// Service role: transporters cannot update tour_schedules under RLS; callers verified the request
// belongs to them first (AGENTS.md §5.3).
async function setScheduleTransportStatus(scheduleId: string, status: 'pending' | 'confirmed' | 'unresolved') {
  const { error } = await createAdminClient({ admin: true })
    .from('tour_schedules')
    .update({ transport_status: status })
    .eq('id', scheduleId)
    .eq('transport_type', 'external_transporter');
  // The request change is already committed; a stale badge must not turn it into a failure.
  if (error) captureException(error, { action: 'setScheduleTransportStatus', scheduleId, status });
}

function revalidateTransportPages(tourId?: string | null) {
  revalidatePath('/dashboard/transporter');
  revalidatePath('/dashboard/transporter/requests');
  revalidatePath('/dashboard/transporter/availability');
  revalidatePath('/dashboard/organizer/transport');
  revalidatePath('/dashboard/organizer/tours');
  if (tourId) revalidatePath(`/dashboard/organizer/tours/${tourId}/edit`);
}

async function transporterName(
  supabase: Awaited<ReturnType<typeof requireSession>>['supabase'],
  transporterId: string
): Promise<string> {
  // SEC-13: other partners are read through the public view, not the owner-only base table.
  const { data } = await supabase
    .from('public_transporter_profiles')
    .select('display_name, company_name')
    .eq('id', transporterId)
    .maybeSingle();
  return data?.display_name || data?.company_name || 'The transporter';
}

function reportUnexpected(error: unknown, context: Record<string, unknown>) {
  if (!isExpectedTransportError(error)) captureException(error, context);
}

// ─── Transporter: accept, decline, complete ───

/**
 * Accept a pending request. The same UPDATE books the vehicle (vehicle_availability 'booked' row)
 * inside the database, and fails as a whole if the vehicle is taken, inactive, or the schedule is
 * cancelled, so there is no "accepted but not booked" state.
 */
export async function acceptTransportRequest(requestId: unknown): Promise<ActionResult> {
  try {
    const input = transportRequestIdSchema.parse({ requestId });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    const request = await loadOwnedRequest(supabase, input.requestId, { column: 'transporter_id', id: transporterId });
    if (request.status !== 'pending') throw new TransportError(`This request is already ${request.status}.`);

    const { data: updated, error } = await supabase
      .from('transport_bookings')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('transporter_id', transporterId)
      .eq('status', 'pending')
      .select('id');
    if (error) throwTransportDbError(error);
    if (!updated?.length) throw new TransportError('This request was already answered.');

    await setScheduleTransportStatus(request.tour_schedule_id, 'confirmed');

    const schedule = single(request.tour_schedule);
    if (schedule?.tour_id) {
      await notifyOrganizerOfStatusChange(
        request.organizer_id,
        schedule.tour_id,
        request.tour_schedule_id,
        await transporterName(supabase, transporterId),
        'accepted'
      );
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transport_bookings',
      entityId: request.id,
      action: 'ACCEPT_TRANSPORT_REQUEST',
      diff: { status: 'accepted', vehicle_id: request.vehicle_id },
    });

    revalidateTransportPages(schedule?.tour_id);
    return { success: true };
  } catch (error: unknown) {
    reportUnexpected(error, { action: 'acceptTransportRequest' });
    return toTransportFailure(error, 'Failed to accept the request.');
  }
}

/** Decline a pending request. Any availability linked to it is released by the database. */
export async function declineTransportRequest(requestId: unknown, reason?: unknown): Promise<ActionResult> {
  try {
    const input = declineTransportRequestSchema.parse({ requestId, reason: reason ?? undefined });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    const request = await loadOwnedRequest(supabase, input.requestId, { column: 'transporter_id', id: transporterId });
    if (request.status !== 'pending') throw new TransportError(`This request is already ${request.status}.`);

    const { data: updated, error } = await supabase
      .from('transport_bookings')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('transporter_id', transporterId)
      .eq('status', 'pending')
      .select('id');
    if (error) throwTransportDbError(error);
    if (!updated?.length) throw new TransportError('This request was already answered.');

    await setScheduleTransportStatus(request.tour_schedule_id, 'unresolved');

    const schedule = single(request.tour_schedule);
    if (schedule?.tour_id) {
      await notifyOrganizerOfStatusChange(
        request.organizer_id,
        schedule.tour_id,
        request.tour_schedule_id,
        await transporterName(supabase, transporterId),
        'declined'
      );
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transport_bookings',
      entityId: request.id,
      action: 'DECLINE_TRANSPORT_REQUEST',
      diff: { status: 'declined', reason: input.reason ?? null },
    });

    revalidateTransportPages(schedule?.tour_id);
    return { success: true };
  } catch (error: unknown) {
    reportUnexpected(error, { action: 'declineTransportRequest' });
    return toTransportFailure(error, 'Failed to decline the request.');
  }
}

/** Mark an accepted trip completed. Allowed from the trip's end date (Manila); the DB enforces it. */
export async function completeTransportBooking(requestId: unknown): Promise<ActionResult> {
  try {
    const input = transportRequestIdSchema.parse({ requestId });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    const request = await loadOwnedRequest(supabase, input.requestId, { column: 'transporter_id', id: transporterId });
    if (request.status !== 'accepted') throw new TransportError('Only an accepted trip can be marked complete.');

    const schedule = single(request.tour_schedule);
    const from = transportCompletableFrom(schedule?.end_date, request.pickup_datetime, request.return_datetime);
    if (manilaToday() < from) {
      throw new TransportError(`This trip can be marked complete from ${formatBusinessDate(from)}.`);
    }

    const { data: updated, error } = await supabase
      .from('transport_bookings')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('transporter_id', transporterId)
      .eq('status', 'accepted')
      .select('id');
    if (error) throwTransportDbError(error);
    if (!updated?.length) throw new TransportError('This trip was already updated.');

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transport_bookings',
      entityId: request.id,
      action: 'COMPLETE_TRANSPORT_BOOKING',
      diff: { status: 'completed' },
    });

    revalidateTransportPages(schedule?.tour_id);
    return { success: true };
  } catch (error: unknown) {
    reportUnexpected(error, { action: 'completeTransportBooking' });
    return toTransportFailure(error, 'Failed to complete the trip.');
  }
}

// ─── Organizer: send, cancel ───

/**
 * Organizer asks a transporter for a vehicle on one of their schedules. Dates come from the schedule,
 * times are Manila wall-clock times; the transporter and seat count are derived on the server.
 * Returns `code: 'CONFLICT'` when the vehicle is already booked or blocked for those dates.
 */
export async function sendTransportRequest(input: unknown): Promise<ActionResult<{ requestId: string }>> {
  try {
    const data = sendTransportRequestSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');
    const organizerId = await requireOwnOrganizerId(supabase, profile.id);

    const { data: scheduleRow, error: scheduleError } = await supabase
      .from('tour_schedules')
      .select('id, start_date, end_date, capacity, status, transport_type, tour:tours ( id, title, organizer_id )')
      .eq('id', data.tourScheduleId)
      .is('deleted_at', null)
      .maybeSingle();
    if (scheduleError) throw scheduleError;
    const tour = scheduleRow ? single(scheduleRow.tour as One<{ id: string; title: string; organizer_id: string }>) : null;
    if (!scheduleRow || tour?.organizer_id !== organizerId) throw new TransportError('Schedule not found.');
    if (scheduleRow.status === 'cancelled') throw new TransportError('This schedule was cancelled.');
    if (scheduleRow.start_date < manilaToday()) throw new TransportError('This schedule has already started.');
    if (scheduleRow.transport_type !== 'external_transporter') {
      throw new TransportError('Set this schedule\'s transport to "External transporter" before requesting a vehicle.');
    }

    const { data: active, error: activeError } = await supabase
      .from('transport_bookings')
      .select('id')
      .eq('tour_schedule_id', scheduleRow.id)
      .in('status', ['pending', 'accepted'])
      .is('deleted_at', null)
      .limit(1);
    if (activeError) throw activeError;
    if (active?.length) {
      throw new TransportError('This schedule already has an active transport request. Cancel it before sending a new one.');
    }

    // SEC-13: another transporter's vehicle is read through public_vehicles (already excludes deleted rows).
    const { data: vehicle, error: vehicleError } = await supabase
      .from('public_vehicles')
      .select('id, transporter_id, seat_capacity')
      .eq('id', data.vehicleId)
      .eq('status', 'active')
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) throw new TransportError('This vehicle is no longer available.');
    if (vehicle.seat_capacity < scheduleRow.capacity) {
      throw new TransportError(`This vehicle seats ${vehicle.seat_capacity}, fewer than the schedule's ${scheduleRow.capacity} guests.`);
    }

    const pickupDatetime = manilaDateTimeToIso(scheduleRow.start_date, data.pickupTime);
    const returnDatetime = manilaDateTimeToIso(scheduleRow.end_date ?? scheduleRow.start_date, data.returnTime);
    if (returnDatetime <= pickupDatetime) throw new TransportError('The return time must be after the pickup time.');

    const { data: request, error: insertError } = await supabase
      .from('transport_bookings')
      .insert({
        tour_schedule_id: scheduleRow.id,
        organizer_id: organizerId,
        transporter_id: vehicle.transporter_id,
        vehicle_id: vehicle.id,
        pickup_location: data.pickupLocation,
        dropoff_location: data.dropoffLocation,
        pickup_datetime: pickupDatetime,
        return_datetime: returnDatetime,
        seats_required: scheduleRow.capacity,
        status: 'pending',
      })
      .select('id')
      .single();
    if (insertError) throwTransportDbError(insertError);
    if (!request) throw new TransportError('Failed to send the transport request.');

    // The organizer owns the schedule, so the RLS client can update its transport badge.
    const { error: statusError } = await supabase
      .from('tour_schedules')
      .update({ transport_status: 'pending' })
      .eq('id', scheduleRow.id);
    if (statusError) captureException(statusError, { action: 'sendTransportRequest schedule status' });

    await notifyTransporterOfRequest(vehicle.transporter_id, scheduleRow.start_date, scheduleRow.end_date ?? scheduleRow.start_date);

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transport_bookings',
      entityId: request.id,
      action: 'SEND_TRANSPORT_REQUEST',
      diff: { vehicle_id: vehicle.id, tour_schedule_id: scheduleRow.id, status: 'pending' },
    });

    revalidateTransportPages(tour.id);
    return { success: true, requestId: request.id as string };
  } catch (error: unknown) {
    reportUnexpected(error, { action: 'sendTransportRequest' });
    return toTransportFailure(error, 'Failed to send the transport request.');
  }
}

/**
 * Organizer cancels a pending or accepted request. For an accepted one the database releases the
 * vehicle's booked dates in the same statement. The transporter is notified.
 */
export async function cancelTransportRequest(requestId: unknown): Promise<ActionResult> {
  try {
    const input = transportRequestIdSchema.parse({ requestId });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');
    const organizerId = await requireOwnOrganizerId(supabase, profile.id);

    const request = await loadOwnedRequest(supabase, input.requestId, { column: 'organizer_id', id: organizerId });
    if (request.status !== 'pending' && request.status !== 'accepted') {
      throw new TransportError(`A ${request.status} request cannot be canceled.`);
    }
    const wasAccepted = request.status === 'accepted';

    const { data: updated, error } = await supabase
      .from('transport_bookings')
      .update({ status: 'canceled', updated_at: new Date().toISOString() })
      .eq('id', request.id)
      .eq('organizer_id', organizerId)
      .in('status', ['pending', 'accepted'])
      .select('id');
    if (error) throwTransportDbError(error);
    if (!updated?.length) throw new TransportError('This request was already updated. Refresh and try again.');

    const { error: statusError } = await supabase
      .from('tour_schedules')
      .update({ transport_status: 'unresolved' })
      .eq('id', request.tour_schedule_id)
      .eq('transport_type', 'external_transporter');
    if (statusError) captureException(statusError, { action: 'cancelTransportRequest schedule status' });

    const schedule = single(request.tour_schedule);
    const { data: organizer } = await supabase
      .from('organizer_profiles')
      .select('display_name, company_name')
      .eq('id', organizerId)
      .maybeSingle();
    await notifyTransporterOfCancellation(request.transporter_id, {
      organizerName: organizer?.company_name || organizer?.display_name || 'The tour organizer',
      tourTitle: single(schedule?.tour ?? null)?.title ?? null,
      startDate: schedule?.start_date ?? manilaDateOf(request.pickup_datetime),
      endDate: schedule?.end_date ?? null,
      wasAccepted,
    });

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transport_bookings',
      entityId: request.id,
      action: 'CANCEL_TRANSPORT_REQUEST',
      diff: { from: request.status, status: 'canceled' },
    });

    revalidateTransportPages(schedule?.tour_id);
    return { success: true };
  } catch (error: unknown) {
    reportUnexpected(error, { action: 'cancelTransportRequest' });
    return toTransportFailure(error, 'Failed to cancel the request.');
  }
}
