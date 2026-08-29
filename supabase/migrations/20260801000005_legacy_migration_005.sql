-- 1. Create Enums
CREATE TYPE tour_schedule_status AS ENUM ('open', 'full', 'cancelled');

-- 2. Create tour_schedules table
CREATE TABLE public.tour_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    booked_count INTEGER NOT NULL DEFAULT 0,
    status tour_schedule_status NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS on tour_schedules
ALTER TABLE public.tour_schedules ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for tour_schedules
-- Anyone can read tour schedules
CREATE POLICY "Public read access for tour_schedules" 
    ON public.tour_schedules FOR SELECT 
    USING (true);

-- Only organizers can insert schedules for their own tours
CREATE POLICY "Organizers can insert own tour_schedules"
    ON public.tour_schedules FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles WHERE user_profile_id = auth.uid()
            )
        )
    );

-- Only organizers can update schedules for their own tours
CREATE POLICY "Organizers can update own tour_schedules"
    ON public.tour_schedules FOR UPDATE
    USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles WHERE user_profile_id = auth.uid()
            )
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.tours 
            WHERE tours.id = tour_schedules.tour_id 
            AND tours.organizer_id IN (
                SELECT id FROM public.organizer_profiles WHERE user_profile_id = auth.uid()
            )
        )
    );

-- 5. Migrate existing tours data into tour_schedules
INSERT INTO public.tour_schedules (tour_id, start_date, end_date, capacity, booked_count)
SELECT id, start_date, end_date, capacity, booked_count
FROM public.tours
WHERE start_date IS NOT NULL;

-- 6. Drop columns from tours
ALTER TABLE public.tours DROP COLUMN start_date;
ALTER TABLE public.tours DROP COLUMN end_date;
ALTER TABLE public.tours DROP COLUMN capacity;
ALTER TABLE public.tours DROP COLUMN booked_count;


