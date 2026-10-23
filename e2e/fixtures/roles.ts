// Shared helpers for the authenticated e2e suite (e2e/authenticated/**). See e2e/README.md.
//
// Credentials come ONLY from environment variables (never hardcode them). Every authenticated spec
// skips itself when its role's variables are missing, so `npm run test:e2e` stays green locally.
import path from 'node:path';

export const ROLES = ['traveler', 'organizer', 'transporter', 'admin'] as const;
export type Role = (typeof ROLES)[number];

const AUTH_DIR = path.join(__dirname, '.auth');

/** Where the auth setup saves the signed-in browser state (cookies) for a role. Git-ignored. */
export function storageStatePath(role: Role): string {
  return path.join(AUTH_DIR, `${role}.json`);
}

function envPrefix(role: Role) {
  return `E2E_${role.toUpperCase()}`;
}

export function credentials(role: Role): { email: string; password: string } | null {
  const email = process.env[`${envPrefix(role)}_EMAIL`]?.trim();
  const password = process.env[`${envPrefix(role)}_PASSWORD`];
  return email && password ? { email, password } : null;
}

export function hasCredentials(role: Role): boolean {
  return credentials(role) !== null;
}

export function missingCredentialsMessage(role: Role): string {
  return `${envPrefix(role)}_EMAIL / ${envPrefix(role)}_PASSWORD not set; skipping ${role} e2e`;
}

/**
 * Tests that create data (bookings, tours) run only when E2E_ALLOW_WRITES=1. Set it only when the
 * app under test points at the STAGING Supabase project.
 */
export const writesAllowed = process.env.E2E_ALLOW_WRITES === '1';
export const WRITES_DISABLED_MESSAGE = 'E2E_ALLOW_WRITES is not 1; skipping a test that writes to the database';

const PRODUCTION_HOSTS = new Set(['travi.ph', 'www.travi.ph', 'travi.app', 'www.travi.app']);

/**
 * Authenticated tests sign in as real accounts and may write data: refuse to run them against the
 * production site. (They must also never run against a local server wired to the production DB;
 * that is a setup rule documented in e2e/README.md, since the browser cannot see which DB is used.)
 */
export function productionTargetReason(): string | null {
  const base = process.env.PLAYWRIGHT_TEST_BASE_URL;
  if (!base) return null;
  try {
    const host = new URL(base).hostname.toLowerCase();
    return PRODUCTION_HOSTS.has(host) ? `Refusing to run authenticated e2e against production (${host})` : null;
  } catch {
    return `PLAYWRIGHT_TEST_BASE_URL is not a valid URL: ${base}`;
  }
}

/** Reason to skip a role's specs, or null when they can run. */
export function skipReason(role: Role): string | null {
  return productionTargetReason() ?? (hasCredentials(role) ? null : missingCredentialsMessage(role));
}
