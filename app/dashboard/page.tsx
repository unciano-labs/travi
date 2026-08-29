import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';

import { requireSession } from '@/lib/auth-helpers';

export default async function DashboardDispatcherPage() {
  let session;
  try {
    session = await requireSession();
  } catch (error) {
    redirect('/login');
  }
  const { user, profile, supabase } = session;

  // Fetch the user's active roles
  const websiteId = env.WEBSITE_ID;
  let query = supabase
    .from('user_roles')
    .select(`
      website_roles!inner(role, website_id)
    `)
    .eq('user_profile_id', profile.id);

  if (websiteId) {
    query = query.eq('website_roles.website_id', websiteId);
  }

  const { data: rolesData } = await query;
  const roles = rolesData ? rolesData.map((r: any) => r.website_roles.role) : [];

  // Redirect based on priority
  if (roles.includes('admin')) {
    redirect('/admin');
  } else if (roles.includes('organizer')) {
    redirect('/dashboard/organizer');
  } else if (roles.includes('transporter')) {
    redirect('/dashboard/transporter');
  } else {
    redirect('/dashboard/traveler');
  }
}
