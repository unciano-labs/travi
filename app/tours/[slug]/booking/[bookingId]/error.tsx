'use client';

import PublicRouteError from '@/components/landing/PublicRouteError';

export default function BookingError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <PublicRouteError
      error={error}
      retry={retry}
      segment="tour-booking"
      backHref="/dashboard/traveler/bookings"
      backLabel="My bookings"
    />
  );
}
