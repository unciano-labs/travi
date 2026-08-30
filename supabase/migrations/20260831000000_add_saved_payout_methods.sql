-- Migration: Add saved_payout_methods to user_wallets
ALTER TABLE public.user_wallets ADD COLUMN IF NOT EXISTS saved_payout_methods JSONB DEFAULT '[]'::jsonb;
