'use server';

// Vehicle availability (transporter calendar). Overlaps are rejected by the database
// (vehicle_availability_no_overlap, 20261025110000); 'booked' rows are owned by the transport
// request lifecycle and cannot be created, edited or removed here.
import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { assertRateLimit } from '@/lib/ratelimit';
import { logMutation } from '@/lib/audit';
import { manilaToday } from '@/lib/datetime';
import {
  availabilityIdSchema,
  blockVehicleDatesSchema,
  vehicleFilterSchema,
  type AvailabilityView,
} from '@/lib/schemas/transport';
import {
  TransportError,
  isExpectedTransportError,
  requireOwnTransporterId,
  throwTransportDbError,
  toTransportFailure,
  type TransportFailure,
} from '@/lib/transport';

type ActionResult<T extends object = object> = ({ success: true } & T) | TransportFailure;

type One<T> = T | T[] | null;
const single = <T,>(value: One<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value);

interface AvailabilityRow {
  id: string;
  vehicle_id: string;
  start_date: string;
  end_date: string;
  status: AvailabilityView['status'];
  notes: string | null;
  transport_booking_id: string | null;
  vehicles: One<{ id: string; name: string; vehicle_type: string | null; plate_number: string | null; transporter_id: string }>;
}

interface LinkedBookingRow {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  organizer: One<{ display_name: string | null; company_name: string | null }>;
}

function revalidateAvailabilityPages() {
  revalidatePath('/dashboard/transporter/availability');
  revalidatePath('/dashboard/transporter/vehicles');
}

/** Live booked and blocked dates across the transporter's fleet, or for one of their vehicles. */
export async function getTransporterAvailability(vehicleId?: string): Promise<AvailabilityView[]> {
  try {
    const vehicleFilter = vehicleFilterSchema.parse(vehicleId);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    let query = supabase
      .from('vehicle_availability')
      .select(`
        id, vehicle_id, start_date, end_date, status, notes, transport_booking_id,
        vehicles!inner ( id, name, vehicle_type, plate_number, transporter_id )
      `)
      .eq('vehicles.transporter_id', transporterId)
      .in('status', ['booked', 'blocked'])
      .is('deleted_at', null)
      .order('start_date', { ascending: true });
    if (vehicleFilter) query = query.eq('vehicle_id', vehicleFilter);

    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as AvailabilityRow[];

    // No FK from vehicle_availability to transport_bookings, so load the linked requests separately.
    const bookingIds = rows.map((r) => r.transport_booking_id).filter((id): id is string => Boolean(id));
    const bookings = new Map<string, LinkedBookingRow>();
    if (bookingIds.length > 0) {
      const { data: linked, error: linkedError } = await supabase
        .from('transport_bookings')
        .select('id, pickup_location, dropoff_location, organizer:organizer_profiles ( display_name, company_name )')
        .eq('transporter_id', transporterId)
        .in('id', bookingIds);
      if (linkedError) throw linkedError;
      for (const b of (linked ?? []) as unknown as LinkedBookingRow[]) bookings.set(b.id, b);
    }

    return rows.map((r) => {
      const vehicle = single(r.vehicles);
      const booking = r.transport_booking_id ? bookings.get(r.transport_booking_id) : undefined;
      const organizer = booking ? single(booking.organizer) : null;
      return {
        id: r.id,
        vehicleId: r.vehicle_id,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        notes: r.notes,
        vehicle: vehicle
          ? { id: vehicle.id, name: vehicle.name, vehicleType: vehicle.vehicle_type, plateNumber: vehicle.plate_number }
          : null,
        booking: booking
          ? {
              organizerName: organizer?.company_name || organizer?.display_name || null,
              pickupLocation: booking.pickup_location,
              dropoffLocation: booking.dropoff_location,
            }
          : null,
      };
    });
  } catch (error: unknown) {
    unstable_rethrow(error);
    captureException(error, { action: 'getTransporterAvailability' });
    return [];
  }
}

/**
 * Block a date range (maintenance, private use) on one of the transporter's vehicles. Dates are
 * Manila calendar dates. Returns `code: 'CONFLICT'` when the range overlaps a booking or block.
 */
export async function blockVehicleDates(input: unknown): Promise<ActionResult<{ blockId: string }>> {
  try {
    const data = blockVehicleDatesSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    if (data.startDate < manilaToday()) throw new TransportError('You cannot block dates in the past.');

    const { data: vehicle, error: vehicleError } = await supabase
      .from('vehicles')
      .select('id')
      .eq('id', data.vehicleId)
      .eq('transporter_id', transporterId)
      .is('deleted_at', null)
      .maybeSingle();
    if (vehicleError) throw vehicleError;
    if (!vehicle) throw new TransportError('Vehicle not found.');

    // Friendly pre-check; vehicle_availability_no_overlap is the real (race-free) guard.
    const { data: conflicts, error: conflictError } = await supabase
      .from('vehicle_availability')
      .select('id')
      .eq('vehicle_id', vehicle.id)
      .in('status', ['booked', 'blocked'])
      .is('deleted_at', null)
      .lte('start_date', data.endDate)
      .gte('end_date', data.startDate)
      .limit(1);
    if (conflictError) throw conflictError;
    if (conflicts?.length) {
      throw new TransportError('This vehicle is already booked or blocked for some of those dates.', 'CONFLICT');
    }

    const { data: block, error } = await supabase
      .from('vehicle_availability')
      .insert({
        vehicle_id: vehicle.id,
        start_date: data.startDate,
        end_date: data.endDate,
        status: 'blocked',
        notes: data.notes ?? 'Blocked for maintenance / offline',
      })
      .select('id')
      .single();
    if (error) throwTransportDbError(error);
    if (!block) throw new TransportError('Failed to block dates.');

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'vehicle_availability',
      entityId: block.id,
      action: 'BLOCK_VEHICLE_DATES',
      diff: { vehicle_id: vehicle.id, start_date: data.startDate, end_date: data.endDate },
    });

    revalidateAvailabilityPages();
    return { success: true, blockId: block.id as string };
  } catch (error: unknown) {
    if (!isExpectedTransportError(error)) captureException(error, { action: 'blockVehicleDates' });
    return toTransportFailure(error, 'Failed to block dates.');
  }
}

/** Remove (soft-delete) a manual block. Booked dates are released only through the request. */
export async function removeAvailabilityBlock(availabilityId: unknown): Promise<ActionResult> {
  try {
    const input = availabilityIdSchema.parse({ availabilityId });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');
    const transporterId = await requireOwnTransporterId(supabase, profile.id);

    const { data: block, error: blockError } = await supabase
      .from('vehicle_availability')
      .select('id, status, vehicles!inner ( transporter_id )')
      .eq('id', input.availabilityId)
      .eq('vehicles.transporter_id', transporterId)
      .is('deleted_at', null)
      .maybeSingle();
    if (blockError) throw blockError;
    if (!block) throw new TransportError('Availability record not found.');
    if (block.status === 'booked') {
      throw new TransportError('Booked dates belong to an accepted transport request. They are released if the organizer cancels it.');
    }

    const { data: removed, error } = await supabase
      .from('vehicle_availability')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', block.id)
      .is('deleted_at', null)
      .select('id');
    if (error) throwTransportDbError(error);
    if (!removed?.length) throw new TransportError('This block was already removed.');

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'vehicle_availability',
      entityId: block.id,
      action: 'REMOVE_AVAILABILITY_BLOCK',
      diff: { deleted: true },
    });

    revalidateAvailabilityPages();
    return { success: true };
  } catch (error: unknown) {
    if (!isExpectedTransportError(error)) captureException(error, { action: 'removeAvailabilityBlock' });
    return toTransportFailure(error, 'Failed to remove the block.');
  }
}
