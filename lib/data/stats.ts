import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { captureException } from '@/lib/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getPublicSupabase() {
  return createClient(supabaseUrl, supabaseAnonKey);
}

export interface MarketplaceStats {
  toursCount: number;
  organizersCount: number;
  reviewCount: number;
  // Share of published reviews rated 4+; null until there are reviews to base it on.
  satisfactionRate: number | null;
}

const EMPTY_STATS: MarketplaceStats = { toursCount: 0, organizersCount: 0, reviewCount: 0, satisfactionRate: null };

/**
 * Cached platform aggregate stats with 1-hour TTL and 'platform-stats' cache tag.
 * Only real counts: never fall back to invented numbers (Consumer Act RA 7394; see
 * docs/MVP_LAUNCH_READINESS.md LEG-07).
 */
export const getCachedPlatformStats = unstable_cache(
  async (): Promise<MarketplaceStats> => {
    try {
      const supabase = getPublicSupabase();

      const [toursRes, orgRes, reviewsRes] = await Promise.all([
        supabase.from('tours').select('id', { count: 'exact', head: true }).eq('status', 'published').is('deleted_at', null),
        supabase.from('organizer_profiles').select('id', { count: 'exact', head: true }).eq('status', 'approved').is('deleted_at', null),
        supabase.from('reviews').select('rating').eq('status', 'published').is('deleted_at', null),
      ]);

      const reviews = reviewsRes.data ?? [];
      const positiveReviews = reviews.filter((r) => r.rating >= 4).length;

      return {
        toursCount: toursRes.count ?? 0,
        organizersCount: orgRes.count ?? 0,
        reviewCount: reviews.length,
        satisfactionRate: reviews.length > 0 ? Math.round((positiveReviews / reviews.length) * 100) : null,
      };
    } catch (err: unknown) {
      captureException(err, { action: 'getCachedPlatformStats exception' });
      return EMPTY_STATS;
    }
  },
  ['platform-stats-aggregate'],
  {
    tags: ['platform-stats', 'tours', 'reviews'],
    revalidate: 3600,
  }
);
