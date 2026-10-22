import Link from 'next/link';
import { ChevronDown, SlidersHorizontal } from 'lucide-react';
import {
  CATALOG_SORTS,
  DURATIONS,
  TOUR_FORMATS,
  TOUR_FORMAT_LABELS,
  TOUR_THEMES,
  type CatalogSearch,
} from '@/lib/schemas/catalog';

// Plain GET form: filtering works without JavaScript and every result page is a shareable URL.
// The hero search bar and this panel submit together (the panel's fields use form="catalog-search").

export const CATALOG_FORM_ID = 'catalog-search';

const POPULAR_DESTINATIONS = ['Palawan', 'Siargao', 'Boracay', 'Cebu', 'Bohol', 'Sagada', 'Batanes', 'Vigan', 'Baguio', 'Ilocos'];

const fieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/40';
const labelClass = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

export function CatalogSearchBar({ search, today }: { search: CatalogSearch; today: string }) {
  return (
    <form
      id={CATALOG_FORM_ID}
      action="/tours"
      method="get"
      role="search"
      aria-label="Search tours"
      className="bg-white rounded-2xl p-4 md:p-5 shadow-lift grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr_0.8fr_auto] gap-3 items-end"
    >
      <div>
        <label htmlFor="catalog-q" className={labelClass}>Where to?</label>
        <input id="catalog-q" name="q" type="search" defaultValue={search.q ?? ''} maxLength={80}
          placeholder="Destination, activity or tour name" className={fieldClass} />
      </div>
      <div>
        <label htmlFor="catalog-from" className={labelClass}>Departing from</label>
        <input id="catalog-from" name="from" type="date" min={today} defaultValue={search.from ?? ''} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="catalog-to" className={labelClass}>Departing by</label>
        <input id="catalog-to" name="to" type="date" min={today} defaultValue={search.to ?? ''} className={fieldClass} />
      </div>
      <div>
        <label htmlFor="catalog-guests" className={labelClass}>Guests</label>
        <input id="catalog-guests" name="guests" type="number" min={1} max={50} inputMode="numeric"
          defaultValue={search.guests ?? ''} placeholder="Any" className={fieldClass} />
      </div>
      <button type="submit"
        className="h-[42px] rounded-lg bg-coral hover:bg-coral/90 px-6 text-sm font-extrabold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2">
        Search
      </button>
    </form>
  );
}

export function CatalogFilterPanel({ search, activeCount }: { search: CatalogSearch; activeCount: number }) {
  return (
    <details
      open={activeCount > 0 || undefined}
      className="group bg-white rounded-2xl border border-slate-100 shadow-sm lg:[&::details-content]:[content-visibility:visible]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-4 text-sm font-extrabold text-slate-900 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-2xl">
        <span className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-coral" aria-hidden="true" />
          Filters &amp; sort
          {activeCount > 0 && (
            <span className="rounded-full bg-coral/10 px-2 py-0.5 text-[11px] font-bold text-coral">{activeCount} active</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180 lg:hidden" aria-hidden="true" />
      </summary>

      <div className="space-y-5 border-t border-slate-100 px-5 py-5">
        <div>
          <label htmlFor="catalog-sort" className={labelClass}>Sort by</label>
          <select id="catalog-sort" name="sort" form={CATALOG_FORM_ID} defaultValue={search.sort} className={fieldClass}>
            {CATALOG_SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="catalog-destination" className={labelClass}>Destination</label>
          <input id="catalog-destination" name="destination" form={CATALOG_FORM_ID} list="catalog-destinations"
            defaultValue={search.destination ?? ''} maxLength={80} placeholder="Any destination" className={fieldClass} />
          <datalist id="catalog-destinations">
            {POPULAR_DESTINATIONS.map((d) => <option key={d} value={d} />)}
          </datalist>
        </div>

        <fieldset>
          <legend className={labelClass}>Price per person (₱)</legend>
          <div className="grid grid-cols-2 gap-2">
            <input aria-label="Minimum price" name="min" form={CATALOG_FORM_ID} type="number" min={0} step={100}
              inputMode="numeric" defaultValue={search.min ?? ''} placeholder="Min" className={fieldClass} />
            <input aria-label="Maximum price" name="max" form={CATALOG_FORM_ID} type="number" min={0} step={100}
              inputMode="numeric" defaultValue={search.max ?? ''} placeholder="Max" className={fieldClass} />
          </div>
        </fieldset>

        <div>
          <label htmlFor="catalog-duration" className={labelClass}>Duration</label>
          <select id="catalog-duration" name="duration" form={CATALOG_FORM_ID} defaultValue={search.duration ?? ''} className={fieldClass}>
            <option value="">Any length</option>
            {DURATIONS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="catalog-format" className={labelClass}>Tour type</label>
          <select id="catalog-format" name="format" form={CATALOG_FORM_ID} defaultValue={search.format ?? ''} className={fieldClass}>
            <option value="">Any type</option>
            {TOUR_FORMATS.map((f) => <option key={f} value={f}>{TOUR_FORMAT_LABELS[f]}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="catalog-theme" className={labelClass}>Theme</label>
          <select id="catalog-theme" name="theme" form={CATALOG_FORM_ID} defaultValue={search.theme ?? ''} className={fieldClass}>
            <option value="">Any theme</option>
            {TOUR_THEMES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" form={CATALOG_FORM_ID}
            className="flex-1 rounded-lg bg-coral hover:bg-coral/90 px-4 py-2.5 text-sm font-extrabold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2">
            Apply filters
          </button>
          <Link href="/tours" className="text-sm font-semibold text-slate-500 hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral rounded">
            Clear all
          </Link>
        </div>
      </div>
    </details>
  );
}
