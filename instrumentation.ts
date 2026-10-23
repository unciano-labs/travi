// Next.js server instrumentation (ENG-03): loads the Sentry config for the active runtime and
// reports every uncaught server error (RSC render, route handler, Server Action, middleware).
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
