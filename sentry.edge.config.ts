// Sentry for the edge runtime (middleware). Loaded by instrumentation.ts register() (ENG-03).
// Reads process.env directly: this runs before lib/env.ts and must never fail startup.
import * as Sentry from '@sentry/nextjs';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from '@/lib/sentry-scrub';

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
    debug: false,
  });
}
