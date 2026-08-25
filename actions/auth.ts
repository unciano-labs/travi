'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function loginAsAdmin(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  redirect('/admin');
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

import { headers } from 'next/headers';

export async function loginUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  const websiteId = process.env.WEBSITE_ID;

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

  console.log('LOGIN websiteId:', websiteId, 'rolesData:', JSON.stringify(rolesData));
  const roles = rolesData.filter((r: any) => !websiteId || r.website_roles?.website_id === websiteId).map((r: any) => r.website_roles.role);

  if (roles.length === 0) {
    await supabase.auth.signOut();
    return { error: 'Access denied: You do not have permission for this website.' };
  }

  const primaryRole = roles.includes('traveler') ? 'traveler' : roles[0];
  console.log('LOGIN REDIRECTING TO:', `/dashboard/${primaryRole}`);
  redirect(`/dashboard/${primaryRole}`);
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function signupUser(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = (formData.get('role') as string) || 'traveler';
  const firstName = formData.get('firstName') as string;
  const lastName = formData.get('lastName') as string;
  
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: firstName,
        last_name: lastName,
      }
    }
  });

  if (error) {
    return { error: error.message };
  }

  if (data.user) {
    const websiteId = process.env.WEBSITE_ID;

    // 1. Insert the global user profile
    const { data: profileData, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: data.user.id,
        email: email,
        full_name: `${firstName} ${lastName}`.trim()
      })
      .select('id')
      .single();

    if (profileData && websiteId) {
      // 2. Find the correct website_roles ID
      const { data: websiteRoleData } = await supabase
        .from('website_roles')
        .select('id')
        .eq('role', role)
        .eq('website_id', websiteId)
        .single();

      // 3. Link them in user_roles
      if (websiteRoleData) {
        await supabase.from('user_roles').insert({
          user_profile_id: profileData.id,
          website_role_id: websiteRoleData.id
        });
      }
    }
  }

  if (data.session) {
    redirect(`/dashboard/${role}`);
  } else {
    redirect('/login?message=Check your email to confirm your account');
  }
}


export async function getUserRoles() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const websiteId = process.env.WEBSITE_ID;

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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const websiteId = process.env.WEBSITE_ID;
  if (!websiteId) return { error: 'Missing website ID configuration' };

  // Get user profile
  const { data: profileData } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profileData) return { error: 'Profile not found' };

  // Get website role ID
  const { data: websiteRoleData } = await supabase
    .from('website_roles')
    .select('id')
    .eq('role', role)
    .eq('website_id', websiteId)
    .single();

  if (!websiteRoleData) return { error: 'Role not found for this website' };

  // Insert user_role
  const { error } = await supabase.from('user_roles').insert({
    user_profile_id: profileData.id,
    website_role_id: websiteRoleData.id
  });

  if (error) {
    return { error: error.message };
  }

  redirect(`/dashboard/${role}`);
}
