import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeletons';

export default function TravelerBookingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}
