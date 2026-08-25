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
  const capacity = parseInt(formData.get('capacity') as string, 10);
  const startDate = formData.get('startDate') as string;
  const endDate = formData.get('endDate') as string;
  const accommodationDetails = formData.get('accommodationDetails') as string;
  const travelTimeInfo = formData.get('travelTimeInfo') as string;
  const transportType = formData.get('transportType') as string;
  
  // Create a unique slug from the title
  const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

  const { error } = await supabase.from('tours').insert({
    organizer_id: organizerProfile.id,
    title,
    slug,
    description,
    location,
    price_per_person: pricePerPerson,
    duration_days: durationDays,
    capacity,
    start_date: startDate,
    end_date: endDate,
    accommodation_details: accommodationDetails,
    travel_time_info: travelTimeInfo,
    transport_type: transportType,
    status: 'draft', // By default, new tours are drafts
    transport_status: transportType === 'none' ? 'not_required' : (transportType === 'self_provided' ? 'self_provided' : 'unresolved')
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/organizer/tours');
  redirect('/dashboard/organizer/tours');
}

export async function publishTour(tourId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('tours').update({ status: 'published' }).eq('id', tourId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath('/dashboard/organizer/tours');
  return { success: true };
}

export async function archiveTour(tourId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('tours').update({ status: 'archived' }).eq('id', tourId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath('/dashboard/organizer/tours');
  return { success: true };
}
