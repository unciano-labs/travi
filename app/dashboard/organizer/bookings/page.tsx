import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function OrganizerBookings() {
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
    .select('id')
    .eq('user_profile_id', userProfile.id)
    .single();

  if (!profile) return null;

  // Fetch bookings (using RLS for organizers)
  const { data: recentBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      user_profiles!traveler_id ( full_name ),
      tour_schedules!inner (
        start_date,
        tours!inner ( title, organizer_id )
      )
    `)
    .eq('tour_schedules.tours.organizer_id', profile.id)
    .order('created_at', { ascending: false });

  const bookings = (recentBookings as any[]) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Manage Bookings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {bookings.length === 0 ? (
           <div className="p-8 text-center text-slate-500">No bookings found for your tours.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Booking ID</th>
                <th className="px-6 py-4">Traveler</th>
                <th className="px-6 py-4">Tour & Date</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500" title={b.id}>
                    {b.id.split('-')[0]}...
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">{b.user_profiles?.full_name || 'Anonymous'}</td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-slate-900">{b.tour_schedules?.tours?.title}</div>
                    <div className="text-xs text-slate-500">
                      {b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'} ({b.seats} Pax)
                    </div>
                  </td>
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
                  <td className="px-6 py-4 text-right">
                    {b.status === 'pending' && (
                      <div className="flex justify-end gap-2 text-xs font-medium">
                        <button className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-md hover:bg-emerald-100 transition-colors">
                          Confirm
                        </button>
                        <button className="px-3 py-1.5 bg-red-50 text-red-600 rounded-md hover:bg-red-100 transition-colors">
                          Decline
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
