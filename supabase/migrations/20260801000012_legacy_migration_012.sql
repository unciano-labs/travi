-- Migration 012: Create bookings and payments tables
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'canceled', 'refunded', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');

CREATE TABLE public.bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tour_schedule_id UUID NOT NULL REFERENCES public.tour_schedules(id) ON DELETE CASCADE,
    traveler_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    seats INTEGER NOT NULL CHECK (seats >= 1),
    total_amount DECIMAL NOT NULL,
    status booking_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    amount DECIMAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status payment_status NOT NULL DEFAULT 'pending',
    provider TEXT NOT NULL,
    provider_payment_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Policies for bookings
-- Traveler sees own bookings
CREATE POLICY "Traveler own bookings" 
    ON public.bookings FOR SELECT 
    USING (auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE id = traveler_id));

-- Traveler insert own bookings
CREATE POLICY "Traveler insert own bookings"
    ON public.bookings FOR INSERT
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE id = traveler_id));

-- Traveler update own bookings
CREATE POLICY "Traveler update own bookings"
    ON public.bookings FOR UPDATE
    USING (auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE id = traveler_id))
    WITH CHECK (auth.uid() IN (SELECT user_id FROM public.user_profiles WHERE id = traveler_id));

-- Organizer sees bookings for their tours
CREATE POLICY "Organizer tour bookings" 
    ON public.bookings FOR SELECT 
    USING (
      auth.uid() IN (
          SELECT op.user_profile_id FROM public.organizer_profiles op
          JOIN public.tours t ON t.organizer_id = op.id
          JOIN public.tour_schedules ts ON ts.tour_id = t.id
          WHERE ts.id = tour_schedule_id
      )
    );

-- Policies for payments
CREATE POLICY "Traveler own payments" 
    ON public.payments FOR SELECT 
    USING (
      auth.uid() IN (
          SELECT up.user_id FROM public.user_profiles up
          JOIN public.bookings b ON b.traveler_id = up.id
          WHERE b.id = booking_id
      )
    );
