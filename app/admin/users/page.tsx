import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';
import { ROLE_VALUES, firstParam, pageNumber, sanitizeSearch, type RoleValue } from '@/lib/schemas/admin-tools';
import PageHeader from '@/components/ui/PageHeader';
import UsersClient, { type AdminUser } from '@/components/admin/UsersClient';

const PAGE_SIZE = 25;

interface ProfileRow {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  deleted_at: string | null;
  user_roles: { website_roles: { role: string; website_id: string } | { role: string; website_id: string }[] | null }[] | null;
}

// Supabase stores bans as a banned_until timestamp; a past value means the ban has expired.
function isBanned(bannedUntil: string | null) {
  return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
}

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user, profile } = await requireSession();
  await assertRole(user.id, 'admin');

  const params = await searchParams;
  const q = sanitizeSearch(firstParam(params.q));
  const page = pageNumber(params.page);

  // Service role: admin console read across every user, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  let query = admin
    .from('user_profiles')
    .select('id, user_id, email, full_name, created_at, deleted_at, user_roles ( website_roles ( role, website_id ) )', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  // q is restricted to letters, digits, spaces and @._+- (sanitizeSearch), so it is safe inside .or().
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%`);
  const { data, count, error } = await query;
  if (error) captureException(error, { action: 'AdminUsersPage' });

  const rows = (data ?? []) as unknown as ProfileRow[];
  const status = new Map<string, { banned_until: string | null; last_sign_in_at: string | null }>();
  if (rows.length > 0) {
    const { data: auth, error: authError } = await admin.rpc('admin_auth_user_status', { p_user_ids: rows.map((r) => r.user_id) });
    if (authError) captureException(authError, { action: 'AdminUsersPage auth status' });
    for (const s of (auth ?? []) as { user_id: string; banned_until: string | null; last_sign_in_at: string | null }[]) {
      status.set(s.user_id, s);
    }
  }

  const users: AdminUser[] = rows.map((r) => {
    const roles = new Set<RoleValue>();
    for (const ur of r.user_roles ?? []) {
      const list = Array.isArray(ur.website_roles) ? ur.website_roles : ur.website_roles ? [ur.website_roles] : [];
      for (const wr of list) {
        if (env.WEBSITE_ID && wr.website_id !== env.WEBSITE_ID) continue;
        if ((ROLE_VALUES as readonly string[]).includes(wr.role)) roles.add(wr.role as RoleValue);
      }
    }
    const auth = status.get(r.user_id);
    return {
      id: r.id,
      email: r.email,
      fullName: r.full_name,
      createdAt: r.created_at,
      deleted: Boolean(r.deleted_at),
      roles: ROLE_VALUES.filter((role) => roles.has(role)),
      suspended: auth ? isBanned(auth.banned_until) : null,
      lastSignInAt: auth?.last_sign_in_at ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Users"
        description="Search accounts, manage roles and suspend sign-in. Every change is recorded in the audit log."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Users' }]}
      />
      <UsersClient
        key={`${q}-${page}`}
        initialUsers={users}
        total={count ?? users.length}
        page={page}
        pageSize={PAGE_SIZE}
        query={q}
        currentProfileId={profile.id as string}
      />
    </>
  );
}
