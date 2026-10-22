// Account provisioning and role helpers shared by the auth Server Actions, the auth callback
// route and pages. Server-only; deliberately NOT Server Actions (AGENTS.md §3.2).
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';

export const SELF_SERVICE_ROLES = ['traveler', 'organizer', 'transporter'] as const;
export type SelfServiceRole = (typeof SELF_SERVICE_ROLES)[number];

export function isSelfServiceRole(value: unknown): value is SelfServiceRole {
  return typeof value === 'string' && (SELF_SERVICE_ROLES as readonly string[]).includes(value);
}

// The primary role is traveler if the user has it, else the first role (AGENTS.md §4.6).
export function primaryRole(roles: string[]): string | null {
  if (roles.includes('traveler')) return 'traveler';
  return roles[0] ?? null;
}

// Where a signed-in user lands when no `next` path was requested.
export function homePathForRoles(roles: string[]): string {
  if (roles.includes('admin')) return '/admin';
  const role = primaryRole(roles);
  return role ? `/dashboard/${role}` : '/dashboard';
}

// Absolute origin for links that leave the app (auth emails). NEXT_PUBLIC_SITE_URL wins (it is
// required in production); otherwise the request's own host, for local dev and previews.
export async function getSiteOrigin(): Promise<string> {
  if (env.NEXT_PUBLIC_SITE_URL) return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, '');
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'localhost:3000';
  const proto = headerList.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

type RoleRow = { website_roles: { role: string; website_id: string } | null };

// Roles of the signed-in user for this website (RLS: users read only their own roles).
export async function fetchUserRoles(supabase: SupabaseClient, authUserId: string): Promise<string[]> {
  let query = supabase
    .from('user_roles')
    .select('user_profiles!inner(user_id), website_roles!inner(role, website_id)')
    .eq('user_profiles.user_id', authUserId);

  if (env.WEBSITE_ID) {
    query = query.eq('website_roles.website_id', env.WEBSITE_ID);
  }

  const { data, error } = await query;
  if (error) throw new Error('Failed to verify user roles.');
  return ((data ?? []) as unknown as RoleRow[])
    .map((row) => row.website_roles?.role)
    .filter((role): role is string => typeof role === 'string');
}

function fullNameFromMetadata(user: User): string | null {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const name = str(meta.full_name) || [str(meta.first_name), str(meta.last_name)].filter(Boolean).join(' ');
  return name ? name.slice(0, 200) : null;
}

/**
 * Fallback for the auth.users → user_profiles trigger (migration 20261024090000): makes sure the
 * signed-in user has a profile and, if they have no role yet, the role they chose at signup.
 * Safe to call repeatedly. Uses the caller's RLS client: the profile insert is limited to the
 * caller's own row and assign_self_role never grants admin.
 * Returns the user's roles for this website.
 */
export async function ensureAccountProvisioned(supabase: SupabaseClient, user: User): Promise<string[]> {
  const { data: existing } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (!existing) {
    const { error } = await supabase
      .from('user_profiles')
      .upsert(
        { user_id: user.id, email: user.email ?? '', full_name: fullNameFromMetadata(user) },
        { onConflict: 'user_id', ignoreDuplicates: true }
      );
    if (error) captureException(error, { action: 'ensureAccountProvisioned:profile' });
  }

  let roles = await fetchUserRoles(supabase, user.id);

  const signupRole = (user.user_metadata as Record<string, unknown> | undefined)?.signup_role;
  if (roles.length === 0 && env.WEBSITE_ID && isSelfServiceRole(signupRole)) {
    const { error } = await supabase.rpc('assign_self_role', {
      p_role: signupRole,
      p_website_id: env.WEBSITE_ID,
    });
    if (error) {
      captureException(error, { action: 'ensureAccountProvisioned:role' });
    } else {
      roles = await fetchUserRoles(supabase, user.id);
    }
  }

  return roles;
}
