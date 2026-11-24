import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeletons';

export default function OrganizerBookingsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <TableSkeleton rows={8} columns={5} />
    </div>
  );
}
