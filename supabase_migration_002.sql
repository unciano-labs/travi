-- Migration 002: Organizer profiles and tours

-- 1. Create organizer_profiles table
CREATE TABLE public.organizer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    organizer_type TEXT NOT NULL CHECK (organizer_type IN ('individual', 'company')),
    company_name TEXT,
    display_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    description TEXT,
    address TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    provides_transport BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_profile_id)
);

ALTER TABLE public.organizer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "organizer select own" ON public.organizer_profiles FOR SELECT USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "organizer insert own" ON public.organizer_profiles FOR INSERT WITH CHECK (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "organizer update own" ON public.organizer_profiles FOR UPDATE USING (
    user_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
);
CREATE POLICY "public read approved" ON public.organizer_profiles FOR SELECT USING (status = 'approved');

-- 2. Create tours table
CREATE TABLE public.tours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id UUID NOT NULL REFERENCES public.organizer_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    location TEXT NOT NULL,
    price_per_person DECIMAL NOT NULL CHECK (price_per_person > 0),
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    capacity INTEGER NOT NULL CHECK (capacity > 0),
    booked_count INTEGER NOT NULL DEFAULT 0,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    accommodation_details TEXT,
    travel_time_info TEXT,
    transport_type TEXT NOT NULL CHECK (transport_type IN ('none', 'self_provided', 'external_transporter')),
    transport_status TEXT NOT NULL DEFAULT 'not_required' CHECK (transport_status IN ('not_required', 'self_provided', 'pending', 'confirmed', 'unresolved')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    cover_image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.tours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published tours" ON public.tours FOR SELECT USING (status = 'published');
CREATE POLICY "organizer manage own tours" ON public.tours FOR ALL USING (
    organizer_id IN (
        SELECT op.id FROM public.organizer_profiles op 
        JOIN public.user_profiles up ON op.user_profile_id = up.id
        WHERE up.user_id = auth.uid()
    )
);

-- 3. Create tour_itineraries table
CREATE TABLE public.tour_itineraries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tour_id UUID NOT NULL REFERENCES public.tours(id) ON DELETE CASCADE,
    day_number INTEGER NOT NULL CHECK (day_number > 0),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tour_id, day_number)
);

ALTER TABLE public.tour_itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read published itineraries" ON public.tour_itineraries FOR SELECT USING (
    tour_id IN (SELECT id FROM public.tours WHERE status = 'published')
);
CREATE POLICY "organizer manage own itineraries" ON public.tour_itineraries FOR ALL USING (
    tour_id IN (
        SELECT t.id FROM public.tours t
        JOIN public.organizer_profiles op ON t.organizer_id = op.id
        JOIN public.user_profiles up ON op.user_profile_id = up.id
        WHERE up.user_id = auth.uid()
    )
);
