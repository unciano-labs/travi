// Tour detail skeleton (overrides the catalog skeleton in app/tours/loading.tsx for this segment).
export default function TourDetailLoading() {
  return (
    <div className="min-h-screen bg-slate-50" role="status" aria-live="polite" aria-label="Loading tour">
      <div className="h-[60vh] min-h-[500px] bg-slate-900 flex items-end">
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-4">
          <div className="h-5 w-40 rounded bg-white/20 animate-pulse" />
          <div className="h-12 w-3/4 max-w-2xl rounded bg-white/20 animate-pulse" />
          <div className="h-5 w-64 rounded bg-white/20 animate-pulse" />
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        <div className="lg:col-span-2 space-y-4">
          <div className="h-7 w-40 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-full rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-11/12 rounded bg-slate-200 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-slate-200 animate-pulse" />
        </div>
        <div className="h-80 rounded-3xl bg-white border border-slate-100 shadow-sm animate-pulse" />
      </div>
    </div>
  );
}
