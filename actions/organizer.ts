'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { requireSession, assertRole, assertEmailVerified } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { notifySuperAdmin } from '@/lib/notifications';
import {
  assertHasGovernmentId,
  organizerProfileSchema,
  partnerDocumentsFieldSchema,
} from '@/lib/schemas/partner';
import { insertPartnerDocuments } from '@/lib/services/partner-documents';
import { recordAcceptance } from '@/lib/legal/consent';
import { acceptedCheckboxSchema } from '@/lib/schemas/legal';
import { formText, partnerDbErrorMessage, partnerErrorMessage } from '@/lib/partners';

function organizerRaw(formData: FormData) {
  return {
    organizerType: formText(formData, 'organizerType'),
    companyName: formText(formData, 'companyName'),
    displayName: formText(formData, 'displayName'),
    legalName: formText(formData, 'legalName'),
    tin: formText(formData, 'tin'),
    businessRegistrationNo: formText(formData, 'businessRegistrationNo'),
    dotAccreditationNo: formText(formData, 'dotAccreditationNo'),
    phone: formText(formData, 'phone'),
    address: formText(formData, 'address'),
    description: formText(formData, 'description'),
    publicContactEmail: formText(formData, 'publicContactEmail'),
    providesTransport: formData.get('providesTransport') === 'on',
  };
}

/**
 * Organizer onboarding (BIZ-06, LEG-06): business + KYC details and a government ID. The profile
 * starts 'pending' (DB trigger); an admin approves it in /admin/organizers.
 */
export async function createOrganizerProfile(formData: FormData) {
  try {
    const data = organizerProfileSchema.parse(organizerRaw(formData));
    const documents = partnerDocumentsFieldSchema.parse(formText(formData, 'documents'));
    assertHasGovernmentId(documents);
    // LEG-05: the Partner Terms click-through is required.
    acceptedCheckboxSchema.parse(formData.get('acceptPartnerTerms'));

    const { user, profile, supabase } = await requireSession();
    assertEmailVerified(user);
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    const { data: existing } = await supabase
      .from('organizer_profiles')
      .select('id')
      .eq('user_profile_id', profile.id)
      .maybeSingle();
    if (existing) return { success: false as const, error: 'You already have an organizer profile.' };

    // Record the Partner Terms acceptance first: no record, no application.
    await recordAcceptance(supabase, { userProfileId: profile.id, document: 'partner_terms' });

    const { data: created, error } = await supabase
      .from('organizer_profiles')
      .insert({
        user_profile_id: profile.id,
        organizer_type: data.organizerType,
        company_name: data.organizerType === 'company' ? data.companyName : null,
        display_name: data.displayName,
        legal_name: data.legalName,
        tin: data.tin,
        business_registration_no: data.businessRegistrationNo,
        dot_accreditation_no: data.dotAccreditationNo,
        public_contact_email: data.publicContactEmail,
        phone: data.phone,
        description: data.description,
        address: data.address,
        provides_transport: data.providesTransport,
        // status is set by the database trigger: 'pending' until an admin approves (BIZ-06)
      })
      .select('id')
      .single();

    if (error || !created) {
      captureException(error, { action: 'createOrganizerProfile insert' });
      return { success: false as const, error: partnerDbErrorMessage(error, 'Could not create your organizer profile.') };
    }

    // The profile exists now; a failed document insert must not strand the partner on onboarding.
    let documentsSaved = true;
    try {
      await insertPartnerDocuments(supabase, {
        authUserId: user.id,
        ownerProfileId: profile.id,
        partnerType: 'organizer',
        documents,
      });
    } catch (docError: unknown) {
      documentsSaved = false;
      captureException(docError, { action: 'createOrganizerProfile documents' });
    }

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'organizer',
      entityId: created.id,
      action: 'create',
      notes: 'Organizer application submitted',
      diff: { organizerType: data.organizerType, documents: documents.map((d) => d.docType) },
    });

    await notifySuperAdmin(
      'New Organizer Application',
      `${data.displayName} applied as an organizer and is waiting for review.`,
      'organizer_created',
      '/admin/organizers'
    );

    updateTag('organizers');
    revalidatePath('/dashboard/organizer', 'layout');
    revalidatePath('/admin/organizers');
    return {
      success: true as const,
      warning: documentsSaved ? undefined : 'Profile saved, but your documents could not be saved. Please upload them on your profile page.',
    };
  } catch (error: unknown) {
    captureException(error, { action: 'createOrganizerProfile' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to create organizer profile.') };
  }
}

const IDENTITY_FIELDS = [
  ['organizerType', 'organizer_type'],
  ['companyName', 'company_name'],
  ['legalName', 'legal_name'],
  ['tin', 'tin'],
  ['businessRegistrationNo', 'business_registration_no'],
  ['dotAccreditationNo', 'dot_accreditation_no'],
] as const;

/**
 * Organizer profile save (BIZ-11). Decision: once approved, verified identity fields are read-only
 * (they may only be filled in when blank); editing them after a rejection re-submits the
 * application for review. Both rules are also enforced by the DB (partner_profiles_kyc_rules).
 */
export async function updateOrganizerProfile(formData: FormData) {
  try {
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, 'organizer');
    await assertRateLimit(profile.id, 'mutation');

    const { data: current, error: loadError } = await supabase
      .from('organizer_profiles')
      .select('id, status, organizer_type, company_name, legal_name, tin, business_registration_no, dot_accreditation_no')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (loadError || !current) return { success: false as const, error: 'Organizer profile not found.' };

    // Locked (verified) fields are not submitted by the form: keep the stored values.
    const raw: Record<string, unknown> = organizerRaw(formData);
    const row = current as Record<string, unknown>;
    for (const [field, column] of IDENTITY_FIELDS) {
      const stored = typeof row[column] === 'string' ? (row[column] as string) : '';
      if (current.status === 'approved' && stored.trim()) raw[field] = stored;
      else if (raw[field] === undefined) raw[field] = stored;
    }
    const data = organizerProfileSchema.parse(raw);

    const updatePayload = {
      organizer_type: data.organizerType,
      company_name: data.organizerType === 'company' ? data.companyName : current.company_name,
      display_name: data.displayName,
      legal_name: data.legalName,
      tin: data.tin,
      business_registration_no: data.businessRegistrationNo,
      dot_accreditation_no: data.dotAccreditationNo,
      public_contact_email: data.publicContactEmail,
      phone: data.phone,
      description: data.description,
      address: data.address,
      provides_transport: data.providesTransport,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error } = await supabase
      .from('organizer_profiles')
      .update(updatePayload)
      .eq('id', current.id)
      .eq('user_profile_id', profile.id)
      .select('status')
      .single();

    if (error || !updated) {
      captureException(error, { action: 'updateOrganizerProfile', organizerId: current.id });
      return { success: false as const, error: partnerDbErrorMessage(error, 'Could not save your profile.') };
    }

    const resubmitted = current.status === 'rejected' && updated.status === 'pending';
    await logMutation({
      adminProfileId: profile.id,
      entityType: 'organizer',
      entityId: current.id,
      action: 'update',
      notes: resubmitted ? 'Organizer profile updated and re-submitted for review' : 'Organizer profile updated',
      diff: { fields: Object.keys(updatePayload), status: updated.status },
    });

    if (resubmitted) {
      await notifySuperAdmin(
        'Organizer Re-submitted',
        `${data.displayName} updated their details and is waiting for review.`,
        'organizer_created',
        '/admin/organizers'
      );
    }

    updateTag('organizers');
    updateTag('tours');
    revalidatePath('/dashboard/organizer', 'layout');
    return { success: true as const, status: updated.status as string, resubmitted };
  } catch (error: unknown) {
    captureException(error, { action: 'updateOrganizerProfile' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to update profile.') };
  }
}
