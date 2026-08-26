-- Migration 014: Allow Organizers to view Traveler profiles
-- This allows organizers to see the names of travelers who booked their tours.

CREATE POLICY "Organizers can read profiles of travelers who booked their tours"
ON public.user_profiles FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
    JOIN public.tours t ON t.id = ts.tour_id
    JOIN public.organizer_profiles op ON op.id = t.organizer_id
    JOIN public.user_profiles op_up ON op_up.id = op.user_profile_id
    WHERE b.traveler_id = user_profiles.id
    AND op_up.user_id = auth.uid()
  )
);
