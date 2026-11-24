import { PageHeaderSkeleton, TourCardsGridSkeleton } from '@/components/ui/skeletons';

export default function VehiclesLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton breadcrumbs={2} hasAction={true} />
      <TourCardsGridSkeleton count={4} />
    </div>
  );
}
