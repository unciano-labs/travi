import type { Metadata } from 'next';
import Link from 'next/link';
import { SearchX, X } from 'lucide-react';
import Header from '@/components/landing/Header';
import Footer from '@/components/landing/Footer';
import TourGrid from '@/components/landing/TourGrid';
import { CATALOG_FORM_ID, CatalogFilterPanel, CatalogSearchBar } from '@/components/landing/CatalogFilters';
import CatalogFormEnhancer from '@/components/landing/CatalogFormEnhancer';
import { getCatalogPage } from '@/lib/data/tours';
import { manilaToday } from '@/lib/datetime';
import { formatDate, formatPHP } from '@/lib/format';
import {
  CATALOG_PAGE_SIZE,
  DURATIONS,
  TOUR_FORMAT_LABELS,
  TOUR_THEMES,
  catalogHref,
  parseCatalogSearch,
  type CatalogSearch,
} from '@/lib/schemas/catalog';

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type FilterKey = 'q' | 'destination' | 'from' | 'to' | 'guests' | 'min' | 'max' | 'duration' | 'format' | 'theme';

function activeFilters(search: CatalogSearch) {
  const fmtDate = (d: string) => formatDate(d, { month: 'short', day: 'numeric' });
  const chips: { key: FilterKey; label: string }[] = [];
  if (search.q) chips.push({ key: 'q', label: `“${search.q}”` });
  if (search.destination) chips.push({ key: 'destination', label: search.destination });
  if (search.from) chips.push({ key: 'from', label: `From ${fmtDate(search.from)}` });
  if (search.to) chips.push({ key: 'to', label: `By ${fmtDate(search.to)}` });
  if (search.guests) chips.push({ key: 'guests', label: `${search.guests} guest${search.guests > 1 ? 's' : ''}` });
  if (search.min !== undefined) chips.push({ key: 'min', label: `Min ${formatPHP(search.min, { cents: 'auto' })}` });
  if (search.max !== undefined) chips.push({ key: 'max', label: `Max ${formatPHP(search.max, { cents: 'auto' })}` });
  if (search.duration) chips.push({ key: 'duration', label: DURATIONS.find((d) => d.id === search.duration)?.label ?? search.duration });
  if (search.format) chips.push({ key: 'format', label: TOUR_FORMAT_LABELS[search.format] });
  if (search.theme) chips.push({ key: 'theme', label: TOUR_THEMES.find((t) => t.id === search.theme)?.label ?? search.theme });
  return chips;
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const search = parseCatalogSearch(await searchParams);
  const filtered = activeFilters(search).length > 0 || search.sort !== 'soonest';
  const rawWhere = search.destination || search.q;
  const where = rawWhere ? rawWhere.charAt(0).toUpperCase() + rawWhere.slice(1) : undefined;
  const title = where ? `Tours in ${where} | Travi` : 'Browse Philippine Tours | Travi';
  const description = where
    ? `Compare and book ${where} tour packages from local Philippine organizers. Pay securely with GCash or Maya.`
    : 'Browse and book tour packages across the Philippines — Palawan, Siargao, Batanes and more — from local organizers.';
  return {
    title,
    description,
    // Only the unfiltered catalog (and its pages) is canonical; filter combinations are endless.
    alternates: { canonical: catalogHref({ page: search.page }) },
    robots: filtered ? { index: false, follow: true } : undefined,
    openGraph: { title, description, url: '/tours', type: 'website' },
  };
}

export default async function ToursCatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const search = parseCatalogSearch(await searchParams);
  const { tours, total, page, pageCount } = await getCatalogPage(search, CATALOG_PAGE_SIZE);
  const chips = activeFilters(search);
  const refineCount = chips.filter((c) => !['q', 'from', 'to', 'guests'].includes(c.key)).length;
  const firstShown = total === 0 ? 0 : (page - 1) * CATALOG_PAGE_SIZE + 1;
  const lastShown = Math.min(page * CATALOG_PAGE_SIZE, total);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-grow">
        <section className="bg-brand-navy pt-28 pb-10 lg:pt-32 lg:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-widest text-sky-300 mb-2">Tour catalog</p>
            <h1 className="text-3xl lg:text-5xl font-extrabold text-white font-display mb-6">
              Find your next Philippine adventure
            </h1>
            <CatalogSearchBar search={search} today={manilaToday()} />
            <CatalogFormEnhancer formId={CATALOG_FORM_ID} />
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 lg:py-12">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 items-start">
            <aside aria-label="Filters" className="lg:sticky lg:top-24">
              <CatalogFilterPanel search={search} activeCount={refineCount} />
            </aside>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                <h2 className="text-sm font-semibold text-slate-600" aria-live="polite">
                  {total === 0
                    ? 'No tours found'
                    : tours.length === 0
                      ? `${total} tour${total === 1 ? '' : 's'} found`
                      : `Showing ${firstShown}–${lastShown} of ${total} tour${total === 1 ? '' : 's'}`}
                </h2>
                {chips.length > 0 && (
                  <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                    {chips.map((chip) => (
                      <li key={chip.key}>
                        <Link
                          href={catalogHref(search, { [chip.key]: undefined, page: 1 })}
                          aria-label={`Remove filter: ${chip.label}`}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:border-coral hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
                        >
                          {chip.label}
                          <X className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {tours.length > 0 ? (
                <>
                  <TourGrid tours={tours} eagerCount={page === 1 ? 3 : 0} />
                  <Pagination search={search} page={page} pageCount={pageCount} />
                </>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                  <SearchX className="w-10 h-10 text-slate-300 mb-4" aria-hidden="true" />
                  <p className="text-base font-bold text-slate-800 mb-1">
                    {total > 0 ? 'This page is empty.' : 'No tours match your search.'}
                  </p>
                  <p className="text-sm text-slate-500 mb-6">
                    {total > 0
                      ? 'There are fewer results than this page number.'
                      : 'Try other dates, fewer filters or a nearby destination.'}
                  </p>
                  <Link
                    href={total > 0 ? catalogHref(search, { page: 1 }) : '/tours'}
                    className="rounded-xl bg-coral hover:bg-coral/90 px-5 py-2.5 text-sm font-extrabold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
                  >
                    {total > 0 ? 'Back to the first page' : 'See all tours'}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}

function Pagination({ search, page, pageCount }: { search: CatalogSearch; page: number; pageCount: number }) {
  if (pageCount <= 1) return null;
  // Current page ±2, plus first and last.
  const pages = Array.from({ length: pageCount }, (_, i) => i + 1).filter(
    (p) => p === 1 || p === pageCount || Math.abs(p - page) <= 2
  );
  const linkClass =
    'min-w-10 h-10 inline-flex items-center justify-center rounded-lg border px-3 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral';

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-wrap items-center justify-center gap-2">
      {page > 1 && (
        <Link rel="prev" href={catalogHref(search, { page: page - 1 })} className={`${linkClass} border-slate-200 bg-white text-slate-700 hover:border-coral hover:text-coral`}>
          Previous
        </Link>
      )}
      {pages.map((p, i) => (
        <span key={p} className="flex items-center gap-2">
          {i > 0 && p - pages[i - 1] > 1 && <span className="text-slate-400" aria-hidden="true">…</span>}
          {p === page ? (
            <span aria-current="page" className={`${linkClass} border-coral bg-coral text-white`}>{p}</span>
          ) : (
            <Link href={catalogHref(search, { page: p })} aria-label={`Page ${p}`} className={`${linkClass} border-slate-200 bg-white text-slate-700 hover:border-coral hover:text-coral`}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < pageCount && (
        <Link rel="next" href={catalogHref(search, { page: page + 1 })} className={`${linkClass} border-slate-200 bg-white text-slate-700 hover:border-coral hover:text-coral`}>
          Next
        </Link>
      )}
    </nav>
  );
}
