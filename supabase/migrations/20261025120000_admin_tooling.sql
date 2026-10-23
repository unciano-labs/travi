-- =============================================================================
-- Phase 3.11: admin tooling and finance
-- docs/MVP_LAUNCH_READINESS.md OPS-06, OPS-07, FIN-11 (admin part), FIN-15, AGENTS.md §6 #6
--
--   1. Payments needing review: admins resolve `booking_payments` rows with status 'needs_review'
--      (refund through PayMongo, or close with a note). These payments were never applied to escrow,
--      so resolving one never touches the ledger.
--   2. Maker-checker payouts: above `platform_settings.payout_dual_approval_threshold` a payout must be
--      approved (pending -> processing) by one admin and marked paid by a DIFFERENT admin.
--   3. Tour moderation hold: an admin can unpublish a tour; the organizer cannot re-publish it until an
--      admin lifts the hold.
--   4. Read-side aggregates for the admin dashboard and the finance page (no 1000-row cap, no JS sums).
--
-- Requires 20261023090000_rls_hardening.sql and 20261023120000_money_integrity.sql. Idempotent.
-- Every function here is service-role only: the app authenticates and authorizes the admin first.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helper: is this user profile an admin (any website)? Defense in depth for the admin functions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.website_roles wr ON wr.id = ur.website_role_id
    WHERE ur.user_profile_id = p_profile_id AND wr.role = 'admin'
  )
$$;

-- -----------------------------------------------------------------------------
-- 1. Payments needing review (§6 #6, FIN-11)
-- -----------------------------------------------------------------------------
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS resolved_at timestamptz;
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS resolved_by uuid REFERENCES public.user_profiles(id);
-- refunded: the money went back to the payer through PayMongo. no_refund: closed without a refund
-- (e.g. refunded outside Travi, or applied by hand); resolution_note says why.
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS resolution text;
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS resolution_note text;
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS provider_refund_id text;
-- Set while a PayMongo refund call is in flight, so two admins cannot refund the same payment twice.
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS refund_started_at timestamptz;
ALTER TABLE public.booking_payments ADD COLUMN IF NOT EXISTS refund_started_by uuid REFERENCES public.user_profiles(id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_payments_resolution_check') THEN
    ALTER TABLE public.booking_payments ADD CONSTRAINT booking_payments_resolution_check CHECK (
      (resolution IS NULL AND resolved_at IS NULL)
      OR (resolution = 'no_refund' AND resolved_at IS NOT NULL)
      OR (resolution = 'refunded' AND resolved_at IS NOT NULL AND provider_refund_id IS NOT NULL)
    );
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS booking_payments_open_review_idx
  ON public.booking_payments (created_at) WHERE status = 'needs_review' AND resolved_at IS NULL;

-- Step 1 of a refund: claim the payment (row lock). Returns the PayMongo payment id and amount to refund.
-- A claim older than 15 minutes is considered abandoned and can be taken over.
CREATE OR REPLACE FUNCTION public.begin_payment_review_refund(p_payment_id uuid, p_admin_profile_id uuid)
RETURNS TABLE (provider_payment_id text, amount_centavos bigint, booking_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
BEGIN
  IF NOT public.is_admin_profile(p_admin_profile_id) THEN
    RAISE EXCEPTION 'Only admins can resolve payments' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.booking_payments bp WHERE bp.id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.status <> 'needs_review' THEN
    RAISE EXCEPTION 'This payment was applied to a booking; refund the booking instead.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.resolved_at IS NOT NULL THEN
    RAISE EXCEPTION 'This payment has already been resolved.' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.refund_started_at IS NOT NULL AND v_row.refund_started_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'A refund for this payment is already in progress.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.booking_payments
  SET refund_started_at = now(), refund_started_by = p_admin_profile_id
  WHERE id = p_payment_id;

  RETURN QUERY SELECT v_row.provider_payment_id, v_row.amount_centavos, v_row.booking_id;
END;
$$;

-- PayMongo refused the refund: release the claim so it can be retried.
CREATE OR REPLACE FUNCTION public.fail_payment_review_refund(p_payment_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.booking_payments SET refund_started_at = NULL, refund_started_by = NULL
  WHERE id = p_payment_id AND resolved_at IS NULL;
$$;

-- Close a payment review. p_resolution: 'refunded' (needs p_provider_refund_id) or 'no_refund'.
-- Idempotent: resolving an already-resolved payment the same way returns 'already_resolved'.
CREATE OR REPLACE FUNCTION public.resolve_payment_review(
  p_payment_id uuid,
  p_admin_profile_id uuid,
  p_resolution text,
  p_provider_refund_id text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row record;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
BEGIN
  IF NOT public.is_admin_profile(p_admin_profile_id) THEN
    RAISE EXCEPTION 'Only admins can resolve payments' USING ERRCODE = '42501';
  END IF;
  IF p_resolution NOT IN ('refunded', 'no_refund') THEN
    RAISE EXCEPTION 'Invalid resolution %', p_resolution USING ERRCODE = 'P0001';
  END IF;
  IF p_resolution = 'refunded' AND coalesce(trim(p_provider_refund_id), '') = '' THEN
    RAISE EXCEPTION 'A PayMongo refund id is required' USING ERRCODE = 'P0001';
  END IF;
  IF p_resolution = 'no_refund' AND v_note IS NULL THEN
    RAISE EXCEPTION 'Add a note explaining why no refund is needed' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_row FROM public.booking_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.status <> 'needs_review' THEN
    RAISE EXCEPTION 'Only payments that need review can be resolved here' USING ERRCODE = 'P0001';
  END IF;

  IF v_row.resolved_at IS NOT NULL THEN
    IF v_row.resolution = p_resolution
       AND coalesce(v_row.provider_refund_id, '') = coalesce(trim(p_provider_refund_id), '') THEN
      RETURN 'already_resolved';
    END IF;
    RAISE EXCEPTION 'This payment has already been resolved.' USING ERRCODE = 'P0001';
  END IF;

  -- "No refund" while someone else's PayMongo refund may be in flight would hide a real refund.
  IF p_resolution = 'no_refund' AND v_row.refund_started_at IS NOT NULL
     AND v_row.refund_started_at > now() - interval '15 minutes' THEN
    RAISE EXCEPTION 'A refund for this payment is in progress.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.booking_payments
  SET resolved_at = now(),
      resolved_by = p_admin_profile_id,
      resolution = p_resolution,
      resolution_note = v_note,
      provider_refund_id = CASE WHEN p_resolution = 'refunded' THEN trim(p_provider_refund_id) END
  WHERE id = p_payment_id;

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (
    p_admin_profile_id, 'booking_payment', p_payment_id,
    CASE WHEN p_resolution = 'refunded' THEN 'payment_review_refunded' ELSE 'payment_review_closed' END,
    format('%s: %s centavos (%s, %s)%s%s',
           v_row.provider_payment_id, v_row.amount_centavos, v_row.review_reason, p_resolution,
           CASE WHEN p_resolution = 'refunded' THEN '. PayMongo refund ' || trim(p_provider_refund_id) ELSE '' END,
           CASE WHEN v_note IS NOT NULL THEN '. Note: ' || v_note ELSE '' END)
  );

  RETURN 'resolved';
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Maker-checker payouts (OPS-07)
-- -----------------------------------------------------------------------------
-- NULL = off (one admin may mark any payout paid). Otherwise payouts with amount >= threshold need
-- approve_payout() by one admin and mark_payout_paid() by a different admin.
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS payout_dual_approval_threshold numeric(12,2);
COMMENT ON COLUMN public.platform_settings.payout_dual_approval_threshold IS
  'Pesos. NULL = maker-checker off. Payouts with amount >= this need approve_payout() by one admin and mark_payout_paid() by a different admin.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_settings_payout_threshold_positive') THEN
    ALTER TABLE public.platform_settings ADD CONSTRAINT platform_settings_payout_threshold_positive
      CHECK (payout_dual_approval_threshold IS NULL OR payout_dual_approval_threshold > 0);
  END IF;
END;
$$;

ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.user_profiles(id);
ALTER TABLE public.payout_requests ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Admins used to have FOR ALL on payout_requests, which let any admin session flip a payout to 'paid'
-- without the ledger or the second approver. Payout writes now go only through the functions below.
DROP POLICY IF EXISTS "Admin manage all payout requests" ON public.payout_requests;
DROP POLICY IF EXISTS "Admin read all payout requests" ON public.payout_requests;
CREATE POLICY "Admin read all payout requests" ON public.payout_requests FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.website_roles wr ON ur.website_role_id = wr.id
    JOIN public.user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  )
);

-- Does this payout need two admins? (current threshold; NULL threshold = no)
CREATE OR REPLACE FUNCTION public.payout_requires_dual_approval(p_amount numeric)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(p_amount >= (
    SELECT payout_dual_approval_threshold FROM public.platform_settings ORDER BY updated_at DESC LIMIT 1
  ), false)
$$;

-- First admin: pending -> processing. Returns the wallet id.
CREATE OR REPLACE FUNCTION public.approve_payout(p_payout_id uuid, p_admin_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_wallet uuid;
  v_amount numeric;
BEGIN
  IF NOT public.is_admin_profile(p_admin_profile_id) THEN
    RAISE EXCEPTION 'Only admins can approve payouts' USING ERRCODE = '42501';
  END IF;

  UPDATE public.payout_requests
  SET status = 'processing', approved_by = p_admin_profile_id, approved_at = now(), updated_at = now()
  WHERE id = p_payout_id AND status = 'pending'
  RETURNING wallet_id, amount INTO v_wallet, v_amount;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payout is not pending (already approved, paid or rejected)' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'payout', p_payout_id, 'approve', format('Approved payout of %s (awaiting a second admin to pay)', v_amount));

  RETURN v_wallet;
END;
$$;

-- Same behaviour as 20261023120000_money_integrity.sql, plus the maker-checker rule:
--   * a payout that needs dual approval must be approved ('processing') first;
--   * an approved payout must be marked paid by a different admin than the approver.
CREATE OR REPLACE FUNCTION public.mark_payout_paid(p_payout_id uuid, p_admin_profile_id uuid, p_reference text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_payout record;
  v_wallet uuid;
  v_amount numeric;
BEGIN
  IF coalesce(trim(p_reference), '') = '' THEN
    RAISE EXCEPTION 'Reference number is required' USING ERRCODE = 'P0001';
  END IF;

  SELECT id, status::text AS status, amount, approved_by INTO v_payout
  FROM public.payout_requests WHERE id = p_payout_id FOR UPDATE;

  IF NOT FOUND OR v_payout.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Payout is not pending (already paid or rejected)' USING ERRCODE = 'P0001';
  END IF;
  IF public.payout_requires_dual_approval(v_payout.amount) AND v_payout.status <> 'processing' THEN
    RAISE EXCEPTION 'This payout needs approval by another admin before it can be marked paid.' USING ERRCODE = 'P0001';
  END IF;
  IF v_payout.approved_by IS NOT NULL AND v_payout.approved_by = p_admin_profile_id THEN
    RAISE EXCEPTION 'A different admin must mark this payout paid (you approved it).' USING ERRCODE = 'P0001';
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

-- -----------------------------------------------------------------------------
-- 3. Tour moderation hold (OPS-06)
-- -----------------------------------------------------------------------------
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS admin_hold_at timestamptz;
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS admin_hold_by uuid REFERENCES public.user_profiles(id);
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS admin_hold_reason text;

-- End users (organizers) cannot set or clear the hold, and cannot publish a held tour.
-- SECURITY INVOKER on purpose: is_end_user_request() must see the caller's role.
CREATE OR REPLACE FUNCTION public.tours_enforce_admin_hold()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.admin_hold_at := NULL;
    NEW.admin_hold_by := NULL;
    NEW.admin_hold_reason := NULL;
    RETURN NEW;
  END IF;

  IF NEW.admin_hold_at IS DISTINCT FROM OLD.admin_hold_at
     OR NEW.admin_hold_by IS DISTINCT FROM OLD.admin_hold_by
     OR NEW.admin_hold_reason IS DISTINCT FROM OLD.admin_hold_reason THEN
    RAISE EXCEPTION 'Column tours.admin_hold_* can only be changed by the server' USING ERRCODE = '42501';
  END IF;

  IF OLD.admin_hold_at IS NOT NULL AND NEW.status = 'published' AND OLD.status IS DISTINCT FROM 'published' THEN
    RAISE EXCEPTION 'This tour was unpublished by the Travi team and cannot be published until they review it. Please contact support.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tours_enforce_admin_hold ON public.tours;
CREATE TRIGGER tours_enforce_admin_hold
  BEFORE INSERT OR UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.tours_enforce_admin_hold();

-- Admin unpublish: published -> draft with a hold and a reason. Returns the organizer profile id.
CREATE OR REPLACE FUNCTION public.admin_unpublish_tour(p_tour_id uuid, p_admin_profile_id uuid, p_reason text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer uuid;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
BEGIN
  IF NOT public.is_admin_profile(p_admin_profile_id) THEN
    RAISE EXCEPTION 'Only admins can moderate tours' USING ERRCODE = '42501';
  END IF;
  IF v_reason IS NULL THEN
    RAISE EXCEPTION 'A reason is required' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.tours
  SET status = 'draft', admin_hold_at = now(), admin_hold_by = p_admin_profile_id, admin_hold_reason = v_reason,
      updated_at = now()
  WHERE id = p_tour_id AND status = 'published' AND deleted_at IS NULL
  RETURNING organizer_id INTO v_organizer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only published tours can be unpublished' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'tour', p_tour_id, 'unpublish', 'Reason: ' || v_reason);
  RETURN v_organizer;
END;
$$;

-- Admin re-publish: lifts the hold of a tour an admin unpublished. Returns the organizer profile id.
CREATE OR REPLACE FUNCTION public.admin_republish_tour(p_tour_id uuid, p_admin_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organizer uuid;
BEGIN
  IF NOT public.is_admin_profile(p_admin_profile_id) THEN
    RAISE EXCEPTION 'Only admins can moderate tours' USING ERRCODE = '42501';
  END IF;

  UPDATE public.tours
  SET status = 'published', admin_hold_at = NULL, admin_hold_by = NULL, admin_hold_reason = NULL, updated_at = now()
  WHERE id = p_tour_id AND status = 'draft' AND admin_hold_at IS NOT NULL AND deleted_at IS NULL
  RETURNING organizer_id INTO v_organizer;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only tours unpublished by an admin can be re-published here' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_audit_logs (admin_profile_id, entity_type, entity_id, action, notes)
  VALUES (p_admin_profile_id, 'tour', p_tour_id, 'republish', 'Admin hold lifted');
  RETURN v_organizer;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Read-side aggregates (admin dashboard, finance page, users page)
-- -----------------------------------------------------------------------------
-- Bookings per Manila calendar month for the last p_months months (including the current one).
-- Revenue = total_amount of confirmed + completed bookings. Replaces a capped JS aggregation (§6 23c).
CREATE OR REPLACE FUNCTION public.admin_booking_stats(p_months integer DEFAULT 6)
RETURNS TABLE (
  month date, bookings bigint, revenue numeric,
  pending bigint, confirmed bigint, completed bigint, canceled bigint, refunded bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH months AS (
    SELECT (date_trunc('month', public.manila_today()::timestamp) - make_interval(months => g))::date AS month
    FROM generate_series(0, greatest(least(coalesce(p_months, 6), 36), 1) - 1) AS g
  ),
  b AS (
    SELECT date_trunc('month', (created_at AT TIME ZONE 'Asia/Manila'))::date AS month, status::text AS status, total_amount
    FROM public.bookings
    WHERE created_at >= ((SELECT min(month) FROM months)::timestamp AT TIME ZONE 'Asia/Manila')
  )
  SELECT m.month,
         count(b.status),
         coalesce(sum(b.total_amount) FILTER (WHERE b.status IN ('confirmed', 'completed')), 0),
         count(*) FILTER (WHERE b.status = 'pending'),
         count(*) FILTER (WHERE b.status = 'confirmed'),
         count(*) FILTER (WHERE b.status = 'completed'),
         count(*) FILTER (WHERE b.status = 'canceled'),
         count(*) FILTER (WHERE b.status = 'refunded')
  FROM months m
  LEFT JOIN b ON b.month = m.month
  GROUP BY m.month
  ORDER BY m.month
$$;

-- Finance overview for [p_from, p_to] (Manila dates, inclusive). Flows are ranged; balances are now.
--   gmv: PayMongo payments applied to bookings. platform_fees: fee_amount on escrow_deposit rows
--   (gross, before refunds). mdr: PayMongo fees on every payment. refunds: booking refunds that
--   succeeded + payment-review refunds.
CREATE OR REPLACE FUNCTION public.admin_finance_summary(p_from date, p_to date)
RETURNS TABLE (
  gmv numeric, payments_count bigint,
  platform_fees numeric,
  mdr numeric,
  refunds numeric, refunds_count bigint,
  escrow_liability numeric, available_liability numeric,
  pending_payouts numeric, pending_payouts_count bigint,
  needs_review_amount numeric, needs_review_count bigint,
  ledger_drift_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH r AS (
    SELECT (coalesce(p_from, '2000-01-01'::date)::timestamp AT TIME ZONE 'Asia/Manila') AS t0,
           ((coalesce(p_to, public.manila_today()) + 1)::timestamp AT TIME ZONE 'Asia/Manila') AS t1
  )
  SELECT
    (SELECT coalesce(sum(amount_centavos), 0) / 100.0 FROM public.booking_payments, r
      WHERE status = 'applied' AND created_at >= r.t0 AND created_at < r.t1),
    (SELECT count(*) FROM public.booking_payments, r
      WHERE status = 'applied' AND created_at >= r.t0 AND created_at < r.t1),
    (SELECT coalesce(sum(fee_amount), 0) FROM public.wallet_transactions, r
      WHERE type = 'escrow_deposit' AND created_at >= r.t0 AND created_at < r.t1),
    (SELECT coalesce(sum(fee_centavos), 0) / 100.0 FROM public.booking_payments, r
      WHERE created_at >= r.t0 AND created_at < r.t1),
    (SELECT coalesce(sum(amount), 0) FROM public.booking_refunds, r
      WHERE status = 'succeeded' AND updated_at >= r.t0 AND updated_at < r.t1)
      + (SELECT coalesce(sum(amount_centavos), 0) / 100.0 FROM public.booking_payments, r
      WHERE resolution = 'refunded' AND resolved_at >= r.t0 AND resolved_at < r.t1),
    (SELECT count(*) FROM public.booking_refunds, r
      WHERE status = 'succeeded' AND updated_at >= r.t0 AND updated_at < r.t1)
      + (SELECT count(*) FROM public.booking_payments, r
      WHERE resolution = 'refunded' AND resolved_at >= r.t0 AND resolved_at < r.t1),
    (SELECT coalesce(sum(escrow_balance), 0) FROM public.user_wallets),
    (SELECT coalesce(sum(available_balance), 0) FROM public.user_wallets),
    (SELECT coalesce(sum(amount), 0) FROM public.payout_requests WHERE status IN ('pending', 'processing')),
    (SELECT count(*) FROM public.payout_requests WHERE status IN ('pending', 'processing')),
    (SELECT coalesce(sum(amount_centavos), 0) / 100.0 FROM public.booking_payments
      WHERE status = 'needs_review' AND resolved_at IS NULL),
    (SELECT count(*) FROM public.booking_payments WHERE status = 'needs_review' AND resolved_at IS NULL),
    (SELECT count(*) FROM public.wallet_ledger_drift())
$$;

-- Suspension and sign-in info for a page of users (auth.users is not exposed through PostgREST).
-- plpgsql so the body is only resolved when called.
CREATE OR REPLACE FUNCTION public.admin_auth_user_status(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, banned_until timestamptz, last_sign_in_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT u.id, u.banned_until, u.last_sign_in_at
  FROM auth.users u
  WHERE u.id = ANY (p_user_ids);
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Privileges: everything above is service-role only.
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.is_admin_profile(uuid)',
    'public.begin_payment_review_refund(uuid, uuid)',
    'public.fail_payment_review_refund(uuid)',
    'public.resolve_payment_review(uuid, uuid, text, text, text)',
    'public.payout_requires_dual_approval(numeric)',
    'public.approve_payout(uuid, uuid)',
    'public.mark_payout_paid(uuid, uuid, text)',
    'public.admin_unpublish_tour(uuid, uuid, text)',
    'public.admin_republish_tour(uuid, uuid)',
    'public.admin_booking_stats(integer)',
    'public.admin_finance_summary(date, date)',
    'public.admin_auth_user_status(uuid[])'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END;
$$;
