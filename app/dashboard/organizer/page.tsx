import { MapPin, Users, Banknote } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

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
  
  // Calculate stats
  const totalRevenue = bookings
    .filter(b => b.status === 'confirmed' || b.status === 'completed')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  const pendingRevenue = bookings
    .filter(b => b.status === 'pending')
    .reduce((sum, b) => sum + (b.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {profile.description && (
          <p className="text-slate-500 mt-1 max-w-2xl">{profile.description}</p>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-coral/10 text-coral rounded-lg">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Active Tours</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{activeToursCount || 0}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-brand-navy/10 text-brand-navy rounded-lg">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Total Bookings</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">{bookings.length}</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Confirmed Revenue</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">₱{totalRevenue.toLocaleString()}</p>
            {pendingRevenue > 0 && (
              <p className="text-xs text-slate-500 mt-1">+₱{pendingRevenue.toLocaleString()} pending</p>
            )}
          </div>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mt-8">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Recent Bookings</h2>
          <Link href="/dashboard/organizer/bookings" className="text-sm text-coral font-medium hover:text-coral/80">View All</Link>
        </div>
        
        {bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No bookings found.</div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {bookings.slice(0, 5).map(b => (
                <LazyMobileCard
                  key={b.id}
                  headerTitle={b.user_profiles?.full_name || 'Anonymous'}
                  headerSubtitle={b.tour_schedules?.tours?.title}
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
                      label: 'Tour Details',
                      value: (
                        <div className="text-right">
                          <div className="capitalize">{b.tour_schedules?.tours?.format} • {b.tour_schedules?.tours?.duration_days} Days</div>
                          <div className="text-xs text-slate-500 truncate max-w-[150px]">{b.tour_schedules?.tours?.location}</div>
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
                          <div className="text-xs text-slate-500">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        </div>
                      )
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
                <th className="px-6 py-4">Traveler</th>
                <th className="px-6 py-4">Tour & Details</th>
                <th className="px-6 py-4">Schedule</th>
                <th className="px-6 py-4">Booked On</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.slice(0, 5).map(b => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{b.user_profiles?.full_name || 'Anonymous'}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{b.tour_schedules?.tours?.title}</div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <span className="capitalize">{b.tour_schedules?.tours?.format}</span>
                      <span>•</span>
                      <span>{b.tour_schedules?.tours?.duration_days} Days</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px] inline-block align-bottom">{b.tour_schedules?.tours?.location}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'}</td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{new Date(b.created_at).toLocaleDateString()}</div>
                    <div className="text-xs text-slate-500">{new Date(b.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
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
