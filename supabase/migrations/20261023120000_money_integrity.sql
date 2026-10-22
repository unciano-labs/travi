-- =============================================================================
-- Phase 2: payments, ledger and payouts correctness
-- docs/MVP_LAUNCH_READINESS.md §5 Phase 2 (FIN-01…08, FIN-10…14, FIN-17, FIN-18, FIN-21…23)
--
-- Every money movement is now a SECURITY DEFINER function that locks the rows it touches, writes
-- the ledger and the balances in the same transaction, and is idempotent. The app calls these
-- through the service role after talking to PayMongo; it never edits balances or ledger rows.
--
-- Ledger sign convention (documented in AGENTS.md §4.4): `amount` is the signed effect on the
-- bucket named in `balance_affected`, so for every wallet
--   sum(amount where balance_affected = 'available') = available_balance
--   sum(amount where balance_affected = 'escrow')    = escrow_balance
-- `wallet_ledger_drift()` reports wallets where that does not hold.
--
-- Requires 20261023090000_rls_hardening.sql. Idempotent.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Settings: bounds, minimum payout, change history (FIN-14, FIN-21)
-- -----------------------------------------------------------------------------
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS min_payout_amount numeric(12,2) NOT NULL DEFAULT 100.00;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_bounds') THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_bounds CHECK (
      organizer_fee_percent BETWEEN 0 AND 50
      AND transporter_fee_percent BETWEEN 0 AND 50
      AND escrow_holding_days BETWEEN 0 AND 60
      AND min_payout_amount > 0
    ) NOT VALID;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.platform_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  settings_id uuid NOT NULL,
  changed_by uuid,
  old_values jsonb NOT NULL,
  new_values jsonb NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_settings_history ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.platform_settings_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.platform_settings_history (settings_id, changed_by, old_values, new_values)
  VALUES (NEW.id, NEW.updated_by, to_jsonb(OLD), to_jsonb(NEW));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS platform_settings_audit ON public.platform_settings;
CREATE TRIGGER platform_settings_audit
  AFTER UPDATE ON public.platform_settings
  FOR EACH ROW EXECUTE FUNCTION public.platform_settings_audit();

-- -----------------------------------------------------------------------------
-- 2. Fee snapshot on the booking (FIN-23): the fee in force when the booking was created applies.
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS organizer_fee_percent numeric(5,2);

-- SECURITY INVOKER on purpose: is_end_user_request() must see the caller's role. Settings are publicly readable.
CREATE OR REPLACE FUNCTION public.bookings_snapshot_fee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.organizer_fee_percent IS NULL OR public.is_end_user_request() THEN
    SELECT organizer_fee_percent INTO NEW.organizer_fee_percent FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_snapshot_fee ON public.bookings;
CREATE TRIGGER bookings_snapshot_fee
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_snapshot_fee();

-- -----------------------------------------------------------------------------
-- 3. Payment and refund records (FIN-10, FIN-11, FIN-17)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.booking_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'paymongo',
  payment_intent_id text,
  provider_payment_id text NOT NULL UNIQUE,
  amount_centavos bigint NOT NULL CHECK (amount_centavos > 0),
  fee_centavos bigint NOT NULL DEFAULT 0 CHECK (fee_centavos >= 0),
  currency text NOT NULL DEFAULT 'PHP',
  -- applied: confirmed the booking. needs_review: money received but not applied (late, duplicate,
  -- wrong amount) and must be refunded or resolved by an admin.
  status text NOT NULL CHECK (status IN ('applied', 'needs_review')),
  review_reason text,
  source text NOT NULL CHECK (source IN ('return', 'webhook', 'backfill')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_payments_booking_idx ON public.booking_payments (booking_id);
ALTER TABLE public.booking_payments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.booking_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  reason text NOT NULL,
  initiated_by uuid REFERENCES public.user_profiles(id),
  initiated_role text NOT NULL DEFAULT 'system' CHECK (initiated_role IN ('traveler', 'organizer', 'admin', 'system')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed')),
  provider_refund_id text UNIQUE,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- At most one in-flight or successful refund per booking: a double click cannot refund twice.
CREATE UNIQUE INDEX IF NOT EXISTS booking_refunds_one_active
  ON public.booking_refunds (booking_id) WHERE status IN ('pending', 'succeeded');
ALTER TABLE public.booking_refunds ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.webhook_events (
  id text PRIMARY KEY,               -- provider event id
  provider text NOT NULL DEFAULT 'paymongo',
  type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  outcome text
);
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 4. Ledger invariants (FIN-12, FIN-13, FIN-22)
-- -----------------------------------------------------------------------------
-- Escrow release writes one row per bucket, so the per-reference uniqueness includes the bucket.
DROP INDEX IF EXISTS public.wallet_transactions_reference_unique;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    GROUP BY wallet_id, reference_type, reference_id, type, balance_affected
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'wallet_transactions has duplicate rows; unique index NOT created (reconcile first)';
  ELSE
    CREATE UNIQUE INDEX wallet_transactions_reference_unique
      ON public.wallet_transactions (wallet_id, reference_type, reference_id, type, balance_affected);
  END IF;
END;
$$;

-- The ledger is append-only. Corrections are new rows (manual_adjustment), never edits.
CREATE OR REPLACE FUNCTION public.wallet_transactions_append_only()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(current_setting('travi.allow_ledger_edit', true), '') = 'on' THEN
    RETURN coalesce(NEW, OLD);
  END IF;
  RAISE EXCEPTION 'wallet_transactions is append-only; record a correcting entry instead' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS wallet_transactions_append_only ON public.wallet_transactions;
CREATE TRIGGER wallet_transactions_append_only
  BEFORE UPDATE OR DELETE ON public.wallet_transactions
  FOR EACH ROW EXECUTE FUNCTION public.wallet_transactions_append_only();

-- Race-free wallet creation (the old version could insert twice under concurrency).
CREATE OR REPLACE FUNCTION public.ensure_user_wallet(profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  w_id uuid;
BEGIN
  INSERT INTO public.user_wallets (user_profile_id) VALUES (profile_id)
  ON CONFLICT (user_profile_id) DO NOTHING;
  SELECT id INTO w_id FROM public.user_wallets WHERE user_profile_id = profile_id;
  RETURN w_id;
END;
$$;

-- Wallet that receives a booking's revenue: the organizer's USER profile (FIN-01: never organizer_profiles.id).
CREATE OR REPLACE FUNCTION public.organizer_wallet_for_booking(p_booking_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_profile_id uuid;
BEGIN
  SELECT op.user_profile_id INTO v_user_profile_id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  JOIN public.organizer_profiles op ON op.id = t.organizer_id
  WHERE b.id = p_booking_id;

  IF v_user_profile_id IS NULL THEN
    RAISE EXCEPTION 'Organizer not found for booking %', p_booking_id;
  END IF;
  RETURN public.ensure_user_wallet(v_user_profile_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.manila_today()
RETURNS date
LANGUAGE sql
STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Manila')::date
$$;

-- -----------------------------------------------------------------------------
-- 5. Confirm a paid booking (FIN-01, FIN-02, FIN-03, FIN-04, BIZ-03)
-- Called by the success page and the webhook with the payment as reported by PayMongo's API.
-- Returns: confirmed | already_applied | amount_mismatch | duplicate_payment | late_payment_needs_refund
--          | booking_closed_needs_refund
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_booking_payment(
  p_booking_id uuid,
  p_payment_intent_id text,
  p_provider_payment_id text,
  p_amount_centavos bigint,
  p_fee_centavos bigint,
  p_source text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_existing record;
  v_expected bigint;
  v_fee_pct numeric;
  v_fee numeric;
  v_net numeric;
  v_wallet uuid;
  v_review text;
BEGIN
  SELECT b.*, ts.start_date INTO v_booking
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking % not found', p_booking_id;
  END IF;

  -- Idempotent: the same PayMongo payment is applied at most once (success page + webhook race).
  SELECT status, review_reason INTO v_existing FROM public.booking_payments WHERE provider_payment_id = p_provider_payment_id;
  IF FOUND THEN
    RETURN CASE WHEN v_existing.status = 'applied' THEN 'already_applied' ELSE v_existing.review_reason END;
  END IF;

  v_expected := round(v_booking.total_amount * 100)::bigint;

  IF p_amount_centavos <> v_expected THEN
    v_review := 'amount_mismatch';
  ELSIF v_booking.status::text IN ('confirmed', 'completed') THEN
    v_review := 'duplicate_payment';
  ELSIF v_booking.status::text = 'refunded' THEN
    v_review := 'booking_closed_needs_refund';
  ELSIF v_booking.status::text = 'canceled' THEN
    -- Late payment: the 15-minute hold expired (or the traveler canceled) before PayMongo confirmed.
    -- Revive the booking if the trip has not started and seats are still available.
    IF v_booking.start_date <= public.manila_today() THEN
      v_review := 'late_payment_needs_refund';
    ELSE
      BEGIN
        UPDATE public.bookings SET status = 'confirmed', paymongo_session_id = p_payment_intent_id, updated_at = now()
        WHERE id = p_booking_id;
      EXCEPTION WHEN check_violation THEN
        v_review := 'late_payment_needs_refund';
      END;
    END IF;
  ELSE
    UPDATE public.bookings SET status = 'confirmed', paymongo_session_id = p_payment_intent_id, updated_at = now()
    WHERE id = p_booking_id;
  END IF;

  IF v_review IS NOT NULL THEN
    INSERT INTO public.booking_payments
      (booking_id, payment_intent_id, provider_payment_id, amount_centavos, fee_centavos, status, review_reason, source)
    VALUES (p_booking_id, p_payment_intent_id, p_provider_payment_id, p_amount_centavos, coalesce(p_fee_centavos, 0),
            'needs_review', v_review, p_source);
    RETURN v_review;
  END IF;

  INSERT INTO public.booking_payments
    (booking_id, payment_intent_id, provider_payment_id, amount_centavos, fee_centavos, status, source)
  VALUES (p_booking_id, p_payment_intent_id, p_provider_payment_id, p_amount_centavos, coalesce(p_fee_centavos, 0),
          'applied', p_source);

  -- Escrow credit for the organizer, net of the platform fee snapshotted on the booking.
  v_fee_pct := coalesce(v_booking.organizer_fee_percent,
                        (SELECT organizer_fee_percent FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1));
  IF v_fee_pct IS NULL THEN
    RAISE EXCEPTION 'Platform fee is not configured';
  END IF;
  v_fee := round(v_booking.total_amount * v_fee_pct / 100, 2);
  v_net := v_booking.total_amount - v_fee;
  v_wallet := public.organizer_wallet_for_booking(p_booking_id);

  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = p_booking_id
      AND type IN ('escrow_deposit', 'payment_hold')
  ) THEN
    INSERT INTO public.wallet_transactions
      (wallet_id, amount, fee_amount, type, balance_affected, reference_type, reference_id, description)
    VALUES (v_wallet, v_net, v_fee, 'escrow_deposit', 'escrow', 'booking', p_booking_id,
            'Revenue for booking ' || v_booking.booking_ref);
    UPDATE public.user_wallets SET escrow_balance = escrow_balance + v_net, updated_at = now() WHERE id = v_wallet;
  END IF;

  RETURN 'confirmed';
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Escrow release (FIN-02, FIN-05, FIN-18)
-- Returns: released | already_released | not_confirmed | disputed | not_due | no_deposit
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_booking_escrow(p_booking_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_holding integer;
  v_wallet uuid;
  v_deposit numeric;
BEGIN
  SELECT b.id, b.status::text AS status, b.dispute_status::text AS dispute_status, b.booking_ref, ts.end_date
  INTO v_booking
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND OR v_booking.status <> 'confirmed' THEN
    RETURN 'not_confirmed';
  END IF;
  IF v_booking.dispute_status NOT IN ('none', 'resolved_denied') THEN
    RETURN 'disputed';
  END IF;

  SELECT escrow_holding_days INTO v_holding FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1;
  IF v_holding IS NULL THEN
    RAISE EXCEPTION 'Escrow holding period is not configured';
  END IF;
  IF v_booking.end_date + v_holding > public.manila_today() THEN
    RETURN 'not_due';
  END IF;

  v_wallet := public.organizer_wallet_for_booking(p_booking_id);

  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = p_booking_id AND type = 'escrow_release'
  ) THEN
    UPDATE public.bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
    RETURN 'already_released';
  END IF;

  -- Deposit still held for this booking (deposits minus any refund reversals).
  SELECT coalesce(sum(amount), 0) INTO v_deposit
  FROM public.wallet_transactions
  WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = p_booking_id
    AND balance_affected = 'escrow' AND type IN ('escrow_deposit', 'payment_hold', 'refund');

  IF NOT EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = p_booking_id
      AND type IN ('escrow_deposit', 'payment_hold')
  ) THEN
    RETURN 'no_deposit';
  END IF;

  IF v_deposit > 0 THEN
    UPDATE public.user_wallets
    SET escrow_balance = escrow_balance - v_deposit,
        available_balance = available_balance + v_deposit,
        updated_at = now()
    WHERE id = v_wallet;

    INSERT INTO public.wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
    VALUES
      (v_wallet, -v_deposit, 'escrow_release', 'escrow', 'booking', p_booking_id, 'Escrow released for booking ' || v_booking.booking_ref),
      (v_wallet, v_deposit, 'escrow_release', 'available', 'booking', p_booking_id, 'Escrow released for booking ' || v_booking.booking_ref);
  END IF;

  UPDATE public.bookings SET status = 'completed', updated_at = now() WHERE id = p_booking_id;
  RETURN 'released';
END;
$$;

-- Bookings the escrow cron should try today.
CREATE OR REPLACE FUNCTION public.bookings_due_for_escrow_release()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  WHERE b.status = 'confirmed'
    AND b.dispute_status::text IN ('none', 'resolved_denied')
    AND ts.end_date + (SELECT escrow_holding_days FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1)
        <= public.manila_today()
$$;

-- -----------------------------------------------------------------------------
-- 7. Disputes (FIN-18)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.open_booking_dispute(p_booking_id uuid, p_traveler_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_holding integer;
BEGIN
  SELECT b.traveler_id, b.status::text AS status, b.dispute_status::text AS dispute_status, ts.end_date
  INTO v_booking
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  WHERE b.id = p_booking_id
  FOR UPDATE OF b;

  IF NOT FOUND OR v_booking.traveler_id <> p_traveler_profile_id THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Disputes can only be opened for confirmed bookings that have not been completed.' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.dispute_status <> 'none' THEN
    RAISE EXCEPTION 'A dispute is already open or resolved for this booking.' USING ERRCODE = 'P0001';
  END IF;

  SELECT escrow_holding_days INTO v_holding FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1;
  IF v_booking.end_date + coalesce(v_holding, 0) < public.manila_today() THEN
    RAISE EXCEPTION 'The dispute period for this booking has ended.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.bookings SET dispute_status = 'open', updated_at = now() WHERE id = p_booking_id;
  RETURN 'open';
END;
$$;

CREATE OR REPLACE FUNCTION public.deny_booking_dispute(p_booking_id uuid, p_admin_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.bookings SET dispute_status = 'resolved_denied', updated_at = now()
  WHERE id = p_booking_id AND dispute_status = 'open';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No open dispute to resolve' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'booking', p_booking_id, 'dispute_denied', 'Dispute denied');
  RETURN 'resolved_denied';
END;
$$;

-- -----------------------------------------------------------------------------
-- 8. Refunds (FIN-17): begin (before calling PayMongo) -> complete | fail
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_booking_refund(
  p_booking_id uuid, p_amount numeric, p_reason text, p_initiated_by uuid, p_initiated_role text DEFAULT 'system'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_amount numeric;
  v_refund_id uuid;
BEGIN
  SELECT id, status::text AS status, total_amount INTO v_booking
  FROM public.bookings WHERE id = p_booking_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_booking.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only confirmed (paid, not yet completed) bookings can be refunded.' USING ERRCODE = 'P0001';
  END IF;

  v_amount := coalesce(p_amount, v_booking.total_amount);
  IF v_amount <= 0 OR v_amount > v_booking.total_amount OR v_amount <> round(v_amount, 2) THEN
    RAISE EXCEPTION 'Invalid refund amount' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    INSERT INTO public.booking_refunds (booking_id, amount, reason, initiated_by, initiated_role)
    VALUES (p_booking_id, v_amount, p_reason, p_initiated_by, coalesce(p_initiated_role, 'system'))
    RETURNING id INTO v_refund_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'A refund is already in progress or completed for this booking.' USING ERRCODE = 'P0001';
  END;

  RETURN v_refund_id;
END;
$$;

-- p_booking_status: 'canceled' (traveler/organizer cancellation) or 'refunded' (dispute refund).
CREATE OR REPLACE FUNCTION public.complete_booking_refund(
  p_refund_id uuid, p_provider_refund_id text, p_booking_status text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_refund record;
  v_booking record;
  v_wallet uuid;
  v_held numeric;
  v_reverse numeric;
BEGIN
  IF p_booking_status NOT IN ('canceled', 'refunded') THEN
    RAISE EXCEPTION 'Invalid booking status %', p_booking_status;
  END IF;

  SELECT * INTO v_refund FROM public.booking_refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Refund % not found', p_refund_id;
  END IF;
  IF v_refund.status = 'succeeded' THEN
    RETURN 'already_completed';
  END IF;
  IF v_refund.status = 'failed' THEN
    RAISE EXCEPTION 'Refund % already failed', p_refund_id;
  END IF;

  SELECT id, total_amount, booking_ref, dispute_status::text AS dispute_status INTO v_booking
  FROM public.bookings WHERE id = v_refund.booking_id FOR UPDATE;

  UPDATE public.booking_refunds
  SET status = 'succeeded', provider_refund_id = p_provider_refund_id, updated_at = now()
  WHERE id = p_refund_id;

  -- Reverse the organizer's escrow proportionally to the amount refunded.
  v_wallet := public.organizer_wallet_for_booking(v_booking.id);
  SELECT coalesce(sum(amount), 0) INTO v_held
  FROM public.wallet_transactions
  WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = v_booking.id
    AND balance_affected = 'escrow' AND type IN ('escrow_deposit', 'payment_hold', 'refund', 'escrow_release');

  IF v_held > 0 THEN
    v_reverse := least(v_held, round(v_held * v_refund.amount / v_booking.total_amount, 2));
    UPDATE public.user_wallets SET escrow_balance = escrow_balance - v_reverse, updated_at = now() WHERE id = v_wallet;
    INSERT INTO public.wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
    VALUES (v_wallet, -v_reverse, 'refund', 'escrow', 'booking', v_booking.id, 'Refund for booking ' || v_booking.booking_ref);
  END IF;

  UPDATE public.bookings
  SET status = p_booking_status::booking_status,
      dispute_status = CASE WHEN dispute_status = 'open' THEN 'resolved_refunded'::dispute_status_enum ELSE dispute_status END,
      updated_at = now()
  WHERE id = v_booking.id;

  IF v_refund.initiated_role = 'admin' AND v_refund.initiated_by IS NOT NULL THEN
    INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
    VALUES (v_refund.initiated_by, 'booking', v_booking.id, 'refund',
            format('Refunded %s (%s). PayMongo refund %s', v_refund.amount, v_refund.reason, p_provider_refund_id));
  END IF;

  RETURN 'refunded';
END;
$$;

CREATE OR REPLACE FUNCTION public.fail_booking_refund(p_refund_id uuid, p_error text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.booking_refunds SET status = 'failed', error = left(p_error, 1000), updated_at = now()
  WHERE id = p_refund_id AND status = 'pending';
$$;

-- -----------------------------------------------------------------------------
-- 9. Payouts (FIN-06, FIN-07, FIN-08, FIN-21)
-- -----------------------------------------------------------------------------
-- Called with the USER's session (auth.uid()); the caller must have re-entered their password.
CREATE OR REPLACE FUNCTION public.request_payout(p_amount numeric, p_method_id text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile uuid := public.current_user_profile_id();
  v_wallet record;
  v_min numeric;
  v_method jsonb;
  v_payout_id uuid;
BEGIN
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizer_profiles WHERE user_profile_id = v_profile AND status = 'approved' AND deleted_at IS NULL
    UNION ALL
    SELECT 1 FROM public.transporter_profiles WHERE user_profile_id = v_profile AND status = 'approved' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Only approved organizers and transporters can request payouts.' USING ERRCODE = 'P0001';
  END IF;

  SELECT min_payout_amount INTO v_min FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1;
  IF p_amount IS NULL OR p_amount <> round(p_amount, 2) OR p_amount < coalesce(v_min, 100) THEN
    RAISE EXCEPTION 'Minimum withdrawal is ₱%', to_char(coalesce(v_min, 100), 'FM999,999,990.00') USING ERRCODE = 'P0001';
  END IF;

  SELECT id, available_balance, saved_payout_methods INTO v_wallet
  FROM public.user_wallets WHERE user_profile_id = v_profile FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found' USING ERRCODE = 'P0001';
  END IF;

  SELECT m INTO v_method
  FROM jsonb_array_elements(coalesce(v_wallet.saved_payout_methods, '[]'::jsonb)) AS m
  WHERE m ->> 'id' = p_method_id;
  IF v_method IS NULL THEN
    RAISE EXCEPTION 'Choose one of your saved payout methods.' USING ERRCODE = 'P0001';
  END IF;

  IF v_wallet.available_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient available balance' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_wallets SET available_balance = available_balance - p_amount, updated_at = now() WHERE id = v_wallet.id;

  INSERT INTO public.payout_requests (wallet_id, amount, status, payout_method)
  VALUES (v_wallet.id, p_amount, 'pending', jsonb_build_object(
    'method_id', v_method ->> 'id',
    'method', v_method ->> 'type',
    'account_name', v_method -> 'details' ->> 'accountName',
    'account_number', v_method -> 'details' ->> 'accountNumber',
    'bank_name', v_method -> 'details' ->> 'bankName'
  ))
  RETURNING id INTO v_payout_id;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
  VALUES (v_wallet.id, -p_amount, 'withdrawal_pending', 'available', 'payout', v_payout_id,
          'Withdrawal requested via ' || upper(v_method ->> 'type'));

  RETURN v_payout_id;
END;
$$;

-- Admin marks a payout paid after sending the money. Returns the wallet id (for the email).
CREATE OR REPLACE FUNCTION public.mark_payout_paid(p_payout_id uuid, p_admin_profile_id uuid, p_reference text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet uuid;
  v_amount numeric;
BEGIN
  IF coalesce(trim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'Reference number is required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.payout_requests
  SET status = 'paid', admin_notes = 'Reference ID: ' || trim(p_reference), updated_at = now()
  WHERE id = p_payout_id AND status IN ('pending', 'processing')
  RETURNING wallet_id, amount INTO v_wallet, v_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout is not pending (already paid or rejected)' USING ERRCODE = 'P0001';
  END IF;

  -- Memo row: the balance was already debited when the payout was requested.
  INSERT INTO public.wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
  VALUES (v_wallet, 0, 'withdrawal_completed', 'available', 'payout', p_payout_id,
          format('Payout of ₱%s sent. Ref: %s', to_char(v_amount, 'FM999,999,990.00'), trim(p_reference)));

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'payout', p_payout_id, 'mark_paid', format('Amount %s, reference %s', v_amount, trim(p_reference)));

  RETURN v_wallet;
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_payout(p_payout_id uuid, p_admin_profile_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet uuid;
  v_amount numeric;
BEGIN
  UPDATE public.payout_requests
  SET status = 'rejected', admin_notes = nullif(trim(p_reason), ''), updated_at = now()
  WHERE id = p_payout_id AND status IN ('pending', 'processing')
  RETURNING wallet_id, amount INTO v_wallet, v_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout is not pending (already paid or rejected)' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.user_wallets SET available_balance = available_balance + v_amount, updated_at = now() WHERE id = v_wallet;

  INSERT INTO public.wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description)
  VALUES (v_wallet, v_amount, 'withdrawal_rejected', 'available', 'payout', p_payout_id,
          coalesce('Payout rejected: ' || nullif(trim(p_reason), ''), 'Payout rejected by admin'));

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'payout', p_payout_id, 'reject', coalesce(nullif(trim(p_reason), ''), 'No reason given'));

  RETURN v_wallet;
END;
$$;

-- -----------------------------------------------------------------------------
-- 10. Reconciliation helpers (FIN-11, FIN-22)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.wallet_ledger_drift()
RETURNS TABLE (
  wallet_id uuid, available_balance numeric, ledger_available numeric, escrow_balance numeric, ledger_escrow numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT w.id, w.available_balance, coalesce(l.available, 0), w.escrow_balance, coalesce(l.escrow, 0)
  FROM public.user_wallets w
  LEFT JOIN (
    SELECT t.wallet_id,
           sum(t.amount) FILTER (WHERE t.balance_affected = 'available') AS available,
           sum(t.amount) FILTER (WHERE t.balance_affected = 'escrow') AS escrow
    FROM public.wallet_transactions t
    GROUP BY t.wallet_id
  ) l ON l.wallet_id = w.id
  WHERE w.available_balance <> coalesce(l.available, 0) OR w.escrow_balance <> coalesce(l.escrow, 0)
$$;

-- Paid bookings with no organizer deposit (the FIN-01 backlog). Used by scripts/backfill-escrow-deposits.ts.
CREATE OR REPLACE FUNCTION public.bookings_missing_deposit()
RETURNS TABLE (booking_id uuid, booking_ref text, status text, total_amount numeric, paymongo_session_id text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id, b.booking_ref, b.status::text, b.total_amount, b.paymongo_session_id
  FROM public.bookings b
  WHERE b.status IN ('confirmed', 'completed')
    AND NOT EXISTS (
      SELECT 1 FROM public.wallet_transactions t
      WHERE t.reference_type = 'booking' AND t.reference_id = b.id AND t.type IN ('escrow_deposit', 'payment_hold')
    )
$$;

-- Record the deposit for an already-confirmed booking whose payment was verified with PayMongo.
CREATE OR REPLACE FUNCTION public.backfill_booking_deposit(
  p_booking_id uuid, p_payment_intent_id text, p_provider_payment_id text, p_amount_centavos bigint, p_fee_centavos bigint
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_fee_pct numeric;
  v_fee numeric;
  v_net numeric;
  v_wallet uuid;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND OR v_booking.status::text <> 'confirmed' THEN
    RETURN 'skipped_not_confirmed';
  END IF;
  IF p_amount_centavos <> round(v_booking.total_amount * 100)::bigint THEN
    RETURN 'skipped_amount_mismatch';
  END IF;

  v_wallet := public.organizer_wallet_for_booking(p_booking_id);
  IF EXISTS (
    SELECT 1 FROM public.wallet_transactions
    WHERE wallet_id = v_wallet AND reference_type = 'booking' AND reference_id = p_booking_id
      AND type IN ('escrow_deposit', 'payment_hold')
  ) THEN
    RETURN 'already_has_deposit';
  END IF;

  INSERT INTO public.booking_payments
    (booking_id, payment_intent_id, provider_payment_id, amount_centavos, fee_centavos, status, source)
  VALUES (p_booking_id, p_payment_intent_id, p_provider_payment_id, p_amount_centavos, coalesce(p_fee_centavos, 0), 'applied', 'backfill')
  ON CONFLICT (provider_payment_id) DO NOTHING;

  v_fee_pct := coalesce(v_booking.organizer_fee_percent,
                        (SELECT organizer_fee_percent FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1));
  v_fee := round(v_booking.total_amount * v_fee_pct / 100, 2);
  v_net := v_booking.total_amount - v_fee;

  INSERT INTO public.wallet_transactions
    (wallet_id, amount, fee_amount, type, balance_affected, reference_type, reference_id, description)
  VALUES (v_wallet, v_net, v_fee, 'escrow_deposit', 'escrow', 'booking', p_booking_id,
          'Revenue for booking ' || v_booking.booking_ref || ' (backfilled)');
  UPDATE public.user_wallets SET escrow_balance = escrow_balance + v_net, updated_at = now() WHERE id = v_wallet;
  RETURN 'backfilled';
END;
$$;

-- -----------------------------------------------------------------------------
-- 11. Privileges: money functions are service-role only, except request_payout (user session).
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.ensure_user_wallet(uuid)',
    'public.organizer_wallet_for_booking(uuid)',
    'public.confirm_booking_payment(uuid, text, text, bigint, bigint, text)',
    'public.release_booking_escrow(uuid)',
    'public.bookings_due_for_escrow_release()',
    'public.open_booking_dispute(uuid, uuid)',
    'public.deny_booking_dispute(uuid, uuid)',
    'public.begin_booking_refund(uuid, numeric, text, uuid, text)',
    'public.complete_booking_refund(uuid, text, text)',
    'public.fail_booking_refund(uuid, text)',
    'public.mark_payout_paid(uuid, uuid, text)',
    'public.reject_payout(uuid, uuid, text)',
    'public.wallet_ledger_drift()',
    'public.bookings_missing_deposit()',
    'public.backfill_booking_deposit(uuid, text, text, bigint, bigint)',
    'public.platform_settings_audit()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.request_payout(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_payout(numeric, text) TO authenticated, service_role;
