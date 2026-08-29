import { SupabaseClient } from '@supabase/supabase-js';
import { tourSchema } from '@/lib/schemas/tour';
import { z } from 'zod';
import { captureException } from '@/lib/logger';

export async function createTourService(
  supabase: SupabaseClient,
  organizerProfileId: string,
  validatedData: z.infer<typeof tourSchema>
) {
  let coverImageUrl = validatedData.coverImageUrl;
  if (!coverImageUrl && validatedData.imageUrls.length > 0) coverImageUrl = validatedData.imageUrls[0];

  const baseSlug = validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

  let itineraries: any[] = [];
  if (validatedData.itineraries) {
    try { itineraries = JSON.parse(validatedData.itineraries); } catch (e) {}
  }

  const { data: tourData, error } = await supabase.from('tours').insert({
    organizer_id: organizerProfileId,
    title: validatedData.title,
    slug,
    description: validatedData.description,
    city: validatedData.city,
    province: validatedData.province,
    location: validatedData.location,
    price_per_person: validatedData.pricePerPerson,
    duration_days: validatedData.durationDays,
    accommodation_details: validatedData.accommodationDetails,
    travel_time_info: validatedData.travelTimeInfo,
    status: validatedData.status,
    cover_image_url: coverImageUrl || null,
    image_urls: validatedData.imageUrls,
    format: validatedData.format,
    themes: validatedData.themes,
    latitude: validatedData.latitude,
    longitude: validatedData.longitude
  }).select('id').single();

  if (error) {
    captureException(error, { action: 'createTourService insert' });
    throw new Error(error.message);
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

  return tourData;
}

export async function updateTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string,
  validatedData: z.infer<typeof tourSchema>
) {
  let coverImageUrl = validatedData.coverImageUrl;
  if (!coverImageUrl && validatedData.imageUrls.length > 0) coverImageUrl = validatedData.imageUrls[0];

  const updateData: any = {
    title: validatedData.title,
    description: validatedData.description,
    city: validatedData.city,
    province: validatedData.province,
    location: validatedData.location,
    price_per_person: validatedData.pricePerPerson,
    duration_days: validatedData.durationDays,
    accommodation_details: validatedData.accommodationDetails,
    travel_time_info: validatedData.travelTimeInfo,
    status: validatedData.status,
    cover_image_url: coverImageUrl || null,
    image_urls: validatedData.imageUrls,
    format: validatedData.format,
    themes: validatedData.themes,
  };

  if (validatedData.latitude !== null) updateData.latitude = validatedData.latitude;
  if (validatedData.longitude !== null) updateData.longitude = validatedData.longitude;

  const { error } = await supabase.from('tours').update(updateData).eq('id', tourId).eq('organizer_id', organizerProfileId);

  if (error) {
    captureException(error, { action: 'updateTourService update', tourId });
    throw new Error(error.message);
  }

  if (validatedData.itineraries) {
    try {
      const itineraries = JSON.parse(validatedData.itineraries);
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

  return true;
}

export async function publishTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string
) {
  const { data, error } = await supabase
    .from('tours')
    .update({ status: 'published', deleted_at: null })
    .eq('id', tourId)
    .eq('organizer_id', organizerProfileId)
    .select('id');

  if (error) {
    captureException(error, { action: 'publishTourService', tourId });
    throw new Error(error.message);
  }
  if (!data || data.length === 0) throw new Error('Failed to publish: Tour not found or you do not have permission to modify it.');

  return data;
}

export async function archiveTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string
) {
  const { data, error } = await supabase
    .from('tours')
    .update({
      status: 'archived',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', tourId)
    .eq('organizer_id', organizerProfileId)
    .select('id');

  if (error) {
    captureException(error, { action: 'archiveTourService', tourId });
    throw new Error(error.message);
  }
  if (!data || data.length === 0) throw new Error('Failed to archive: Tour not found or you do not have permission to modify it.');

  return data;
}
