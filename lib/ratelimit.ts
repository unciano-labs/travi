import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';
import { headers } from 'next/headers';

const hasRedis = Boolean(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN);

const redis = hasRedis
  ? new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Auth limiter: 5 requests per 10 seconds
export const authRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, '10 s'),
      analytics: true,
      prefix: 'ratelimit:auth',
    })
  : null;

// Mutation limiter: 10 requests per 10 seconds
export const mutationRateLimiter = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '10 s'),
      analytics: true,
      prefix: 'ratelimit:mutation',
    })
  : null;

/**
 * Retrieves the client's IP address from incoming headers.
 */
export async function getClientIp(): Promise<string> {
  const headerStore = await headers();
  const forwardedFor = headerStore.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = headerStore.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}

/**
 * Asserts that the given identifier has not exceeded the specified rate limit.
 * Throws an Error with a user-friendly message if rate limit is exceeded.
 */
export async function assertRateLimit(
  identifier: string,
  type: 'auth' | 'mutation' = 'auth'
): Promise<void> {
  const limiter = type === 'auth' ? authRateLimiter : mutationRateLimiter;

  if (!limiter) {
    // If Redis is not configured (e.g. local dev), allow request without blocking
    return;
  }

  const { success, reset } = await limiter.limit(identifier);

  if (!success) {
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    throw new Error(`Too many requests. Please try again in ${retryAfter}s.`);
  }
}
