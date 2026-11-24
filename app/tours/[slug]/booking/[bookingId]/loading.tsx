import CardBox from '@/components/ui/CardBox';
import { Skeleton } from '@/components/ui/skeleton';

export default function BookingLoading() {
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12" role="status" aria-live="polite" aria-label="Loading your booking">
      <CardBox className="w-full max-w-lg p-6 sm:p-8 space-y-6 shadow-card border-slate-200">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="space-y-3 py-4 border-y border-slate-100">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="flex justify-between">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <Skeleton className="h-11 w-full rounded-lg" />
      </CardBox>
    </main>
  );
}
