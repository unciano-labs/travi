import pino from 'pino';
import * as Sentry from '@sentry/nextjs';

const isProduction = process.env.NODE_ENV === 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          ignore: 'pid,hostname',
          translateTime: 'SYS:standard',
        },
      }
    : undefined,
});

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    return new Error((error as { message: string }).message);
  }
  return new Error(String(error));
}

/**
 * Centrally captures an unhandled or handled exception.
 * Outputs a structured error log via Pino and forwards to Sentry when configured.
 */
export function captureException(
  error: unknown,
  context?: Record<string, any>
): void {
  const err = toError(error);
  // Supabase/PostgREST errors are plain objects: keep their code and hint (not `details`, which can echo row values).
  const pg = !(error instanceof Error) && error && typeof error === 'object' ? (error as { code?: unknown; hint?: unknown }) : null;
  const pgFields = pg ? { code: typeof pg.code === 'string' ? pg.code : undefined, hint: typeof pg.hint === 'string' ? pg.hint : undefined } : {};

  logger.error(
    {
      err: {
        message: err.message,
        name: err.name,
        stack: err.stack,
        ...pgFields,
      },
      ...context,
    },
    context?.message || err.message
  );

  try {
    Sentry.captureException(err, {
      extra: pg ? { ...context, ...pgFields } : context,
    });
  } catch (sentryErr) {
    logger.warn({ sentryErr }, 'Failed to send exception to Sentry');
  }
}
