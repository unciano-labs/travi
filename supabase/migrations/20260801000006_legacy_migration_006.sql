-- 1. Drop the incorrect policies
DROP POLICY IF EXISTS "Organizers can insert own tour_schedules" ON public.tour_schedules;
DROP POLICY IF EXISTS "Organizers can update own tour_schedules" ON public.tour_schedules;

-- 2. Create the correct policies using user_id from user_profiles
CREATE POLICY "Organizers can insert own tour_schedules"
    ON public.tour_schedules FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles 
                WHERE user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
            )
        )
    );

CREATE POLICY "Organizers can update own tour_schedules"
    ON public.tour_schedules FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles 
                WHERE user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles 
                WHERE user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
            )
        )
    );
