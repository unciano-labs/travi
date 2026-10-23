import { z } from 'zod';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { TRANSPORT_STATUSES, firstParam, pageNumber } from '@/lib/schemas/admin-tools';
import PageHeader from '@/components/ui/PageHeader';
import TransportClient, { type TransportRequest } from '@/components/admin/TransportClient';

const PAGE_SIZE = 25;

type Embed<T> = T | T[] | null | undefined;
const one = <T,>(value: Embed<T>): T | null => (Array.isArray(value) ? value[0] ?? null : value ?? null);
interface PartnerName { display_name: string | null; company_name: string | null }

interface Row {
  id: string;
  status: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  return_datetime: string | null;
  seats_required: number;
  estimated_price: number | string | null;
  created_at: string;
  updated_at: string;
  organizer: Embed<PartnerName>;
  transporter: Embed<PartnerName>;
  vehicles: Embed<{ name: string | null; vehicle_type: string | null; seat_capacity: number | null }>;
  tour_schedules: Embed<{ start_date: string; end_date: string; tours: Embed<{ title: string }> }>;
}

export default async function AdminTransportPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const params = await searchParams;
  const statusParam = z.enum(TRANSPORT_STATUSES).safeParse(firstParam(params.status));
  const status = statusParam.success ? statusParam.data : null;
  const page = pageNumber(params.page);

  // Service role: read-only admin oversight of every transport request, authorized above (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  let query = admin
    .from('transport_bookings')
    .select(`
      id, status, pickup_location, dropoff_location, pickup_datetime, return_datetime, seats_required, estimated_price,
      created_at, updated_at,
      organizer:organizer_profiles ( display_name, company_name ),
      transporter:transporter_profiles ( display_name, company_name ),
      vehicles ( name, vehicle_type, seat_capacity ),
      tour_schedules ( start_date, end_date, tours ( title ) )
    `, { count: 'exact' })
    .is('deleted_at', null)
    .order('pickup_datetime', { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq('status', status);
  const { data, count, error } = await query;
  if (error) captureException(error, { action: 'AdminTransportPage' });

  const name = (p: PartnerName | null) => p?.company_name || p?.display_name || 'Unknown';
  const requests: TransportRequest[] = ((data ?? []) as unknown as Row[]).map((r) => {
    const schedule = one(r.tour_schedules);
    const vehicle = one(r.vehicles);
    return {
      id: r.id,
      status: r.status,
      pickup: r.pickup_location,
      dropoff: r.dropoff_location,
      pickupAt: r.pickup_datetime,
      returnAt: r.return_datetime,
      seats: r.seats_required,
      estimatedPrice: r.estimated_price === null ? null : Number(r.estimated_price),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      organizer: name(one(r.organizer)),
      transporter: name(one(r.transporter)),
      vehicle: vehicle
        ? [vehicle.name ?? 'Vehicle', vehicle.vehicle_type, vehicle.seat_capacity ? `${vehicle.seat_capacity} seats` : null].filter(Boolean).join(' · ')
        : '—',
      tourTitle: one(schedule?.tours)?.title ?? 'Unknown tour',
      scheduleStart: schedule?.start_date ?? null,
      scheduleEnd: schedule?.end_date ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Transport Requests"
        description="Read-only view of every organizer ↔ transporter request."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Transport' }]}
      />
      <TransportClient requests={requests} status={status} total={count ?? requests.length} page={page} pageSize={PAGE_SIZE} />
    </>
  );
}
