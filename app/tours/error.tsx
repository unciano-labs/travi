'use client';

import PublicRouteError from '@/components/landing/PublicRouteError';

export default function ToursError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PublicRouteError error={error} retry={retry} segment="tours" backHref="/" backLabel="Go home" />;
}
