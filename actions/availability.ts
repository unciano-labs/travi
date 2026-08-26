'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { logAdminAudit } from '@/lib/audit';

async function getTransporterSession() {
  const { user, profile, supabase } = await requireSession();
  const { data: transporter, error } = await supabase
    .from('transporter_profiles')
    .select('*')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .single();

  if (error || !transporter) {
    throw new Error('Transporter profile not found');
  }

  return { user, profile, transporter, supabase };
}

/**
 * Fetch all availability blocks and booked dates across transporter's fleet or for a specific vehicle.
 */
export async function getTransporterAvailability(vehicleId?: string) {
  try {
    const { transporter, supabase } = await getTransporterSession();

    let query = supabase
      .from('vehicle_availability')
      .select(`
        *,
        vehicle:vehicles (
          id,
          name,
          vehicle_type,
          plate_number,
          transporter_id
        )
      `)
      .order('start_date', { ascending: true });

    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("DB QUERY ERROR in getTransporterAvailability:", JSON.stringify(error, null, 2));
      captureException(error, { action: 'getTransporterAvailability', vehicleId });
      return [];
    }

    // Filter to only records where vehicle belongs to this transporter
    const filtered = (data || []).filter(
      (item: any) => item.vehicle?.transporter_id === transporter.id
    );

    return filtered;
  } catch (err: any) {
    captureException(err, { action: 'getTransporterAvailability exception' });
    return [];
  }
}

/**
 * Block out dates for a vehicle (maintenance, offline booking, private use).
 */
export async function blockVehicleDates(
  vehicleId: string,
  startDate: string,
  endDate: string,
  notes?: string
) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    // Verify vehicle belongs to transporter
    const { data: vehicle, error: vErr } = await supabase
      .from('vehicles')
      .select('id, name')
      .eq('id', vehicleId)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .single();

    if (vErr || !vehicle) {
      return { success: false, error: 'Vehicle not found or unauthorized.' };
    }

    if (new Date(startDate) > new Date(endDate)) {
      return { success: false, error: 'Start date cannot be after end date.' };
    }

    // Check for existing overlapping blocks or bookings
    const { data: conflicts } = await supabase
      .from('vehicle_availability')
      .select('id, start_date, end_date, status')
      .eq('vehicle_id', vehicleId)
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: `Date conflict: This vehicle already has ${conflicts.length} scheduled booking/block within these dates.`,
      };
    }

    const { data: block, error } = await supabase
      .from('vehicle_availability')
      .insert({
        vehicle_id: vehicleId,
        start_date: startDate,
        end_date: endDate,
        status: 'blocked',
        notes: notes || 'Blocked for maintenance / offline',
      })
      .select()
      .single();

    if (error) {
      captureException(error, { action: 'blockVehicleDates', vehicleId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'BLOCK_VEHICLE_DATES',
      'vehicle_availability',
      block.id,
      { vehicleId, startDate, endDate, notes }
    );

    revalidatePath('/dashboard/transporter/availability');
    revalidatePath('/dashboard/transporter/vehicles');

    return { success: true, block };
  } catch (err: any) {
    captureException(err, { action: 'blockVehicleDates exception' });
    return { success: false, error: err.message || 'Failed to block dates.' };
  }
}

/**
 * Remove an availability block / unblock dates.
 */
export async function removeAvailabilityBlock(availabilityId: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    // Verify block belongs to a vehicle of this transporter
    const { data: block, error: bErr } = await supabase
      .from('vehicle_availability')
      .select(`
        id,
        vehicle_id,
        status,
        vehicle:vehicles (transporter_id)
      `)
      .eq('id', availabilityId)
      .single();

    if (bErr || !block || (block.vehicle as any)?.transporter_id !== transporter.id) {
      return { success: false, error: 'Availability record not found or unauthorized.' };
    }

    if (block.status === 'booked') {
      return { success: false, error: 'Cannot directly delete a confirmed booking block. Manage via Requests instead.' };
    }

    const { error } = await supabase
      .from('vehicle_availability')
      .delete()
      .eq('id', availabilityId);

    if (error) {
      captureException(error, { action: 'removeAvailabilityBlock', availabilityId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'REMOVE_AVAILABILITY_BLOCK',
      'vehicle_availability',
      availabilityId,
      { deleted_at: new Date().toISOString() }
    );

    revalidatePath('/dashboard/transporter/availability');
    revalidatePath('/dashboard/transporter/vehicles');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'removeAvailabilityBlock exception' });
    return { success: false, error: err.message || 'Failed to remove block.' };
  }
}
