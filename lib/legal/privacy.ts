// Data subject rights helpers (RA 10173; LEG-10). Server-only; deliberately NOT Server Actions.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { COMPANY, LEGAL_DOCUMENTS, RETENTION, legalValue } from '@/lib/legal/company';
import type { DataRequestStatus, DataRequestType } from '@/lib/schemas/legal';

export interface OwnDataRequest {
  id: string;
  requestType: DataRequestType;
  status: DataRequestStatus;
  details: string | null;
  adminNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

/** Shown wherever a user asks for deletion: what we must keep, and why. */
export function deletionRetentionNote(): string {
  return (
    'Deleting your account removes your profile and sign-in. Some records cannot be erased right away: ' +
    'bookings, payments, refunds, payouts and the wallet ledger are kept for the period the law requires ' +
    `(${legalValue(RETENTION.financialRecords)}), as are records needed for an open booking, dispute, complaint ` +
    'or legal claim. Where we must keep a record, we restrict it to that purpose.'
  );
}

/** The signed-in user's own data requests (RLS: users read only their own). */
export async function listOwnDataRequests(supabase: SupabaseClient, userProfileId: string): Promise<OwnDataRequest[]> {
  const { data, error } = await supabase
    .from('data_requests')
    .select('id, request_type, status, details, admin_note, created_at, resolved_at')
    .eq('user_profile_id', userProfileId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) {
    // The table only exists once 20261026090000 is applied; the card still renders without history.
    captureException(error, { action: 'listOwnDataRequests' });
    return [];
  }
  return (data ?? []).map((r) => ({
    id: r.id as string,
    requestType: r.request_type as DataRequestType,
    status: r.status as DataRequestStatus,
    details: (r.details as string | null) ?? null,
    adminNote: (r.admin_note as string | null) ?? null,
    createdAt: r.created_at as string,
    resolvedAt: (r.resolved_at as string | null) ?? null,
  }));
}

type Section = unknown[] | Record<string, unknown> | null | { unavailable: string };

/**
 * Everything Travi holds about one user, as a JSON-serialisable object (right to access and data
 * portability). Every query is filtered by the caller's own ids, derived from the session by the
 * caller; no other user's personal data is included (bookings on an organizer's tours are the
 * travelers' data and are left out).
 *
 * Service role: own pending/hidden reviews, soft-deleted rows and service-only tables are not all
 * readable under RLS, and the export must be complete (AGENTS.md §5.3).
 */
export async function buildPersonalDataExport(input: {
  authUserId: string;
  email: string | null | undefined;
  userProfileId: string;
}): Promise<Record<string, unknown>> {
  const admin = createAdminClient({ admin: true });
  const { authUserId, userProfileId } = input;

  const section = async (name: string, query: PromiseLike<{ data: unknown; error: unknown }>): Promise<Section> => {
    try {
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? null) as Section;
    } catch (error: unknown) {
      captureException(error, { action: 'buildPersonalDataExport', section: name });
      return { unavailable: 'This part of your data could not be exported. Please contact us.' };
    }
  };

  const wallet = await section('wallet', admin.from('user_wallets').select('*').eq('user_profile_id', userProfileId).maybeSingle());
  const walletId = wallet && !Array.isArray(wallet) && typeof (wallet as Record<string, unknown>).id === 'string'
    ? ((wallet as Record<string, unknown>).id as string)
    : null;

  const [
    profile, roles, organizerProfile, transporterProfile, partnerDocuments, bookings, reviews,
    notifications, ledger, payouts, acceptances, dataRequests, supportMessages,
  ] = await Promise.all([
    section('profile', admin.from('user_profiles').select('*').eq('id', userProfileId).maybeSingle()),
    section('roles', admin.from('user_roles').select('created_at, website_roles ( role )').eq('user_profile_id', userProfileId)),
    section('organizer_profile', admin.from('organizer_profiles').select('*').eq('user_profile_id', userProfileId).maybeSingle()),
    section('transporter_profile', admin.from('transporter_profiles').select('*').eq('user_profile_id', userProfileId).maybeSingle()),
    // Metadata only; the files themselves can be requested from the privacy team.
    section('partner_documents', admin.from('partner_documents')
      .select('doc_type, status, file_name, mime_type, size_bytes, created_at').eq('owner_profile_id', userProfileId)),
    section('bookings', admin.from('bookings')
      .select('*, tour_schedules ( start_date, end_date, tours ( title, slug ) )')
      .eq('traveler_id', userProfileId)
      .order('created_at', { ascending: false })),
    section('reviews', admin.from('reviews').select('*').eq('reviewer_profile_id', userProfileId)),
    // notifications are keyed by the AUTH user id (AGENTS.md §4.1).
    section('notifications', admin.from('notifications').select('*').eq('user_id', authUserId).order('created_at', { ascending: false })),
    walletId
      ? section('wallet_transactions', admin.from('wallet_transactions').select('*').eq('wallet_id', walletId).order('created_at', { ascending: true }))
      : Promise.resolve([] as unknown[]),
    walletId
      ? section('payout_requests', admin.from('payout_requests').select('*').eq('wallet_id', walletId).order('created_at', { ascending: false }))
      : Promise.resolve([] as unknown[]),
    section('legal_acceptances', admin.from('legal_acceptances').select('document, version, accepted_at, reference_id, ip_hash, user_agent').eq('user_profile_id', userProfileId)),
    section('data_requests', admin.from('data_requests').select('request_type, status, details, admin_note, created_at, resolved_at').eq('user_profile_id', userProfileId)),
    section('support_messages', admin.from('support_messages').select('name, email, topic, booking_ref, message, status, created_at, resolved_at').eq('user_profile_id', userProfileId)),
  ]);

  return {
    export: {
      generatedAt: new Date().toISOString(),
      controller: legalValue(COMPANY.registeredName),
      privacyNotice: { path: LEGAL_DOCUMENTS.privacy.path, version: LEGAL_DOCUMENTS.privacy.version },
      note: 'Your personal data held by Travi, exported at your request (Data Privacy Act of 2012, RA 10173). '
        + 'Files you uploaded (ID documents, images) are listed but not included; contact the Data Protection Officer to receive copies.',
    },
    account: { authUserId, email: input.email ?? null },
    profile,
    roles,
    organizerProfile,
    transporterProfile,
    partnerDocuments,
    bookings,
    reviews,
    notifications,
    wallet,
    walletTransactions: ledger,
    payoutRequests: payouts,
    legalAcceptances: acceptances,
    dataRequests,
    supportMessages,
  };
}
