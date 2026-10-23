import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

// Storage images come from whichever Supabase project this environment points at (staging or production).
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'xhjkkrjnlorrayuaxbra.supabase.co';

const isDev = process.env.NODE_ENV === 'development';
const siteIsHttps = (process.env.NEXT_PUBLIC_SITE_URL ?? '').startsWith('https://');

// ─── Content Security Policy (SEC-16) ───
// Static policy (no nonces): a nonce forces every page to render dynamically, which would turn off
// the cached catalog and tour pages. 'unsafe-inline' scripts are therefore allowed (Next's inline
// bootstrap scripts need it); everything else is locked to an allow-list. Keep it in sync with
// images.remotePatterns below and with any new third-party host (see docs/RUNBOOK.md).
const imageHosts = [
  `https://${supabaseHost}`,
  'https://images.unsplash.com',
  'https://ui-avatars.com',
  'https://lh3.googleusercontent.com',
  'https://avatars.githubusercontent.com',
  'https://*.tile.openstreetmap.org', // Leaflet tiles (LocationPicker)
  'https://unpkg.com', // Leaflet marker icons
  'https://logo.clearbit.com', // bank logos (PayoutMethodsManager)
];

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://va.vercel-scripts.com`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: ${imageHosts.join(' ')}`,
  "font-src 'self' data: https://fonts.gstatic.com",
  `media-src 'self' https://${supabaseHost} https://commondatastorage.googleapis.com`,
  [
    "connect-src 'self'",
    `https://${supabaseHost}`,
    `wss://${supabaseHost}`, // realtime notifications
    'https://psgc.gitlab.io', // PH provinces/cities (TourForm)
    'https://*.sentry.io', // Sentry ingest (o<id>.ingest[.us|.de].sentry.io)
    'https://va.vercel-scripts.com',
    'https://vitals.vercel-insights.com',
    ...(isDev ? ['ws://localhost:*', 'ws://127.0.0.1:*'] : []),
  ].join(' '),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  // PayMongo checkout/3DS pages are reached by top-level redirects; allow them as form targets too.
  "form-action 'self' https://*.paymongo.com",
  "frame-ancestors 'none'",
  ...(siteIsHttps ? ['upgrade-insecure-requests'] : []),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=(), interest-cohort=()',
  },
];

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['127.0.0.1'],
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'ui-avatars.com',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
      },
    ],
  },
};

// Source maps are uploaded only when the build has Sentry credentials (Vercel production/preview
// env: SENTRY_AUTH_TOKEN, SENTRY_ORG, SENTRY_PROJECT). They are deleted from the output after upload.
const canUploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT
);

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  telemetry: false,
  sourcemaps: {
    disable: !canUploadSourceMaps,
    deleteSourcemapsAfterUpload: true,
  },
  release: {
    create: canUploadSourceMaps,
  },
  widenClientFileUpload: true,
  webpack: {
    treeshake: { removeDebugLogging: true },
  },
});
