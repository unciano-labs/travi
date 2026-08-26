-- Add deleted_at to existing tables
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.organizer_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.transporter_profiles ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tour_schedules ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.tour_itineraries ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;
ALTER TABLE public.admin_audit_logs ADD COLUMN IF NOT EXISTS deleted_at timestamptz DEFAULT NULL;

-- Ensure vehicles table exists with soft-delete support
CREATE TABLE IF NOT EXISTS public.vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transporter_id uuid NOT NULL REFERENCES public.transporter_profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  vehicle_type text NOT NULL CHECK (vehicle_type IN ('car', 'van', 'bus', 'minibus', 'suv')),
  seat_capacity integer NOT NULL CHECK (seat_capacity > 0),
  plate_number text,
  description text,
  rate_per_day numeric(10, 2),
  photos text[] DEFAULT '{}'::text[],
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure vehicle_availability table exists with soft-delete support
CREATE TABLE IF NOT EXISTS public.vehicle_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.vehicles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'blocked')),
  transport_booking_id uuid,
  notes text,
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure transport_bookings table exists with soft-delete support
CREATE TABLE IF NOT EXISTS public.transport_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_schedule_id uuid REFERENCES public.tour_schedules(id),
  organizer_id uuid REFERENCES public.organizer_profiles(id),
  transporter_id uuid REFERENCES public.transporter_profiles(id),
  vehicle_id uuid REFERENCES public.vehicles(id),
  pickup_location text NOT NULL,
  dropoff_location text NOT NULL,
  pickup_datetime timestamptz NOT NULL,
  return_datetime timestamptz,
  seats_required integer NOT NULL CHECK (seats_required > 0),
  estimated_price numeric(10, 2),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'canceled', 'completed')),
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on vehicles tables
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_bookings ENABLE ROW LEVEL SECURITY;

-- Indexes for performance filtering soft-deletes
CREATE INDEX IF NOT EXISTS idx_tours_deleted_at ON public.tours (deleted_at);
CREATE INDEX IF NOT EXISTS idx_tour_schedules_deleted_at ON public.tour_schedules (deleted_at);
CREATE INDEX IF NOT EXISTS idx_reviews_deleted_at ON public.reviews (deleted_at);
CREATE INDEX IF NOT EXISTS idx_bookings_deleted_at ON public.bookings (deleted_at);
CREATE INDEX IF NOT EXISTS idx_vehicles_deleted_at ON public.vehicles (deleted_at);
