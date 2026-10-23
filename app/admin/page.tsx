import { Users, Bus, Map as MapIcon, CreditCard, Activity, ArrowRight } from 'lucide-react';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import Link from 'next/link';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import StatCard, { type StatTone } from '@/components/ui/StatCard';
import Timeline, { type TimelineItem } from '@/components/ui/Timeline';
import EmptyState from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import BarChart from '@/components/ui/charts/BarChart';
import DonutChart from '@/components/ui/charts/DonutChart';
import { captureException } from '@/lib/logger';
import { formatDate, formatDateOfInstant, formatNumber, formatPHP, formatTimeOfInstant } from '@/lib/format';

const CHART_MONTHS = 6;
const STATUS_BREAKDOWN: { status: string; label: string; color: string; dot: string }[] = [
  { status: 'pending', label: 'Pending', color: 'var(--color-warning)', dot: 'bg-warning' },
  { status: 'confirmed', label: 'Confirmed', color: 'var(--color-success)', dot: 'bg-success' },
  { status: 'completed', label: 'Completed', color: 'var(--color-primary)', dot: 'bg-primary' },
  { status: 'canceled', label: 'Canceled', color: 'var(--color-error)', dot: 'bg-error' },
  { status: 'refunded', label: 'Refunded', color: 'var(--color-info)', dot: 'bg-info' },
];
const STATUS_TONE: Record<string, TimelineItem['tone']> = {
  pending: 'warning',
  confirmed: 'success',
  completed: 'primary',
  canceled: 'error',
  refunded: 'info',
};

interface MonthStats {
  month: string; // first day of the Manila month, YYYY-MM-DD
  bookings: number | string;
  revenue: number | string;
  pending: number | string;
  confirmed: number | string;
  completed: number | string;
  canceled: number | string;
  refunded: number | string;
}

const monthLabel = (month: string) => formatDate(`${month.slice(0, 7)}-15`, { month: 'short' });

export default async function AdminDashboard() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  const [
    usersRes,
    toursRes,
    bookingsRes,
    transportersRes,
    recentActivityRes,
    statsRes
  ] = await Promise.all([
    admin.from('user_profiles').select('*', { count: 'exact', head: true }),
    admin.from('tours').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    admin.from('bookings').select('*', { count: 'exact', head: true }).eq('status', 'confirmed'),
    admin.from('transporter_profiles').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    admin.from('bookings')
      .select('id, total_amount, created_at, seats, status, user_profiles(full_name), tour_schedules(tours(title))')
      .order('created_at', { ascending: false })
      .limit(5),
    // Aggregated in SQL (per Manila month): no PostgREST row cap, no JS sums (AGENTS.md §6 23c).
    admin.rpc('admin_booking_stats', { p_months: CHART_MONTHS }),
  ]);
  if (statsRes.error) captureException(statsRes.error, { action: 'AdminDashboard admin_booking_stats' });

  const stats: { name: string; value: string; icon: typeof Users; tone: StatTone; href?: string }[] = [
    { name: 'Total Users', value: formatNumber(usersRes.count || 0), icon: Users, tone: 'primary' },
    { name: 'Active Tours', value: formatNumber(toursRes.count || 0), icon: MapIcon, tone: 'success', href: '/admin/tours' },
    { name: 'Total Bookings', value: formatNumber(bookingsRes.count || 0), icon: CreditCard, tone: 'info', href: '/admin/bookings' },
    { name: 'Transporters', value: formatNumber(transportersRes.count || 0), icon: Bus, tone: 'warning', href: '/admin/transporters' },
  ];

  const monthStats = ((statsRes.data ?? []) as MonthStats[]).map((m) => ({ ...m, label: monthLabel(String(m.month)) }));
  const months = monthStats.map((m) => ({ key: String(m.month), label: m.label }));
  const bookingsPerMonth = monthStats.map((m) => Number(m.bookings) || 0);
  const revenuePerMonth = monthStats.map((m) => Number(m.revenue) || 0);
  const statusCounts = new Map<string, number>(
    STATUS_BREAKDOWN.map((s) => [
      s.status,
      monthStats.reduce((sum, m) => sum + (Number(m[s.status as keyof MonthStats]) || 0), 0),
    ])
  );
  const totalChartBookings = bookingsPerMonth.reduce((a, b) => a + b, 0);
  const totalChartRevenue = revenuePerMonth.reduce((a, b) => a + b, 0);
  const breakdown = STATUS_BREAKDOWN.map((s) => ({ ...s, count: statusCounts.get(s.status) || 0 }));

  const recentBookings = recentActivityRes.data || [];
  const timelineItems: TimelineItem[] = recentBookings.map((b: any) => {
    const travelerName = b.user_profiles?.full_name || 'Anonymous';
    const tourTitle = b.tour_schedules?.tours?.title || 'Unknown Tour';
    return {
      key: b.id,
      time: (
        <>
          {formatDateOfInstant(b.created_at)}
          <span className="block font-normal text-muted-foreground">
            {formatTimeOfInstant(b.created_at)}
          </span>
        </>
      ),
      title: `New Booking: ${tourTitle}`,
      subtitle: `${travelerName} booked for ${b.seats} pax • ${formatPHP(b.total_amount || 0)}`,
      tone: STATUS_TONE[b.status] ?? 'primary',
    };
  });

  return (
    <>
      <PageHeader
        title="Dashboard Overview"
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Dashboard' }]}
      />

      <div className="grid grid-cols-12 gap-6">
        {/* Stats */}
        <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.name} title={stat.name} value={stat.value} icon={stat.icon} tone={stat.tone} href={stat.href} />
          ))}
        </div>

        {/* Revenue / bookings chart */}
        <div className="col-span-12 flex lg:col-span-8">
          <CardBox className="h-full pb-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h5 className="card-title">Revenue Updates</h5>
                <p className="text-sm text-muted-foreground">Confirmed and completed bookings, last {CHART_MONTHS} months</p>
              </div>
              <div className="flex gap-6">
                <div>
                  <p className="text-xs text-muted-foreground">Revenue</p>
                  <p className="text-lg font-semibold text-foreground">{formatPHP(totalChartRevenue)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Bookings</p>
                  <p className="text-lg font-semibold text-foreground">{formatNumber(totalChartBookings)}</p>
                </div>
              </div>
            </div>
            <BarChart
              categories={months.map((m) => m.label)}
              series={[{ name: 'Revenue', data: revenuePerMonth }]}
              valuePrefix="₱"
              height={300}
            />
          </CardBox>
        </div>

        {/* Booking status breakdown */}
        <div className="col-span-12 flex lg:col-span-4">
          <CardBox className="h-full">
            <div>
              <h5 className="card-title">Booking Status</h5>
              <p className="text-sm text-muted-foreground">Last {CHART_MONTHS} months</p>
            </div>
            {totalChartBookings === 0 ? (
              <EmptyState icon={CreditCard} title="No bookings yet." className="py-6" />
            ) : (
              <div className="flex flex-1 flex-col items-center justify-center gap-6">
                <div className="flex shrink-0 justify-center">
                  <DonutChart
                    labels={breakdown.map((s) => s.label)}
                    series={breakdown.map((s) => s.count)}
                    colors={breakdown.map((s) => s.color)}
                  />
                </div>
                <ul className="grid w-full grid-cols-2 gap-x-4 gap-y-2">
                  {breakdown.map((s) => (
                    <li key={s.status} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`size-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden="true" />
                      <span>{s.label}</span>
                      <span className="ml-auto font-semibold text-foreground">{formatNumber(s.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBox>
        </div>

        {/* Recent activity */}
        <div className="col-span-12 lg:col-span-8">
          <CardBox className="h-full">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-lightprimary text-primary">
                  <Activity className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <h5 className="card-title">Recent Activity</h5>
                  <p className="text-sm text-muted-foreground">Latest 5 bookings</p>
                </div>
              </div>
            </div>
            {timelineItems.length === 0 ? (
              <EmptyState icon={Activity} title="No recent activity found." />
            ) : (
              <Timeline items={timelineItems} />
            )}
            <div className="mt-auto border-t border-border pt-4 text-center">
              <Button asChild variant="ghostprimary" size="sm">
                <Link href="/admin/bookings">
                  View All Activity <ArrowRight />
                </Link>
              </Button>
            </div>
          </CardBox>
        </div>

        {/* Bookings per month */}
        <div className="col-span-12 flex lg:col-span-4">
          <CardBox className="h-full pb-0">
            <div>
              <h5 className="card-title">Bookings per Month</h5>
              <p className="text-sm text-muted-foreground">All statuses</p>
            </div>
            <BarChart
              categories={months.map((m) => m.label)}
              series={[{ name: 'Bookings', data: bookingsPerMonth }]}
              colors={['var(--color-secondary)']}
              height={280}
            />
          </CardBox>
        </div>
      </div>
    </>
  );
}
