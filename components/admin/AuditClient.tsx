'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ScrollText } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input, NativeSelect } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminPager from '@/components/admin/AdminPager';
import { manilaDateTime } from '@/lib/finance-format';

export interface AuditEntry {
  id: string;
  adminName: string;
  entityType: string;
  entityId: string;
  action: string;
  notes: string | null;
  createdAt: string;
}

export interface AuditFilters {
  entity: string;
  action: string;
  admin: string;
  from: string;
  to: string;
}

interface AuditClientProps {
  entries: AuditEntry[];
  filters: AuditFilters;
  entityTypes: string[];
  admins: { id: string; name: string }[];
  total: number;
  page: number;
  pageSize: number;
}

function Notes({ text }: { text: string | null }) {
  if (!text) return <span className="text-muted-foreground">—</span>;
  if (text.length <= 120) return <span className="break-words">{text}</span>;
  return (
    <details>
      <summary className="cursor-pointer rounded text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
        {text.slice(0, 100)}…
      </summary>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded bg-muted p-2 font-mono text-[11px] text-bodytext">{text}</pre>
    </details>
  );
}

export default function AuditClient({ entries, filters, entityTypes, admins, total, page, pageSize }: AuditClientProps) {
  const router = useRouter();
  const [form, setForm] = useState<AuditFilters>(filters);
  const set = (key: keyof AuditFilters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const apply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(form)) if (v) params.set(k, v);
    const qs = params.toString();
    router.push(qs ? `/admin/audit?${qs}` : '/admin/audit');
  };
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <form onSubmit={apply} className="grid grid-cols-1 gap-4 border-b border-border px-6 py-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="space-y-2">
          <Label htmlFor="audit-entity">Entity</Label>
          <NativeSelect id="audit-entity" value={form.entity} onChange={set('entity')}>
            <option value="">All</option>
            {entityTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-action">Action contains</Label>
          <Input id="audit-action" value={form.action} onChange={set('action')} placeholder="e.g. refund" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-admin">Admin</Label>
          <NativeSelect id="audit-admin" value={form.admin} onChange={set('admin')}>
            <option value="">Anyone</option>
            {admins.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" type="date" value={form.from} onChange={set('from')} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" type="date" value={form.to} onChange={set('to')} />
        </div>
        <div className="flex gap-2">
          <Button type="submit">Filter</Button>
          {hasFilters && (
            <Button type="button" variant="neutral" onClick={() => router.push('/admin/audit')}>Clear</Button>
          )}
        </div>
      </form>

      <div className="border-b border-border px-6 py-3 text-sm text-muted-foreground">{total.toLocaleString()} entr{total === 1 ? 'y' : 'ies'}</div>

      {entries.length === 0 ? (
        <EmptyState icon={ScrollText} title={hasFilters ? 'No audit entries match these filters.' : 'No audit entries yet.'} />
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {entries.map((e) => (
              <LazyMobileCard
                key={e.id}
                headerTitle={e.action}
                headerSubtitle={manilaDateTime(e.createdAt)}
                headerBadge={<Badge variant="gray">{e.entityType}</Badge>}
                rows={[
                  { label: 'Admin', value: e.adminName },
                  { label: 'Entity id', value: <span className="font-mono text-xs">{e.entityId.slice(0, 8)}…</span> },
                  { label: 'Notes', value: <Notes text={e.notes} />, fullWidth: true },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">When</TableHead>
                  <TableHead className="px-6">Admin</TableHead>
                  <TableHead className="px-6">Entity</TableHead>
                  <TableHead className="px-6">Action</TableHead>
                  <TableHead className="px-6">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => (
                  <TableRow key={e.id} className="align-top">
                    <TableCell className="whitespace-nowrap px-6 text-muted-foreground">{manilaDateTime(e.createdAt)}</TableCell>
                    <TableCell className="px-6 font-medium text-foreground">{e.adminName}</TableCell>
                    <TableCell className="px-6">
                      <Badge variant="gray">{e.entityType.replace(/_/g, ' ')}</Badge>
                      <p className="mt-1 font-mono text-[11px] text-muted-foreground" title={e.entityId}>{e.entityId.slice(0, 8)}…</p>
                    </TableCell>
                    <TableCell className="px-6 font-mono text-xs text-foreground">{e.action}</TableCell>
                    <TableCell className="max-w-md px-6 text-xs text-bodytext"><Notes text={e.notes} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <AdminPager
        basePath="/admin/audit"
        params={{ entity: filters.entity || undefined, action: filters.action || undefined, admin: filters.admin || undefined, from: filters.from || undefined, to: filters.to || undefined }}
        page={page}
        pageSize={pageSize}
        total={total}
      />
    </CardBox>
  );
}
