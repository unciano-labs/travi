-- Add phone_verified_at to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMPTZ;
