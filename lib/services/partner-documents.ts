import type { SupabaseClient } from '@supabase/supabase-js';
import type { PartnerDocumentInput, PartnerType } from '@/lib/schemas/partner';

/**
 * Record KYC documents the partner already uploaded to the private `partner-documents` bucket.
 * Runs on the caller's RLS client: the DB forces status 'submitted', checks the path is inside the
 * caller's own folder and that a vehicle (OR/CR) belongs to them (20261025090000).
 */
export async function insertPartnerDocuments(
  supabase: SupabaseClient,
  params: {
    authUserId: string;
    ownerProfileId: string;
    partnerType: PartnerType;
    documents: PartnerDocumentInput[];
    vehicleId?: string | null;
  }
) {
  if (params.documents.length === 0) return;

  for (const doc of params.documents) {
    if (!doc.storagePath.startsWith(`${params.authUserId}/`)) {
      throw new Error('Invalid document upload. Please upload the file again.');
    }
  }

  const { error } = await supabase.from('partner_documents').insert(
    params.documents.map((doc) => ({
      owner_profile_id: params.ownerProfileId,
      partner_type: params.partnerType,
      doc_type: doc.docType,
      vehicle_id: params.vehicleId ?? null,
      storage_path: doc.storagePath,
      file_name: doc.fileName ?? null,
      mime_type: doc.mimeType,
      size_bytes: doc.sizeBytes,
    }))
  );

  if (error) {
    throw new Error(error.code === '23505' ? 'This document was already submitted.' : 'Could not save your documents. Please try again.');
  }
}

export interface PartnerDocumentRow {
  id: string;
  doc_type: string;
  vehicle_id: string | null;
  file_name: string | null;
  status: string;
  created_at: string;
}

/** The caller's own, non-withdrawn documents (RLS: owner read). */
export async function listOwnPartnerDocuments(
  supabase: SupabaseClient,
  ownerProfileId: string,
  partnerType: PartnerType
): Promise<PartnerDocumentRow[]> {
  const { data, error } = await supabase
    .from('partner_documents')
    .select('id, doc_type, vehicle_id, file_name, status, created_at')
    .eq('owner_profile_id', ownerProfileId)
    .eq('partner_type', partnerType)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data ?? []) as PartnerDocumentRow[];
}
