import { z } from 'zod';

// A "production deploy" is the live site, not `next build` on a laptop or a Vercel preview.
// Set APP_ENV=production explicitly, or rely on Vercel's VERCEL_ENV.
const isProductionDeploy = (process.env.APP_ENV ?? process.env.VERCEL_ENV) === 'production';

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WEBSITE_ID: z.string().min(1).optional(),
  ADMIN_EMAIL: z.string().email().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  PAYMONGO_SECRET_KEY: z.string().optional(),
  PAYMONGO_WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().min(32).optional(),
  OTP_SECRET: z.string().min(32).optional(),
  RESEND_API_KEY: z.string().min(1).optional(),
  RESEND_FROM_EMAIL: z.string().min(1).optional(),
});

// Without these, a production deploy would silently mock payments, expose the cron,
// disable rate limiting, or sign OTPs with a guessable key. Fail at startup instead.
const REQUIRED_IN_PRODUCTION = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'WEBSITE_ID',
  'ADMIN_EMAIL',
  'NEXT_PUBLIC_SITE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'PAYMONGO_SECRET_KEY',
  'PAYMONGO_WEBHOOK_SECRET',
  'CRON_SECRET',
  'OTP_SECRET',
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
] as const;

const productionSchema = envSchema.superRefine((value, ctx) => {
  if (!isProductionDeploy) return;
  for (const key of REQUIRED_IN_PRODUCTION) {
    if (!value[key]) {
      ctx.addIssue({ code: 'custom', path: [key], message: `${key} is required in production` });
    }
  }
  if (value.PAYMONGO_SECRET_KEY && !value.PAYMONGO_SECRET_KEY.startsWith('sk_live_')) {
    ctx.addIssue({ code: 'custom', path: ['PAYMONGO_SECRET_KEY'], message: 'Production must use a live PayMongo key (sk_live_)' });
  }
});

const parsed = productionSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  WEBSITE_ID: process.env.WEBSITE_ID,
  ADMIN_EMAIL: process.env.ADMIN_EMAIL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_DSN: process.env.SENTRY_DSN,
  PAYMONGO_SECRET_KEY: process.env.PAYMONGO_SECRET_KEY,
  PAYMONGO_WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  OTP_SECRET: process.env.OTP_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
});

// Web Crypto, not node:crypto: this module is also bundled for the browser and the edge middleware.
function ephemeralSecret() {
  const bytes = new Uint8Array(32);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export const env = {
  ...parsed,
  IS_PRODUCTION_DEPLOY: isProductionDeploy,
  // Outside production, an unset OTP_SECRET gets a random per-process key: OTPs work within one
  // dev server run, and there is never a well-known fallback secret.
  OTP_SECRET: parsed.OTP_SECRET ?? ephemeralSecret(),
};
