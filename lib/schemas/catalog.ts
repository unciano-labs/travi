import { z } from 'zod';
import { isCalendarDate } from '@/lib/datetime';

// Public catalog search (/tours). Query params are untrusted and shareable, so parsing is lenient:
// an invalid value is dropped (treated as "no filter") instead of failing the whole page.

export const CATALOG_PAGE_SIZE = 12;

export const TOUR_FORMATS = ['joiner', 'private', 'solo'] as const;
export const TOUR_FORMAT_LABELS: Record<(typeof TOUR_FORMATS)[number], string> = {
  joiner: 'Joiner tour',
  private: 'Private group',
  solo: 'Solo / couple',
};

// Mirrors the theme ids organizers pick in components/dashboard/TourForm.tsx.
export const TOUR_THEMES = [
  { id: 'island_hopping', label: 'Island Hopping' },
  { id: 'adventure_sports', label: 'Adventure & Sports' },
  { id: 'city_historical', label: 'City & Historical' },
  { id: 'nature_wildlife', label: 'Nature & Wildlife' },
  { id: 'wellness_retreat', label: 'Wellness & Retreat' },
  { id: 'culinary_food', label: 'Culinary & Food' },
] as const;
const THEME_IDS = TOUR_THEMES.map((t) => t.id) as [string, ...string[]];

export const DURATIONS = [
  { id: '1', label: 'Day trip', min: 1, max: 1 },
  { id: '2-3', label: '2–3 days', min: 2, max: 3 },
  { id: '4-plus', label: '4+ days', min: 4, max: null },
] as const;
const DURATION_IDS = DURATIONS.map((d) => d.id) as [string, ...string[]];

export const CATALOG_SORTS = [
  { id: 'soonest', label: 'Soonest departure' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
] as const;
export type CatalogSort = 'soonest' | 'price_asc' | 'price_desc' | 'newest';

// '' and whitespace-only values mean "not set".
const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const lenient = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(blankToUndefined, schema.optional()).catch(undefined);

const isoDate = z.string().refine(isCalendarDate, 'Invalid date');

export const catalogSearchSchema = z
  .object({
    q: lenient(z.string().trim().max(80)),
    destination: lenient(z.string().trim().max(80)),
    from: lenient(isoDate),
    to: lenient(isoDate),
    guests: lenient(z.coerce.number().int().min(1).max(50)),
    min: lenient(z.coerce.number().min(0).max(10_000_000)),
    max: lenient(z.coerce.number().min(0).max(10_000_000)),
    duration: lenient(z.enum(DURATION_IDS)),
    format: lenient(z.enum(TOUR_FORMATS)),
    theme: lenient(z.enum(THEME_IDS)),
    sort: z.preprocess(blankToUndefined, z.enum(['soonest', 'price_asc', 'price_desc']).default('soonest')).catch('soonest'),
    page: lenient(z.coerce.number().int().min(1).max(1000)),
  })
  .transform((v) => {
    // Swapped ranges are almost always a typo: honour the intent instead of returning nothing.
    let { from, to, min, max } = v;
    if (from && to && from > to) [from, to] = [to, from];
    if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
    return { ...v, from, to, min, max, page: v.page ?? 1 };
  });

export type CatalogSearch = z.output<typeof catalogSearchSchema>;

/** Normalizes Next's `searchParams` (string | string[] | undefined) and parses it leniently. */
export function parseCatalogSearch(params: Record<string, string | string[] | undefined>): CatalogSearch {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params)) flat[key] = Array.isArray(value) ? value[0] : value;
  return catalogSearchSchema.parse(flat);
}

/** Builds a /tours URL from a search, dropping defaults so URLs stay short and canonical. */
export function catalogHref(search: Partial<CatalogSearch>, overrides: Partial<CatalogSearch> = {}): string {
  const merged = { ...search, ...overrides };
  const qs = new URLSearchParams();
  const keys = ['q', 'destination', 'from', 'to', 'guests', 'min', 'max', 'duration', 'format', 'theme', 'sort', 'page'] as const;
  for (const key of keys) {
    const value = merged[key];
    if (value === undefined || value === null || value === '') continue;
    if (key === 'sort' && value === 'soonest') continue;
    if (key === 'page' && value === 1) continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `/tours?${s}` : '/tours';
}
