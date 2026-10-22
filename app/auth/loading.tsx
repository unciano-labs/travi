import { Loader2 } from 'lucide-react';

export default function AuthLoading() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center" role="status">
      <Loader2 className="w-10 h-10 text-coral animate-spin" aria-hidden="true" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
