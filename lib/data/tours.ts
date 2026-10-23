import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { captureException, logger } from '@/lib/logger';
import { DURATIONS, type CatalogSearch, type CatalogSort } from '@/lib/schemas/catalog';
import { searchToursFallback } from './tours-fallback';

// Public, cached catalog reads. They use a cookie-less anon client, so RLS limits them to what any
// visitor may see, and every result is safe to share across users in the Data Cache.

function getPublicSupabase() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** One tour card in the public catalog. Price/seat/date figures cover its matching schedules only. */
export interface CatalogTour {
  id: string;
  title: string;
  slug: string;
  location: string;
  city: string | null;
  province: string | null;
  duration_days: number;
  format: 'joiner' | 'private' | 'solo';
  themes: string[];
  cover_image_url: string | null;
  image_urls: string[];
  organizer_name: string | null;
  calculated_lowest_price: number;
  calculated_original_price: number | null;
  is_on_sale: boolean;
  calculated_max_pax: number;
  seats_left: number;
  next_start_date: string;
  rating_avg: number | null;
  review_count: number;
}

export interface CatalogQuery {
  q?: string;
  destination?: string;
  from?: string;
  to?: string;
  guests?: number;
  min?: number;
  max?: number;
  duration?: string;
  format?: 'joiner' | 'private' | 'solo';
  theme?: string;
  sort: CatalogSort;
}

export interface CatalogResult {
  tours: CatalogTour[];
  total: number;
}

interface SearchRow {
  id: string;
  title: string;
  slug: string;
  location: string;
  city: string | null;
  province: string | null;
  duration_days: number;
  format: CatalogTour['format'];
  themes: string[] | null;
  cover_image_url: string | null;
  image_urls: string[] | null;
  organizer_name: string | null;
  lowest_price: number | string;
  original_price: number | string | null;
  max_capacity: number;
  seats_left: number;
  next_start_date: string;
  rating_avg: number | string | null;
  review_count: number;
  total_count: number | string;
}

export function toCatalogTour(row: Omit<SearchRow, 'total_count'>): CatalogTour {
  const lowest = Number(row.lowest_price);
  const original = row.original_price === null ? null : Number(row.original_price);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    location: row.location,
    city: row.city,
    province: row.province,
    duration_days: row.duration_days,
    format: row.format,
    themes: row.themes ?? [],
    cover_image_url: row.cover_image_url,
    image_urls: row.image_urls ?? [],
    organizer_name: row.organizer_name,
    calculated_lowest_price: lowest,
    calculated_original_price: original,
    is_on_sale: original !== null && original > lowest,
    calculated_max_pax: row.max_capacity,
    seats_left: row.seats_left,
    next_start_date: row.next_start_date,
    rating_avg: row.rating_avg === null ? null : Number(row.rating_avg),
    review_count: row.review_count ?? 0,
  };
}

let warnedMissingRpc = false;

async function searchPublicTours(query: CatalogQuery, limit: number, offset: number): Promise<CatalogResult> {
  try {
    const supabase = getPublicSupabase();
    const duration = DURATIONS.find((d) => d.id === query.duration);
    const { data, error } = await supabase.rpc('search_public_tours', {
      p_q: query.q ?? null,
      p_destination: query.destination ?? null,
      p_from: query.from ?? null,
      p_to: query.to ?? null,
      p_guests: query.guests ?? null,
      p_min_price: query.min ?? null,
      p_max_price: query.max ?? null,
      p_min_days: duration?.min ?? null,
      p_max_days: duration?.max ?? null,
      p_format: query.format ?? null,
      p_theme: query.theme ?? null,
      p_sort: query.sort,
      p_limit: limit,
      p_offset: offset,
    });

    if (error) {
      // PGRST202: the 20261024100000 migration is not applied yet. Serve a bounded, degraded
      // query so the catalog keeps working during the rollout. Remove once the RPC is live.
      if (error.code === 'PGRST202') {
        if (!warnedMissingRpc) {
          warnedMissingRpc = true;
          logger.warn({ action: 'searchPublicTours' }, 'search_public_tours RPC missing; using fallback query');
        }
        return await searchToursFallback(supabase, query, limit, offset);
      }
      captureException(error, { action: 'searchPublicTours' });
      return { tours: [], total: 0 };
    }

    const rows = (data ?? []) as SearchRow[];
    return { tours: rows.map(toCatalogTour), total: rows.length ? Number(rows[0].total_count) : 0 };
  } catch (err: unknown) {
    captureException(err, { action: 'searchPublicTours' });
    return { tours: [], total: 0 };
  }
}

/**
 * Cached catalog search. The cache key includes every argument; seat counts change with bookings,
 * so entries live 5 minutes and are also dropped on the `tours` / `reviews` tags.
 */
export const getCachedTourSearch = unstable_cache(searchPublicTours, ['public-tours-search-v1'], {
  tags: ['tours', 'reviews'],
  revalidate: 300,
});

/** Catalog page for a parsed /tours search (`page` is 1-based). */
export async function getCatalogPage(search: CatalogSearch, pageSize: number) {
  const { page, ...rest } = search;
  const query: CatalogQuery = {
    q: rest.q, destination: rest.destination, from: rest.from, to: rest.to, guests: rest.guests,
    min: rest.min, max: rest.max, duration: rest.duration, format: rest.format, theme: rest.theme,
    sort: rest.sort,
  };
  const { tours, total } = await getCachedTourSearch(query, pageSize, (page - 1) * pageSize);
  return { tours, total, page, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** Unfiltered catalog slice (landing page). Newest tours first. */
export async function getCachedPublicTours(offset = 0, limit = 6) {
  const safeLimit = Math.min(Math.max(Math.trunc(limit) || 6, 1), 48);
  const safeOffset = Math.max(Math.trunc(offset) || 0, 0);
  const { tours, total } = await getCachedTourSearch({ sort: 'newest' }, safeLimit, safeOffset);
  return { tours, total, hasMore: safeOffset + tours.length < total };
}

/** Every listable tour slug for the sitemap (published, not deleted, approved organizer). */
export const getCachedSitemapTours = unstable_cache(
  async (): Promise<{ slug: string; updated_at: string | null }[]> => {
    try {
      const { data, error } = await getPublicSupabase()
        .from('tours')
        .select('slug, updated_at, organizer:organizer_profiles!inner(status, deleted_at)')
        .eq('status', 'published')
        .is('deleted_at', null)
        .eq('organizer.status', 'approved')
        .is('organizer.deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (error) {
        captureException(error, { action: 'getCachedSitemapTours' });
        return [];
      }
      return (data ?? []).map((t) => ({ slug: t.slug as string, updated_at: (t.updated_at as string | null) ?? null }));
    } catch (err: unknown) {
      captureException(err, { action: 'getCachedSitemapTours' });
      return [];
    }
  },
  ['public-tours-sitemap-v1'],
  { tags: ['tours'], revalidate: 3600 }
);

const fetchTourBySlug = unstable_cache(
  async (slug: string) => {
    try {
      const { data: tour, error } = await getPublicSupabase()
        .from('tours')
        .select(`
          *,
          organizer:organizer_profiles!inner (
            id,
            company_name,
            display_name
          ),
          itineraries:tour_itineraries (*),
          schedules:tour_schedules (*)
        `)
        .eq('slug', slug)
        .eq('status', 'published')
        .is('deleted_at', null)
        .is('itineraries.deleted_at', null)
        .is('schedules.deleted_at', null)
        .maybeSingle();

      if (error) {
        captureException(error, { action: 'getCachedTourBySlug', slug });
        return null;
      }
      return tour;
    } catch (err: unknown) {
      captureException(err, { action: 'getCachedTourBySlug', slug });
      return null;
    }
  },
  ['public-tour-by-slug-v1'],
  // Short TTL: the booking card shows seats left, and pending-booking expiry (pg_cron) cannot
  // invalidate tags. Booking creation and organizer edits invalidate `tours` immediately.
  { tags: ['tours'], revalidate: 60 }
);

/**
 * Single published tour by slug. React `cache()` dedupes the call between `generateMetadata` and
 * the page within one request; `unstable_cache` shares it across requests.
 */
export const getCachedTourBySlug = cache(async (slug: string) => {
  let decoded = slug;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return null; // malformed percent-encoding: treat as not found
  }
  return fetchTourBySlug(decoded);
});
