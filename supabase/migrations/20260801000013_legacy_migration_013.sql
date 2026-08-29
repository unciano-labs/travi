-- Migration 013: Fix Organizer Bookings RLS Policy
-- Drop the incorrect policy
DROP POLICY IF EXISTS "Organizer tour bookings" ON public.bookings;

-- Recreate the policy with the correct JOIN for auth.uid()
CREATE POLICY "Organizer tour bookings" 
    ON public.bookings FOR SELECT 
    USING (
      auth.uid() IN (
          SELECT up.user_id FROM public.user_profiles up
          JOIN public.organizer_profiles op ON op.user_profile_id = up.id
          JOIN public.tours t ON t.organizer_id = op.id
          JOIN public.tour_schedules ts ON ts.tour_id = t.id
          WHERE ts.id = tour_schedule_id
      )
    );
