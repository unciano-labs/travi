import { Loader2 } from 'lucide-react';

export default function BookingLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-10 h-10 text-coral animate-spin" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500">Loading your booking…</p>
      </div>
    </main>
  );
}
