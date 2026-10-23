'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Users, UserCog, Ban, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { modifyUserRole, setUserSuspended } from '@/actions/admin';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import InputDialog from '@/components/admin/InputDialog';
import AdminPager from '@/components/admin/AdminPager';
import { manilaDateTime } from '@/lib/finance-format';
import { ROLE_VALUES, type RoleValue } from '@/lib/schemas/admin-tools';

export interface AdminUser {
  id: string;
  email: string;
  fullName: string | null;
  createdAt: string;
  deleted: boolean;
  roles: RoleValue[];
  /** null when the auth status could not be read. */
  suspended: boolean | null;
  lastSignInAt: string | null;
}

interface UsersClientProps {
  initialUsers: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
  currentProfileId: string;
}

const ROLE_BADGE: Record<RoleValue, 'lightError' | 'lightPrimary' | 'lightSuccess' | 'lightSecondary'> = {
  admin: 'lightError',
  traveler: 'lightPrimary',
  organizer: 'lightSuccess',
  transporter: 'lightSecondary',
};

export default function UsersClient({ initialUsers, total, page, pageSize, query, currentProfileId }: UsersClientProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [search, setSearch] = useState(query);
  const [managing, setManaging] = useState<AdminUser | null>(null);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const [busyRole, setBusyRole] = useState<RoleValue | 'unsuspend' | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);

  const update = (id: string, changes: Partial<AdminUser>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...changes } : u)));
    setManaging((m) => (m && m.id === id ? { ...m, ...changes } : m));
  };

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    router.push(q ? `/admin/users?q=${encodeURIComponent(q)}` : '/admin/users');
  };

  const toggleRole = async (u: AdminUser, role: RoleValue) => {
    const has = u.roles.includes(role);
    setBusyRole(role);
    setDialogError(null);
    const res = await modifyUserRole({ userProfileId: u.id, role, operation: has ? 'revoke' : 'grant' });
    setBusyRole(null);
    if (!res.success) {
      setDialogError(res.error);
      return;
    }
    update(u.id, { roles: has ? u.roles.filter((r) => r !== role) : ROLE_VALUES.filter((r) => r === role || u.roles.includes(r)) });
  };

  const unsuspend = async (u: AdminUser) => {
    setBusyRole('unsuspend');
    setDialogError(null);
    const res = await setUserSuspended({ userProfileId: u.id, suspend: false });
    setBusyRole(null);
    if (!res.success) setDialogError(res.error);
    else update(u.id, { suspended: false });
  };

  const statusBadge = (u: AdminUser) => {
    if (u.deleted) return <Badge variant="gray">deleted</Badge>;
    if (u.suspended === null) return <Badge variant="gray">unknown</Badge>;
    return u.suspended ? <Badge variant="lightError">suspended</Badge> : <Badge variant="lightSuccess">active</Badge>;
  };
  const roleBadges = (u: AdminUser) =>
    u.roles.length === 0 ? (
      <span className="text-xs text-muted-foreground">No roles</span>
    ) : (
      <div className="flex flex-wrap gap-1">
        {u.roles.map((r) => <Badge key={r} variant={ROLE_BADGE[r]}>{r}</Badge>)}
      </div>
    );
  const manageButton = (u: AdminUser) => (
    <Button type="button" variant="lightprimary" size="xs" onClick={() => { setDialogError(null); setManaging(u); }}>
      <UserCog /> Manage
    </Button>
  );

  return (
    <>
      <CardBox className="gap-0 overflow-hidden p-0">
        <div className="flex flex-col justify-between gap-4 border-b border-border px-6 py-4 sm:flex-row sm:items-center">
          <div>
            <h5 className="card-title">All users</h5>
            <p className="text-sm text-muted-foreground">{total.toLocaleString()} user{total === 1 ? '' : 's'}{query ? ` matching “${query}”` : ''}</p>
          </div>
          <form onSubmit={submitSearch} role="search" className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search users by name or email"
              placeholder="Search name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 sm:w-72"
            />
          </form>
        </div>

        {users.length === 0 ? (
          <EmptyState icon={Users} title={query ? 'No users match your search.' : 'No users found.'} />
        ) : (
          <>
            <div className="space-y-4 p-4 md:hidden">
              {users.map((u) => (
                <LazyMobileCard
                  key={u.id}
                  headerTitle={u.fullName || u.email}
                  headerSubtitle={u.email}
                  headerBadge={statusBadge(u)}
                  rows={[
                    { label: 'Roles', value: roleBadges(u), fullWidth: true },
                    { label: 'Joined', value: manilaDateTime(u.createdAt) },
                    { label: 'Last sign-in', value: manilaDateTime(u.lastSignInAt) },
                  ]}
                  actions={manageButton(u)}
                />
              ))}
            </div>
            <div className="hidden md:block">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-6">User</TableHead>
                    <TableHead className="px-6">Roles</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6">Joined</TableHead>
                    <TableHead className="px-6">Last sign-in</TableHead>
                    <TableHead className="px-6 text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="px-6">
                        <p className="font-semibold text-foreground">{u.fullName || '—'}{u.id === currentProfileId && <span className="ml-1 text-xs font-normal text-muted-foreground">(you)</span>}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </TableCell>
                      <TableCell className="px-6">{roleBadges(u)}</TableCell>
                      <TableCell className="px-6">{statusBadge(u)}</TableCell>
                      <TableCell className="whitespace-nowrap px-6 text-muted-foreground">{manilaDateTime(u.createdAt)}</TableCell>
                      <TableCell className="whitespace-nowrap px-6 text-muted-foreground">{manilaDateTime(u.lastSignInAt)}</TableCell>
                      <TableCell className="px-6 text-right">{manageButton(u)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
        <AdminPager basePath="/admin/users" params={{ q: query || undefined }} page={page} pageSize={pageSize} total={total} />
      </CardBox>

      {managing && (
        <Dialog open onOpenChange={(open) => { if (!open && !busyRole) setManaging(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{managing.fullName || managing.email}</DialogTitle>
              <DialogDescription>{managing.email}</DialogDescription>
            </DialogHeader>
            <div className="space-y-5">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-semibold text-foreground">Roles</legend>
                {ROLE_VALUES.map((role) => {
                  const has = managing.roles.includes(role);
                  const selfAdmin = role === 'admin' && has && managing.id === currentProfileId;
                  return (
                    <div key={role} className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2">
                      <span className="flex items-center gap-2 text-sm capitalize text-foreground">
                        {role}
                        {has && <Badge variant={ROLE_BADGE[role]}>has role</Badge>}
                      </span>
                      <Button
                        type="button"
                        size="xs"
                        variant={has ? 'lighterror' : 'lightprimary'}
                        disabled={busyRole !== null || selfAdmin}
                        title={selfAdmin ? 'You cannot remove your own admin role.' : undefined}
                        onClick={() => toggleRole(managing, role)}
                      >
                        {busyRole === role && <Loader2 className="animate-spin" />}
                        {has ? 'Remove' : 'Grant'}
                      </Button>
                    </div>
                  );
                })}
              </fieldset>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Sign-in access</p>
                {managing.suspended ? (
                  <Button type="button" variant="lightsuccess" size="sm" disabled={busyRole !== null} onClick={() => unsuspend(managing)}>
                    {busyRole === 'unsuspend' ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Unsuspend account
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="lighterror"
                    size="sm"
                    disabled={busyRole !== null || managing.id === currentProfileId || managing.roles.includes('admin')}
                    title={managing.roles.includes('admin') ? 'Remove the admin role before suspending an admin.' : undefined}
                    onClick={() => setSuspending(managing)}
                  >
                    <Ban /> Suspend account
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">Suspended users cannot sign in. Sessions already open end within an hour.</p>
              </div>
              {dialogError && (
                <Alert variant="lighterror">
                  <AlertCircle />
                  <AlertDescription>{dialogError}</AlertDescription>
                </Alert>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="neutral" disabled={busyRole !== null} onClick={() => setManaging(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <InputDialog
        open={suspending !== null}
        title="Suspend account"
        description={suspending ? `${suspending.fullName || suspending.email} will not be able to sign in until unsuspended.` : undefined}
        label="Reason (kept in the audit log)"
        placeholder="e.g. Fraudulent bookings reported"
        multiline
        minLength={3}
        confirmText="Suspend"
        destructive
        onClose={() => setSuspending(null)}
        onSubmit={async (reason) => {
          if (!suspending) return null;
          const res = await setUserSuspended({ userProfileId: suspending.id, suspend: true, reason });
          if (!res.success) return res.error;
          update(suspending.id, { suspended: true });
          return null;
        }}
      />
    </>
  );
}
