import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OrganizerBookingsClient from '@/components/dashboard/OrganizerBookingsClient';
import { attachTravelerContacts } from '@/lib/services/traveler-contacts';

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
      updated_at,
      booking_ref,
      paymongo_session_id,
      traveler_id,
      tour_schedules!inner (
        start_date,
        tours!inner ( title, organizer_id )
      )
    `)
    .eq('tour_schedules.tours.organizer_id', profile.id)
    .order('created_at', { ascending: false });

  // SEC-13: traveler names come from organizer_traveler_contacts(), not the user_profiles table.
  const bookings = await attachTravelerContacts(supabase, recentBookings ?? []);

  return <OrganizerBookingsClient initialBookings={bookings as unknown as React.ComponentProps<typeof OrganizerBookingsClient>['initialBookings']} />;
}
