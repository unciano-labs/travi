// Browser Sentry (ENG-03). Next.js runs this file before the app becomes interactive;
// sentry.client.config.ts is not loaded under Turbopack. No session replay (it would record PII).
import * as Sentry from '@sentry/nextjs';
import { config as zodConfig } from 'zod';
import { scrubBreadcrumb, scrubEvent, scrubTransaction } from '@/lib/sentry-scrub';

// SEC-16: the CSP has no 'unsafe-eval'. Zod v4 probes `new Function()` to enable its JIT; the probe
// is caught but still raises a CSP violation in the console. Jitless mode skips the probe.
zodConfig({ jitless: true });

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubTransaction,
    beforeBreadcrumb: scrubBreadcrumb,
    debug: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
