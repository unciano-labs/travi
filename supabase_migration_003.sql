-- 1. Create transporter_profiles table
CREATE TABLE public.transporter_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transporter_type TEXT NOT NULL CHECK (transporter_type IN ('individual', 'company')),
    company_name TEXT,
    display_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    description TEXT,
    service_areas TEXT[],
    status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    average_rating DECIMAL NOT NULL DEFAULT 0.0,
    review_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_profile_id)
);

ALTER TABLE public.transporter_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read transporter profiles" ON public.transporter_profiles FOR SELECT USING (true);
CREATE POLICY "Allow users to update own transporter profile" ON public.transporter_profiles FOR UPDATE USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Allow users to insert own transporter profile" ON public.transporter_profiles FOR INSERT WITH CHECK (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);

-- Note: Also update organizer_profiles status to default 'approved' in dev if needed
-- ALTER TABLE public.organizer_profiles ALTER COLUMN status SET DEFAULT 'approved';
