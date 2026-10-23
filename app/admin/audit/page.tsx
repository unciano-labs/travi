import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { dateRangeSchema, firstParam, pageNumber, sanitizeSearch, uuidSchema } from '@/lib/schemas/admin-tools';
import PageHeader from '@/components/ui/PageHeader';
import AuditClient, { type AuditEntry, type AuditFilters } from '@/components/admin/AuditClient';

const PAGE_SIZE = 50;

type Embed<T> = T | T[] | null | undefined;
const one = <T,>(value: Embed<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);

interface LogRow {
  id: string;
  admin_profile_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  notes: string | null;
  created_at: string;
  actor: Embed<{ full_name: string | null; email: string | null }>;
}

// Entity types written by the app and the database functions (free text in the table).
const ENTITY_TYPES = [
  'booking', 'booking_payment', 'export', 'organizer', 'payout', 'platform_settings', 'review', 'tour',
  'transport_booking', 'transporter', 'user_profile', 'user_role',
];

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const params = await searchParams;
  const entity = sanitizeSearch(firstParam(params.entity), 40).replace(/\s/g, '');
  const action = sanitizeSearch(firstParam(params.action), 60).replace(/\s/g, '');
  const adminParam = uuidSchema.safeParse(firstParam(params.admin));
  const adminId = adminParam.success ? adminParam.data : '';
  const range = dateRangeSchema.safeParse({ from: firstParam(params.from) || undefined, to: firstParam(params.to) || undefined });
  const from = range.success ? range.data.from ?? '' : '';
  const to = range.success ? range.data.to ?? '' : '';
  const page = pageNumber(params.page);

  // Service role: admin console read of the audit trail, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  let query = admin
    .from('admin_audit_logs')
    .select('id, admin_profile_id, entity_type, entity_id, action, notes, created_at, actor:user_profiles!admin_profile_id ( full_name, email )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) query = query.eq('entity_type', entity);
  if (action) query = query.ilike('action', `%${action}%`);
  if (adminId) query = query.eq('admin_profile_id', adminId);
  if (from) query = query.gte('created_at', new Date(`${from}T00:00:00+08:00`).toISOString());
  if (to) {
    const end = new Date(`${to}T00:00:00+08:00`);
    end.setUTCDate(end.getUTCDate() + 1);
    query = query.lt('created_at', end.toISOString());
  }

  const [logsRes, adminsRes] = await Promise.all([
    query,
    admin
      .from('user_roles')
      .select('user_profiles!inner ( id, full_name, email ), website_roles!inner ( role )')
      .eq('website_roles.role', 'admin'),
  ]);
  if (logsRes.error) captureException(logsRes.error, { action: 'AdminAuditPage' });

  const entries: AuditEntry[] = ((logsRes.data ?? []) as unknown as LogRow[]).map((r) => {
    const actor = one(r.actor);
    return {
      id: r.id,
      adminName: actor?.full_name || actor?.email || r.admin_profile_id,
      entityType: r.entity_type,
      entityId: r.entity_id,
      action: r.action,
      notes: r.notes,
      createdAt: r.created_at,
    };
  });

  const adminOptions = new Map<string, string>();
  for (const row of (adminsRes.data ?? []) as unknown as { user_profiles: Embed<{ id: string; full_name: string | null; email: string }> }[]) {
    const p = one(row.user_profiles);
    if (p) adminOptions.set(p.id, p.full_name || p.email);
  }

  const filters: AuditFilters = { entity, action, admin: adminId, from, to };

  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every admin and money action, newest first. Entries cannot be edited or deleted from the app."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Audit' }]}
      />
      <AuditClient
        key={JSON.stringify(filters) + page}
        entries={entries}
        filters={filters}
        entityTypes={ENTITY_TYPES}
        admins={[...adminOptions].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))}
        total={logsRes.count ?? entries.length}
        page={page}
        pageSize={PAGE_SIZE}
      />
    </>
  );
}
