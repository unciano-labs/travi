'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from '@/lib/notifications';

import { tourSchema } from '@/lib/schemas/tour';

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
      city: formData.get('city'),
      province: formData.get('province'),
      location: formData.get('location'),
      pricePerPerson: formData.get('pricePerPerson'),
      durationDays: formData.get('durationDays'),
      accommodationDetails: formData.get('accommodationDetails'),
      travelTimeInfo: formData.get('travelTimeInfo'),
      status: formData.get('status') || 'draft',
      imageUrls: formData.getAll('imageUrls'),
      coverImageUrl: formData.get('coverImageUrl'),
      format: formData.get('format') || 'joiner',
      themes: formData.getAll('themes'),
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      itineraries: formData.get('itineraries'),
    };

    const validated = tourSchema.parse(rawData);

    const { createTourService } = await import('@/lib/services/tours');
    await createTourService(supabase, organizerProfile.id, validated);
    
    await notifySuperAdmin(
      'New Tour Created',
      `A new tour "${validated.title}" was created.`,
      'tour_created',
      '/admin/tours'
    );

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
      city: formData.get('city'),
      province: formData.get('province'),
      location: formData.get('location'),
      pricePerPerson: formData.get('pricePerPerson'),
      durationDays: formData.get('durationDays'),
      accommodationDetails: formData.get('accommodationDetails'),
      travelTimeInfo: formData.get('travelTimeInfo'),
      status: formData.get('status') || 'draft',
      imageUrls: formData.getAll('imageUrls'),
      coverImageUrl: formData.get('coverImageUrl'),
      format: formData.get('format') || 'joiner',
      themes: formData.getAll('themes'),
      latitude: formData.get('latitude') || null,
      longitude: formData.get('longitude') || null,
      itineraries: formData.get('itineraries'),
    };

    const validated = tourSchema.parse(rawData);

    const { updateTourService } = await import('@/lib/services/tours');
    await updateTourService(supabase, tourId, organizerProfile.id, validated);

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

    const { publishTourService } = await import('@/lib/services/tours');
    await publishTourService(supabase, tourId, organizerProfile.id);

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

    const { archiveTourService } = await import('@/lib/services/tours');
    await archiveTourService(supabase, tourId, organizerProfile.id);

    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'archiveTour exception', tourId });
    return { success: false, error: err.message };
  }
}
