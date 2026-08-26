import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { captureException } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getPublicSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Cached reviews fetcher with 'reviews' tag.
 */
export const getCachedTourReviews = unstable_cache(
  async (tourId: string) => {
    try {
      const supabase = getPublicSupabase();

      const { data, error } = await supabase
        .from('reviews')
        .select(`
          id,
          rating,
          comment,
          created_at,
          reviewer:user_profiles (
            id,
            full_name,
            avatar_url
          )
        `)
        .eq('tour_id', tourId)
        .eq('status', 'published')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        captureException(error, { action: 'getCachedTourReviews', tourId });
        return [];
      }

      return data || [];
    } catch (err: any) {
      captureException(err, { action: 'getCachedTourReviews exception', tourId });
      return [];
    }
  },
  ['tour-reviews-list'],
  {
    tags: ['reviews'],
    revalidate: 3600,
  }
);
