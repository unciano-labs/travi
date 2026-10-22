import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getCachedPublicTours } from '@/lib/data/tours';
import TourGrid from './TourGrid';
import { TourCardsGridSkeleton } from './TourCardSkeleton';

const LANDING_TOUR_COUNT = 6;

async function TourListLoader() {
  const { tours, total } = await getCachedPublicTours(0, LANDING_TOUR_COUNT);

  if (tours.length === 0) {
    return <p className="text-center py-12 text-slate-500">No tours available right now. Check back soon!</p>;
  }

  return (
    <>
      <TourGrid tours={tours} />
      <div className="mt-12 text-center">
        <Link
          href="/tours"
          className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-coral text-slate-700 hover:text-coral transition-colors text-sm font-bold px-6 py-3 rounded-xl shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
        >
          {total > tours.length ? `Browse all ${total} tours` : 'Browse all tours'}
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </>
  );
}

export default function ToursSection() {
  return (
    <section id="tours" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-coral mb-2">Curated Packages</p>
          <h2 className="text-2xl lg:text-4xl font-extrabold text-slate-900 mb-4 font-display">Latest Tours</h2>
          <p className="text-slate-600 text-sm">Experience the best of the Philippines with packages from local organizers.</p>
        </div>

        <Suspense fallback={<TourCardsGridSkeleton count={LANDING_TOUR_COUNT} />}>
          <TourListLoader />
        </Suspense>
      </div>
    </section>
  );
}
