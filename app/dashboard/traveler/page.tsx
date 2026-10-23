import { MapPin, Calendar, Ticket, Compass } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import Image from 'next/image';
import WelcomeBanner from '@/components/ui/WelcomeBanner';
import StatCard from '@/components/ui/StatCard';
import CardBox from '@/components/ui/CardBox';
import StatusBadge from '@/components/ui/StatusBadge';
import Timeline, { type TimelineItem } from '@/components/ui/Timeline';
import EmptyState from '@/components/ui/EmptyState';
import DonutChart from '@/components/ui/charts/DonutChart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatPHP } from '@/lib/format';

const STATUS_TONES: Record<string, NonNullable<TimelineItem['tone']>> = {
  confirmed: 'success',
  pending: 'warning',
  completed: 'primary',
  canceled: 'error',
  refunded: 'info',
};

export default async function TravelerDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Get user profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  // Fetch all bookings for traveler
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      tour_schedules (
        start_date,
        end_date,
        tours (
          title,
          slug,
          location,
          cover_image_url,
          organizer_profiles:public_organizer_profiles (
            display_name,
            company_name
          )
        )
      )
    `)
    .eq('traveler_id', profile.id)
    .order('created_at', { ascending: false });

  const allBookings = (bookings as any[]) || [];

  const now = new Date();

  // Calculate stats
  const upcomingTours = allBookings.filter(b => {
    const startDate = new Date(b.tour_schedules.start_date);
    return startDate >= now && b.status !== 'canceled' && b.status !== 'refunded';
  });

  const pastBookings = allBookings.filter(b => {
    const endDate = new Date(b.tour_schedules.end_date);
    return endDate < now || b.status === 'completed';
  });

  // Sort upcoming to find the "Next Adventure"
  upcomingTours.sort((a, b) => new Date(a.tour_schedules.start_date).getTime() - new Date(b.tour_schedules.start_date).getTime());
  const nextAdventure = upcomingTours[0];

  // Presentation-only derivations from the bookings fetched above
  const upcomingTimeline: TimelineItem[] = upcomingTours.slice(0, 5).map((b) => ({
    key: b.id,
    time: formatDate(b.tour_schedules.start_date),
    title: b.tour_schedules.tours.title,
    subtitle: `${b.tour_schedules.tours.location} · ${b.seats} Pax`,
    tone: STATUS_TONES[b.status] ?? 'primary',
  }));

  const statusCounts = allBookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] || 0) + 1;
    return acc;
  }, {});
  const statusLabels = Object.keys(statusCounts);

  const firstName = profile.full_name?.split(' ')[0] || 'Traveler';

  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-12">
        <WelcomeBanner
          name={firstName}
          subtitle="Here's what's coming up on your travels."
          actions={
            <Button asChild>
              <Link href="/tours"><Compass /> Explore Tours</Link>
            </Button>
          }
        />
      </div>

      <div className="col-span-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
        <StatCard title="Upcoming Tours" value={upcomingTours.length} icon={MapPin} tone="primary" />
        <StatCard title="Past Bookings" value={pastBookings.length} icon={Calendar} tone="secondary" />
        <StatCard title="Total Bookings" value={allBookings.length} icon={Ticket} tone="success" href="/dashboard/traveler/bookings" />
      </div>

      {nextAdventure && (
        <CardBox className="col-span-12 gap-0 overflow-hidden p-0 lg:col-span-8">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h5 className="card-title">Your Next Adventure</h5>
            <Button asChild variant="link" size="sm" className="px-0">
              <Link href={`/tours/${nextAdventure.tour_schedules.tours.slug}`}>View Tour</Link>
            </Button>
          </div>
          <div className="flex flex-col items-center gap-6 p-6 sm:flex-row">
            <div className="relative h-40 w-full flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted sm:w-64">
               {nextAdventure.tour_schedules.tours.cover_image_url ? (
                 <Image
                   src={nextAdventure.tour_schedules.tours.cover_image_url}
                   alt={nextAdventure.tour_schedules.tours.title}
                   fill
                   sizes="(max-width: 640px) 100vw, 256px"
                   className="object-cover"
                 />
               ) : (
                 <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                   <MapPin className="h-8 w-8 opacity-50" />
                 </div>
               )}
            </div>
            <div className="w-full flex-1">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="lightPrimary">Upcoming</Badge>
                <StatusBadge status={nextAdventure.status} />
              </div>
              <h3 className="text-xl font-semibold text-foreground">{nextAdventure.tour_schedules.tours.title}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {nextAdventure.tour_schedules.tours.location}
              </p>

              <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-6 md:grid-cols-4">
                 <div className="text-sm">
                   <span className="mb-1 block text-xs text-muted-foreground">Start Date</span>
                   <span className="font-semibold text-foreground">{formatDate(nextAdventure.tour_schedules.start_date)}</span>
                 </div>
                 <div className="text-sm">
                   <span className="mb-1 block text-xs text-muted-foreground">End Date</span>
                   <span className="font-semibold text-foreground">{formatDate(nextAdventure.tour_schedules.end_date)}</span>
                 </div>
                 <div className="text-sm">
                   <span className="mb-1 block text-xs text-muted-foreground">Guests</span>
                   <span className="font-semibold text-foreground">{nextAdventure.seats} Pax</span>
                 </div>
                 <div className="text-sm">
                   <span className="mb-1 block text-xs text-muted-foreground">Total Paid</span>
                   <span className="font-semibold text-primary">{formatPHP(nextAdventure.total_amount)}</span>
                 </div>
              </div>
            </div>
          </div>
        </CardBox>
      )}

      {allBookings.length > 0 && (
        <CardBox className={`col-span-12 ${nextAdventure ? 'lg:col-span-4' : 'lg:col-span-6'}`}>
          <div>
            <h5 className="card-title">Bookings by Status</h5>
            <p className="text-sm text-muted-foreground">All {allBookings.length} bookings</p>
          </div>
          <div className="flex flex-col items-center gap-4">
            <DonutChart labels={statusLabels.map((s) => s.replace(/_/g, ' '))} series={statusLabels.map((s) => statusCounts[s])} height={180} width={200} />
            <div className="flex flex-wrap justify-center gap-2">
              {statusLabels.map((s) => (
                <StatusBadge key={s} status={s} label={`${s.replace(/_/g, ' ')}: ${statusCounts[s]}`} />
              ))}
            </div>
          </div>
        </CardBox>
      )}

      <CardBox className={`col-span-12 ${!nextAdventure && allBookings.length > 0 ? 'lg:col-span-6' : 'lg:col-span-4'}`}>
        <div>
          <h5 className="card-title">Upcoming Trips</h5>
          <p className="text-sm text-muted-foreground">Your soonest scheduled tours</p>
        </div>
        {upcomingTimeline.length > 0 ? (
          <Timeline items={upcomingTimeline} />
        ) : (
          <EmptyState icon={Calendar} title="No upcoming trips" className="py-6" />
        )}
      </CardBox>

      <CardBox className={`col-span-12 gap-0 overflow-hidden p-0 ${!nextAdventure && allBookings.length > 0 ? '' : 'lg:col-span-8'}`}>
        <div className="border-b border-border px-6 py-4">
          <h5 className="card-title">My Bookings</h5>
        </div>

        {allBookings.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No bookings yet"
            description={<>You haven't booked any tours. <Link href="/tours" className="text-primary hover:underline">Start exploring!</Link></>}
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="px-6">Tour</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="px-6 font-semibold text-foreground">{booking.tour_schedules.tours.title}</TableCell>
                      <TableCell>{formatDate(booking.tour_schedules.start_date)}</TableCell>
                      <TableCell>{booking.tour_schedules.tours.location}</TableCell>
                      <TableCell className="text-right font-semibold text-foreground">{formatPHP(booking.total_amount)}</TableCell>
                      <TableCell className="px-6"><StatusBadge status={booking.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="space-y-3 p-4 md:hidden">
              {allBookings.map((booking) => (
                <LazyMobileCard
                  key={booking.id}
                  headerTitle={booking.tour_schedules.tours.title}
                  headerSubtitle={booking.tour_schedules.tours.location}
                  headerBadge={<StatusBadge status={booking.status} />}
                  rows={[
                    { label: 'Date', value: formatDate(booking.tour_schedules.start_date) },
                    { label: 'Amount', value: formatPHP(booking.total_amount) },
                  ]}
                />
              ))}
            </div>
          </>
        )}
      </CardBox>
    </div>
  );
}
