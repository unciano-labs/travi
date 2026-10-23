import { unstable_rethrow } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { captureException } from '@/lib/logger';
import { manilaToday } from '@/lib/datetime';
import { DURATIONS } from '@/lib/schemas/catalog';
import type { CatalogQuery, CatalogResult, CatalogTour } from './tours';

// TEMPORARY rollout fallback for lib/data/tours.ts, used only while the `search_public_tours` RPC
// (migration 20261024100000_public_tour_catalog.sql) is missing from the database. It pushes every
// filter PostgREST can express into SQL (status, organizer, schedule status/dates, format, theme,
// duration), bounds the read, and applies the rest (text, seats, price, sort, paging) in memory.
// It returns no ratings. Delete this file once the migration is applied everywhere.

const MAX_ROWS = 500;

interface FallbackSchedule {
  start_date: string;
  capacity: number;
  booked_count: number | null;
  price_per_person: number | string | null;
  original_price: number | string | null;
}

interface FallbackRow {
  id: string;
  title: string;
  slug: string;
  location: string;
  city: string | null;
  province: string | null;
  duration_days: number;
  price_per_person: number | string;
  format: CatalogTour['format'];
  themes: string[] | null;
  cover_image_url: string | null;
  image_urls: string[] | null;
  created_at: string;
  organizer: { display_name: string | null; company_name: string | null } | null;
  schedules: FallbackSchedule[];
}

const contains = (haystack: (string | null)[], needle?: string) =>
  !needle || haystack.some((h) => (h ?? '').toLowerCase().includes(needle.toLowerCase()));

export async function searchToursFallback(
  supabase: SupabaseClient,
  query: CatalogQuery,
  limit: number,
  offset: number
): Promise<CatalogResult> {
  try {
    const today = manilaToday();
    const from = query.from && query.from > today ? query.from : today;
    const duration = DURATIONS.find((d) => d.id === query.duration);

    let request = supabase
      .from('tours')
      .select(`
        id, title, slug, location, city, province, duration_days, price_per_person, format, themes,
        cover_image_url, image_urls, created_at,
        organizer:organizer_profiles!inner(display_name, company_name),
        schedules:tour_schedules!inner(start_date, capacity, booked_count, price_per_person, original_price)
      `)
      .eq('status', 'published')
      .is('deleted_at', null)
      .eq('organizer.status', 'approved')
      .is('organizer.deleted_at', null)
      .eq('schedules.status', 'open')
      .is('schedules.deleted_at', null)
      .gte('schedules.start_date', from)
      .limit(MAX_ROWS);

    if (query.to) request = request.lte('schedules.start_date', query.to);
    if (query.format) request = request.eq('format', query.format);
    if (query.theme) request = request.contains('themes', [query.theme]);
    if (duration) request = request.gte('duration_days', duration.min);
    if (duration?.max) request = request.lte('duration_days', duration.max);

    const { data, error } = await request;
    if (error) {
      captureException(error, { action: 'searchToursFallback' });
      return { tours: [], total: 0 };
    }

    const guests = Math.max(query.guests ?? 1, 1);
    const tours: CatalogTour[] = [];
    const createdAt = new Map<string, string>();
    for (const row of (data ?? []) as unknown as FallbackRow[]) {
      if (!contains([row.title, row.location, row.city, row.province], query.q)) continue;
      if (!contains([row.location, row.city, row.province], query.destination)) continue;

      const matching = row.schedules
        .map((s) => ({
          ...s,
          seatsLeft: s.capacity - Math.max(s.booked_count ?? 0, 0),
          price: Number(s.price_per_person ?? row.price_per_person),
        }))
        .filter((s) => s.seatsLeft >= guests)
        .filter((s) => query.min === undefined || s.price >= query.min)
        .filter((s) => query.max === undefined || s.price <= query.max)
        .sort((a, b) => a.price - b.price || a.start_date.localeCompare(b.start_date));
      if (matching.length === 0) continue;

      const cheapest = matching[0];
      const original = cheapest.original_price === null ? null : Number(cheapest.original_price);
      tours.push({
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
        organizer_name: row.organizer?.display_name ?? row.organizer?.company_name ?? null,
        calculated_lowest_price: cheapest.price,
        calculated_original_price: original,
        is_on_sale: original !== null && original > cheapest.price,
        calculated_max_pax: Math.max(...matching.map((s) => s.capacity)),
        seats_left: Math.max(...matching.map((s) => s.seatsLeft)),
        next_start_date: matching.map((s) => s.start_date).sort()[0],
        rating_avg: null,
        review_count: 0,
      });
      createdAt.set(row.id, row.created_at);
    }

    tours.sort((a, b) => {
      if (query.sort === 'price_asc' && a.calculated_lowest_price !== b.calculated_lowest_price) {
        return a.calculated_lowest_price - b.calculated_lowest_price;
      }
      if (query.sort === 'price_desc' && a.calculated_lowest_price !== b.calculated_lowest_price) {
        return b.calculated_lowest_price - a.calculated_lowest_price;
      }
      if (query.sort === 'newest') {
        const byCreated = (createdAt.get(b.id) ?? '').localeCompare(createdAt.get(a.id) ?? '');
        if (byCreated !== 0) return byCreated;
      }
      return a.next_start_date.localeCompare(b.next_start_date) || a.id.localeCompare(b.id);
    });

    return {
      tours: tours.slice(offset, offset + limit),
      total: tours.length,
    };
  } catch (err: unknown) {
    unstable_rethrow(err);
    captureException(err, { action: 'searchToursFallback' });
    return { tours: [], total: 0 };
  }
}
