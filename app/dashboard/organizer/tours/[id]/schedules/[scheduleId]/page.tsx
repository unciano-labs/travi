import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, CalendarDays, Receipt } from 'lucide-react';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

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

  if (!schedule) {
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
      user_profiles!traveler_id ( full_name, email )
    `)
    .eq('tour_schedule_id', scheduleId)
    .order('created_at', { ascending: false });

  const bookings = (recentBookings as any[]) || [];

  const totalBooked = bookings.reduce((acc, b) => {
    if (['pending', 'confirmed', 'completed'].includes(b.status)) {
      return acc + b.seats;
    }
    return acc;
  }, 0);

  const start = new Date(schedule.start_date);
  const end = new Date(schedule.end_date);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/organizer/tours/${id}/edit?tab=schedules`} className="p-2 text-slate-400 hover:text-slate-900 transition-colors bg-white rounded-lg border border-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Schedule Bookings</h1>
            <p className="text-slate-600">Tour: <span className="font-semibold text-slate-900">{(schedule.tours as any).title}</span></p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
            <CalendarDays className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500 mb-0.5">Dates</div>
            <div className="font-bold text-slate-900">
              {start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - {end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          </div>
        </div>
        
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-coral-50 text-coral-600 rounded-lg flex items-center justify-center">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500 mb-0.5">Capacity</div>
            <div className="font-bold text-slate-900">
              {totalBooked} / {schedule.capacity} Booked
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <div className="text-sm font-medium text-slate-500 mb-0.5">Total Revenue</div>
            <div className="font-bold text-slate-900">
              ₱{bookings.reduce((acc, b) => b.status === 'confirmed' || b.status === 'completed' ? acc + Number(b.total_amount) : acc, 0).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {bookings.length === 0 ? (
           <div className="p-8 text-center text-slate-500">No bookings have been made for this schedule yet.</div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {bookings.map((b) => (
                <LazyMobileCard
                  key={b.id}
                  headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                  headerSubtitle={<span className="font-mono text-[10px]">ID: {b.id.split('-')[0]}...</span>}
                  headerBadge={
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      b.status === 'canceled' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {b.status}
                    </span>
                  }
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
                      value: <span className="font-medium text-emerald-600">₱{(b.total_amount || 0).toLocaleString()}</span>
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
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Booking ID</th>
                <th className="px-6 py-4">Traveler</th>
                <th className="px-6 py-4">Seats</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Booked On</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500" title={b.id}>
                    {b.id.split('-')[0]}...
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{b.user_profiles?.full_name || 'Anonymous'}</div>
                    <div className="text-xs text-slate-500">{b.user_profiles?.email}</div>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{b.seats} Pax</td>
                  <td className="px-6 py-4 text-slate-900 font-medium">₱{(b.total_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      b.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                      b.status === 'canceled' ? 'bg-red-100 text-red-800' :
                      'bg-slate-100 text-slate-800'
                    }`}>
                      {b.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(b.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>
    </div>
  );
}
