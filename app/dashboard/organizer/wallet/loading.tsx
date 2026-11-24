import CardBox from '@/components/ui/CardBox';
import { PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

export default function OrganizerWalletLoading() {
  return (
    <div className="space-y-6" aria-hidden="true">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <StatCardsSkeleton count={3} />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-5">
          <CardBox className="p-6 space-y-4">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardBox>
        </div>
        <div className="col-span-12 lg:col-span-7">
          <TableSkeleton rows={5} columns={4} />
        </div>
      </div>
    </div>
  );
}
