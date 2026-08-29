CREATE TYPE transaction_type_enum AS ENUM ('payment_hold', 'escrow_release', 'withdrawal_pending', 'withdrawal_completed', 'withdrawal_rejected', 'refund', 'platform_fee', 'manual_adjustment');
CREATE TYPE payout_status_enum AS ENUM ('pending', 'processing', 'paid', 'rejected');

-- Platform Settings (Singleton pattern usually)
CREATE TABLE platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform_fee_percent numeric(5,2) NOT NULL DEFAULT 10.00,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES user_profiles(id)
);

-- Insert default setting
INSERT INTO platform_settings (platform_fee_percent) VALUES (10.00);

-- User Wallets
CREATE TABLE user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE UNIQUE,
  available_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  escrow_balance numeric(12,2) NOT NULL DEFAULT 0.00,
  currency text NOT NULL DEFAULT 'PHP',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallet Transactions Ledger
CREATE TABLE wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  type transaction_type_enum NOT NULL,
  balance_affected text NOT NULL CHECK (balance_affected IN ('available', 'escrow')),
  reference_type text NOT NULL, -- e.g. 'booking', 'payout'
  reference_id uuid NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Payout Requests
CREATE TABLE payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES user_wallets(id) ON DELETE CASCADE,
  amount numeric(12,2) NOT NULL,
  status payout_status_enum NOT NULL DEFAULT 'pending',
  payout_method jsonb NOT NULL,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payout_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- platform_settings: anyone can read, only admin can update
CREATE POLICY "Public read platform settings" ON platform_settings FOR SELECT USING (true);
CREATE POLICY "Admin update platform settings" ON platform_settings FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN website_roles wr ON ur.website_role_id = wr.id 
    JOIN user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  )
);

-- user_wallets: owner can read
CREATE POLICY "User read own wallet" ON user_wallets FOR SELECT USING (
  user_profile_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid())
);

-- wallet_transactions: owner can read
CREATE POLICY "User read own wallet transactions" ON wallet_transactions FOR SELECT USING (
  wallet_id IN (SELECT id FROM user_wallets WHERE user_profile_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()))
);

-- payout_requests: owner can read and insert
CREATE POLICY "User read own payout requests" ON payout_requests FOR SELECT USING (
  wallet_id IN (SELECT id FROM user_wallets WHERE user_profile_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()))
);
CREATE POLICY "User insert own payout requests" ON payout_requests FOR INSERT WITH CHECK (
  wallet_id IN (SELECT id FROM user_wallets WHERE user_profile_id = (SELECT id FROM user_profiles WHERE user_id = auth.uid()))
);

-- Admins can read all for wallets, transactions, payouts
CREATE POLICY "Admin read all wallets" ON user_wallets FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN website_roles wr ON ur.website_role_id = wr.id 
    JOIN user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  )
);
CREATE POLICY "Admin read all wallet transactions" ON wallet_transactions FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN website_roles wr ON ur.website_role_id = wr.id 
    JOIN user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  )
);
CREATE POLICY "Admin manage all payout requests" ON payout_requests FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    JOIN website_roles wr ON ur.website_role_id = wr.id 
    JOIN user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  )
);

-- Function to automatically create a wallet for an organizer or transporter if they don't have one
CREATE OR REPLACE FUNCTION ensure_user_wallet(profile_id uuid)
RETURNS uuid AS $$
DECLARE
    w_id uuid;
BEGIN
    SELECT id INTO w_id FROM user_wallets WHERE user_profile_id = profile_id;
    IF w_id IS NULL THEN
        INSERT INTO user_wallets (user_profile_id) VALUES (profile_id) RETURNING id INTO w_id;
    END IF;
    RETURN w_id;
END;
$$ LANGUAGE plpgsql;

-- Function to safely increment escrow balance
CREATE OR REPLACE FUNCTION increment_escrow_balance(w_id uuid, amt numeric)
RETURNS void AS $$
BEGIN
  UPDATE user_wallets 
  SET escrow_balance = escrow_balance + amt,
      updated_at = now()
  WHERE id = w_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release escrow funds to available balance when tour completes
CREATE OR REPLACE FUNCTION release_tour_escrow(p_schedule_id uuid)
RETURNS void AS $$
DECLARE
  b record;
  w_id uuid;
  org_amt numeric;
  fee_pct numeric;
BEGIN
  SELECT platform_fee_percent INTO fee_pct FROM platform_settings LIMIT 1;
  IF fee_pct IS NULL THEN fee_pct := 10.0; END IF;

  FOR b IN 
    SELECT b.id, b.total_amount, t.organizer_id
    FROM bookings b
    JOIN tour_schedules ts ON ts.id = b.tour_schedule_id
    JOIN tours t ON t.id = ts.tour_id
    WHERE ts.id = p_schedule_id AND b.status IN ('confirmed', 'completed')
  LOOP
    SELECT id INTO w_id FROM user_wallets WHERE user_profile_id = b.organizer_id;
    
    IF w_id IS NOT NULL THEN
      org_amt := b.total_amount * (1.0 - (fee_pct / 100.0));

      IF NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE reference_id = b.id AND type = 'escrow_release') THEN
        
        INSERT INTO wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
        VALUES (w_id, org_amt, 'escrow_release', 'available', 'booking', b.id, 'Escrow release for completed tour');

        UPDATE user_wallets 
        SET escrow_balance = escrow_balance - org_amt,
            available_balance = available_balance + org_amt,
            updated_at = now()
        WHERE id = w_id;
      END IF;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
