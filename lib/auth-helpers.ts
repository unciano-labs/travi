import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

export async function requireSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error('Unauthorized');
  }

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  return { user, profile, supabase };
}

async function fetchRoles(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const websiteId = env.WEBSITE_ID;

  let query = supabase
    .from('user_roles')
    .select(`
      user_profiles!inner(user_id),
      website_roles!inner(role, website_id)
    `)
    .eq('user_profiles.user_id', userId);

  if (websiteId) {
    query = query.eq('website_roles.website_id', websiteId);
  }

  const { data } = await query;
  return data ? data.map((r) => (r.website_roles as unknown as { role: string }).role) : [];
}

/**
 * Role check for Server Actions / RSC. Admin passes every role check, but whenever the caller is
 * acting AS an admin (required role 'admin', or allowed only through the admin bypass) the session
 * must also be MFA-verified (aal2, SEC-12) when ADMIN_MFA_REQUIRED is on.
 */
export async function assertRole(userId: string, requiredRole: string) {
  const roles = await fetchRoles(userId);
  const hasRole = roles.includes(requiredRole);

  if (!hasRole && !roles.includes('admin')) {
    throw new Error(`Forbidden: Requires ${requiredRole} role.`);
  }
  if (requiredRole === 'admin' || !hasRole) {
    await assertAdminAal2(userId);
  }

  return roles;
}

export const ADMIN_MFA_REQUIRED_MESSAGE =
  'Two-factor verification is required for admin actions. Sign in again and enter your authenticator code.';

/**
 * SEC-12: the current session must be aal2 (password + TOTP). getClaims() verifies the access
 * token (JWKS, or a getUser() round trip for HS256 projects), so the aal claim can be trusted.
 */
export async function assertAdminAal2(userId: string) {
  if (!env.ADMIN_MFA_REQUIRED) return;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims || claims.sub !== userId || claims.aal !== 'aal2') {
    throw new Error(ADMIN_MFA_REQUIRED_MESSAGE);
  }
}

/**
 * Admin role check WITHOUT the aal2 requirement. Only for the MFA enrol/verify actions themselves
 * (the step that upgrades an aal1 admin session to aal2). Never use it to guard anything else.
 */
export async function assertAdminRoleForMfa(userId: string) {
  const roles = await fetchRoles(userId);
  if (!roles.includes('admin')) throw new Error('Forbidden: Requires admin role.');
  return roles;
}

export const EMAIL_NOT_VERIFIED_MESSAGE =
  'Please verify your email address first. Open the confirmation link we emailed you, then try again.';

/**
 * BIZ-12: gate actions that need a reachable, verified email (booking, partner onboarding,
 * payouts). Uses Supabase Auth's own confirmation stamp, so it works with "Confirm email" ON
 * (stamped when the link is opened) and OFF (Supabase stamps it at signup).
 */
export function assertEmailVerified(user: { email_confirmed_at?: string | null } | null | undefined) {
  if (!user?.email_confirmed_at) {
    throw new Error(EMAIL_NOT_VERIFIED_MESSAGE);
  }
}
