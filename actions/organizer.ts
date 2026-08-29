'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { notifySuperAdmin } from './notifications';

export async function createOrganizerProfile(formData: FormData) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: 'Not authenticated' };
  }

  // Get user profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    return { error: 'User profile not found' };
  }

  const organizerType = formData.get('organizerType') as string;
  const companyName = formData.get('companyName') as string;
  const displayName = formData.get('displayName') as string;
  const phone = formData.get('phone') as string;
  const description = formData.get('description') as string;
  const address = formData.get('address') as string;
  const providesTransport = formData.get('providesTransport') === 'on';

  const { error } = await supabase.from('organizer_profiles').insert({
    user_profile_id: profile.id,
    organizer_type: organizerType,
    company_name: companyName,
    display_name: displayName,
    phone,
    description,
    address,
    provides_transport: providesTransport,
    status: 'approved' // Seamless approval per user request
  });

  if (error) {
    return { error: error.message };
  }
  
  await notifySuperAdmin(
    'New Organizer Profile',
    `A new organizer profile was created by ${displayName || companyName}.`,
    'organizer_created',
    '/admin/organizers'
  );

  revalidatePath('/dashboard/organizer');
  return { success: true };
}
