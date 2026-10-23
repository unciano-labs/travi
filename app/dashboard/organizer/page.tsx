import { MapPin, Users, Banknote, Ticket } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import WelcomeBanner from '@/components/ui/WelcomeBanner';
import StatCard from '@/components/ui/StatCard';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import BarChart from '@/components/ui/charts/BarChart';
import DonutChart from '@/components/ui/charts/DonutChart';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

// Booking status order and colour for the breakdown donut (matches StatusBadge tones).
const STATUS_SEGMENTS: { status: string; label: string; color: string; dot: string }[] = [
  { status: 'pending', label: 'Pending', color: 'var(--color-warning)', dot: 'bg-warning' },
  { status: 'confirmed', label: 'Confirmed', color: 'var(--color-success)', dot: 'bg-success' },
  { status: 'completed', label: 'Completed', color: 'var(--color-primary)', dot: 'bg-primary' },
  { status: 'canceled', label: 'Canceled', color: 'var(--color-error)', dot: 'bg-error' },
  { status: 'refunded', label: 'Refunded', color: 'var(--color-info)', dot: 'bg-info' },
];

export default async function OrganizerDashboard() {
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

  if (!userProfile) return null;

  const { data: profile } = await supabase
    .from('organizer_profiles')
    .select('id, company_name, display_name, description')
    .eq('user_profile_id', userProfile.id)
    .single();

  if (!profile) return null;

  const title = profile.company_name || profile.display_name || 'Organizer Overview';

  // Fetch active tours
  const { count: activeToursCount } = await supabase
    .from('tours')
    .select('*', { count: 'exact', head: true })
    .eq('organizer_id', profile.id)
    .eq('status', 'published');

  // Fetch bookings (using RLS for organizers)
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      updated_at,
      booking_ref,
      paymongo_session_id,
      user_profiles!traveler_id ( full_name ),
      tour_schedules!inner (
        start_date,
        tours!inner ( title, organizer_id, location, format, duration_days )
      )
    `)
    .eq('tour_schedules.tours.organizer_id', profile.id)
    .order('created_at', { ascending: false });

  const bookings = (recentBookings as any[]) || [];

  // Net earnings (FIN-15): what actually reaches the organizer's wallet, from their own ledger (RLS:
  // owners read their own wallet and ledger). escrow_deposit rows are already net of the platform fee;
  // refund rows (negative) reverse them. Paged so large ledgers are not cut at the 1000-row cap.
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('id')
    .eq('user_profile_id', userProfile.id)
    .maybeSingle();
  const earnings: { amount: number; created_at: string }[] = [];
  if (wallet?.id) {
    const PAGE = 1000;
    for (let from = 0; from < 50_000; from += PAGE) {
      const { data: rows, error: ledgerError } = await supabase
        .from('wallet_transactions')
        .select('amount, created_at')
        .eq('wallet_id', wallet.id)
        .eq('reference_type', 'booking')
        .eq('balance_affected', 'escrow')
        .in('type', ['escrow_deposit', 'refund'])
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (ledgerError || !rows) break;
      for (const r of rows) earnings.push({ amount: Number(r.amount) || 0, created_at: r.created_at });
      if (rows.length < PAGE) break;
    }
  }
  const netEarnings = earnings.reduce((sum, e) => sum + e.amount, 0);

  // Calculate stats
  const isConfirmedRevenue = (b: { status: string }) => b.status === 'confirmed' || b.status === 'completed';

  const totalRevenue = bookings
    .filter(isConfirmedRevenue)
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const pendingRevenue = bookings
    .filter(b => b.status === 'pending')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  // Net earnings per month (by ledger date), last 6 months including the current one.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }) };
  });
  const revenueByMonth = new Map<string, number>(months.map(m => [m.key, 0]));
  for (const e of earnings) {
    const d = new Date(e.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (revenueByMonth.has(key)) revenueByMonth.set(key, (revenueByMonth.get(key) || 0) + e.amount);
  }
  const revenueCategories = months.map(m => m.label);
  const revenueSeries = [{ name: 'Net Earnings', data: months.map(m => Math.round((revenueByMonth.get(m.key) || 0) * 100) / 100) }];
  const sixMonthRevenue = revenueSeries[0].data.reduce((sum, v) => sum + v, 0);

  // Booking status breakdown (only statuses that occur).
  const statusCounts = STATUS_SEGMENTS
    .map(s => ({ ...s, count: bookings.filter(b => b.status === s.status).length }))
    .filter(s => s.count > 0);

  const recent = bookings.slice(0, 5);

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <WelcomeBanner name={title} subtitle={profile.description || undefined} />
      </div>

      <div className="col-span-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard title="Active Tours" value={activeToursCount || 0} icon={MapPin} tone="primary" href="/dashboard/organizer/tours" />
        <StatCard title="Total Bookings" value={bookings.length} icon={Users} tone="secondary" href="/dashboard/organizer/bookings" />
        <StatCard
          title="Net Earnings"
          value={`₱${netEarnings.toLocaleString('en-PH', { maximumFractionDigits: 2 })}`}
          icon={Banknote}
          tone="success"
          href="/dashboard/organizer/wallet"
          hint={
            <>
              After platform fees and refunds · Gross ₱{totalRevenue.toLocaleString()}
              {pendingRevenue > 0 ? ` (+₱${pendingRevenue.toLocaleString()} pending)` : ''}
            </>
          }
        />
      </div>

      <div className="col-span-12 lg:col-span-8 flex">
        <CardBox>
          <div>
            <h5 className="card-title">Earnings Overview</h5>
            <p className="text-sm text-muted-foreground">Net earnings per month (after platform fees and refunds), last 6 months</p>
          </div>
          <div className="-mx-2">
            <BarChart categories={revenueCategories} series={revenueSeries} valuePrefix="₱" height={300} />
          </div>
          <p className="text-sm text-muted-foreground">
            Net for the period: <span className="font-semibold text-foreground">₱{sixMonthRevenue.toLocaleString('en-PH', { maximumFractionDigits: 2 })}</span>
          </p>
        </CardBox>
      </div>

      <div className="col-span-12 lg:col-span-4 flex">
        <CardBox>
          <div>
            <h5 className="card-title">Booking Status</h5>
            <p className="text-sm text-muted-foreground">Breakdown of all bookings</p>
          </div>
          {statusCounts.length === 0 ? (
            <EmptyState icon={Ticket} title="No bookings found." className="py-8" />
          ) : (
            <>
              <div className="flex justify-center">
                <DonutChart
                  labels={statusCounts.map(s => s.label)}
                  series={statusCounts.map(s => s.count)}
                  colors={statusCounts.map(s => s.color)}
                  height={200}
                  width={220}
                />
              </div>
              <ul className="flex flex-col gap-3">
                {statusCounts.map(s => (
                  <li key={s.status} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-bodytext">
                      <span className={`size-2.5 rounded-full ${s.dot}`} aria-hidden="true" />
                      {s.label}
                    </span>
                    <span className="font-semibold text-foreground">{s.count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardBox>
      </div>

      <div className="col-span-12">
        <CardBox className="p-0 gap-0 overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex justify-between items-center gap-4">
            <div>
              <h5 className="card-title">Recent Bookings</h5>
              <p className="text-sm text-muted-foreground">Latest 5 bookings</p>
            </div>
            <Button asChild variant="lightprimary" size="sm">
              <Link href="/dashboard/organizer/bookings">View All</Link>
            </Button>
          </div>

          {bookings.length === 0 ? (
            <EmptyState icon={Ticket} title="No bookings found." />
          ) : (
            <>
              {/* Mobile View */}
              <div className="block md:hidden p-4 space-y-4">
                {recent.map(b => (
                  <LazyMobileCard
                    key={b.id}
                    headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                    headerSubtitle={b.tour_schedules?.tours?.title}
                    headerBadge={<StatusBadge status={b.status} />}
                    rows={[
                      {
                        label: 'Tour Details',
                        value: (
                          <div className="text-right">
                            <div className="capitalize">{b.tour_schedules?.tours?.format} • {b.tour_schedules?.tours?.duration_days} Days</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[150px]">{b.tour_schedules?.tours?.location}</div>
                          </div>
                        )
                      },
                      {
                        label: 'Schedule',
                        value: b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'
                      },
                      {
                        label: 'Booked On',
                        value: (
                          <div className="text-right">
                            <div>{new Date(b.created_at).toLocaleDateString()}</div>
                            <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                          </div>
                        )
                      }
                    ]}
                  />
                ))}
              </div>

              {/* Desktop View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="px-6">Traveler</TableHead>
                      <TableHead className="px-6">Tour & Details</TableHead>
                      <TableHead className="px-6">Schedule</TableHead>
                      <TableHead className="px-6">Booked On</TableHead>
                      <TableHead className="px-6">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="px-6 font-medium text-foreground">{b.user_profiles?.full_name || 'Anonymous'}</TableCell>
                        <TableCell className="px-6">
                          <div className="font-medium text-foreground">{b.tour_schedules?.tours?.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                            <span className="capitalize">{b.tour_schedules?.tours?.format}</span>
                            <span>•</span>
                            <span>{b.tour_schedules?.tours?.duration_days} Days</span>
                            <span>•</span>
                            <span className="truncate max-w-[120px] inline-block align-bottom">{b.tour_schedules?.tours?.location}</span>
                          </div>
                        </TableCell>
                        <TableCell className="px-6">{b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'}</TableCell>
                        <TableCell className="px-6">
                          <div className="text-sm font-medium text-foreground">{new Date(b.created_at).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </TableCell>
                        <TableCell className="px-6">
                          <StatusBadge status={b.status} />
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
