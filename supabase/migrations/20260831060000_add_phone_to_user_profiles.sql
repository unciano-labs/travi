-- Add phone and email_verified_at to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
