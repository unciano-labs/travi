import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function TravelerBookings() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) return null;

  // Fetch all bookings for traveler
  const { data: allBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      seats,
      total_amount,
      status,
      created_at,
      tour_schedules (
        start_date,
        tours (
          title
        )
      )
    `)
    .eq('traveler_id', profile.id)
    .order('created_at', { ascending: false });

  const bookings = (allBookings as any[]) || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">My Bookings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-8 text-center text-slate-500">You haven't booked any tours yet.</div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
              <tr>
                <th className="px-6 py-4">Booking ID</th>
                <th className="px-6 py-4">Tour Package</th>
                <th className="px-6 py-4">Travel Date</th>
                <th className="px-6 py-4">Total Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs font-medium text-slate-500" title={b.id}>
                    {b.id.split('-')[0]}...
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    {b.tour_schedules?.tours?.title}
                    <div className="text-xs text-slate-500 font-normal mt-1">{b.seats} Pax</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {b.tour_schedules?.start_date ? new Date(b.tour_schedules.start_date).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-slate-900 font-medium">₱{(b.total_amount || 0).toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                      b.status === 'confirmed' ? 'bg-emerald-100 text-emerald-800' : 
                      b.status === 'completed' ? 'bg-slate-100 text-slate-800' :
                      b.status === 'canceled' ? 'bg-red-100 text-red-800' :
                      'bg-amber-100 text-amber-800'
                    }`}>
                      {b.status}
                    </span>
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
