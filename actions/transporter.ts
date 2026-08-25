'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createTransporterProfile(formData: FormData) {
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

  const transporterType = formData.get('transporterType') as string;
  const companyName = formData.get('companyName') as string;
  const displayName = formData.get('displayName') as string;
  const phone = formData.get('phone') as string;
  const description = formData.get('description') as string;
  
  // For MVP, we can just grab service areas as a string and array-ify it, or just keep it simple
  const serviceAreasStr = formData.get('serviceAreas') as string;
  const serviceAreas = serviceAreasStr ? serviceAreasStr.split(',').map(s => s.trim()) : [];

  const { error } = await supabase.from('transporter_profiles').insert({
    user_profile_id: profile.id,
    transporter_type: transporterType,
    company_name: companyName,
    display_name: displayName,
    phone,
    description,
    service_areas: serviceAreas,
    status: 'approved' // Seamless approval per user request
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath('/dashboard/transporter');
  return { success: true };
}
