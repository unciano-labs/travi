'use client';

import PublicRouteError from '@/components/landing/PublicRouteError';

export default function DestinationsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <PublicRouteError error={error} retry={retry} segment="destinations" backHref="/" backLabel="Go home" />;
}

