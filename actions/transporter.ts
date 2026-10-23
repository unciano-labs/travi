'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { unstable_rethrow } from 'next/navigation';
import { requireSession, assertRole, assertEmailVerified } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { notifySuperAdmin } from '@/lib/notifications';
import {
  assertHasGovernmentId,
  partnerDocumentsFieldSchema,
  transporterProfileSchema,
} from '@/lib/schemas/partner';
import { insertPartnerDocuments } from '@/lib/services/partner-documents';
import { recordAcceptance } from '@/lib/legal/consent';
import { acceptedCheckboxSchema } from '@/lib/schemas/legal';
import { formText, partnerDbErrorMessage, partnerErrorMessage, splitList } from '@/lib/partners';

function transporterRaw(formData: FormData) {
  return {
    transporterType: formText(formData, 'transporterType'),
    companyName: formText(formData, 'companyName'),
    displayName: formText(formData, 'displayName'),
    legalName: formText(formData, 'legalName'),
    tin: formText(formData, 'tin'),
    businessRegistrationNo: formText(formData, 'businessRegistrationNo'),
    ltfrbFranchiseNo: formText(formData, 'ltfrbFranchiseNo'),
    phone: formText(formData, 'phone'),
    description: formText(formData, 'description'),
    serviceAreas: splitList(formText(formData, 'serviceAreas')),
  };
}

/**
 * Transporter onboarding (BIZ-06, LEG-09): business + KYC details and a government ID. The profile
 * starts 'pending' (DB trigger); an admin approves it in /admin/transporters.
 */
export async function createTransporterProfile(formData: FormData) {
  try {
    const data = transporterProfileSchema.parse(transporterRaw(formData));
    const documents = partnerDocumentsFieldSchema.parse(formText(formData, 'documents'));
    assertHasGovernmentId(documents);
    // LEG-05: the Partner Terms click-through is required.
    acceptedCheckboxSchema.parse(formData.get('acceptPartnerTerms'));

    const { user, profile, supabase } = await requireSession();
    assertEmailVerified(user);
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');

    const { data: existing } = await supabase
      .from('transporter_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .maybeSingle();
    if (existing) return { success: false as const, error: 'You already have a transporter profile.' };

    // Record the Partner Terms acceptance first: no record, no application.
    await recordAcceptance(supabase, { userProfileId: profile.id, document: 'partner_terms' });

    const { data: created, error } = await supabase
      .from('transporter_profiles')
      .insert({
        user_profile_id: profile.id,
        transporter_type: data.transporterType,
        company_name: data.transporterType === 'company' ? data.companyName : null,
        display_name: data.displayName,
        legal_name: data.legalName,
        tin: data.tin,
        business_registration_no: data.businessRegistrationNo,
        ltfrb_franchise_no: data.ltfrbFranchiseNo,
        phone: data.phone,
        description: data.description,
        service_areas: data.serviceAreas,
        // status is set by the database trigger: 'pending' until an admin approves (BIZ-06)
      })
      .select('id')
      .single();

    if (error || !created) {
      captureException(error, { action: 'createTransporterProfile insert' });
      return { success: false as const, error: partnerDbErrorMessage(error, 'Could not create your transporter profile.') };
    }

    // The profile exists now; a failed document insert must not strand the partner on onboarding.
    let documentsSaved = true;
    try {
      await insertPartnerDocuments(supabase, {
        authUserId: user.id,
        ownerProfileId: profile.id,
        partnerType: 'transporter',
        documents,
      });
    } catch (docError: unknown) {
      documentsSaved = false;
      captureException(docError, { action: 'createTransporterProfile documents' });
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transporter',
      entityId: created.id,
      action: 'create',
      notes: 'Transporter application submitted',
      diff: { transporterType: data.transporterType, documents: documents.map((d) => d.docType) },
    });

    await notifySuperAdmin(
      'New Transporter Application',
      `${data.displayName} applied as a transporter and is waiting for review.`,
      'transporter_created',
      '/admin/transporters'
    );

    updateTag('transporters');
    revalidatePath('/dashboard/transporter', 'layout');
    revalidatePath('/admin/transporters');
    return {
      success: true as const,
      warning: documentsSaved ? undefined : 'Profile saved, but your documents could not be saved. Please upload them on your profile page.',
    };
  } catch (error: unknown) {
    captureException(error, { action: 'createTransporterProfile' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to create transporter profile.') };
  }
}

const IDENTITY_FIELDS = [
  ['transporterType', 'transporter_type'],
  ['companyName', 'company_name'],
  ['legalName', 'legal_name'],
  ['tin', 'tin'],
  ['businessRegistrationNo', 'business_registration_no'],
  ['ltfrbFranchiseNo', 'ltfrb_franchise_no'],
] as const;

/**
 * Update transporter profile and business info. Same identity rules as updateOrganizerProfile:
 * verified fields are fill-once after approval; editing after a rejection re-submits for review.
 */
export async function updateTransporterProfile(formData: FormData) {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'transporter');
    await assertRateLimit(profile.id, 'mutation');

    const { data: current, error: loadError } = await supabase
      .from('transporter_profiles')
      .select('id, status, transporter_type, company_name, legal_name, tin, business_registration_no, ltfrb_franchise_no')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (loadError || !current) return { success: false as const, error: 'Transporter profile not found.' };

    const raw: Record<string, unknown> = transporterRaw(formData);
    const row = current as Record<string, unknown>;
    for (const [field, column] of IDENTITY_FIELDS) {
      const stored = typeof row[column] === 'string' ? (row[column] as string) : '';
      if (current.status === 'approved' && stored.trim()) raw[field] = stored;
      else if (raw[field] === undefined) raw[field] = stored;
    }
    const data = transporterProfileSchema.parse(raw);

    const updatePayload = {
      transporter_type: data.transporterType,
      company_name: data.transporterType === 'company' ? data.companyName : current.company_name,
      display_name: data.displayName,
      legal_name: data.legalName,
      tin: data.tin,
      business_registration_no: data.businessRegistrationNo,
      ltfrb_franchise_no: data.ltfrbFranchiseNo,
      phone: data.phone,
      description: data.description,
      service_areas: data.serviceAreas,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateErr } = await supabase
      .from('transporter_profiles')
      .update(updatePayload)
      .eq('id', current.id)
      .eq('user_profile_id', profile.id)
      .select('status')
      .single();

    if (updateErr || !updated) {
      captureException(updateErr, { action: 'updateTransporterProfile', transporterId: current.id });
      return { success: false as const, error: partnerDbErrorMessage(updateErr, 'Could not save your profile.') };
    }

    const resubmitted = current.status === 'rejected' && updated.status === 'pending';
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'transporter',
      entityId: current.id,
      action: 'update',
      notes: resubmitted ? 'Transporter profile updated and re-submitted for review' : 'Transporter profile updated',
      diff: { fields: Object.keys(updatePayload), status: updated.status },
    });

    if (resubmitted) {
      await notifySuperAdmin(
        'Transporter Re-submitted',
        `${data.displayName} updated their details and is waiting for review.`,
        'transporter_created',
        '/admin/transporters'
      );
    }

    updateTag('transporters');
    revalidatePath('/dashboard/transporter', 'layout');
    return { success: true as const, status: updated.status as string, resubmitted };
  } catch (error: unknown) {
    captureException(error, { action: 'updateTransporterProfile' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to update profile.') };
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
