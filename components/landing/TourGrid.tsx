import type { CatalogTour } from '@/lib/data/tours';
import TourCard from './TourCard';

/** Responsive grid of catalog cards. `eagerCount` cards load their image eagerly (likely LCP). */
export default function TourGrid({ tours, eagerCount = 0 }: { tours: CatalogTour[]; eagerCount?: number }) {
  return (
    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {tours.map((tour, i) => (
        <li key={tour.id} className="flex [&>article]:w-full">
          <TourCard tour={tour} priority={i < eagerCount} />
        </li>
      ))}
    </ul>
  );
}
