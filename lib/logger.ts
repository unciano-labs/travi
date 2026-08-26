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

/**
 * Centrally captures an unhandled or handled exception.
 * Outputs a structured error log via Pino and forwards to Sentry when configured.
 */
export function captureException(
  error: unknown,
  context?: Record<string, any>
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  logger.error(
    {
      err: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
      ...context,
    },
    context?.message || err.message
  );

  try {
    Sentry.captureException(err, {
      extra: context,
    });
  } catch (sentryErr) {
    logger.warn({ sentryErr }, 'Failed to send exception to Sentry');
  }
}
