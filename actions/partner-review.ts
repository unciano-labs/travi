'use server';

import { revalidatePath, updateTag } from 'next/cache';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import {
  notifyOrganizerAccountStatus,
  notifyPartnerInfoRequested,
  notifyTransporterAccountStatus,
} from '@/lib/notifications';
import {
  documentIdSchema,
  partnerRefSchema,
  PARTNER_DOCUMENTS_BUCKET,
  rejectPartnerSchema,
  requestMoreInfoSchema,
  type PartnerType,
} from '@/lib/schemas/partner';
import { partnerErrorMessage } from '@/lib/partners';

// Admin review of partner applications (BIZ-07). Status and review columns are server-owned
// (guarded by DB triggers), so every write uses the service role after the admin check.

const tableFor = (t: PartnerType) => (t === 'organizer' ? 'organizer_profiles' : 'transporter_profiles');

async function requireAdmin() {
  const { user, profile } = await requireSession();
  await assertRole(user.id, 'admin');
  await assertRateLimit(profile.id, 'mutation');
  return { adminProfileId: profile.id as string };
}

function invalidate(partnerType: PartnerType) {
  updateTag(partnerType === 'organizer' ? 'organizers' : 'transporters');
  updateTag('platform-stats');
  if (partnerType === 'organizer') updateTag('tours'); // catalog lists approved organizers only
  revalidatePath(`/admin/${partnerType}s`);
}

/** Approve a pending (or previously rejected) partner. Submitted documents become verified. */
export async function approvePartner(input: unknown) {
  try {
    const data = partnerRefSchema.parse(input);
    const { adminProfileId } = await requireAdmin();
    const now = new Date().toISOString();

    // Service role: status is server-owned and admins have no UPDATE policy (AGENTS.md §5.3).
    const admin = createAdminClient({ admin: true });
    const { data: updated, error } = await admin
      .from(tableFor(data.partnerType))
      .update({ status: 'approved', reviewed_at: now, review_note: null, info_requested_at: null })
      .eq('id', data.partnerId)
      .in('status', ['pending', 'rejected'])
      .is('deleted_at', null)
      .select('id, user_profile_id');

    if (error) throw new Error('Could not approve this partner.');
    if (!updated || updated.length === 0) {
      return { success: false as const, error: 'Partner not found or already approved.' };
    }

    const { error: docError } = await admin
      .from('partner_documents')
      .update({ status: 'verified', reviewed_at: now, reviewed_by: adminProfileId })
      .eq('owner_profile_id', updated[0].user_profile_id)
      .eq('partner_type', data.partnerType)
      .eq('status', 'submitted')
      .is('deleted_at', null);
    if (docError) captureException(docError, { action: 'approvePartner documents', partnerId: data.partnerId });

    await logMutation({
      adminProfileId,
      entityType: data.partnerType,
      entityId: data.partnerId,
      action: 'approve',
      notes: `${data.partnerType} application approved`,
      diff: { status: 'approved' },
    });

    if (data.partnerType === 'organizer') await notifyOrganizerAccountStatus(data.partnerId, 'activated');
    else await notifyTransporterAccountStatus(data.partnerId, 'activated');

    invalidate(data.partnerType);
    return { success: true as const, status: 'approved' as const };
  } catch (error: unknown) {
    captureException(error, { action: 'approvePartner' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to approve partner.') };
  }
}

/** Reject a pending application, or deactivate an approved partner. The reason is shown to them. */
export async function rejectPartner(input: unknown) {
  try {
    const data = rejectPartnerSchema.parse(input);
    const { adminProfileId } = await requireAdmin();

    const admin = createAdminClient({ admin: true });
    const { data: updated, error } = await admin
      .from(tableFor(data.partnerType))
      .update({
        status: 'rejected',
        review_note: data.reason,
        reviewed_at: new Date().toISOString(),
        info_requested_at: null,
      })
      .eq('id', data.partnerId)
      .in('status', ['pending', 'approved'])
      .is('deleted_at', null)
      .select('id');

    if (error) throw new Error('Could not reject this partner.');
    if (!updated || updated.length === 0) {
      return { success: false as const, error: 'Partner not found or already rejected.' };
    }

    await logMutation({
      adminProfileId,
      entityType: data.partnerType,
      entityId: data.partnerId,
      action: 'reject',
      notes: `Rejected: ${data.reason}`,
      diff: { status: 'rejected' },
    });

    if (data.partnerType === 'organizer') await notifyOrganizerAccountStatus(data.partnerId, 'deactivated', data.reason);
    else await notifyTransporterAccountStatus(data.partnerId, 'deactivated', data.reason);

    invalidate(data.partnerType);
    return { success: true as const, status: 'rejected' as const };
  } catch (error: unknown) {
    captureException(error, { action: 'rejectPartner' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to reject partner.') };
  }
}

/** Ask a pending applicant for more information. Status stays 'pending'. */
export async function requestMoreInfo(input: unknown) {
  try {
    const data = requestMoreInfoSchema.parse(input);
    const { adminProfileId } = await requireAdmin();

    const admin = createAdminClient({ admin: true });
    const { data: updated, error } = await admin
      .from(tableFor(data.partnerType))
      .update({ review_note: data.note, info_requested_at: new Date().toISOString() })
      .eq('id', data.partnerId)
      .eq('status', 'pending')
      .is('deleted_at', null)
      .select('id');

    if (error) throw new Error('Could not save the request.');
    if (!updated || updated.length === 0) {
      return { success: false as const, error: 'Only pending applications can be asked for more information.' };
    }

    await logMutation({
      adminProfileId,
      entityType: data.partnerType,
      entityId: data.partnerId,
      action: 'request_info',
      notes: `More information requested: ${data.note}`,
    });

    await notifyPartnerInfoRequested(data.partnerType, data.partnerId, data.note);

    invalidate(data.partnerType);
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'requestMoreInfo' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to request more information.') };
  }
}

/** Short-lived (5 minute) signed URL for one KYC document in the private bucket. Admin only. */
export async function getPartnerDocumentUrl(documentId: unknown) {
  try {
    const docId = documentIdSchema.parse(documentId);
    await requireAdmin();

    // Service role: documents live in a private bucket with owner-only storage policies.
    const admin = createAdminClient({ admin: true });
    const { data: doc, error } = await admin
      .from('partner_documents')
      .select('storage_path')
      .eq('id', docId)
      .is('deleted_at', null)
      .maybeSingle();
    if (error || !doc) return { success: false as const, error: 'Document not found.' };

    const { data: signed, error: signError } = await admin.storage
      .from(PARTNER_DOCUMENTS_BUCKET)
      .createSignedUrl(doc.storage_path, 300);
    if (signError || !signed) throw new Error('Could not open the document.');

    return { success: true as const, url: signed.signedUrl };
  } catch (error: unknown) {
    captureException(error, { action: 'getPartnerDocumentUrl' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to open document.') };
  }
}
