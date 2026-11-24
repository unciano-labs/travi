import { PageHeaderSkeleton, StatCardsSkeleton, TableSkeleton } from '@/components/ui/skeletons';

export default function ScheduleBookingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton breadcrumbs={4} hasAction={true} />
      <StatCardsSkeleton count={3} />
      <TableSkeleton rows={5} columns={6} />
    </div>
  );
}
