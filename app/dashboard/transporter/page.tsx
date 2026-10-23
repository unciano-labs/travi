import { Bus, CalendarCheck, Map, Star, Clock, Plus, Calendar, Inbox, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import CardBox from '@/components/ui/CardBox';
import WelcomeBanner from '@/components/ui/WelcomeBanner';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Timeline, { type TimelineItem } from '@/components/ui/Timeline';
import EmptyState from '@/components/ui/EmptyState';
import BarChart from '@/components/ui/charts/BarChart';
import DonutChart from '@/components/ui/charts/DonutChart';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface RecentRequest {
  id: string;
  pickup_location: string;
  dropoff_location: string;
  pickup_datetime: string;
  seats_required: number | null;
  estimated_price: number | string | null;
  status: string;
  created_at: string;
  organizer: { company_name: string | null; display_name: string | null } | null;
  vehicle: { name: string | null; vehicle_type: string | null } | null;
}

const STATUS_TONE: Record<string, TimelineItem['tone']> = {
  pending: 'warning',
  accepted: 'success',
  completed: 'primary',
  declined: 'error',
  canceled: 'error',
};

function formatPickupDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function organizerName(r: RecentRequest) {
  return r.organizer?.company_name || r.organizer?.display_name || 'Tour Organizer';
}

export default async function TransporterDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!userProfile) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('transporter_profiles')
    .select('*')
    .eq('user_profile_id', userProfile.id)
    .is('deleted_at', null)
    .single();

  if (!profile) {
    redirect('/dashboard/transporter');
  }

  // Fetch real counts in parallel
  const [vehiclesRes, pendingRes, upcomingRes, recentRequestsRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id', { count: 'exact', head: true })
      .eq('transporter_id', profile.id)
      .eq('status', 'active')
      .is('deleted_at', null),
    supabase
      .from('transport_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('transporter_id', profile.id)
      .eq('status', 'pending')
      .is('deleted_at', null),
    supabase
      .from('transport_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('transporter_id', profile.id)
      .eq('status', 'accepted')
      .is('deleted_at', null),
    supabase
      .from('transport_bookings')
      .select(`
        id,
        pickup_location,
        dropoff_location,
        pickup_datetime,
        seats_required,
        estimated_price,
        status,
        created_at,
        organizer:public_organizer_profiles (
          company_name,
          display_name
        ),
        vehicle:vehicles (
          name,
          vehicle_type
        )
      `)
      .eq('transporter_id', profile.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const activeVehiclesCount = vehiclesRes.count || 0;
  const pendingRequestsCount = pendingRes.count || 0;
  const upcomingTripsCount = upcomingRes.count || 0;
  const recentRequests = (recentRequestsRes.data || []) as unknown as RecentRequest[];
  const serviceAreasCount = profile.service_areas?.length || 0;
  const averageRating = Number(profile.average_rating) || 0;

  const title = profile.company_name || profile.display_name || 'Transporter Dashboard';

  // Chart data, aggregated on the server from the rows fetched above.
  const chronological = [...recentRequests].reverse();
  const requestValueCategories = chronological.map((r) =>
    new Date(r.pickup_datetime).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
  );
  const requestValueSeries = [
    { name: 'Estimated Price', data: chronological.map((r) => Number(r.estimated_price) || 0) },
  ];
  const pipelineTotal = pendingRequestsCount + upcomingTripsCount;

  const timelineItems: TimelineItem[] = recentRequests.map((r) => ({
    key: r.id,
    time: new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    title: organizerName(r),
    subtitle: `${r.pickup_location} → ${r.dropoff_location}`,
    tone: STATUS_TONE[r.status] ?? 'secondary',
  }));

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Welcome */}
      <div className="col-span-12">
        <WelcomeBanner
          name={title}
          subtitle={profile.description || 'Welcome to your fleet command center. Manage vehicles, dates, and tour organizer bookings in real-time.'}
          actions={
            <>
              <Button asChild size="sm">
                <Link href="/dashboard/transporter/vehicles">
                  <Plus /> Add Vehicle
                </Link>
              </Button>
              <Button asChild size="sm" variant="neutral">
                <Link href="/dashboard/transporter/availability">
                  <Calendar /> Block Dates
                </Link>
              </Button>
            </>
          }
        />
      </div>

      {/* KPI Cards */}
      <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Active Fleet"
          value={activeVehiclesCount}
          icon={Bus}
          tone="primary"
          hint="Ready for bookings"
          href="/dashboard/transporter/vehicles"
        />
        <StatCard
          title="Pending Requests"
          value={pendingRequestsCount}
          icon={Clock}
          tone="warning"
          hint="Requires review"
          href="/dashboard/transporter/requests"
        />
        <StatCard
          title="Upcoming Trips"
          value={upcomingTripsCount}
          icon={CalendarCheck}
          tone="secondary"
          hint="Confirmed schedule"
          href="/dashboard/transporter/requests"
        />
        <StatCard
          title="Rating & Reviews"
          value={
            <>
              {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}{' '}
              <span className="text-xs font-medium text-muted-foreground">({profile.review_count || 0})</span>
            </>
          }
          icon={Star}
          tone="success"
          hint="Customer satisfaction"
          href="/dashboard/transporter/reviews"
        />
      </div>

      {/* Recent request value */}
      <div className="col-span-12 flex lg:col-span-8">
        <CardBox>
          <div>
            <h5 className="card-title">Recent Request Value</h5>
            <p className="text-sm text-muted-foreground">Estimated price of your latest transport requests, by pickup date</p>
          </div>
          {recentRequests.length === 0 ? (
            <EmptyState icon={Inbox} title="No transport requests received yet." />
          ) : (
            <BarChart categories={requestValueCategories} series={requestValueSeries} valuePrefix="₱" height={300} />
          )}
        </CardBox>
      </div>

      {/* Pipeline + coverage */}
      <div className="col-span-12 flex flex-col gap-6 lg:col-span-4">
        <CardBox>
          <div className="grid grid-cols-12 items-center gap-4">
            <div className="col-span-7 flex flex-col">
              <h5 className="card-title mb-4">Request Pipeline</h5>
              <h4 className="mb-2 text-xl font-semibold text-foreground">{pipelineTotal}</h4>
              <p className="text-sm text-muted-foreground">Open & confirmed trips</p>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-warning" aria-hidden="true" /> Pending
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="size-2.5 rounded-full bg-secondary" aria-hidden="true" /> Upcoming
                </span>
              </div>
            </div>
            <div className="col-span-5 flex justify-center">
              {pipelineTotal > 0 ? (
                <DonutChart
                  labels={['Pending', 'Upcoming']}
                  series={[pendingRequestsCount, upcomingTripsCount]}
                  colors={['var(--color-warning)', 'var(--color-secondary)']}
                  height={150}
                  width={150}
                />
              ) : (
                <span className="flex size-24 items-center justify-center rounded-full border-8 border-muted text-xs text-muted-foreground">
                  0
                </span>
              )}
            </div>
          </div>
        </CardBox>

        <CardBox>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h5 className="card-title mb-4">Fleet Coverage</h5>
              <h4 className="mb-2 text-xl font-semibold text-foreground">{serviceAreasCount}</h4>
              <p className="text-sm text-muted-foreground">
                Service area{serviceAreasCount === 1 ? '' : 's'} · {activeVehiclesCount} active vehicle{activeVehiclesCount === 1 ? '' : 's'}
              </p>
            </div>
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-secondary text-white">
              <Map className="size-6" aria-hidden="true" />
            </span>
          </div>
        </CardBox>
      </div>

      {/* Recent activity timeline */}
      <div className="col-span-12 lg:col-span-4">
        <CardBox className="h-full">
          <div>
            <h5 className="card-title">Recent Activity</h5>
            <p className="text-sm text-muted-foreground">Latest requests received</p>
          </div>
          {timelineItems.length === 0 ? (
            <EmptyState title="No transport requests received yet." />
          ) : (
            <Timeline items={timelineItems} />
          )}
        </CardBox>
      </div>

      {/* Recent Requests table */}
      <div className="col-span-12 flex lg:col-span-8">
        <CardBox className="gap-0 overflow-hidden p-0">
          <div className="flex items-center justify-between gap-4 border-b border-border px-6 py-4">
            <div>
              <h5 className="card-title">Recent Transport Requests</h5>
              <p className="text-sm text-muted-foreground">Latest trip booking requests received from Tour Organizers.</p>
            </div>
            <Button asChild variant="ghostprimary" size="sm">
              <Link href="/dashboard/transporter/requests">
                <span>View All Inbox</span>
                <ArrowRight />
              </Link>
            </Button>
          </div>

          {recentRequests.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No transport requests received yet."
              description="Make sure your vehicles are active and availability is set to attract Tour Organizers."
            />
          ) : (
            <>
              {/* Mobile View */}
              <div className="block space-y-4 p-4 md:hidden">
                {recentRequests.map((r) => (
                  <LazyMobileCard
                    key={r.id}
                    headerTitle={organizerName(r)}
                    headerSubtitle={
                      <span className="font-mono text-[10px]">
                        Route: <span className="text-bodytext">{r.pickup_location} → {r.dropoff_location}</span>
                      </span>
                    }
                    headerBadge={<StatusBadge status={r.status} />}
                    rows={[
                      { label: 'Vehicle', value: r.vehicle?.name || 'Any Available', fullWidth: true },
                      { label: 'Pickup Date', value: formatPickupDate(r.pickup_datetime) },
                    ]}
                    actions={
                      <Link href="/dashboard/transporter/requests" className="text-xs font-semibold text-primary hover:underline">
                        Manage
                      </Link>
                    }
                  />
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-6">Organizer</TableHead>
                      <TableHead>Vehicle Requested</TableHead>
                      <TableHead>Pickup Date</TableHead>
                      <TableHead>Route</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="px-6 text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="px-6 font-semibold text-foreground">{organizerName(r)}</TableCell>
                        <TableCell className="font-medium">{r.vehicle?.name || 'Any Available'}</TableCell>
                        <TableCell>{formatPickupDate(r.pickup_datetime)}</TableCell>
                        <TableCell className="max-w-xs truncate text-xs">
                          {r.pickup_location} → {r.dropoff_location}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={r.status} />
                        </TableCell>
                        <TableCell className="px-6 text-right">
                          <Link href="/dashboard/transporter/requests" className="text-xs font-semibold text-primary hover:underline">
                            Manage
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardBox>
      </div>
    </div>
  );
}
