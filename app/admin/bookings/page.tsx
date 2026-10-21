import { Suspense } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import BookingsClient from '@/components/admin/BookingsClient';
import { Skeleton } from '@/components/ui/skeleton';

export default async function BookingsPage() {
  const admin = createAdminClient({ admin: true });

  const { data: bookings } = await admin
    .from('bookings')
    .select(`
      id,
      booking_ref,
      seats,
      total_amount,
      status,
      dispute_status,
      created_at,
      traveler:user_profiles!traveler_id (
        full_name,
        email
      ),
      tour_schedule:tour_schedules (
        id,
        start_date,
        end_date,
        tour:tours (
          title,
          location
        )
      )
    `)
    .order('created_at', { ascending: false });

  // Handle Supabase relation typing (array vs object)
  const formattedBookings = (bookings || []).map((b) => {
    const travelerProfile = Array.isArray(b.traveler) ? b.traveler[0] : b.traveler;
    const schedule = Array.isArray(b.tour_schedule) ? b.tour_schedule[0] : b.tour_schedule;
    
    let tourInfo = null;
    if (schedule && schedule.tour) {
       tourInfo = Array.isArray(schedule.tour) ? schedule.tour[0] : schedule.tour;
    }

    return {
      ...b,
      traveler: travelerProfile,
      tour_schedule: schedule ? {
        ...schedule,
        tour: tourInfo
      } : null
    };
  });

  return (
    <Suspense fallback={<div className="space-y-6"><Skeleton className="h-24 w-full rounded-md" /><Skeleton className="h-96 w-full rounded-lg" /></div>}>
      <BookingsClient initialBookings={formattedBookings as any} />
    </Suspense>
  );
}
