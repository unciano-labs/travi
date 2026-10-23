import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, CalendarDays, Receipt } from 'lucide-react';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import CancelScheduleButton from '@/components/dashboard/CancelScheduleButton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { attachTravelerContacts } from '@/lib/services/traveler-contacts';

export default async function ScheduleBookingsPage(props: {
  params: Promise<{ id: string, scheduleId: string }>
}) {
  const params = await props.params;
  const { id, scheduleId } = params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, organizer_profiles(id)')
    .eq('user_id', user.id)
    .single();

  if (!profile || !profile.organizer_profiles) {
    redirect('/dashboard');
  }

  const organizerProfile = Array.isArray(profile.organizer_profiles) 
    ? profile.organizer_profiles[0] 
    : profile.organizer_profiles;
    
  if (!organizerProfile) {
    redirect('/dashboard');
  }

  const organizerId = (organizerProfile as { id: string }).id;

  // Verify the schedule belongs to the organizer's tour
  const { data: schedule } = await supabase
    .from('tour_schedules')
    .select(`
      id,
      start_date,
      end_date,
      capacity,
      booked_count,
      status,
      deleted_at,
      price_per_person,
      tours!inner (
        id,
        title,
        organizer_id
      )
    `)
    .eq('id', scheduleId)
    .eq('tour_id', id)
    .eq('tours.organizer_id', organizerId)
    .single();

  if (!schedule || schedule.deleted_at) {
    redirect(`/dashboard/organizer/tours/${id}/edit?tab=schedules`);
  }

  // Fetch bookings for this schedule
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      traveler_id
    `)
    .eq('tour_schedule_id', scheduleId)
    .order('created_at', { ascending: false });

  // SEC-13: names (and emails for confirmed bookings) via organizer_traveler_contacts().
  const bookings = await attachTravelerContacts(supabase, recentBookings ?? []);

  // Maintained by the database (a private booking holds the whole group).
  const totalBooked = Number(schedule.booked_count) || 0;
  const isCancelled = schedule.status === 'cancelled';

  const start = new Date(schedule.start_date);
  const end = new Date(schedule.end_date);

  const fillPercent = schedule.capacity > 0 ? Math.round((totalBooked / schedule.capacity) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Schedule Bookings"
        description={<>Tour: <span className="font-semibold text-foreground">{(schedule.tours as any).title}</span></>}
        breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard/organizer' },
          { title: 'My Tours', href: '/dashboard/organizer/tours' },
          { title: 'Schedules', href: `/dashboard/organizer/tours/${id}/edit?tab=schedules` },
          { title: 'Bookings' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {isCancelled ? (
              <StatusBadge status="cancelled" />
            ) : (
              <CancelScheduleButton scheduleId={scheduleId} tourId={id} />
            )}
            <Button asChild variant="neutral">
              <Link href={`/dashboard/organizer/tours/${id}/edit?tab=schedules`}>
                <ArrowLeft />
                Back to Schedules
              </Link>
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <StatCard
          title="Dates"
          icon={CalendarDays}
          tone="primary"
          value={<>{start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</>}
        />
        <StatCard
          title="Capacity"
          icon={Users}
          tone="warning"
          value={<>{totalBooked} / {schedule.capacity} Booked</>}
        />
        <StatCard
          title="Total Revenue"
          icon={Receipt}
          tone="success"
          value={<>₱{bookings.reduce((acc, b) => b.status === 'confirmed' || b.status === 'completed' ? acc + Number(b.total_amount) : acc, 0).toLocaleString()}</>}
        />
      </div>
      
      <CardBox className="p-0 gap-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h5 className="card-title">Bookings</h5>
            <p className="text-sm text-muted-foreground">Travelers booked on this schedule</p>
          </div>
          <div className="w-full sm:w-56">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Seats filled</span>
              <span className="font-medium text-foreground">{fillPercent}%</span>
            </div>
            <Progress
              value={fillPercent}
              variant={fillPercent >= 100 ? 'warning' : 'primary'}
              aria-label={`${totalBooked} of ${schedule.capacity} seats booked`}
            />
          </div>
        </div>
        {bookings.length === 0 ? (
          <EmptyState icon={Users} title="No bookings have been made for this schedule yet." />
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {bookings.map((b) => (
                <LazyMobileCard
                  key={b.id}
                  headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                  headerSubtitle={<span className="font-mono text-[10px]">ID: {b.id.split('-')[0]}...</span>}
                  headerBadge={<StatusBadge status={b.status} />}
                  rows={[
                    {
                      label: 'Email',
                      value: b.user_profiles?.email || 'N/A',
                      fullWidth: true
                    },
                    {
                      label: 'Pax',
                      value: `${b.seats} Pax`
                    },
                    {
                      label: 'Amount',
                      value: <span className="font-medium text-successemphasis">₱{(b.total_amount || 0).toLocaleString()}</span>
                    },
                    {
                      label: 'Booked On',
                      value: new Date(b.created_at).toLocaleDateString()
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
                    <TableHead className="px-6">Booking ID</TableHead>
                    <TableHead className="px-6">Traveler</TableHead>
                    <TableHead className="px-6">Seats</TableHead>
                    <TableHead className="px-6">Total Amount</TableHead>
                    <TableHead className="px-6">Status</TableHead>
                    <TableHead className="px-6">Booked On</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="px-6 font-mono text-xs font-medium text-muted-foreground" title={b.id}>
                        {b.id.split('-')[0]}...
                      </TableCell>
                      <TableCell className="px-6">
                        <div className="font-medium text-foreground">{b.user_profiles?.full_name || 'Anonymous'}</div>
                        <div className="text-xs text-muted-foreground">{b.user_profiles?.email}</div>
                      </TableCell>
                      <TableCell className="px-6 font-medium text-foreground">{b.seats} Pax</TableCell>
                      <TableCell className="px-6 font-medium text-foreground">₱{(b.total_amount || 0).toLocaleString()}</TableCell>
                      <TableCell className="px-6">
                        <StatusBadge status={b.status} />
                      </TableCell>
                      <TableCell className="px-6 text-muted-foreground">
                        {new Date(b.created_at).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardBox>
    </>
  );
}
