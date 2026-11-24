'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Landmark,
  LayoutGrid,
  Search,
  Sparkles,
  Trees,
  UtensilsCrossed,
  Waves,
  X,
} from 'lucide-react';
import type { CatalogTour } from '@/lib/data/tours';
import { TOUR_THEMES, catalogHref } from '@/lib/schemas/catalog';
import TourCard from './TourCard';

const LANDING_VISIBLE_COUNT = 9;

const THEME_ICONS: Record<string, typeof LayoutGrid> = {
  island_hopping: Waves,
  adventure_sports: Compass,
  city_historical: Landmark,
  nature_wildlife: Trees,
  wellness_retreat: Sparkles,
  culinary_food: UtensilsCrossed,
};

export default function LandingToursBrowser({
  tours,
  total,
}: {
  tours: CatalogTour[];
  total: number;
}) {
  const [activeTheme, setActiveTheme] = useState<string>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tours.filter((tour) => {
      if (activeTheme !== 'all' && !tour.themes.includes(activeTheme)) {
        return false;
      }
      if (q) {
        const haystack = [tour.title, tour.location, tour.city ?? '', tour.province ?? '']
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [tours, activeTheme, query]);

  const visibleTours = filtered.slice(0, LANDING_VISIBLE_COUNT);
  const browseHref = catalogHref({
    theme: activeTheme === 'all' ? undefined : activeTheme,
    q: query.trim() || undefined,
  });
  const activeLabel =
    activeTheme === 'all'
      ? 'tours'
      : `${(TOUR_THEMES.find((t) => t.id === activeTheme)?.label ?? activeTheme).toLowerCase()} tours`;

  return (
    <>
      <div className="mb-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div
          className="flex flex-wrap items-center justify-center lg:justify-start gap-2"
          role="tablist"
          aria-label="Filter tours by category"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTheme === 'all'}
            onClick={() => setActiveTheme('all')}
            className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
              activeTheme === 'all'
                ? 'bg-coral text-white border-coral shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-coral hover:text-coral'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
            All Tours
          </button>
          {TOUR_THEMES.map((theme) => {
            const Icon = THEME_ICONS[theme.id] ?? Compass;
            const active = activeTheme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveTheme(theme.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                  active
                    ? 'bg-coral text-white border-coral shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-coral hover:text-coral'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {theme.label}
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72 shrink-0">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Quick filter by destination or title"
            aria-label="Quick filter tours on landing page"
            maxLength={80}
            className="w-full rounded-full border border-slate-200 bg-white pl-9 pr-9 py-2 text-xs font-medium text-slate-700 placeholder:text-slate-400 focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear quick filter"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {visibleTours.length > 0 ? (
        <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {visibleTours.map((tour) => (
            <li key={tour.id} className="flex [&>article]:w-full">
              <TourCard tour={tour} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm font-bold text-slate-800 mb-1">No matching tours in this preview.</p>
          <p className="text-xs text-slate-500 mb-4">
            Try another category or search the full catalog of {total} published tours.
          </p>
          <button
            type="button"
            onClick={() => {
              setActiveTheme('all');
              setQuery('');
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:border-coral hover:text-coral transition-colors"
          >
            Reset filter
          </button>
        </div>
      )}

      <div className="mt-12 text-center">
        <Link
          href={browseHref}
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-coral text-slate-700 hover:text-coral transition-colors text-sm font-bold px-6 py-3 rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {activeTheme === 'all' && !query.trim() && total > visibleTours.length
            ? `Browse all ${total} tours`
            : `See all ${activeLabel} on /tours`}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

