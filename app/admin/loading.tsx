import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/skeletons';

export default function AdminLoading() {
  return (
    <div className="tw-admin space-y-6">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={true} />
      <TableSkeleton rows={8} columns={6} />
    </div>
  );
}
