import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeletons';

export default function TransporterReviewsLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={false} />
      <TableSkeleton rows={5} columns={4} />
    </div>
  );
}
