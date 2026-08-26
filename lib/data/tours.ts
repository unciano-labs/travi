import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { captureException } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getPublicSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Cached fetcher for published public tours catalog with pagination and active schedule aggregation.
 */
export const getCachedPublicTours = unstable_cache(
  async (offset = 0, limit = 6) => {
    try {
      const supabase = getPublicSupabase();

      const { data: tours, error } = await supabase
        .from('tours')
        .select(`
          id,
          title,
          slug,
          location,
          duration_days,
          price_per_person,
          cover_image_url,
          image_urls,
          organizer:organizer_profiles(company_name, display_name),
          schedules:tour_schedules(capacity, price_per_person, original_price, status, start_date, deleted_at),
          reviews (
            id,
            rating,
            comment,
            created_at,
            reviewer:user_profiles (
              id,
              full_name,
              avatar_url
            )
          )
        `)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        captureException(error, { action: 'getCachedPublicTours' });
        return { tours: [], hasMore: false };
      }

      // Filter and compute pricing / availability
      const processedTours = [];

      for (const tour of tours || []) {
        const activeSchedules = (tour.schedules || []).filter(
          (s: any) => 
            s.deleted_at === null &&
            s.status === 'open' && 
            new Date(s.start_date) >= new Date(new Date().setHours(0, 0, 0, 0))
        );

        if (activeSchedules.length === 0) continue;

        const maxPax = Math.max(...activeSchedules.map((s: any) => s.capacity));
        const lowestPrice = Math.min(...activeSchedules.map((s: any) => 
          s.price_per_person !== null && s.price_per_person !== undefined 
            ? s.price_per_person 
            : tour.price_per_person
        ));

        const lowestPriceSchedule = activeSchedules.find((s: any) => 
          (s.price_per_person !== null && s.price_per_person !== undefined ? s.price_per_person : tour.price_per_person) === lowestPrice
        );
        const originalPrice = lowestPriceSchedule?.original_price;
        const isOnSale = Boolean(originalPrice && originalPrice > lowestPrice);

        processedTours.push({
          ...tour,
          calculated_max_pax: maxPax,
          calculated_lowest_price: lowestPrice,
          calculated_original_price: originalPrice,
          is_on_sale: isOnSale,
        });
      }

      const paginatedTours = processedTours.slice(offset, offset + limit);

      return {
        tours: paginatedTours,
        hasMore: offset + limit < processedTours.length,
        total: processedTours.length,
      };
    } catch (err: any) {
      captureException(err, { action: 'getCachedPublicTours exception' });
      return { tours: [], hasMore: false, total: 0 };
    }
  },
  ['public-tours-catalog'],
  {
    tags: ['tours'],
    revalidate: 3600, // 1 hour background revalidation fallback
  }
);

/**
 * Fetcher for single tour details by slug.
 */
export async function getCachedTourBySlug(slug: string) {
  try {
    const supabase = getPublicSupabase();
    const decodedSlug = decodeURIComponent(slug);
    const { data: tour, error } = await supabase
      .from('tours')
      .select(`
        *,
        organizer:organizer_profiles (
          id,
          company_name,
          display_name
        ),
        itineraries:tour_itineraries (*),
        schedules:tour_schedules (*)
      `)
      .eq('slug', decodedSlug)
      .is('deleted_at', null)
      .single();

    if (error) {
      console.error('getCachedTourBySlug DB error for slug:', slug, error);
      captureException(error, { action: 'getCachedTourBySlug', slug });
      return null;
    }
    return tour;
  } catch (err: any) {
    console.error('getCachedTourBySlug exception:', err);
    captureException(err, { action: 'getCachedTourBySlug exception', slug });
    return null;
  }
}

