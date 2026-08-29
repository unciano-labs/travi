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
export async function getAvailableVehicles(startDate: string, endDate: string, requiredCapacity: number) {
  try {
    const { profile, supabase } = await requireSession();
    
    // Fetch user's organizer profile to get favorites
    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    // 1. Fetch all active vehicles with enough capacity
    const { data: vehicles, error: vError } = await supabase
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

    if (vError || !vehicles) {
      captureException(vError, { action: 'getAvailableVehicles fetch vehicles', startDate, endDate });
      return [];
    }

    if (vehicles.length === 0) return [];

    // 2. Fetch all overlapping availability blocks for these dates
    const { data: blocks, error: bError } = await supabase
      .from('vehicle_availability')
      .select('vehicle_id')
      .lte('start_date', endDate)
      .gte('end_date', startDate);

    if (bError) {
      captureException(bError, { action: 'getAvailableVehicles fetch blocks', startDate, endDate });
      return [];
    }

    // 3. Fetch organizer favorites
    const { data: favoritesData } = await supabase
      .from('organizer_favorite_vehicles')
      .select('vehicle_id')
      .eq('organizer_id', organizerProfile?.id || '');
      
    const favoriteVehicleIds = new Set(favoritesData?.map(f => f.vehicle_id) || []);

    // 4. Filter out vehicles that have any overlapping blocks and map is_favorite
    const blockedVehicleIds = new Set(blocks?.map(b => b.vehicle_id) || []);
    const availableVehicles = vehicles
      .filter(v => !blockedVehicleIds.has(v.id))
      .map(v => ({
        ...v,
        is_favorite: favoriteVehicleIds.has(v.id)
      }));

    return availableVehicles;
  } catch (err: any) {
    captureException(err, { action: 'getAvailableVehicles exception' });
    return [];
  }
}

/**
 * Toggle a vehicle in the organizer's favorites list.
 */
export async function toggleFavoriteVehicle(vehicleId: string) {
  try {
    const { profile, supabase } = await requireSession();

    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    if (!organizerProfile) {
      return { success: false, error: 'Only organizers can favorite vehicles.' };
    }

    // Check if it's already favorited
    const { data: existing } = await supabase
      .from('organizer_favorite_vehicles')
      .select('id')
      .eq('organizer_id', organizerProfile.id)
      .eq('vehicle_id', vehicleId)
      .single();

    if (existing) {
      // Remove favorite
      const { error } = await supabase
        .from('organizer_favorite_vehicles')
        .delete()
        .eq('id', existing.id);
        
      if (error) throw error;
      return { success: true, is_favorite: false };
    } else {
      // Add favorite
      const { error } = await supabase
        .from('organizer_favorite_vehicles')
        .insert({
          organizer_id: organizerProfile.id,
          vehicle_id: vehicleId
        });
        
      if (error) throw error;
      return { success: true, is_favorite: true };
    }
  } catch (err: any) {
    captureException(err, { action: 'toggleFavoriteVehicle exception' });
    return { success: false, error: err.message || 'Failed to toggle favorite.' };
  }
}
