import { Bus, CalendarCheck, Map, Star, Clock, Plus, Calendar, Inbox, ArrowRight, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { LazyMobileCard } from '@/components/ui/LazyMobileCard';

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
        organizer:organizer_profiles (
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
  const recentRequests = recentRequestsRes.data || [];
  const serviceAreasCount = profile.service_areas?.length || 0;
  const averageRating = Number(profile.average_rating) || 0;

  const title = profile.company_name || profile.display_name || 'Transporter Dashboard';

  return (
    <div className="space-y-8">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 to-brand-navy p-6 md:p-8 rounded-3xl text-white shadow-lg">
        <div>
          <div className="flex items-center gap-2 text-coral text-xs font-extrabold uppercase tracking-wider mb-2">
            <span>Transporter Fleet Operations</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight font-display">{title}</h1>
          <p className="text-slate-300 text-sm mt-1 max-w-xl">
            {profile.description || 'Welcome to your fleet command center. Manage vehicles, dates, and tour organizer bookings in real-time.'}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            href="/dashboard/transporter/vehicles"
            className="flex items-center gap-2 bg-coral hover:bg-coral/90 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md shadow-coral/20 transition-all"
          >
            <Plus className="w-4 h-4" /> Add Vehicle
          </Link>
          <Link
            href="/dashboard/transporter/availability"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white font-bold text-xs px-4 py-2.5 rounded-xl backdrop-blur-md transition-all"
          >
            <Calendar className="w-4 h-4" /> Block Dates
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-coral/10 text-coral rounded-xl">
            <Bus className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Fleet</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{activeVehiclesCount}</p>
            <span className="text-xs text-slate-500 mt-0.5 inline-block">Ready for bookings</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Pending Requests</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{pendingRequestsCount}</p>
            <span className="text-xs text-slate-500 mt-0.5 inline-block">Requires review</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <CalendarCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Trips</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{upcomingTripsCount}</p>
            <span className="text-xs text-slate-500 mt-0.5 inline-block">Confirmed schedule</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Star className="w-6 h-6 fill-emerald-500 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Rating & Reviews</p>
            <div className="flex items-center gap-1.5 mt-1">
              <p className="text-2xl font-extrabold text-slate-900">
                {averageRating > 0 ? averageRating.toFixed(1) : '5.0'}
              </p>
              <span className="text-xs text-slate-400 font-medium">({profile.review_count || 0})</span>
            </div>
            <span className="text-xs text-slate-500 mt-0.5 inline-block">Customer satisfaction</span>
          </div>
        </div>
      </div>

      {/* Recent Requests Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recent Transport Requests</h2>
            <p className="text-xs text-slate-500 mt-0.5">Latest trip booking requests received from Tour Organizers.</p>
          </div>
          <Link
            href="/dashboard/transporter/requests"
            className="inline-flex items-center gap-1 text-xs font-bold text-coral hover:text-coral/80 transition-colors"
          >
            <span>View All Inbox</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {recentRequests.length === 0 ? (
          <div className="p-12 text-center text-slate-500 space-y-3">
            <Inbox className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium">No transport requests received yet.</p>
            <p className="text-xs text-slate-400">Make sure your vehicles are active and availability is set to attract Tour Organizers.</p>
          </div>
        ) : (
          <>
            {/* Mobile View */}
            <div className="block md:hidden p-4 space-y-4">
              {recentRequests.map((r: any) => {
                const isPending = r.status === 'pending';
                const isAccepted = r.status === 'accepted';
                const isCompleted = r.status === 'completed';
                return (
                  <LazyMobileCard
                    key={r.id}
                    headerTitle={r.organizer?.company_name || r.organizer?.display_name || 'Tour Organizer'}
                    headerSubtitle={<span className="font-mono text-[10px]">Route: <span className="text-slate-600">{r.pickup_location} → {r.dropoff_location}</span></span>}
                    headerBadge={
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                        isPending ? 'bg-amber-100 text-amber-800' : 
                        isAccepted ? 'bg-blue-100 text-blue-800' : 
                        isCompleted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {r.status.toUpperCase()}
                      </span>
                    }
                    rows={[
                      {
                        label: 'Vehicle',
                        value: r.vehicle?.name || 'Any Available',
                        fullWidth: true
                      },
                      {
                        label: 'Pickup Date',
                        value: new Date(r.pickup_datetime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })
                      }
                    ]}
                    actions={
                      <Link
                        href="/dashboard/transporter/requests"
                        className="text-xs font-bold text-coral hover:underline"
                      >
                        Manage
                      </Link>
                    }
                  />
                );
              })}
            </div>

            {/* Desktop View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4">Organizer</th>
                  <th className="px-6 py-4">Vehicle Requested</th>
                  <th className="px-6 py-4">Pickup Date</th>
                  <th className="px-6 py-4">Route</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentRequests.map((r: any) => {
                  const isPending = r.status === 'pending';
                  const isAccepted = r.status === 'accepted';
                  const isCompleted = r.status === 'completed';

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900">
                        {r.organizer?.company_name || r.organizer?.display_name || 'Tour Organizer'}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {r.vehicle?.name || 'Any Available'}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {new Date(r.pickup_datetime).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          timeZone: 'UTC'
                        })}
                      </td>
                      <td className="px-6 py-4 text-slate-600 text-xs max-w-xs truncate">
                        {r.pickup_location} → {r.dropoff_location}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isPending
                              ? 'bg-amber-100 text-amber-800'
                              : isAccepted
                              ? 'bg-blue-100 text-blue-800'
                              : isCompleted
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {r.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href="/dashboard/transporter/requests"
                          className="text-xs font-bold text-coral hover:underline"
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
