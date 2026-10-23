'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';
import { documentIdSchema, partnerDocumentInputSchema, partnerTypeSchema } from '@/lib/schemas/partner';
import { insertPartnerDocuments } from '@/lib/services/partner-documents';
import { partnerErrorMessage } from '@/lib/partners';

const submitSchema = z.object({
  partnerType: partnerTypeSchema,
  documents: z.array(partnerDocumentInputSchema).min(1).max(10),
});

/**
 * Partner adds KYC documents after onboarding (e.g. when an admin requested more information).
 * Files were uploaded by the browser to the private `partner-documents` bucket first.
 */
export async function submitPartnerDocuments(input: unknown) {
  try {
    const data = submitSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertRole(user.id, data.partnerType);
    await assertRateLimit(profile.id, 'mutation');

    const table = data.partnerType === 'organizer' ? 'organizer_profiles' : 'transporter_profiles';
    const { data: partner } = await supabase
      .from(table)
      .select('id')
      .eq('user_profile_id', profile.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (!partner) return { success: false as const, error: 'Complete your partner profile first.' };

    await insertPartnerDocuments(supabase, {
      authUserId: user.id,
      ownerProfileId: profile.id,
      partnerType: data.partnerType,
      documents: data.documents,
    });

    await logMutation({
      adminProfileId: profile.id,
      entityType: data.partnerType,
      entityId: partner.id,
      action: 'create',
      notes: 'KYC documents submitted',
      diff: { documents: data.documents.map((d) => d.docType) },
    });

    revalidatePath(`/dashboard/${data.partnerType}/profile`);
    revalidatePath(`/admin/${data.partnerType}s`);
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'submitPartnerDocuments' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to submit documents.') };
  }
}

/** Partner withdraws (soft-deletes) one of their own documents. */
export async function withdrawPartnerDocument(documentId: unknown) {
  try {
    const docId = documentIdSchema.parse(documentId);
    const { profile, supabase } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    const { data: updated, error } = await supabase
      .from('partner_documents')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', docId)
      .eq('owner_profile_id', profile.id)
      .is('deleted_at', null)
      .select('id, partner_type')
      .maybeSingle();

    if (error) throw new Error('Could not remove the document.');
    if (!updated) return { success: false as const, error: 'Document not found.' };

    revalidatePath(`/dashboard/${updated.partner_type}/profile`);
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'withdrawPartnerDocument' });
    return { success: false as const, error: partnerErrorMessage(error, 'Failed to remove document.') };
  }
}
