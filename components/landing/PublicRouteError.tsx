'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

/**
 * Brand-themed error UI for public route segments (used by `error.tsx` files, which must be client
 * components). Reports to Sentry; shows no error details, since server errors are redacted anyway.
 */
export default function PublicRouteError({
  error,
  retry,
  segment,
  backHref = '/tours',
  backLabel = 'Browse tours',
}: {
  error: Error & { digest?: string };
  retry: () => void;
  segment: string;
  backHref?: string;
  backLabel?: string;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { segment } });
  }, [error, segment]);

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-24">
      <div role="alert" className="max-w-md w-full bg-white p-8 rounded-2xl shadow-card border border-slate-100 text-center space-y-4">
        <div className="w-12 h-12 bg-coral/10 text-coral rounded-full flex items-center justify-center mx-auto text-xl font-bold" aria-hidden="true">
          !
        </div>
        <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
        <p className="text-sm text-slate-600">
          We couldn&apos;t load this page. Please try again in a moment.
          {error.digest && <span className="block mt-2 text-xs text-slate-400">Reference: {error.digest}</span>}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <button
            type="button"
            onClick={() => retry()}
            className="flex-1 py-3 px-4 bg-coral hover:bg-coral/90 text-white font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral focus-visible:ring-offset-2"
          >
            Try again
          </button>
          <Link
            href={backHref}
            className="flex-1 py-3 px-4 border border-slate-200 text-slate-700 hover:border-coral hover:text-coral font-bold rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </main>
  );
}
