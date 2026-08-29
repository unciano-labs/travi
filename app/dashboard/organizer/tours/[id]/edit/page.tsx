import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Calendar, Users, List, Info, CalendarDays } from 'lucide-react';
import TourForm from '@/components/dashboard/TourForm';
import ScheduleForm from '@/components/dashboard/ScheduleForm';
import SchedulesCalendar from '@/components/dashboard/SchedulesCalendar';
import TransportManager from '@/components/dashboard/TransportManager';

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
    .select('*, transport_bookings(*, vehicle:vehicles(name, photos, vehicle_type, seat_capacity), transporter:transporter_profiles(company_name, display_name)), bookings(seats, status)')
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/organizer/tours" className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-lg border border-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Manage Tour</h1>
            <p className="text-slate-600">Editing: <span className="font-semibold text-slate-900">{tour.title}</span></p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        <Link 
          href={`/dashboard/organizer/tours/${id}/edit?tab=details`}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm ${tab === 'details' ? 'border-coral-500 text-coral-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <Info className="w-4 h-4" /> Tour Details
        </Link>
        <Link 
          href={`/dashboard/organizer/tours/${id}/edit?tab=schedules`}
          className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors font-medium text-sm ${tab === 'schedules' ? 'border-coral-500 text-coral-500' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
        >
          <CalendarDays className="w-4 h-4" /> Schedules
        </Link>
      </div>

      {/* Tab Content */}
      <div className="pt-2">
        {tab === 'details' ? (
          <TourForm initialData={initialData} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <ScheduleForm 
                key={editScheduleId || 'new'}
                tourId={id} 
                basePrice={tour.price_per_person} 
                initialData={editScheduleId ? schedulesWithBookings?.find(s => s.id === editScheduleId) : undefined} 
              />
            </div>

            <div className="lg:col-span-2">
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-slate-900">Upcoming Schedules</h2>
                  <div className="flex bg-slate-100 p-1 rounded-lg">
                    <Link 
                      href={`?tab=schedules&view=calendar`} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${calendarView === 'calendar' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      <Calendar className="w-4 h-4" /> Calendar
                    </Link>
                    <Link 
                      href={`?tab=schedules&view=list`} 
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${calendarView === 'list' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
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
                      <div className="p-12 text-center text-slate-500">
                        <Calendar className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                        <p>No schedules have been added yet.</p>
                        <p className="text-sm">Create a schedule to allow travelers to book this tour.</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {schedulesWithBookings.map((schedule) => {
                          const start = new Date(schedule.start_date);
                          const end = new Date(schedule.end_date);
                          const isPast = end < new Date();
                          
                          return (
                            <div key={schedule.id} className={`p-6 flex flex-col items-start gap-4 ${isPast ? 'bg-slate-50 opacity-75' : ''}`}>
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between w-full gap-4">
                                <div>
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-bold text-slate-900 text-lg">
                                      {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                      {' - '}
                                      {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </h3>
                                    {schedule.status === 'open' && !isPast && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Open</span>}
                                    {schedule.status === 'full' && <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Full</span>}
                                    {schedule.status === 'cancelled' && <span className="bg-red-100 text-red-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Cancelled</span>}
                                    {isPast && <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Past</span>}
                                  </div>
                                  <div className="flex items-center gap-4 text-sm text-slate-500 font-medium">
                                    <span className="flex items-center gap-1"><Users className="w-4 h-4"/> {schedule.booked_count} / {schedule.capacity} Booked</span>
                                    {schedule.price_per_person && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                        {schedule.original_price && (
                                          <span className="line-through text-green-600 opacity-70">₱{schedule.original_price}</span>
                                        )}
                                        Promo: ₱{schedule.price_per_person}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                  <Link href={`?tab=schedules&view=list&editScheduleId=${schedule.id}`} className="w-full sm:w-auto text-center px-4 py-2 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-50 transition-colors text-sm">
                                    Edit
                                  </Link>
                                  <Link href={`/dashboard/organizer/tours/${id}/schedules/${schedule.id}`} className="w-full sm:w-auto text-center px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors text-sm">
                                    View Bookings
                                  </Link>
                                </div>
                              </div>
                              
                              <div className="w-full pt-3 border-t border-slate-100 flex items-center justify-between">
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
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
