'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';

const tourSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  location: z.string().min(1, 'Location is required'),
  pricePerPerson: z.coerce.number().min(0),
  durationDays: z.coerce.number().min(1),
  accommodationDetails: z.string().optional(),
  travelTimeInfo: z.string().optional(),
  transportType: z.string().optional(),
  status: z.string().default('draft'),
  imageUrls: z.array(z.string()).default([]),
  coverImageUrl: z.string().optional(),
  latitude: z.coerce.number().nullable().optional(),
  longitude: z.coerce.number().nullable().optional(),
  selectedVehicleId: z.string().optional(),
  itineraries: z.string().optional(),
});

export async function createTour(formData: FormData) {
  let success = false;
  
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    const { data: organizerProfile } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .single();

    if (!organizerProfile) return { success: false, error: 'Organizer profile not found' };

    const rawData = {
      title: formData.get('title'),
      description: formData.get('description'),
      location: formData.get('location'),
      pricePerPerson: formData.get('pricePerPerson'),
      durationDays: formData.get('durationDays'),
      accommodationDetails: formData.get('accommodationDetails'),
      travelTimeInfo: formData.get('travelTimeInfo'),
      transportType: formData.get('transportType'),
      status: formData.get('status') || 'draft',
      imageUrls: formData.getAll('imageUrls'),
      coverImageUrl: formData.get('coverImageUrl'),
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      selectedVehicleId: formData.get('selectedVehicleId'),
      itineraries: formData.get('itineraries'),
    };

    const validated = tourSchema.parse(rawData);

    let coverImageUrl = validated.coverImageUrl;
    if (!coverImageUrl && validated.imageUrls.length > 0) coverImageUrl = validated.imageUrls[0];

    const baseSlug = validated.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

    let itineraries: any[] = [];
    if (validated.itineraries) {
      try { itineraries = JSON.parse(validated.itineraries); } catch (e) {}
    }

    const transportType = validated.transportType || 'none';
    const transportStatus = transportType === 'none' ? 'not_required' : (transportType === 'self_provided' ? 'self_provided' : (validated.selectedVehicleId ? 'pending' : 'unresolved'));

    const { data: tourData, error } = await supabase.from('tours').insert({
      organizer_id: organizerProfile.id,
      title: validated.title,
      slug,
      description: validated.description,
      location: validated.location,
      price_per_person: validated.pricePerPerson,
      duration_days: validated.durationDays,
      accommodation_details: validated.accommodationDetails,
      travel_time_info: validated.travelTimeInfo,
      transport_type: transportType,
      status: validated.status,
      transport_status: transportStatus,
      cover_image_url: coverImageUrl || null,
      image_urls: validated.imageUrls,
      latitude: validated.latitude,
      longitude: validated.longitude
    }).select('id').single();

    if (error) {
      captureException(error, { action: 'createTour insert' });
      return { success: false, error: error.message };
    }

    if (tourData && itineraries.length > 0) {
      const itineraryInserts = itineraries.map((day: any) => ({
        tour_id: tourData.id,
        day_number: day.day_number,
        title: day.title,
        description: day.description
      }));
      await supabase.from('tour_itineraries').insert(itineraryInserts);
    }

    success = true;
  } catch (err: any) {
    captureException(err, { action: 'createTour exception' });
    return { success: false, error: err.message };
  }

  if (success) {
    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    redirect('/dashboard/organizer/tours');
  }
}

export async function updateTour(tourId: string, formData: FormData) {
  let success = false;
  
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile.id).single();
    if (!organizerProfile) return { success: false, error: 'Organizer profile not found' };

    const rawData = {
      title: formData.get('title'),
      description: formData.get('description'),
      location: formData.get('location'),
      pricePerPerson: formData.get('pricePerPerson'),
      durationDays: formData.get('durationDays'),
      accommodationDetails: formData.get('accommodationDetails'),
      travelTimeInfo: formData.get('travelTimeInfo'),
      transportType: formData.get('transportType'),
      status: formData.get('status') || 'draft',
      imageUrls: formData.getAll('imageUrls'),
      coverImageUrl: formData.get('coverImageUrl'),
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      itineraries: formData.get('itineraries'),
    };

    const validated = tourSchema.parse(rawData);

    let coverImageUrl = validated.coverImageUrl;
    if (!coverImageUrl && validated.imageUrls.length > 0) coverImageUrl = validated.imageUrls[0];

    const transportType = validated.transportType || 'none';
    const updateData: any = {
      title: validated.title,
      description: validated.description,
      location: validated.location,
      price_per_person: validated.pricePerPerson,
      duration_days: validated.durationDays,
      accommodation_details: validated.accommodationDetails,
      travel_time_info: validated.travelTimeInfo,
      transport_type: transportType,
      status: validated.status,
      transport_status: transportType === 'none' ? 'not_required' : (transportType === 'self_provided' ? 'self_provided' : 'unresolved'),
      cover_image_url: coverImageUrl || null,
      image_urls: validated.imageUrls,
    };

    if (validated.latitude !== null) updateData.latitude = validated.latitude;
    if (validated.longitude !== null) updateData.longitude = validated.longitude;

    const { error } = await supabase.from('tours').update(updateData).eq('id', tourId).eq('organizer_id', organizerProfile.id);

    if (error) {
      captureException(error, { action: 'updateTour update', tourId });
      return { success: false, error: error.message };
    }

    if (validated.itineraries) {
      try {
        const itineraries = JSON.parse(validated.itineraries);
        await supabase.from('tour_itineraries').delete().eq('tour_id', tourId);
        
        if (itineraries.length > 0) {
          const itineraryInserts = itineraries.map((day: any) => ({
            tour_id: tourId,
            day_number: day.day_number,
            title: day.title,
            description: day.description
          }));
          await supabase.from('tour_itineraries').insert(itineraryInserts);
        }
      } catch (e) {}
    }

    success = true;
  } catch (err: any) {
    captureException(err, { action: 'updateTour exception', tourId });
    return { success: false, error: err.message };
  }

  if (success) {
    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    redirect('/dashboard/organizer/tours');
  }
}

export async function publishTour(tourId: string) {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');

    const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile.id).single();
    if (!organizerProfile) return { success: false, error: 'Unauthorized: Organizer profile required' };

    const { data, error } = await supabase
      .from('tours')
      .update({ status: 'published', deleted_at: null })
      .eq('id', tourId)
      .eq('organizer_id', organizerProfile.id)
      .select('id');

    if (error) {
      captureException(error, { action: 'publishTour', tourId });
      return { success: false, error: error.message };
    }
    if (!data || data.length === 0) return { success: false, error: 'Failed to publish: Tour not found or you do not have permission to modify it.' };

    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'publishTour exception', tourId });
    return { success: false, error: err.message };
  }
}

export async function archiveTour(tourId: string) {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');

    const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile.id).single();
    if (!organizerProfile) return { success: false, error: 'Unauthorized: Organizer profile required' };

    const { data, error } = await supabase
      .from('tours')
      .update({
        status: 'archived',
        deleted_at: new Date().toISOString(),
      })
      .eq('id', tourId)
      .eq('organizer_id', organizerProfile.id)
      .select('id');

    if (error) {
      captureException(error, { action: 'archiveTour', tourId });
      return { success: false, error: error.message };
    }
    if (!data || data.length === 0) return { success: false, error: 'Failed to archive: Tour not found or you do not have permission to modify it.' };

    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'archiveTour exception', tourId });
    return { success: false, error: err.message };
  }
}
