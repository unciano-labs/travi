'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function createTour(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Get user profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return { error: 'User profile not found' };
  }

  // Get organizer profile id
  const { data: organizerProfile } = await supabase
    .from('organizer_profiles')
    .select('id')
    .eq('user_profile_id', profile.id)
    .single();

  if (!organizerProfile) {
    return { error: 'Organizer profile not found' };
  }

  // Extract form data
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const location = formData.get('location') as string;
  const pricePerPerson = parseFloat(formData.get('pricePerPerson') as string);
  const durationDays = parseInt(formData.get('durationDays') as string, 10);
  const accommodationDetails = formData.get('accommodationDetails') as string;
  const travelTimeInfo = formData.get('travelTimeInfo') as string;
  const transportType = formData.get('transportType') as string;
  const status = (formData.get('status') as string) || 'draft';
  
  // New optional fields
  const imageUrls = formData.getAll('imageUrls') as string[];
  let coverImageUrl = formData.get('coverImageUrl') as string;
  if (!coverImageUrl && imageUrls.length > 0) {
    coverImageUrl = imageUrls[0];
  }
  const latitudeStr = formData.get('latitude') as string;
  const longitudeStr = formData.get('longitude') as string;
  const latitude = latitudeStr ? parseFloat(latitudeStr) : null;
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null;

  // External transporter fields
  const selectedVehicleId = formData.get('selectedVehicleId') as string;
  const pickupLocation = formData.get('pickupLocation') as string;
  const dropoffLocation = formData.get('dropoffLocation') as string;
  const pickupDatetime = formData.get('pickupDatetime') as string;
  
  const itinerariesStr = formData.get('itineraries') as string;
  let itineraries = [];
  if (itinerariesStr) {
    try {
      itineraries = JSON.parse(itinerariesStr);
    } catch (e) {
      console.error("Failed to parse itineraries", e);
    }
  }
  
  // Create a unique slug from the title
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

  const { data: tourData, error } = await supabase.from('tours').insert({
    organizer_id: organizerProfile.id,
    title,
    slug,
    description,
    location,
    price_per_person: pricePerPerson,
    duration_days: durationDays,
    accommodation_details: accommodationDetails,
    travel_time_info: travelTimeInfo,
    transport_type: transportType,
    status: status,
    transport_status: transportType === 'none' ? 'not_required' : (transportType === 'self_provided' ? 'self_provided' : (selectedVehicleId ? 'pending' : 'unresolved')),
    cover_image_url: coverImageUrl || null,
    image_urls: imageUrls,
    latitude,
    longitude
  }).select('id').single();

  if (error) {
    return { error: error.message };
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



  revalidatePath('/dashboard/organizer/tours');
  redirect('/dashboard/organizer/tours');
}

export async function updateTour(tourId: string, formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', user.id).single();
  if (!profile) return { error: 'User profile not found' };

  const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile.id).single();
  if (!organizerProfile) return { error: 'Organizer profile not found' };

  // Extract form data
  const title = formData.get('title') as string;
  const description = formData.get('description') as string;
  const location = formData.get('location') as string;
  const pricePerPerson = parseFloat(formData.get('pricePerPerson') as string);
  const durationDays = parseInt(formData.get('durationDays') as string, 10);
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const accommodationDetails = formData.get('accommodationDetails') as string;
  const travelTimeInfo = formData.get('travelTimeInfo') as string;
  const transportType = formData.get('transportType') as string;
  const status = formData.get('status') as string;

  const imageUrls = formData.getAll('imageUrls') as string[];
  let coverImageUrl = formData.get('coverImageUrl') as string;
  if (!coverImageUrl && imageUrls.length > 0) {
    coverImageUrl = imageUrls[0];
  }
  const latitudeStr = formData.get('latitude') as string;
  const longitudeStr = formData.get('longitude') as string;
  const latitude = latitudeStr ? parseFloat(latitudeStr) : null;
  const longitude = longitudeStr ? parseFloat(longitudeStr) : null;

  const updateData: any = {
    title,
    description,
    location,
    price_per_person: pricePerPerson,
    duration_days: durationDays,
    accommodation_details: accommodationDetails,
    travel_time_info: travelTimeInfo,
    transport_type: transportType,
    transport_status: transportType === 'none' ? 'not_required' : (transportType === 'self_provided' ? 'self_provided' : 'unresolved'),
  };

  if (status) updateData.status = status;

  if (coverImageUrl) updateData.cover_image_url = coverImageUrl;
  updateData.image_urls = imageUrls;
  if (latitude !== null) updateData.latitude = latitude;
  if (longitude !== null) updateData.longitude = longitude;

  const { error } = await supabase.from('tours').update(updateData).eq('id', tourId).eq('organizer_id', organizerProfile.id);

  if (error) {
    return { error: error.message };
  }

  // Update itineraries: delete existing and re-insert
  const itinerariesStr = formData.get('itineraries') as string;
  if (itinerariesStr) {
    try {
      const itineraries = JSON.parse(itinerariesStr);
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
    } catch (e) {
      console.error("Failed to parse/update itineraries", e);
    }
  }



  revalidatePath('/dashboard/organizer/tours');
  redirect('/dashboard/organizer/tours');
}

export async function publishTour(tourId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', user.id).single();
  const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile?.id).single();

  if (!organizerProfile) return { error: 'Unauthorized: Organizer profile required' };

  const { data, error } = await supabase
    .from('tours')
    .update({ status: 'published' })
    .eq('id', tourId)
    .eq('organizer_id', organizerProfile.id)
    .select('id');

  if (error) {
    return { error: error.message };
  }

  if (!data || data.length === 0) {
    return { error: 'Failed to publish: Tour not found or you do not have permission to modify it.' };
  }

  revalidatePath('/dashboard/organizer/tours');
  return { success: true };
}

export async function archiveTour(tourId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase.from('user_profiles').select('id').eq('user_id', user.id).single();
  const { data: organizerProfile } = await supabase.from('organizer_profiles').select('id').eq('user_profile_id', profile?.id).single();

  if (!organizerProfile) return { error: 'Unauthorized: Organizer profile required' };

  const { data, error } = await supabase
    .from('tours')
    .update({ status: 'archived' })
    .eq('id', tourId)
    .eq('organizer_id', organizerProfile.id)
    .select('id');

  if (error) {
    return { error: error.message };
  }
  
  if (!data || data.length === 0) {
    return { error: 'Failed to archive: Tour not found or you do not have permission to modify it.' };
  }

  revalidatePath('/dashboard/organizer/tours');
  return { success: true };
}
