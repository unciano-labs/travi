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
 * Fetch all vehicles owned by the logged-in transporter.
 */
export async function getTransporterVehicles() {
  try {
    const { transporter, supabase } = await getTransporterSession();

    const { data: vehicles, error } = await supabase
      .from('vehicles')
      .select('*')
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getTransporterVehicles', transporterId: transporter.id });
      return [];
    }

    return vehicles || [];
  } catch (err: any) {
    captureException(err, { action: 'getTransporterVehicles' });
    return [];
  }
}

/**
 * Add a new vehicle to the transporter's fleet.
 */
export async function createVehicle(formData: FormData) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const name = (formData.get('name') as string)?.trim();
    const vehicle_type = (formData.get('vehicleType') as string)?.trim() || 'van';
    const seat_capacity = parseInt(formData.get('seatCapacity') as string, 10);
    const plate_number = (formData.get('plateNumber') as string)?.trim() || null;
    const rate_per_day = parseFloat(formData.get('ratePerDay') as string) || null;
    const description = (formData.get('description') as string)?.trim() || null;
    const photosJson = formData.get('photos') as string;

    if (!name || isNaN(seat_capacity) || seat_capacity <= 0) {
      return { success: false, error: 'Vehicle name and valid seat capacity are required.' };
    }

    let photos: string[] = [];
    try {
      if (photosJson) {
        photos = JSON.parse(photosJson);
      }
    } catch (e) {
      // ignore
    }

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        transporter_id: transporter.id,
        name,
        vehicle_type,
        seat_capacity,
        plate_number,
        rate_per_day,
        description,
        photos,
        status: 'active',
      })
      .select()
      .single();

    if (error) {
      captureException(error, { action: 'createVehicle' });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'CREATE_VEHICLE',
      'vehicles',
      vehicle.id,
      { name, vehicle_type, seat_capacity, plate_number }
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true, vehicle };
  } catch (err: any) {
    captureException(err, { action: 'createVehicle exception' });
    return { success: false, error: err.message || 'Failed to create vehicle' };
  }
}

/**
 * Update vehicle details.
 */
export async function updateVehicle(vehicleId: string, formData: FormData) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const name = (formData.get('name') as string)?.trim();
    const vehicle_type = (formData.get('vehicleType') as string)?.trim();
    const seat_capacity = parseInt(formData.get('seatCapacity') as string, 10);
    const plate_number = (formData.get('plateNumber') as string)?.trim() || null;
    const rate_per_day = parseFloat(formData.get('ratePerDay') as string) || null;
    const description = (formData.get('description') as string)?.trim() || null;
    const status = (formData.get('status') as string)?.trim() || 'active';
    const photosJson = formData.get('photos') as string;

    if (!name || isNaN(seat_capacity) || seat_capacity <= 0) {
      return { success: false, error: 'Valid name and capacity are required.' };
    }

    const updatePayload: Record<string, any> = {
      name,
      vehicle_type,
      seat_capacity,
      plate_number,
      rate_per_day,
      description,
      status,
      updated_at: new Date().toISOString(),
    };

    if (photosJson) {
      try {
        updatePayload.photos = JSON.parse(photosJson);
      } catch (e) {
        // ignore
      }
    }

    const { error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', vehicleId)
      .eq('transporter_id', transporter.id);

    if (error) {
      captureException(error, { action: 'updateVehicle', vehicleId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'UPDATE_VEHICLE',
      'vehicles',
      vehicleId,
      updatePayload
    );

    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'updateVehicle exception' });
    return { success: false, error: err.message || 'Failed to update vehicle' };
  }
}

/**
 * Toggle active / inactive vehicle status.
 */
export async function toggleVehicleStatus(vehicleId: string, currentStatus: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    const { error } = await supabase
      .from('vehicles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)
      .eq('transporter_id', transporter.id);

    if (error) {
      captureException(error, { action: 'toggleVehicleStatus', vehicleId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'TOGGLE_VEHICLE_STATUS',
      'vehicles',
      vehicleId,
      { previous: currentStatus, current: newStatus }
    );

    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true, status: newStatus };
  } catch (err: any) {
    captureException(err, { action: 'toggleVehicleStatus exception' });
    return { success: false, error: err.message || 'Failed to toggle vehicle status' };
  }
}

/**
 * Soft delete a vehicle.
 */
export async function deleteVehicle(vehicleId: string) {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const { error } = await supabase
      .from('vehicles')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', vehicleId)
      .eq('transporter_id', transporter.id);

    if (error) {
      captureException(error, { action: 'deleteVehicle', vehicleId });
      return { success: false, error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'DELETE_VEHICLE',
      'vehicles',
      vehicleId,
      { deleted_at: new Date().toISOString() }
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'deleteVehicle exception' });
    return { success: false, error: err.message || 'Failed to delete vehicle' };
  }
}

/**
 * Helper query for Tour Organizers looking for available vehicles.
 */
export async function getAvailableVehicles(date: string, requiredCapacity: number) {
  try {
    const { supabase } = await requireSession();

    const { data, error } = await supabase
      .from('vehicles')
      .select(`
        id,
        name,
        vehicle_type,
        seat_capacity,
        rate_per_day,
        photos,
        transporter_id,
        transporter:transporter_profiles (
          company_name,
          display_name,
          phone
        )
      `)
      .gte('seat_capacity', requiredCapacity)
      .eq('status', 'active')
      .is('deleted_at', null);

    if (error) {
      captureException(error, { action: 'getAvailableVehicles', date, requiredCapacity });
      return [];
    }

    return data || [];
  } catch (err: any) {
    captureException(err, { action: 'getAvailableVehicles exception' });
    return [];
  }
}
