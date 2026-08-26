export function TourCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm flex flex-col animate-pulse">
      {/* Image Skeleton */}
      <div className="h-48 bg-slate-200" />
      
      <div className="p-5 flex-1 flex flex-col space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="h-5 bg-slate-200 rounded w-3/4" />
          <div className="h-4 bg-amber-100 rounded w-10" />
        </div>
        
        <div className="flex items-center gap-3">
          <div className="h-3.5 bg-slate-200 rounded w-20" />
          <div className="h-3.5 bg-slate-200 rounded w-16" />
          <div className="h-3.5 bg-slate-200 rounded w-24" />
        </div>
        
        <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
          <div className="space-y-1">
            <div className="h-2.5 bg-slate-200 rounded w-14" />
            <div className="h-5 bg-slate-200 rounded w-24" />
          </div>
          <div className="h-8 bg-slate-200 rounded-lg w-28" />
        </div>
      </div>
    </div>
  );
}

export function TourCardsGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <TourCardSkeleton key={i} />
      ))}
    </div>
  );
}
