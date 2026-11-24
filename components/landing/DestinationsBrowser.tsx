'use client';

import { useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowRight,
  Compass,
  Landmark,
  MapPin,
  Search,
  Sparkles,
  Sun,
  Trees,
  UtensilsCrossed,
  Waves,
  X,
} from 'lucide-react';
import type { DestinationRegion, DestinationSeason, DestinationSummary } from '@/lib/data/destinations';
import { TOUR_THEMES } from '@/lib/schemas/catalog';
import { formatPHP } from '@/lib/format';

const REGIONS: { id: 'all' | DestinationRegion; label: string }[] = [
  { id: 'all', label: 'All Regions' },
  { id: 'Luzon', label: 'Luzon' },
  { id: 'Visayas', label: 'Visayas' },
  { id: 'Mindanao', label: 'Mindanao' },
];

const SEASONS: { id: 'all' | DestinationSeason; label: string }[] = [
  { id: 'all', label: 'Any Season' },
  { id: 'dry', label: 'Peak Dry (Dec–May)' },
  { id: 'east_coast', label: 'Surf & East Coast (Mar–Oct)' },
  { id: 'highlands', label: 'Cool Highlands (Nov–Feb)' },
];

const STYLE_SPOTS: Record<string, { icon: typeof Waves; spots: string }> = {
  island_hopping: { icon: Waves, spots: 'Palawan, Siargao, Cebu, Caramoan' },
  adventure_sports: { icon: Compass, spots: 'Badian, Sagada, Mt. Pulag, Albay' },
  city_historical: { icon: Landmark, spots: 'Intramuros, Vigan, Batanes, Banaue' },
  nature_wildlife: { icon: Trees, spots: 'Bohol, Donsol, Camiguin, Davao' },
  wellness_retreat: { icon: Sparkles, spots: 'El Nido, Boracay, Baguio, Siquijor' },
  culinary_food: { icon: UtensilsCrossed, spots: 'Binondo, Cebu, Iloilo, Vigan' },
};

const themeLabel = (id: string) => TOUR_THEMES.find((t) => t.id === id)?.label ?? id.replace(/_/g, ' ');

export default function DestinationsBrowser({
  destinations,
}: {
  destinations: DestinationSummary[];
}) {
  const [region, setRegion] = useState<'all' | DestinationRegion>('all');
  const [season, setSeason] = useState<'all' | DestinationSeason>('all');
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return destinations.filter((dest) => {
      if (region !== 'all' && dest.region !== region) return false;
      if (season !== 'all' && dest.season !== season) return false;
      if (q) {
        const hay = `${dest.name} ${dest.subtitle} ${dest.region} ${dest.highlight}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [destinations, region, season, query]);

  const hasFilters = region !== 'all' || season !== 'all' || query.trim() !== '';

  return (
    <div className="space-y-14">
      {/* Filter Controls: Region + Season + Quick Search */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter destinations by region">
            {REGIONS.map((item) => {
              const active = region === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRegion(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-bold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral ${
                    active
                      ? 'bg-coral text-white border-coral shadow-sm'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:border-coral hover:text-coral'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search island, province, or highlight"
              aria-label="Search destinations"
              maxLength={80}
              className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear destination search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Best Time to Visit Strip */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500 mr-1">
            <Sun className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" />
            Best time to visit:
          </span>
          {SEASONS.map((s) => {
            const active = season === s.id;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSeason(s.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                  active
                    ? 'bg-brand-navy text-white border-brand-navy'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-brand hover:text-brand-dark'
                }`}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Results Header */}
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <p className="text-sm font-semibold text-slate-600" aria-live="polite">
            Showing {filtered.length} of {destinations.length} Philippine destinations
          </p>
          {hasFilters && (
            <button
              type="button"
              onClick={() => {
                setRegion('all');
                setSeason('all');
                setQuery('');
              }}
              className="text-xs font-bold text-coral hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral rounded"
            >
              Reset filters
            </button>
          )}
        </div>

        {filtered.length > 0 ? (
          <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((dest, idx) => (
              <li key={dest.slug} className="flex">
                <article className="group w-full bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col">
                  <div className="relative h-52 bg-slate-100">
                    <Image
                      src={dest.image}
                      alt={`${dest.name} — ${dest.subtitle}`}
                      fill
                      priority={idx < 3}
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/15 to-transparent" aria-hidden="true" />
                    <span className="absolute top-3 left-3 rounded-md bg-brand-navy/85 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                      {dest.region}
                    </span>
                    <span className="absolute top-3 right-3 rounded-md bg-white/90 backdrop-blur-md px-2.5 py-1 text-[10px] font-bold text-slate-800">
                      Best: {dest.peakSeason}
                    </span>
                    <div className="absolute bottom-3 left-4 right-4 text-white">
                      <h2 className="text-xl font-extrabold leading-tight">{dest.name}</h2>
                      <p className="text-xs text-sky-200 font-medium flex items-center gap-1 mt-0.5 truncate">
                        <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{dest.subtitle}</span>
                      </p>
                    </div>
                  </div>

                  <div className="p-5 flex-1 flex flex-col">
                    <p className="text-sm text-slate-600 leading-relaxed mb-4">{dest.highlight}</p>

                    {dest.themes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-5">
                        {dest.themes.map((theme) => (
                          <span
                            key={theme}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200"
                          >
                            {themeLabel(theme)}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-slate-900">
                          {dest.tourCount > 0
                            ? `${dest.tourCount} scheduled tour${dest.tourCount === 1 ? '' : 's'}`
                            : 'Coming soon'}
                        </p>
                        {dest.lowestPrice !== null && (
                          <p className="text-xs text-slate-500">
                            From <span className="font-bold text-slate-800">{formatPHP(dest.lowestPrice, { cents: 'auto' })}</span>
                          </p>
                        )}
                      </div>

                      <Link
                        href={`/tours?destination=${encodeURIComponent(dest.query)}`}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-coral hover:bg-coral-dark px-4 py-2.5 text-xs font-extrabold text-white shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                      >
                        Explore Tours
                        <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
            <p className="text-base font-bold text-slate-800 mb-1">No destinations match those filters.</p>
            <p className="text-sm text-slate-500 mb-5">Try another region, season, or browse all scheduled tours.</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setRegion('all');
                  setSeason('all');
                  setQuery('');
                }}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:border-coral hover:text-coral transition-colors"
              >
                Show all destinations
              </button>
              <Link
                href="/tours"
                className="rounded-xl bg-coral hover:bg-coral-dark px-5 py-2.5 text-sm font-extrabold text-white transition-colors"
              >
                Browse all tours
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Travel by Style Section */}
      <section aria-labelledby="travel-style-heading" className="pt-4">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand mb-1">Travel by Style</p>
            <h2 id="travel-style-heading" className="text-2xl font-extrabold text-slate-900">
              Pick an experience, find the place
            </h2>
          </div>
          <Link href="/tours" className="text-xs font-bold text-brand-dark hover:underline">
            View full tour catalog →
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {TOUR_THEMES.map((theme) => {
            const meta = STYLE_SPOTS[theme.id];
            const Icon = meta?.icon ?? Compass;
            return (
              <Link
                key={theme.id}
                href={`/tours?theme=${theme.id}`}
                className="group rounded-2xl bg-white border border-slate-200/80 p-5 shadow-sm hover:border-coral hover:shadow-md transition-all flex items-start gap-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
              >
                <div className="w-10 h-10 rounded-xl bg-sky-50 text-brand-dark flex items-center justify-center shrink-0 group-hover:bg-coral/10 group-hover:text-coral transition-colors">
                  <Icon className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-900 group-hover:text-coral transition-colors">{theme.label}</h3>
                  <p className="text-xs text-slate-500 mt-1">{meta?.spots ?? 'Across the Philippines'}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Partner CTA */}
      <section className="rounded-3xl bg-brand-navy text-white p-8 sm:p-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="max-w-xl">
          <p className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">For Local Tour Organizers</p>
          <h2 className="text-2xl font-extrabold mb-2">Run tours in another Philippine destination?</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            List your scheduled packages on Travi, accept GCash and Maya securely, and reach travelers nationwide.
          </p>
        </div>
        <Link
          href="/signup?role=organizer"
          className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-coral hover:bg-coral-dark px-6 py-3.5 text-sm font-extrabold text-white shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          Become an Organizer
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

