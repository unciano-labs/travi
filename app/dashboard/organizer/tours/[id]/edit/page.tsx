import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, List, Info, CalendarDays } from 'lucide-react';
import TourForm from '@/components/dashboard/TourForm';
import ScheduleForm from '@/components/dashboard/ScheduleForm';
import SchedulesCalendar from '@/components/dashboard/SchedulesCalendar';
import TransportManager from '@/components/dashboard/TransportManager';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default async function EditTourPage(props: { 
  params: Promise<{ id: string }>,
  searchParams: Promise<{ tab?: string, view?: string, editScheduleId?: string }>
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { id } = params;
  const tab = searchParams.tab || 'details';
  const calendarView = searchParams.view || 'calendar';
  const editScheduleId = searchParams.editScheduleId;
  
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

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

  // Fetch the tour and its itineraries
  const { data: tour } = await supabase
    .from('tours')
    .select('*, tour_itineraries(*)')
    .eq('id', id)
    .eq('organizer_id', organizerId)
    .single();

  if (!tour) {
    redirect('/dashboard/organizer/tours');
  }

  // Fetch schedules with their associated transport bookings
  const { data: schedules } = await supabase
    .from('tour_schedules')
    .select('*, transport_bookings(*, vehicle:public_vehicles(name, photos, vehicle_type, seat_capacity, plate_number), transporter:public_transporter_profiles(company_name, display_name, phone)), bookings(seats, status)')
    .eq('tour_id', id)
    .order('start_date', { ascending: true });

  // Filter transport_bookings to only include the latest active one
  const schedulesWithBookings = schedules?.map(schedule => {
    let activeBooking = null;
    if (schedule.transport_bookings && schedule.transport_bookings.length > 0) {
      // Sort to get the latest first
      const sorted = schedule.transport_bookings.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      activeBooking = sorted[0]; // Get the latest one
    }
    
    // Calculate total booked seats (excluding canceled and refunded)
    const booked_count = schedule.bookings?.reduce((acc: number, b: any) => {
      if (['pending', 'confirmed', 'completed'].includes(b.status)) {
        return acc + b.seats;
      }
      return acc;
    }, 0) || 0;
    
    return { ...schedule, transport_booking: activeBooking, booked_count };
  });

  // Format initialData for the form
  const initialData = {
    id: tour.id,
    title: tour.title,
    description: tour.description,
    city: tour.city,
    province: tour.province,
    location: tour.location,
    price_per_person: tour.price_per_person,
    duration_days: tour.duration_days,
    capacity: tour.capacity,
    start_date: tour.start_date,
    end_date: tour.end_date,
    accommodation_details: tour.accommodation_details,
    travel_time_info: tour.travel_time_info,
    transport_type: tour.transport_type,
    cover_image_url: tour.cover_image_url,
    image_urls: tour.image_urls,
    latitude: tour.latitude,
    longitude: tour.longitude,
    status: tour.status,
    tour_itineraries: tour.tour_itineraries,
  };

  const tabClass = (active: boolean) =>
    `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-4 py-2 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 [&_svg]:size-4 ${active ? 'bg-primary text-white shadow-sm' : 'text-foreground hover:bg-lightprimary hover:text-primary'}`;

  return (
    <>
      <PageHeader
        title="Manage Tour"
        description={<>Editing: <span className="font-semibold text-foreground">{tour.title}</span></>}
        breadcrumbs={[
          { title: 'Dashboard', href: '/dashboard/organizer' },
          { title: 'My Tours', href: '/dashboard/organizer/tours' },
          { title: 'Manage Tour' },
        ]}
        actions={
          <Button asChild variant="neutral">
            <Link href="/dashboard/organizer/tours">
              <ArrowLeft />
              Back to Tours
            </Link>
          </Button>
        }
      />

      {/* Tabs */}
      <nav aria-label="Tour sections" className="mb-6 inline-flex flex-wrap items-center gap-2 rounded-md border border-border bg-white p-1">
        <Link 
          href={`/dashboard/organizer/tours/${id}/edit?tab=details`}
          className={tabClass(tab === 'details')}
          aria-current={tab === 'details' ? 'page' : undefined}
        >
          <Info /> Tour Details
        </Link>
        <Link 
          href={`/dashboard/organizer/tours/${id}/edit?tab=schedules`}
          className={tabClass(tab === 'schedules')}
          aria-current={tab === 'schedules' ? 'page' : undefined}
        >
          <CalendarDays /> Schedules
        </Link>
      </nav>

      {/* Tab Content */}
      <div>
        {tab === 'details' ? (
          <TourForm initialData={initialData} />
        ) : (
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4 space-y-6">
              <ScheduleForm 
                key={editScheduleId || 'new'}
                tourId={id} 
                basePrice={tour.price_per_person} 
                initialData={editScheduleId ? schedulesWithBookings?.find(s => s.id === editScheduleId) : undefined} 
              />
            </div>

            <div className="col-span-12 lg:col-span-8">
              <CardBox className="p-0 gap-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="card-title">Upcoming Schedules</h5>
                    <p className="text-sm text-muted-foreground">Dates travelers can book</p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1">
                    <Link 
                      href={`?tab=schedules&view=calendar`} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${calendarView === 'calendar' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                      aria-current={calendarView === 'calendar' ? 'page' : undefined}
                    >
                      <Calendar className="w-4 h-4" /> Calendar
                    </Link>
                    <Link 
                      href={`?tab=schedules&view=list`} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${calendarView === 'list' ? 'bg-white text-primary shadow-sm' : 'text-muted-foreground hover:text-primary'}`}
                      aria-current={calendarView === 'list' ? 'page' : undefined}
                    >
                      <List className="w-4 h-4" /> List
                    </Link>
                  </div>
                </div>
                
                {calendarView === 'calendar' ? (
                  <div className="p-4">
                    <SchedulesCalendar schedules={schedulesWithBookings || []} tourId={id} />
                  </div>
                ) : (
                  <>
                    {(!schedulesWithBookings || schedulesWithBookings.length === 0) ? (
                      <EmptyState
                        icon={Calendar}
                        title="No schedules have been added yet."
                        description="Create a schedule to allow travelers to book this tour."
                      />
                    ) : (
                      <div className="divide-y divide-border">
                        {schedulesWithBookings.map((schedule) => {
                          const start = new Date(schedule.start_date);
                          const end = new Date(schedule.end_date);
                          const isPast = end < new Date();
                          const fillPercent = schedule.capacity > 0 ? Math.round((schedule.booked_count / schedule.capacity) * 100) : 0;
                          
                          return (
                            <div key={schedule.id} className={`px-6 py-5 flex flex-col items-start gap-4 ${isPast ? 'bg-muted/50 opacity-75' : ''}`}>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    <h3 className="font-semibold text-foreground text-base">
                                      {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      {' - '}
                                      {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </h3>
                                    {schedule.status === 'open' && !isPast && <StatusBadge status="open" />}
                                    {schedule.status === 'full' && <StatusBadge status="full" />}
                                    {schedule.status === 'cancelled' && <StatusBadge status="cancelled" />}
                                    {isPast && <StatusBadge status="past" label="Past" />}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground font-medium">
                                    <span className="flex items-center gap-1"><Users className="w-4 h-4"/> {schedule.booked_count} / {schedule.capacity} Booked</span>
                                    {schedule.price_per_person && (
                                      <Badge variant="lightSuccess">
                                        {schedule.original_price && (
                                          <span className="line-through opacity-70">₱{schedule.original_price}</span>
                                        )}
                                        Promo: ₱{schedule.price_per_person}
                                      </Badge>
                                    )}
                                  </div>
                                  <Progress
                                    value={fillPercent}
                                    variant={fillPercent >= 100 ? 'warning' : 'primary'}
                                    className="mt-3 max-w-xs"
                                    aria-label={`${schedule.booked_count} of ${schedule.capacity} seats booked`}
                                  />
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <Button asChild variant="neutral" size="sm" className="w-full sm:w-auto">
                                    <Link href={`?tab=schedules&view=list&editScheduleId=${schedule.id}`}>
                                      Edit
                                    </Link>
                                  </Button>
                                  <Button asChild size="sm" className="w-full sm:w-auto">
                                    <Link href={`/dashboard/organizer/tours/${id}/schedules/${schedule.id}`}>
                                      View Bookings
                                    </Link>
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="w-full pt-3 border-t border-border flex items-center justify-between">
                                <TransportManager
                                  tourScheduleId={schedule.id}
                                  startDate={schedule.start_date}
                                  endDate={schedule.end_date}
                                  capacity={schedule.capacity}
                                  transportType={schedule.transport_type}
                                  existingRequest={schedule.transport_booking}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardBox>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
