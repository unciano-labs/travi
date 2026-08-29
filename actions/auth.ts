'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { z } from 'zod';
import { requireSession } from '@/lib/auth-helpers';
import { assertRateLimit, getClientIp } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from './notifications';

import { loginSchema, signupSchema, addAccountTypeSchema } from '@/lib/schemas/auth';

export async function loginAsAdmin(formData: FormData) {
  let success = false;
  
  try {
    const clientIp = await getClientIp();
    await assertRateLimit(clientIp, 'auth');

    const rawData = {
      email: formData.get('email'),
      password: formData.get('password')
    };
    const validated = loginSchema.parse(rawData);

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) return { error: error.message };
    if (!data.user) return { error: 'Login failed' };

    // Verify the user actually has the admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .single();

    if (profile) {
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('website_roles!inner(role)')
        .eq('user_profile_id', profile.id)
        .eq('website_roles.role', 'admin');

      if (!roleData || roleData.length === 0) {
        await supabase.auth.signOut();
        return { error: 'Unauthorized: You do not have admin privileges.' };
      }
    } else {
      await supabase.auth.signOut();
      return { error: 'Unauthorized: User profile not found.' };
    }
    
    success = true;
  } catch (error: any) {
    captureException(error, { action: 'loginAsAdmin' });
    return { error: error.message };
  }
  
  if (success) {
    redirect('/admin');
  }
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

export async function loginUser(formData: FormData) {
  let primaryRole = 'traveler';
  let success = false;
  
  try {
    const clientIp = await getClientIp();
    await assertRateLimit(clientIp, 'auth');

    const rawData = {
      email: formData.get('email'),
      password: formData.get('password')
    };
    const validated = loginSchema.parse(rawData);
    
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) return { error: error.message };

    const websiteId = env.WEBSITE_ID;

    // Find the user profile first
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('user_id', data.user.id)
      .single();

    if (profileError || !profileData) {
      await supabase.auth.signOut();
      return { error: 'Failed to retrieve user profile.' };
    }

    // Find the role for this website via website_roles
    const { data: rolesData, error: rolesError } = await supabase
      .from('user_roles')
      .select(`
        website_roles!inner (
          role,
          website_id
        )
      `)
      .eq('user_profile_id', profileData.id);

    if (rolesError) {
      await supabase.auth.signOut();
      return { error: 'Failed to verify user roles.' };
    }

    if (!rolesData || rolesData.length === 0) {
      await supabase.auth.signOut();
      return { error: 'Access denied: No role assigned for this website.' };
    }

    const roles = rolesData.filter((r: any) => !websiteId || r.website_roles?.website_id === websiteId).map((r: any) => r.website_roles.role);

    if (roles.length === 0) {
      await supabase.auth.signOut();
      return { error: 'Access denied: You do not have permission for this website.' };
    }

    primaryRole = roles.includes('traveler') ? 'traveler' : roles[0];
    success = true;
  } catch (error: any) {
    captureException(error, { action: 'loginUser' });
    return { error: error.message };
  }
  
  if (success) {
    redirect(`/dashboard/${primaryRole}`);
  }
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function signupUser(formData: FormData) {
  let redirectUrl = '';
  
  try {
    const clientIp = await getClientIp();
    await assertRateLimit(clientIp, 'auth');

    const rawData = {
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role') || 'traveler',
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
    };
    
    const validated = signupSchema.parse(rawData);
    const supabase = await createClient();

    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        data: {
          first_name: validated.firstName,
          last_name: validated.lastName,
        }
      }
    });

    if (error) return { error: error.message };

    if (data.user) {
      const websiteId = env.WEBSITE_ID;

      // 1. Insert the global user profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .insert({
          user_id: data.user.id,
          email: validated.email,
          full_name: `${validated.firstName} ${validated.lastName}`.trim()
        })
        .select('id')
        .single();

      if (profileData && websiteId) {
        // 2. Find the correct website_roles ID
        const { data: websiteRoleData } = await supabase
          .from('website_roles')
          .select('id')
          .eq('role', validated.role)
          .eq('website_id', websiteId)
          .single();

        // 3. Link them in user_roles
        if (websiteRoleData) {
          await supabase.from('user_roles').insert({
            user_profile_id: profileData.id,
            website_role_id: websiteRoleData.id
          });
        }
        
        // Notify SuperAdmin
        await notifySuperAdmin(
          'New Account Created',
          `${validated.firstName} ${validated.lastName} (${validated.email}) created a new ${validated.role} account.`,
          'account_created'
        );
      }
    }

    if (data.session) {
      redirectUrl = `/dashboard/${validated.role}`;
    } else {
      redirectUrl = '/login?message=Check your email to confirm your account';
    }
  } catch (error: any) {
    captureException(error, { action: 'signupUser' });
    return { error: error.message };
  }
  
  if (redirectUrl) {
    redirect(redirectUrl);
  }
}

export async function getUserRoles() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const websiteId = env.WEBSITE_ID;

  let query = supabase
    .from('user_roles')
    .select(`
      user_profiles!inner(user_id),
      website_roles!inner(role, website_id)
    `)
    .eq('user_profiles.user_id', user.id);

  if (websiteId) {
    query = query.eq('website_roles.website_id', websiteId);
  }

  const { data } = await query;
  if (!data) return [];
  
  return data.map((r: any) => r.website_roles.role);
}



export async function addAccountType(role: string) {
  let success = false;
  
  try {
    const validated = addAccountTypeSchema.parse({ role });
    const { profile, supabase } = await requireSession();

    const websiteId = env.WEBSITE_ID;
    if (!websiteId) return { error: 'Missing website ID configuration' };

    // Get website role ID
    const { data: websiteRoleData } = await supabase
      .from('website_roles')
      .select('id')
      .eq('role', validated.role)
      .eq('website_id', websiteId)
      .single();

    if (!websiteRoleData) return { error: 'Role not found for this website' };

    // Insert user_role
    const { error } = await supabase.from('user_roles').insert({
      user_profile_id: profile.id,
      website_role_id: websiteRoleData.id
    });

    if (error) return { error: error.message };
    
    success = true;
  } catch (error: any) {
    captureException(error, { action: 'addAccountType', role });
    return { error: error.message };
  }
  
  if (success) {
    redirect(`/dashboard/${role}`);
  }
}
