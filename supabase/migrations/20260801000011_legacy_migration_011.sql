-- Migration 011: Create reviews table
CREATE TYPE review_status AS ENUM ('pending', 'published', 'hidden');

CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_profile_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    transporter_id UUID REFERENCES public.transporter_profiles(id) ON DELETE CASCADE,
    tour_id UUID REFERENCES public.tours(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    status review_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure a review is tied to either a transporter or a tour
ALTER TABLE public.reviews ADD CONSTRAINT reviews_target_check 
CHECK (transporter_id IS NOT NULL OR tour_id IS NOT NULL);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read access for published reviews" 
    ON public.reviews FOR SELECT 
    USING (status = 'published');

CREATE POLICY "Authenticated users can insert reviews" 
    ON public.reviews FOR INSERT 
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        reviewer_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid())
    );

CREATE POLICY "Users can read own reviews" 
    ON public.reviews FOR SELECT 
    USING (reviewer_profile_id IN (SELECT id FROM public.user_profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all reviews"
    ON public.reviews FOR ALL
    USING (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.website_roles wr ON ur.website_role_id = wr.id
            JOIN public.user_profiles up ON ur.user_profile_id = up.id
            WHERE up.user_id = auth.uid() AND wr.role = 'admin'
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM public.user_roles ur
            JOIN public.website_roles wr ON ur.website_role_id = wr.id
            JOIN public.user_profiles up ON ur.user_profile_id = up.id
            WHERE up.user_id = auth.uid() AND wr.role = 'admin'
        )
    );

-- Create some mock data for existing tours
INSERT INTO public.reviews (reviewer_profile_id, tour_id, rating, comment, status)
SELECT 
    (SELECT id FROM public.user_profiles LIMIT 1),
    id,
    5,
    'Absolutely amazing experience! The guide was very knowledgeable and the itinerary was perfect.',
    'published'
FROM public.tours
LIMIT 2;

INSERT INTO public.reviews (reviewer_profile_id, tour_id, rating, comment, status)
SELECT 
    (SELECT id FROM public.user_profiles LIMIT 1 OFFSET 1),
    id,
    4,
    'Great tour, but the weather was a bit gloomy. Still had a lot of fun.',
    'published'
FROM public.tours
LIMIT 1;
