import { TourCardsGridSkeleton } from '@/components/landing/TourCardSkeleton';

// Shown while /tours (and, until their own segments resolve, /tours/[slug]) stream in.
export default function ToursLoading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-live="polite" aria-label="Loading tours">
      <div className="bg-brand-navy pt-28 pb-10 lg:pt-32 lg:pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-4">
          <div className="h-3 w-24 rounded bg-white/20 animate-pulse" />
          <div className="h-10 w-3/4 max-w-xl rounded bg-white/20 animate-pulse" />
          <div className="h-20 rounded-2xl bg-white/90 animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <TourCardsGridSkeleton count={6} />
      </div>
    </div>
  );
}
