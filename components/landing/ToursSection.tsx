import { Suspense } from 'react';
import { getPublicTours } from '@/actions/public';
import TourListClient from './TourListClient';
import { TourCardsGridSkeleton } from './TourCardSkeleton';

async function TourListLoader() {
  const { tours, hasMore } = await getPublicTours(0, 6);
  return <TourListClient initialTours={tours} initialHasMore={hasMore} />;
}

export default function ToursSection() {
  return (
    <section id="tours" className="py-16 lg:py-24 bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <p className="text-xs font-bold uppercase tracking-widest text-coral mb-2">Curated Packages</p>
          <h2 className="text-2xl lg:text-4xl font-extrabold text-slate-900 mb-4 font-display">Top Rated Tours</h2>
          <p className="text-slate-600 text-sm">Experience the best of the Philippines with packages curated by our top-rated local organizers.</p>
        </div>

        <Suspense fallback={<TourCardsGridSkeleton count={6} />}>
          <TourListLoader />
        </Suspense>
      </div>
    </section>
  );
}
