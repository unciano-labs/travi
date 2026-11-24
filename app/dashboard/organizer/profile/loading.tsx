import CardBox from '@/components/ui/CardBox';
import { PageHeaderSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizerProfileLoading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <CardBox className="p-6 space-y-4">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-24 w-full" />
          </CardBox>
          <CardBox className="p-6 space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
          </CardBox>
        </div>
      </div>
    </div>
  );
}
