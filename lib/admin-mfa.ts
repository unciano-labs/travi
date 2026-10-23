// Admin TOTP MFA state (SEC-12). Shared by the middleware gate and the admin login action.
// Edge-safe: no node:* imports.
import { decodeJwt } from 'jose';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { env } from '@/lib/env';

export type AdminMfaState = 'not_required' | 'verified' | 'needs_verify' | 'needs_enroll';

export const ADMIN_MFA_ENROLL_PATH = '/admin/mfa/enroll';
export const ADMIN_MFA_VERIFY_PATH = '/admin/mfa/verify';

export function hasVerifiedTotp(user: Pick<User, 'factors'>): boolean {
  return (user.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified');
}

/** The `aal` claim of an access token, only if it belongs to `userId`. */
export function aalOfToken(accessToken: string | undefined, userId: string): string | null {
  if (!accessToken) return null;
  try {
    const claims = decodeJwt(accessToken);
    return claims.sub === userId && typeof claims.aal === 'string' ? claims.aal : null;
  } catch {
    return null;
  }
}

/**
 * Where an admin session stands. `user` must come from `auth.getUser()` (server-verified, fresh
 * factors); the access token is the one getUser() just validated, so its `aal` claim is trusted.
 */
export async function getAdminMfaState(supabase: SupabaseClient, user: User): Promise<AdminMfaState> {
  if (!env.ADMIN_MFA_REQUIRED) return 'not_required';
  // Reading access_token (not session.user) avoids the getSession() "insecure user" path.
  const { data } = await supabase.auth.getSession();
  if (aalOfToken(data.session?.access_token, user.id) === 'aal2') return 'verified';
  return hasVerifiedTotp(user) ? 'needs_verify' : 'needs_enroll';
}

export function adminMfaPath(state: AdminMfaState): string | null {
  if (state === 'needs_verify') return ADMIN_MFA_VERIFY_PATH;
  if (state === 'needs_enroll') return ADMIN_MFA_ENROLL_PATH;
  return null;
}
