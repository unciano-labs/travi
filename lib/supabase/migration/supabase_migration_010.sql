-- Migration 010: Add DELETE policy for tour_schedules

CREATE POLICY "Organizers can delete own tour_schedules"
    ON public.tour_schedules FOR DELETE
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
    );
