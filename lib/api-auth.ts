import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function verifyApiAuth(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }

  const token = authHeader.split(' ')[1];

  // We use the standard supabase-js client to verify the JWT
  // because createServerClient expects cookies, whereas API routes
  // from mobile will pass Bearer tokens in headers.
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    }
  });

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw new Error('Invalid or expired token');
  }

  // Fetch the user's profile to get the profile ID for database relations
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('User profile not found');
  }

  return { user, profile, supabase };
}

export async function assertApiRole(supabase: any, userProfileId: string, requiredRole: string) {
  const websiteId = env.WEBSITE_ID;
  
  let query = supabase
    .from('user_roles')
    .select(`
      website_roles!inner(role, website_id)
    `)
    .eq('user_profile_id', userProfileId);

  if (websiteId) {
    query = query.eq('website_roles.website_id', websiteId);
  }

  const { data, error } = await query;
  if (error || !data || data.length === 0) {
    throw new Error('Forbidden: No roles assigned');
  }

  const roles = data.map((r: any) => r.website_roles.role);
  if (!roles.includes(requiredRole)) {
    throw new Error(`Forbidden: Requires ${requiredRole} role`);
  }

  return roles;
}
