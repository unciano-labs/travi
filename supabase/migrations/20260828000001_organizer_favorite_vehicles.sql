-- Create organizer_favorite_vehicles table
CREATE TABLE IF NOT EXISTS organizer_favorite_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES organizer_profiles(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(organizer_id, vehicle_id)
);

-- Setup RLS
ALTER TABLE organizer_favorite_vehicles ENABLE ROW LEVEL SECURITY;

-- Policy: Organizers can view their own favorites
CREATE POLICY "Organizers can view their own favorites"
    ON organizer_favorite_vehicles
    FOR SELECT
    USING (organizer_id IN (
        SELECT id FROM organizer_profiles WHERE user_profile_id IN (
            SELECT id FROM user_profiles WHERE user_id = auth.uid()
        )
    ));

-- Policy: Organizers can insert their own favorites
CREATE POLICY "Organizers can insert their own favorites"
    ON organizer_favorite_vehicles
    FOR INSERT
    WITH CHECK (organizer_id IN (
        SELECT id FROM organizer_profiles WHERE user_profile_id IN (
            SELECT id FROM user_profiles WHERE user_id = auth.uid()
        )
    ));

-- Policy: Organizers can delete their own favorites
CREATE POLICY "Organizers can delete their own favorites"
    ON organizer_favorite_vehicles
    FOR DELETE
    USING (organizer_id IN (
        SELECT id FROM organizer_profiles WHERE user_profile_id IN (
            SELECT id FROM user_profiles WHERE user_id = auth.uid()
        )
    ));
