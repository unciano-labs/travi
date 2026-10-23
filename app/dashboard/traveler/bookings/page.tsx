import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TravelerBookingsClient, { type TravelerBooking } from '@/components/traveler/TravelerBookingsClient';
import PageHeader from '@/components/ui/PageHeader';
import { manilaToday } from '@/lib/datetime';

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

  // Own bookings only (RLS also limits travelers to their own rows).
  const { data: allBookings } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_ref,
      seats,
      total_amount,
      status,
      dispute_status,
      created_at,
      tour_schedules (
        start_date,
        end_date,
        tours (
          title,
          slug
        )
      )
    `)
    .eq('traveler_id', profile.id)
    .order('created_at', { ascending: false });

  const bookings = (allBookings as unknown as TravelerBooking[] | null) ?? [];

  // Bookings already reviewed (own reviews are readable under RLS). On error the review button
  // still shows and createReview reports "already reviewed", so the page never breaks over it.
  const { data: ownReviews } = await supabase
    .from('reviews')
    .select('booking_id')
    .eq('reviewer_profile_id', profile.id)
    .not('booking_id', 'is', null);
  const reviewedBookingIds = ((ownReviews as { booking_id: string | null }[] | null) ?? [])
    .map((r) => r.booking_id)
    .filter((bookingId): bookingId is string => Boolean(bookingId));

  // Dispute window = escrow holding period (settings are publicly readable).
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('escrow_holding_days')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <>
      <PageHeader
        title="My Bookings"
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/traveler' }, { title: 'My Bookings' }]}
      />
      <TravelerBookingsClient
        initialBookings={bookings}
        reviewedBookingIds={reviewedBookingIds}
        today={manilaToday()}
        disputeWindowDays={Number(settings?.escrow_holding_days ?? 3)}
      />
    </>
  );
}
