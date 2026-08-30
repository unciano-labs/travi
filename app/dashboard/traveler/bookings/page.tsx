import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TravelerBookingsClient from '@/components/traveler/TravelerBookingsClient';

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
      dispute_status,
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
      <TravelerBookingsClient initialBookings={bookings} />
    </div>
  );
}
