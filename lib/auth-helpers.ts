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

export async function assertRole(userId: string, requiredRole: string) {
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
  
  const roles = data ? data.map((r: any) => r.website_roles.role) : [];
  
  if (!roles.includes(requiredRole) && !roles.includes('admin')) {
    throw new Error(`Forbidden: Requires ${requiredRole} role.`);
  }

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
