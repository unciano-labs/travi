-- Migration 015: Fix infinite recursion in user_profiles RLS

-- 1. Drop the recursive policy from Migration 014
DROP POLICY IF EXISTS "Organizers can read profiles of travelers who booked their tours" ON public.user_profiles;

-- 2. Create a SECURITY DEFINER function to bypass RLS when checking booking relationships
CREATE OR REPLACE FUNCTION is_organizer_for_traveler(traveler_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bookings b
    JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
    JOIN public.tours t ON t.id = ts.tour_id
    JOIN public.organizer_profiles op ON op.id = t.organizer_id
    JOIN public.user_profiles up ON up.id = op.user_profile_id
    WHERE b.traveler_id = traveler_profile_id
    AND up.user_id = auth.uid()
  );
$$;

-- 3. Recreate the policy using the secure function
CREATE POLICY "Organizers can read profiles of travelers who booked their tours"
ON public.user_profiles FOR SELECT
USING ( is_organizer_for_traveler(id) );
