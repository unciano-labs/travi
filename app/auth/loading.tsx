import CardBox from '@/components/ui/CardBox';
import { Skeleton } from '@/components/ui/skeleton';

export default function AuthLoading() {
  return (
    <div className="tw-admin relative min-h-screen overflow-hidden bg-lightprimary flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8" role="status" aria-live="polite" aria-label="Loading authentication">
      <div className="flex min-h-full items-center justify-center">
        <CardBox className="w-full border-none shadow-dashboard md:w-[450px] p-6 sm:p-8 space-y-6">
          <div className="text-center space-y-3">
            <Skeleton className="h-8 w-24 mx-auto" />
            <Skeleton className="h-6 w-48 mx-auto" />
          </div>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
            <Skeleton className="h-10 w-full rounded-md mt-2" />
          </div>
        </CardBox>
      </div>
    </div>
  );
}
