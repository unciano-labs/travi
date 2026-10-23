'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from '@/lib/notifications';

import { tourSchema } from '@/lib/schemas/tour';
import { partnerErrorMessage } from '@/lib/partners';
import type { PublishReadiness } from '@/lib/services/tours';

const tourIdSchema = z.string().uuid('Invalid tour');

async function organizerSession({ mutate = true } = {}) {
  const { user, profile, supabase } = await requireSession();
  await assertRole(user.id, 'organizer');
  if (mutate) await assertRateLimit(profile.id, 'mutation');
  const { data: organizerProfile } = await supabase
    .from('organizer_profiles')
    .select('id')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!organizerProfile) throw new Error('Organizer profile not found');
  return { supabase, organizerId: organizerProfile.id as string };
}

export async function createTour(formData: FormData) {
  let success = false;
  
  try {
    const { supabase, organizerId } = await organizerSession();

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
    await createTourService(supabase, organizerId, validated);
    
    await notifySuperAdmin(
      'New Tour Created',
      `A new tour "${validated.title}" was created.`,
      'tour_created',
      '/admin/tours'
    );

    success = true;
  } catch (err: unknown) {
    captureException(err, { action: 'createTour exception' });
    return { success: false, error: partnerErrorMessage(err, 'Failed to create tour.') };
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
    const id = tourIdSchema.parse(tourId);
    const { supabase, organizerId } = await organizerSession();

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
    await updateTourService(supabase, id, organizerId, validated);

    success = true;
  } catch (err: unknown) {
    captureException(err, { action: 'updateTour exception', tourId });
    return { success: false, error: partnerErrorMessage(err, 'Failed to update tour.') };
  }

  if (success) {
    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    redirect('/dashboard/organizer/tours');
  }
}

export async function publishTour(tourId: string) {
  try {
    const id = tourIdSchema.parse(tourId);
    const { supabase, organizerId } = await organizerSession();

    const { publishTourService } = await import('@/lib/services/tours');
    await publishTourService(supabase, id, organizerId);

    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    return { success: true as const };
  } catch (err: unknown) {
    captureException(err, { action: 'publishTour exception', tourId });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to publish tour.') };
  }
}

export async function archiveTour(tourId: string) {
  try {
    const id = tourIdSchema.parse(tourId);
    const { supabase, organizerId } = await organizerSession();

    const { archiveTourService } = await import('@/lib/services/tours');
    await archiveTourService(supabase, id, organizerId);

    updateTag('tours');
    revalidatePath('/dashboard/organizer/tours');
    return { success: true as const };
  } catch (err: unknown) {
    captureException(err, { action: 'archiveTour exception', tourId });
    return { success: false as const, error: partnerErrorMessage(err, 'Failed to archive tour.') };
  }
}

/**
 * Publish checklist for the tour form (BIZ-09): organizer approval, itinerary, open future schedule,
 * price and cover image, from the saved tour. Pass no id for a tour that is not saved yet.
 */
export async function getTourPublishReadiness(
  tourId?: string | null
): Promise<{ success: true; readiness: PublishReadiness } | { success: false; error: string }> {
  try {
    const id = tourId ? tourIdSchema.parse(tourId) : null;
    const { supabase, organizerId } = await organizerSession({ mutate: false });
    const { getTourPublishReadiness: readinessFor } = await import('@/lib/services/tours');
    return { success: true, readiness: await readinessFor(supabase, organizerId, id) };
  } catch (err: unknown) {
    captureException(err, { action: 'getTourPublishReadiness', tourId });
    return { success: false, error: partnerErrorMessage(err, 'Could not load the publish checklist.') };
  }
}
