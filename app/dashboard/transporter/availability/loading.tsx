import CardBox from '@/components/ui/CardBox';
import { PageHeaderSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function AvailabilityLoading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={true} />
      <CardBox className="p-6">
        <Skeleton className="h-[480px] w-full rounded-lg" />
      </CardBox>
    </div>
  );
}
