import { SupabaseClient } from '@supabase/supabase-js';
import { tourSchema } from '@/lib/schemas/tour';
import { z } from 'zod';
import { captureException } from '@/lib/logger';
import { manilaToday } from '@/lib/datetime';
import { partnerDbErrorMessage } from '@/lib/partners';

type TourInput = z.infer<typeof tourSchema>;

interface ItineraryDayInput {
  day_number: number;
  title: string;
  description: string;
}

function parseItineraries(raw: string | undefined): ItineraryDayInput[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .map((d: Record<string, unknown>, i: number) => ({
        day_number: Number(d?.day_number) || i + 1,
        title: typeof d?.title === 'string' ? d.title.trim() : '',
        description: typeof d?.description === 'string' ? d.description.trim() : '',
      }))
      .filter((d) => d.title.length > 0);
  } catch {
    return null;
  }
}

// ─── Publish rules (BIZ-09) ───

export type PublishCheckKey = 'approved' | 'itinerary' | 'schedule' | 'price' | 'cover';

export interface PublishCheck {
  key: PublishCheckKey;
  label: string;
  ok: boolean;
}

export interface PublishReadiness {
  organizerStatus: string | null;
  checks: PublishCheck[];
  ready: boolean;
}

const CHECK_LABELS: Record<PublishCheckKey, string> = {
  approved: 'Your organizer account is approved',
  itinerary: 'At least one itinerary day',
  schedule: 'At least one open schedule with a future start date',
  price: 'A price per person above ₱0',
  cover: 'A cover image',
};

/**
 * What a tour still needs before it can be published. `draft` overrides stored values with what the
 * organizer is about to save (price, cover image, itinerary). Reads run under the caller's RLS.
 */
export async function getTourPublishReadiness(
  supabase: SupabaseClient,
  organizerProfileId: string,
  tourId: string | null,
  draft?: { pricePerPerson?: number; coverImageUrl?: string | null; itineraryDays?: number }
): Promise<PublishReadiness> {
  const today = manilaToday();
  const [organizer, tour, itinerary, schedules] = await Promise.all([
    supabase.from('organizer_profiles').select('status').eq('id', organizerProfileId).maybeSingle(),
    tourId
      ? supabase.from('tours').select('price_per_person, cover_image_url').eq('id', tourId).eq('organizer_id', organizerProfileId).maybeSingle()
      : Promise.resolve({ data: null }),
    tourId && draft?.itineraryDays === undefined
      ? supabase.from('tour_itineraries').select('id', { count: 'exact', head: true }).eq('tour_id', tourId).is('deleted_at', null)
      : Promise.resolve({ count: draft?.itineraryDays ?? 0 }),
    tourId
      ? supabase
          .from('tour_schedules')
          .select('id', { count: 'exact', head: true })
          .eq('tour_id', tourId)
          .eq('status', 'open')
          .is('deleted_at', null)
          .gt('start_date', today)
      : Promise.resolve({ count: 0 }),
  ]);

  const organizerStatus = (organizer.data?.status as string | undefined) ?? null;
  const price = draft?.pricePerPerson ?? Number(tour.data?.price_per_person ?? 0);
  const cover = draft?.coverImageUrl !== undefined ? draft.coverImageUrl : (tour.data?.cover_image_url as string | null);

  const results: Record<PublishCheckKey, boolean> = {
    approved: organizerStatus === 'approved',
    itinerary: (itinerary.count ?? 0) > 0,
    schedule: (schedules.count ?? 0) > 0,
    price: Number.isFinite(price) && price > 0,
    cover: Boolean(cover && cover.trim()),
  };

  const checks = (Object.keys(CHECK_LABELS) as PublishCheckKey[]).map((key) => ({
    key,
    label: CHECK_LABELS[key],
    ok: results[key],
  }));
  return { organizerStatus, checks, ready: checks.every((c) => c.ok) };
}

function publishError(readiness: PublishReadiness, only?: PublishCheckKey[]) {
  const missing = readiness.checks.filter((c) => !c.ok && (!only || only.includes(c.key)));
  if (missing.length === 0) return null;
  return `This tour can't be published yet. Still needed: ${missing.map((c) => c.label.toLowerCase()).join('; ')}.`;
}

/** Active (pending or paid) bookings on schedules that have not started yet. */
async function assertNoUpcomingBookings(supabase: SupabaseClient, tourId: string) {
  const { data, error } = await supabase
    .from('bookings')
    .select('id, tour_schedules!inner(tour_id, start_date)')
    .eq('tour_schedules.tour_id', tourId)
    .gte('tour_schedules.start_date', manilaToday())
    .in('status', ['pending', 'confirmed'])
    .limit(1);
  if (error) {
    captureException(error, { action: 'assertNoUpcomingBookings', tourId });
    throw new Error('Could not check the bookings of this tour. Please try again.');
  }
  if (data && data.length > 0) {
    throw new Error(
      'This tour has upcoming bookings. Cancel its schedules (travelers are refunded) before archiving the tour.'
    );
  }
}

// ─── Writes ───

export async function createTourService(
  supabase: SupabaseClient,
  organizerProfileId: string,
  validatedData: TourInput
) {
  let coverImageUrl = validatedData.coverImageUrl;
  if (!coverImageUrl && validatedData.imageUrls.length > 0) coverImageUrl = validatedData.imageUrls[0];

  // A new tour has no schedules yet, so it always starts as a draft.
  if (validatedData.status === 'published') {
    throw new Error('Save the tour as a draft first, add an open schedule, then publish it.');
  }

  const baseSlug = validatedData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;

  const itineraries = parseItineraries(validatedData.itineraries) ?? [];

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
    throw new Error(partnerDbErrorMessage(error, 'Could not create the tour.'));
  }

  if (tourData && itineraries.length > 0) {
    const { error: itineraryError } = await supabase.from('tour_itineraries').insert(
      itineraries.map((day) => ({ tour_id: tourData.id, ...day }))
    );
    if (itineraryError) captureException(itineraryError, { action: 'createTourService itinerary', tourId: tourData.id });
  }

  return tourData;
}

export async function updateTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string,
  validatedData: TourInput
) {
  let coverImageUrl = validatedData.coverImageUrl;
  if (!coverImageUrl && validatedData.imageUrls.length > 0) coverImageUrl = validatedData.imageUrls[0];

  const { data: current, error: loadError } = await supabase
    .from('tours')
    .select('status')
    .eq('id', tourId)
    .eq('organizer_id', organizerProfileId)
    .maybeSingle();
  if (loadError || !current) throw new Error('Tour not found or you do not have permission to modify it.');

  const itineraries = parseItineraries(validatedData.itineraries);

  if (validatedData.status === 'published') {
    const readiness = await getTourPublishReadiness(supabase, organizerProfileId, tourId, {
      pricePerPerson: validatedData.pricePerPerson,
      coverImageUrl: coverImageUrl || null,
      itineraryDays: itineraries ? itineraries.length : undefined,
    });
    // Going live needs everything; a tour that is already live must keep its content complete.
    const message = current.status === 'published'
      ? publishError(readiness, ['itinerary', 'price', 'cover'])
      : publishError(readiness);
    if (message) throw new Error(message);
  }

  if (validatedData.status === 'archived' && current.status !== 'archived') {
    await assertNoUpcomingBookings(supabase, tourId);
  }

  const updateData: Record<string, unknown> = {
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

  if (validatedData.latitude != null) updateData.latitude = validatedData.latitude;
  if (validatedData.longitude != null) updateData.longitude = validatedData.longitude;

  const { error } = await supabase.from('tours').update(updateData).eq('id', tourId).eq('organizer_id', organizerProfileId);

  if (error) {
    captureException(error, { action: 'updateTourService update', tourId });
    throw new Error(partnerDbErrorMessage(error, 'Could not update the tour.'));
  }

  if (itineraries) {
    const { error: deleteError } = await supabase.from('tour_itineraries').delete().eq('tour_id', tourId);
    if (deleteError) {
      captureException(deleteError, { action: 'updateTourService itinerary delete', tourId });
    } else if (itineraries.length > 0) {
      const { error: insertError } = await supabase.from('tour_itineraries').insert(
        itineraries.map((day) => ({ tour_id: tourId, ...day }))
      );
      if (insertError) captureException(insertError, { action: 'updateTourService itinerary insert', tourId });
    }
  }

  return true;
}

export async function publishTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string
) {
  const readiness = await getTourPublishReadiness(supabase, organizerProfileId, tourId);
  const message = publishError(readiness);
  if (message) throw new Error(message);

  const { data, error } = await supabase
    .from('tours')
    .update({ status: 'published', deleted_at: null })
    .eq('id', tourId)
    .eq('organizer_id', organizerProfileId)
    .select('id');

  if (error) {
    captureException(error, { action: 'publishTourService', tourId });
    throw new Error(partnerDbErrorMessage(error, 'Could not publish the tour.'));
  }
  if (!data || data.length === 0) throw new Error('Failed to publish: Tour not found or you do not have permission to modify it.');

  return data;
}

export async function archiveTourService(
  supabase: SupabaseClient,
  tourId: string,
  organizerProfileId: string
) {
  await assertNoUpcomingBookings(supabase, tourId);

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
