'use client';

import Link from 'next/link';
import { Bus } from 'lucide-react';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import AdminPager from '@/components/admin/AdminPager';
import { manilaDateTime, peso, shortDate } from '@/lib/finance-format';
import { cn } from '@/lib/utils';
import { TRANSPORT_STATUSES, type TransportStatus } from '@/lib/schemas/admin-tools';


export interface TransportRequest {
  id: string;
  status: string;
  pickup: string;
  dropoff: string;
  pickupAt: string;
  returnAt: string | null;
  seats: number;
  estimatedPrice: number | null;
  createdAt: string;
  updatedAt: string;
  organizer: string;
  transporter: string;
  vehicle: string;
  tourTitle: string;
  scheduleStart: string | null;
  scheduleEnd: string | null;
}

interface TransportClientProps {
  requests: TransportRequest[];
  status: TransportStatus | null;
  total: number;
  page: number;
  pageSize: number;
}

// Read-only transport oversight (OPS-06). Filters are links so the list is server-paginated.
export default function TransportClient({ requests, status, total, page, pageSize }: TransportClientProps) {
  const filters: { value: TransportStatus | null; label: string }[] = [
    { value: null, label: 'All' },
    ...TRANSPORT_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) })),
  ];

  return (
    <CardBox className="gap-0 overflow-hidden p-0">
      <div className="flex flex-col gap-4 border-b border-border px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h5 className="card-title">All requests</h5>
          <p className="text-sm text-muted-foreground">{total.toLocaleString()} request{total === 1 ? '' : 's'}{status ? ` · ${status}` : ''}</p>
        </div>
        <nav aria-label="Filter by status" className="flex flex-wrap gap-2">
          {filters.map((f) => {
            const active = f.value === status;
            return (
              <Button key={f.label} asChild size="xs" variant={active ? 'default' : 'neutral'}>
                <Link href={f.value ? `/admin/transport?status=${f.value}` : '/admin/transport'} aria-current={active ? 'page' : undefined}>
                  {f.label}
                </Link>
              </Button>
            );
          })}
        </nav>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={Bus} title={status ? `No ${status} transport requests.` : 'No transport requests yet.'} />
      ) : (
        <>
          <div className="space-y-4 p-4 md:hidden">
            {requests.map((r) => (
              <LazyMobileCard
                key={r.id}
                headerTitle={r.tourTitle}
                headerSubtitle={`${r.organizer} → ${r.transporter}`}
                headerBadge={<StatusBadge status={r.status} />}
                rows={[
                  { label: 'Pickup', value: manilaDateTime(r.pickupAt) },
                  { label: 'Seats', value: r.seats },
                  { label: 'Route', value: `${r.pickup} → ${r.dropoff}`, fullWidth: true },
                  { label: 'Vehicle', value: r.vehicle, fullWidth: true },
                ]}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="px-6">Tour & schedule</TableHead>
                  <TableHead className="px-6">Organizer → Transporter</TableHead>
                  <TableHead className="px-6">Route</TableHead>
                  <TableHead className="px-6">Pickup</TableHead>
                  <TableHead className="px-6 text-center">Seats</TableHead>
                  <TableHead className="px-6 text-right">Est. price</TableHead>
                  <TableHead className="px-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="px-6">
                      <p className="font-semibold text-foreground">{r.tourTitle}</p>
                      <p className="text-xs text-muted-foreground">{shortDate(r.scheduleStart)} – {shortDate(r.scheduleEnd)}</p>
                    </TableCell>
                    <TableCell className="px-6">
                      <p className="font-medium text-foreground">{r.organizer}</p>
                      <p className="text-xs text-muted-foreground">→ {r.transporter}</p>
                      <p className="text-xs text-muted-foreground">{r.vehicle}</p>
                    </TableCell>
                    <TableCell className="max-w-[220px] px-6 text-sm text-bodytext">
                      <p className="truncate" title={r.pickup}>{r.pickup}</p>
                      <p className="truncate text-muted-foreground" title={r.dropoff}>→ {r.dropoff}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap px-6 text-muted-foreground">
                      {manilaDateTime(r.pickupAt)}
                      {r.returnAt && <span className="block text-xs">Return {manilaDateTime(r.returnAt)}</span>}
                    </TableCell>
                    <TableCell className="px-6 text-center">{r.seats}</TableCell>
                    <TableCell className={cn('px-6 text-right', r.estimatedPrice === null && 'text-muted-foreground')}>
                      {r.estimatedPrice === null ? '—' : peso(r.estimatedPrice)}
                    </TableCell>
                    <TableCell className="px-6">
                      <StatusBadge status={r.status} />
                      <span className="mt-1 block text-[10px] text-muted-foreground">Updated {manilaDateTime(r.updatedAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
      <AdminPager basePath="/admin/transport" params={{ status: status ?? undefined }} page={page} pageSize={pageSize} total={total} />
    </CardBox>
  );
}
