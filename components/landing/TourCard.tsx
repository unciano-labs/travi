import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, CalendarDays, Clock, MapPin, Star, Users } from 'lucide-react';
import type { CatalogTour } from '@/lib/data/tours';
import { TOUR_FORMAT_LABELS, TOUR_THEMES } from '@/lib/schemas/catalog';

const DEFAULT_IMAGE = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80';

const FORMAT_BADGE: Record<CatalogTour['format'], string> = {
  joiner: 'bg-emerald-600/90',
  private: 'bg-indigo-600/90',
  solo: 'bg-fuchsia-600/90',
};

const themeLabel = (id: string) => TOUR_THEMES.find((t) => t.id === id)?.label ?? id.replace(/_/g, ' ');
const peso = (n: number) => `₱${n.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`;
// next_start_date is a Manila business date (YYYY-MM-DD): format it as a calendar date, not an instant.
const formatDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

/** Catalog card shared by the landing page and /tours. Server-rendered; no client JS. */
export default function TourCard({ tour, priority = false }: { tour: CatalogTour; priority?: boolean }) {
  const image = tour.image_urls[0] || tour.cover_image_url || DEFAULT_IMAGE;
  const place = tour.city && tour.province ? `${tour.city}, ${tour.province}` : tour.location;

  return (
    <article className="group bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lift hover:-translate-y-1 transition-all duration-300 flex flex-col">
      <div className="relative h-48 bg-slate-100">
        <Image
          src={image}
          alt={tour.title}
          fill
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          className="object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <span className={`absolute top-3 left-3 backdrop-blur-md text-[10px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-md shadow-sm text-white ${FORMAT_BADGE[tour.format] ?? FORMAT_BADGE.joiner}`}>
          {TOUR_FORMAT_LABELS[tour.format] ?? 'Joiner tour'}
        </span>
        {tour.is_on_sale && (
          <span className="absolute top-3 right-3 bg-coral text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md shadow-sm">
            On sale
          </span>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-extrabold text-lg text-slate-900 leading-tight group-hover:text-coral transition-colors">
            <Link href={`/tours/${tour.slug}`} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral rounded">
              {tour.title}
            </Link>
          </h3>
          {tour.review_count > 0 && tour.rating_avg !== null ? (
            <span
              className="shrink-0 flex items-center gap-1 bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded text-xs font-bold"
              aria-label={`Rated ${tour.rating_avg} out of 5 from ${tour.review_count} review${tour.review_count === 1 ? '' : 's'}`}
            >
              <Star className="w-3 h-3 fill-current" aria-hidden="true" /> {tour.rating_avg.toFixed(1)}
              <span className="font-medium text-amber-500/80">({tour.review_count})</span>
            </span>
          ) : (
            <span className="shrink-0 bg-sky-50 text-brand-dark px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">New</span>
          )}
        </div>

        <ul className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-medium mb-2 flex-wrap">
          <li className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" aria-hidden="true" /> {place}</li>
          <li className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" aria-hidden="true" /> {tour.duration_days} day{tour.duration_days > 1 ? 's' : ''}
          </li>
          <li className="flex items-center gap-1"><Users className="w-3.5 h-3.5" aria-hidden="true" /> Up to {tour.calculated_max_pax} pax</li>
          <li className="flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" /> Next: {formatDate(tour.next_start_date)}
          </li>
        </ul>

        {tour.themes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {tour.themes.map((theme) => (
              <span key={theme} className="px-2 py-0.5 rounded text-[10px] font-medium text-slate-600 bg-slate-100 border border-slate-200">
                {themeLabel(theme)}
              </span>
            ))}
          </div>
        )}

        <div className="mt-auto pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Starting at</span>
            <div className="flex items-baseline gap-1.5">
              <span className="font-black text-xl text-slate-900 tracking-tight">{peso(tour.calculated_lowest_price)}</span>
              {tour.is_on_sale && tour.calculated_original_price !== null && (
                <span className="text-xs text-slate-400 line-through font-medium">
                  <span className="sr-only">Was </span>{peso(tour.calculated_original_price)}
                </span>
              )}
            </div>
          </div>
          <Link
            href={`/tours/${tour.slug}`}
            aria-label={`View tour: ${tour.title}`}
            className="flex items-center gap-1.5 bg-coral hover:bg-coral/90 text-white transition-all duration-300 text-sm font-extrabold px-5 py-2.5 rounded-xl shadow-card hover:shadow-lift hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            View Tour
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </article>
  );
}
