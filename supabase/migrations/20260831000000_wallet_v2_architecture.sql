-- 1. Update platform_settings
ALTER TABLE platform_settings 
  RENAME COLUMN platform_fee_percent TO organizer_fee_percent;

ALTER TABLE platform_settings 
  ADD COLUMN transporter_fee_percent numeric(5,2) NOT NULL DEFAULT 3.00,
  ADD COLUMN escrow_holding_days integer NOT NULL DEFAULT 3;

-- 2. Update wallet_transactions
ALTER TABLE wallet_transactions 
  ADD COLUMN fee_amount numeric(12,2) DEFAULT 0.00;

-- Need to add enum values if they don't exist
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'escrow_deposit';
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'penalty';
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'escrow_release';
ALTER TYPE transaction_type_enum ADD VALUE IF NOT EXISTS 'manual_adjustment';

-- 3. Update bookings
CREATE TYPE dispute_status_enum AS ENUM ('none', 'open', 'resolved_refunded', 'resolved_denied');

ALTER TABLE bookings 
  ADD COLUMN dispute_status dispute_status_enum NOT NULL DEFAULT 'none';

-- 4. Drop the old PL/pgSQL function as we will handle escrow releases in a Node.js cron/server action
-- This gives us more flexibility to handle external transporters and platform fee logic.
DROP FUNCTION IF EXISTS release_tour_escrow(uuid);

-- 5. Function to increment available balance
CREATE OR REPLACE FUNCTION increment_available_balance(w_id uuid, amt numeric)
RETURNS void AS $$
BEGIN
  UPDATE user_wallets 
  SET available_balance = available_balance + amt,
      updated_at = now()
  WHERE id = w_id;
END;
$$ LANGUAGE plpgsql;