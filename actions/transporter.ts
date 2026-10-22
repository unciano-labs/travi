'use server';

import { revalidatePath } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireSession } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { logAdminAudit } from '@/lib/audit';
import { notifySuperAdmin } from '@/lib/notifications';

export async function createTransporterProfile(formData: FormData) {
  try {
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

    const transporterType = (formData.get('transporterType') as string) || 'individual';
    const companyName = (formData.get('companyName') as string)?.trim() || null;
    const displayName = (formData.get('displayName') as string)?.trim() || 'Transporter';
    const phone = (formData.get('phone') as string)?.trim() || null;
    const description = (formData.get('description') as string)?.trim() || null;
    
    const serviceAreasStr = formData.get('serviceAreas') as string;
    const serviceAreas = serviceAreasStr 
      ? serviceAreasStr.split(',').map(s => s.trim()).filter(Boolean) 
      : [];

    const { data: newProfile, error } = await supabase.from('transporter_profiles').insert({
      user_profile_id: profile.id,
      transporter_type: transporterType,
      company_name: companyName,
      display_name: displayName,
      phone,
      description,
      service_areas: serviceAreas,
      // status is set by the database trigger (partner approval policy, BIZ-06)
    }).select().single();

    if (error) {
      captureException(error, { action: 'createTransporterProfile' });
      return { error: error.message };
    }

    await logAdminAudit(
      profile.id,
      'CREATE_TRANSPORTER_PROFILE',
      'transporter_profiles',
      newProfile.id,
      { transporterType, companyName, displayName }
    );
    
    await notifySuperAdmin(
      'New Transporter Profile',
      `A new transporter profile was created by ${displayName || companyName}.`,
      'transporter_created',
      '/admin/transporters'
    );

    revalidatePath('/dashboard/transporter');
    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'createTransporterProfile exception' });
    return { error: err.message || 'Failed to create transporter profile.' };
  }
}

/**
 * Update transporter profile and business info.
 */
export async function updateTransporterProfile(formData: FormData) {
  try {
    const { profile, supabase } = await requireSession();

    const { data: transporter, error: tErr } = await supabase
      .from('transporter_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .single();

    if (tErr || !transporter) {
      return { success: false, error: 'Transporter profile not found.' };
    }

    const transporterType = (formData.get('transporterType') as string) || 'individual';
    const companyName = (formData.get('companyName') as string)?.trim() || null;
    const displayName = (formData.get('displayName') as string)?.trim() || 'Transporter';
    const phone = (formData.get('phone') as string)?.trim() || null;
    const description = (formData.get('description') as string)?.trim() || null;
    
    const serviceAreasStr = formData.get('serviceAreas') as string;
    const serviceAreas = serviceAreasStr 
      ? serviceAreasStr.split(',').map(s => s.trim()).filter(Boolean) 
      : [];

    const updatePayload = {
      transporter_type: transporterType,
      company_name: companyName,
      display_name: displayName,
      phone,
      description,
      service_areas: serviceAreas,
      updated_at: new Date().toISOString(),
    };

    const { error: updateErr } = await supabase
      .from('transporter_profiles')
      .update(updatePayload)
      .eq('id', transporter.id);

    if (updateErr) {
      captureException(updateErr, { action: 'updateTransporterProfile', transporterId: transporter.id });
      return { success: false, error: updateErr.message };
    }

    await logAdminAudit(
      profile.id,
      'UPDATE_TRANSPORTER_PROFILE',
      'transporter_profiles',
      transporter.id,
      updatePayload
    );

    revalidatePath('/dashboard/transporter');
    revalidatePath('/dashboard/transporter/profile');

    return { success: true };
  } catch (err: any) {
    captureException(err, { action: 'updateTransporterProfile exception' });
    return { success: false, error: err.message || 'Failed to update profile.' };
  }
}

/**
 * Fetch reviews received by the transporter.
 */
export async function getTransporterReviews() {
  try {
    const { profile, supabase } = await requireSession();

    const { data: transporter } = await supabase
      .from('transporter_profiles')
      .select('id, average_rating, review_count')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .single();

    if (!transporter) return { reviews: [], averageRating: 0, reviewCount: 0 };

    // Published, non-deleted reviews only: the same set the rating trigger aggregates
    // (supabase/migrations/20261024120000_reviews_eligibility_and_ratings.sql). reviews has no
    // vehicle relation, so none is joined.
    const { data: reviews, error } = await supabase
      .from('reviews')
      .select(`
        id,
        rating,
        comment,
        created_at,
        reviewer:user_profiles!reviews_reviewer_profile_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('transporter_id', transporter.id)
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      captureException(error, { action: 'getTransporterReviews', transporterId: transporter.id });
      return { reviews: [], averageRating: Number(transporter.average_rating) || 0, reviewCount: transporter.review_count || 0 };
    }

    return {
      reviews: reviews || [],
      averageRating: Number(transporter.average_rating) || 0,
      reviewCount: transporter.review_count || 0,
    };
  } catch (err: unknown) {
    // Let Next's redirect/notFound/dynamic-rendering signals through (AGENTS.md §3.3, §6 #24).
    unstable_rethrow(err);
    captureException(err, { action: 'getTransporterReviews exception' });
    return { reviews: [], averageRating: 0, reviewCount: 0 };
  }
}
