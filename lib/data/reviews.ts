import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';

function getPublicSupabase() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Latest 50 published, non-deleted reviews of a tour (tour detail page). Cached with the 'reviews' tag.
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
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        captureException(error, { action: 'getCachedTourReviews', tourId });
        return [];
      }

      return data || [];
    } catch (err: unknown) {
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
