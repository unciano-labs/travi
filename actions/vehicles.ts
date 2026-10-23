'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logAdminAudit } from '@/lib/audit';
import { partnerDocumentInputSchema, vehicleSchema, vehicleSearchSchema } from '@/lib/schemas/partner';
import { insertPartnerDocuments } from '@/lib/services/partner-documents';
import { formText, partnerErrorMessage } from '@/lib/partners';

// Vehicles can be prepared while the transporter is still pending review; they only become
// discoverable/requestable once the transporter is approved (available_vehicles(),
// transport_request_is_valid(): 20261025090000).

async function getTransporterSession({ mutate = false } = {}) {
  const { user, profile, supabase } = await requireSession();
  await assertRole(user.id, 'transporter');
  if (mutate) await assertRateLimit(profile.id, 'mutation');
  const { data: transporter, error } = await supabase
    .from('transporter_profiles')
    .select('id, status')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .single();

  if (error || !transporter) {
    throw new Error('Transporter profile not found');
  }

  return { user, profile, transporter, supabase };
}

const vehicleIdSchema = z.string().uuid('Invalid vehicle');

function vehicleRaw(formData: FormData) {
  let photos: unknown = [];
  const photosJson = formText(formData, 'photos');
  if (photosJson) {
    try {
      photos = JSON.parse(photosJson);
    } catch {
      photos = null; // fails validation below
    }
  }
  return {
    name: formText(formData, 'name'),
    vehicleType: formText(formData, 'vehicleType') || 'van',
    seatCapacity: formText(formData, 'seatCapacity'),
    plateNumber: formText(formData, 'plateNumber'),
    ratePerDay: formText(formData, 'ratePerDay') ?? '',
    description: formText(formData, 'description'),
    status: formText(formData, 'status') || 'active',
    photos,
  };
}

/** Optional OR/CR upload (LEG-09): FormData field `orcrDocument`, JSON of one uploaded document. */
function orcrDocument(formData: FormData) {
  const raw = formText(formData, 'orcrDocument');
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Invalid OR/CR upload. Please upload the file again.');
  }
  return partnerDocumentInputSchema.parse({ ...(parsed as object), docType: 'vehicle_orcr' });
}

/**
 * Fetch all vehicles owned by the logged-in transporter, with whether an OR/CR was submitted.
 */
export async function getTransporterVehicles() {
  try {
    const { profile, transporter, supabase } = await getTransporterSession();

    const [{ data: vehicles, error }, { data: docs }] = await Promise.all([
      supabase
        .from('vehicles')
        .select('*')
        .eq('transporter_id', transporter.id)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase
        .from('partner_documents')
        .select('vehicle_id, status')
        .eq('owner_profile_id', profile.id)
        .eq('doc_type', 'vehicle_orcr')
        .is('deleted_at', null),
    ]);

    if (error) {
      captureException(error, { action: 'getTransporterVehicles', transporterId: transporter.id });
      return [];
    }

    const orcrByVehicle = new Map<string, string>();
    for (const d of docs ?? []) {
      if (!d.vehicle_id) continue;
      // verified wins over submitted
      if (orcrByVehicle.get(d.vehicle_id) !== 'verified') orcrByVehicle.set(d.vehicle_id, d.status);
    }

    return (vehicles || []).map((v) => ({ ...v, orcr_status: orcrByVehicle.get(v.id) ?? null }));
  } catch (err: unknown) {
    // Let Next's redirect/notFound/dynamic-rendering signals through (AGENTS.md §3.3, §6 #24).
    unstable_rethrow(err);
    captureException(err, { action: 'getTransporterVehicles' });
    return [];
  }
}

/**
 * Add a new vehicle to the transporter's fleet.
 */
export async function createVehicle(formData: FormData) {
  try {
    const data = vehicleSchema.parse(vehicleRaw(formData));
    const orcr = orcrDocument(formData);
    const { user, profile, transporter, supabase } = await getTransporterSession({ mutate: true });

    const { data: vehicle, error } = await supabase
      .from('vehicles')
      .insert({
        transporter_id: transporter.id,
        name: data.name,
        vehicle_type: data.vehicleType,
        seat_capacity: data.seatCapacity,
        plate_number: data.plateNumber,
        rate_per_day: data.ratePerDay,
        description: data.description,
        photos: data.photos,
        status: 'active',
      })
      .select()
      .single();

    if (error || !vehicle) {
      captureException(error, { action: 'createVehicle' });
      return { success: false as const, error: 'Could not add the vehicle.' };
    }

    if (orcr) {
      await insertPartnerDocuments(supabase, {
        authUserId: user.id,
        ownerProfileId: profile.id,
        partnerType: 'transporter',
        documents: [orcr],
        vehicleId: vehicle.id,
      });
    }

    await logAdminAudit(profile.id, 'CREATE_VEHICLE', 'vehicles', vehicle.id, {
      name: data.name,
      vehicle_type: data.vehicleType,
      seat_capacity: data.seatCapacity,
      orcr: Boolean(orcr),
    });

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true as const, vehicle };
  } catch (err: unknown) {
    captureException(err, { action: 'createVehicle' });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to create vehicle') };
  }
}

/**
 * Update vehicle details.
 */
export async function updateVehicle(vehicleId: string, formData: FormData) {
  try {
    const id = vehicleIdSchema.parse(vehicleId);
    const data = vehicleSchema.parse(vehicleRaw(formData));
    const orcr = orcrDocument(formData);
    const { user, profile, transporter, supabase } = await getTransporterSession({ mutate: true });

    const updatePayload = {
      name: data.name,
      vehicle_type: data.vehicleType,
      seat_capacity: data.seatCapacity,
      plate_number: data.plateNumber,
      rate_per_day: data.ratePerDay,
      description: data.description,
      status: data.status,
      photos: data.photos,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('vehicles')
      .update(updatePayload)
      .eq('id', id)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      captureException(error, { action: 'updateVehicle', vehicleId: id });
      return { success: false as const, error: 'Could not update the vehicle.' };
    }
    if (!updated || updated.length === 0) return { success: false as const, error: 'Vehicle not found.' };

    if (orcr) {
      await insertPartnerDocuments(supabase, {
        authUserId: user.id,
        ownerProfileId: profile.id,
        partnerType: 'transporter',
        documents: [orcr],
        vehicleId: id,
      });
    }

    await logAdminAudit(profile.id, 'UPDATE_VEHICLE', 'vehicles', id, { ...updatePayload, orcr: Boolean(orcr) });

    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true as const };
  } catch (err: unknown) {
    captureException(err, { action: 'updateVehicle' });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to update vehicle') };
  }
}

/**
 * Toggle active / inactive vehicle status.
 */
export async function toggleVehicleStatus(vehicleId: string, currentStatus: string) {
  try {
    const id = vehicleIdSchema.parse(vehicleId);
    const previous = z.enum(['active', 'inactive']).parse(currentStatus);
    const { profile, transporter, supabase } = await getTransporterSession({ mutate: true });
    const newStatus = previous === 'active' ? 'inactive' : 'active';

    const { data: updated, error } = await supabase
      .from('vehicles')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      captureException(error, { action: 'toggleVehicleStatus', vehicleId: id });
      return { success: false as const, error: 'Could not change the vehicle status.' };
    }
    if (!updated || updated.length === 0) return { success: false as const, error: 'Vehicle not found.' };

    await logAdminAudit(profile.id, 'TOGGLE_VEHICLE_STATUS', 'vehicles', id, { previous, current: newStatus });

    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true as const, status: newStatus };
  } catch (err: unknown) {
    captureException(err, { action: 'toggleVehicleStatus' });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to toggle vehicle status') };
  }
}

/**
 * Soft delete a vehicle.
 */
export async function deleteVehicle(vehicleId: string) {
  try {
    const id = vehicleIdSchema.parse(vehicleId);
    const { profile, transporter, supabase } = await getTransporterSession({ mutate: true });
    const deletedAt = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('vehicles')
      .update({ deleted_at: deletedAt })
      .eq('id', id)
      .eq('transporter_id', transporter.id)
      .is('deleted_at', null)
      .select('id');

    if (error) {
      captureException(error, { action: 'deleteVehicle', vehicleId: id });
      return { success: false as const, error: 'Could not delete the vehicle.' };
    }
    if (!updated || updated.length === 0) return { success: false as const, error: 'Vehicle not found.' };

    await logAdminAudit(profile.id, 'DELETE_VEHICLE', 'vehicles', id, { deleted_at: deletedAt });

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/vehicles');
    revalidatePath('/dashboard/transporter/availability');

    return { success: true as const };
  } catch (err: unknown) {
    captureException(err, { action: 'deleteVehicle' });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to delete vehicle') };
  }
}

interface AvailableVehicleRow {
  id: string;
  transporter_id: string;
  name: string;
  vehicle_type: string;
  seat_capacity: number;
  rate_per_day: number | null;
  photos: string[] | null;
  transporter_display_name: string | null;
  transporter_company_name: string | null;
}

/**
 * Vehicles an organizer can request for [startDate, endDate]: active vehicles of APPROVED
 * transporters with enough seats and no overlapping availability block (available_vehicles() RPC,
 * SEC-13: no phone numbers or plates). Favorites are flagged.
 */
export async function getAvailableVehicles(startDate: string, endDate: string, requiredCapacity: number) {
  try {
    const query = vehicleSearchSchema.parse({ startDate, endDate, requiredCapacity });
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');

    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!organizerProfile) return [];

    const [{ data: vehicles, error }, { data: favoritesData }] = await Promise.all([
      supabase.rpc('available_vehicles', {
        p_start: query.startDate,
        p_end: query.endDate,
        p_min_seats: query.requiredCapacity,
      }),
      supabase.from('organizer_favorite_vehicles').select('vehicle_id').eq('organizer_id', organizerProfile.id),
    ]);

    if (error || !vehicles) {
      captureException(error, { action: 'getAvailableVehicles', startDate, endDate });
      return [];
    }

    const favoriteVehicleIds = new Set((favoritesData ?? []).map((f) => f.vehicle_id));
    return (vehicles as AvailableVehicleRow[]).map((v) => ({
      id: v.id,
      name: v.name,
      vehicle_type: v.vehicle_type,
      seat_capacity: v.seat_capacity,
      rate_per_day: v.rate_per_day,
      photos: v.photos ?? [],
      transporter_id: v.transporter_id,
      transporter: { company_name: v.transporter_company_name, display_name: v.transporter_display_name },
      is_favorite: favoriteVehicleIds.has(v.id),
    }));
  } catch (err: unknown) {
    captureException(err, { action: 'getAvailableVehicles' });
    return [];
  }
}

/**
 * Toggle a vehicle in the organizer's favorites list.
 */
export async function toggleFavoriteVehicle(vehicleId: string) {
  try {
    const id = vehicleIdSchema.parse(vehicleId);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    if (!organizerProfile) {
      return { success: false as const, error: 'Only organizers can favorite vehicles.' };
    }

    const { data: existing } = await supabase
      .from('organizer_favorite_vehicles')
      .select('id')
      .eq('organizer_id', organizerProfile.id)
      .eq('vehicle_id', id)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase.from('organizer_favorite_vehicles').delete().eq('id', existing.id);
      if (error) throw new Error('Could not remove the favorite.');
      return { success: true as const, is_favorite: false };
    }

    const { error } = await supabase
      .from('organizer_favorite_vehicles')
      .insert({ organizer_id: organizerProfile.id, vehicle_id: id });
    if (error) throw new Error('Could not save the favorite.');
    return { success: true as const, is_favorite: true };
  } catch (err: unknown) {
    captureException(err, { action: 'toggleFavoriteVehicle' });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to toggle favorite.') };
  }
}
