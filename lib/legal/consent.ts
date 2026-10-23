// Consent capture helpers (LEG-01/02/05). Server-only; deliberately NOT Server Actions.
// Acceptances are stored in `legal_acceptances` (migration 20261026090000): append-only, one row per
// acceptance event, with the document version from lib/legal/company.ts.
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { getClientIp } from '@/lib/ratelimit';
import { acceptanceVersion, type AcceptanceDocument } from '@/lib/legal/company';

export interface ConsentFingerprint {
  /** Keyed hash of the client IP (32 hex chars). Never the raw IP. */
  ipHash: string | null;
  /** Browser user agent, truncated. */
  userAgent: string | null;
}

// Domain-separated key: the IP hash must not be comparable with anything else signed by OTP_SECRET.
// Rotating OTP_SECRET only makes old hashes non-comparable with new ones.
function ipHashKey(): Buffer {
  return createHmac('sha256', env.OTP_SECRET).update('travi:legal-acceptance-ip-hash:v1').digest();
}

/** Evidence stored with an acceptance: a pseudonymous IP hash and a short user agent. */
export async function consentFingerprint(): Promise<ConsentFingerprint> {
  const headerList = await headers();
  const ip = await getClientIp();
  const ua = headerList.get('user-agent');
  return {
    ipHash: ip ? createHmac('sha256', ipHashKey()).update(ip).digest('hex').slice(0, 32) : null,
    userAgent: ua ? ua.slice(0, 200) : null,
  };
}

/**
 * Record that the signed-in user accepted `document` at its current version. Uses the caller's RLS
 * client: the DB forces the owner and timestamp, and only lets `checkout_terms` reference the
 * caller's own booking. Throws on failure (callers must not proceed without a record).
 */
export async function recordAcceptance(
  supabase: SupabaseClient,
  input: { userProfileId: string; document: AcceptanceDocument; referenceId?: string | null }
): Promise<void> {
  const fingerprint = await consentFingerprint();
  const { error } = await supabase.from('legal_acceptances').insert({
    user_profile_id: input.userProfileId,
    document: input.document,
    version: acceptanceVersion(input.document),
    reference_id: input.referenceId ?? null,
    ip_hash: fingerprint.ipHash,
    user_agent: fingerprint.userAgent,
  });
  if (error) throw new Error('We could not record your acceptance of the terms. Please try again.');
}

/**
 * Signup metadata (`options.data.legal_acceptance`). Copied into legal_acceptances by the
 * `user_profiles_record_signup_acceptances` trigger when the profile is created.
 */
export async function signupAcceptanceMetadata() {
  const fingerprint = await consentFingerprint();
  return {
    terms: acceptanceVersion('terms'),
    privacy: acceptanceVersion('privacy'),
    ...(fingerprint.ipHash ? { ip_hash: fingerprint.ipHash } : {}),
    // Kept short: auth metadata travels in every session token.
    ...(fingerprint.userAgent ? { ua: fingerprint.userAgent.slice(0, 120) } : {}),
  };
}
