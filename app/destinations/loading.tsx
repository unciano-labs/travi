import { TourCardsGridSkeleton } from '@/components/landing/TourCardSkeleton';

export default function DestinationsLoading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-live="polite" aria-label="Loading destinations">
      <div className="bg-brand-navy pt-28 pb-12 lg:pt-32 lg:pb-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="h-3 w-36 rounded bg-white/20 animate-pulse" />
          <div className="h-10 w-3/4 max-w-xl rounded bg-white/20 animate-pulse" />
          <div className="h-4 w-2/3 max-w-lg rounded bg-white/15 animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <TourCardsGridSkeleton count={6} />
      </div>
    </div>
  );
}

