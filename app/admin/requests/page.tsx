import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import PageHeader from '@/components/ui/PageHeader';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import RequestsClient, { type AdminDataRequest, type AdminSupportMessage } from '@/components/admin/RequestsClient';
import { LEGAL_REVIEW_COMPLETE, missingCompanyFacts } from '@/lib/legal/company';
import type { DataRequestStatus, DataRequestType, SupportStatus, SupportTopic } from '@/lib/schemas/legal';

const LIMIT = 200;

type Profile = { email: string | null; full_name: string | null } | null;

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const params = await searchParams;
  const tab = params.tab === 'support' ? 'support' : 'data';

  // Service role: admin console reads across all users, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const [requestsRes, messagesRes] = await Promise.all([
    admin
      .from('data_requests')
      .select('id, request_type, status, details, admin_note, created_at, resolved_at, user_profiles!data_requests_user_profile_id_fkey ( email, full_name )')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
    admin
      .from('support_messages')
      .select('id, name, email, topic, booking_ref, message, status, admin_note, created_at, resolved_at, user_profile_id')
      .order('created_at', { ascending: false })
      .limit(LIMIT),
  ]);
  if (requestsRes.error) captureException(requestsRes.error, { action: 'AdminRequestsPage data_requests' });
  if (messagesRes.error) captureException(messagesRes.error, { action: 'AdminRequestsPage support_messages' });

  const dataRequests: AdminDataRequest[] = (requestsRes.data ?? []).map((r) => {
    const owner = r.user_profiles as unknown as Profile;
    return {
      id: r.id as string,
      type: r.request_type as DataRequestType,
      status: r.status as DataRequestStatus,
      details: (r.details as string | null) ?? null,
      adminNote: (r.admin_note as string | null) ?? null,
      createdAt: r.created_at as string,
      resolvedAt: (r.resolved_at as string | null) ?? null,
      userEmail: owner?.email ?? null,
      userName: owner?.full_name ?? null,
    };
  });

  const supportMessages: AdminSupportMessage[] = (messagesRes.data ?? []).map((m) => ({
    id: m.id as string,
    name: m.name as string,
    email: m.email as string,
    topic: m.topic as SupportTopic,
    bookingRef: (m.booking_ref as string | null) ?? null,
    message: m.message as string,
    status: m.status as SupportStatus,
    adminNote: (m.admin_note as string | null) ?? null,
    createdAt: m.created_at as string,
    resolvedAt: (m.resolved_at as string | null) ?? null,
    signedIn: Boolean(m.user_profile_id),
  }));

  const missing = missingCompanyFacts();
  const unavailable = Boolean(requestsRes.error || messagesRes.error);

  return (
    <>
      <PageHeader
        title="Requests & Support"
        description="Data subject requests (access, correction, deletion) and contact-form messages, including complaints. Every status change is recorded in the audit log."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Requests & Support' }]}
      />
      <div className="flex flex-col gap-6">
        {(!LEGAL_REVIEW_COMPLETE || missing.length > 0) && (
          <Alert variant="lightwarning">
            <AlertTitle>Legal setup incomplete</AlertTitle>
            <AlertDescription>
              {!LEGAL_REVIEW_COMPLETE && 'The policy pages are drafts pending review by Philippine counsel. '}
              {missing.length > 0 && `Business details still to fill in lib/legal/company.ts: ${missing.join(', ')}.`}
            </AlertDescription>
          </Alert>
        )}
        {unavailable && (
          <Alert variant="lighterror">
            <AlertDescription>Some requests could not be loaded. The database migration 20261026090000 may not be applied yet.</AlertDescription>
          </Alert>
        )}
        <RequestsClient initialTab={tab} initialDataRequests={dataRequests} initialSupportMessages={supportMessages} />
      </div>
    </>
  );
}
