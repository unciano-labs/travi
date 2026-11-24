import CardBox from '@/components/ui/CardBox';
import { PageHeaderSkeleton, StatCardsSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function TravelerBookingDetailLoading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton breadcrumbs={3} hasAction={true} />
      <StatCardsSkeleton count={3} />
      <CardBox className="p-6 space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-32 w-full" />
      </CardBox>
    </div>
  );
}
