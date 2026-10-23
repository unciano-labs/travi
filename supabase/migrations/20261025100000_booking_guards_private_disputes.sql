-- =============================================================================
-- Phase 3.1 / 3.2 / 3.7: booking guards, private tours (decision D3), capacity edits, schedule
-- cancellation, dispute reasons.
-- docs/MVP_LAUNCH_READINESS.md: BIZ-01, BIZ-04, BIZ-05, BIZ-17, BIZ-19.
--
--   * D3 / BIZ-05: a booking on a `private`-format tour books the WHOLE group. Its seats are forced
--     to the schedule capacity and it is priced per person x capacity (booking_quote()).
--   * BIZ-19: every booking stores the seats it consumes (`seats_consumed`, set on insert). The
--     seat-count trigger adds and removes exactly that number, so later capacity edits can no longer
--     corrupt `tour_schedules.booked_count` (the old trigger re-read the CURRENT capacity for private
--     bookings). Existing rows are backfilled and booked_count is reconciled once.
--   * BIZ-04: a payment that arrives for a booking on a cancelled schedule is never applied; it is
--     recorded for refund (`booking_closed_needs_refund`) instead of reviving the booking.
--   * BIZ-17: disputes carry a reason (20-2000 chars) and an opened-at timestamp.
--
-- Requires 20261023090000_rls_hardening.sql and 20261023120000_money_integrity.sql. Idempotent.
-- Tests: supabase/tests/rls/bookings.test.mjs (npm run test:rls).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. New booking columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS seats_consumed integer;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dispute_reason text;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS dispute_opened_at timestamptz;

COMMENT ON COLUMN public.bookings.seats_consumed IS
  'Seats this booking takes from tour_schedules.booked_count while it is pending/confirmed/completed. Set on insert (= seats; private bookings have seats = capacity). Server-owned.';
COMMENT ON COLUMN public.bookings.dispute_reason IS 'Traveler''s reason for the dispute (open_booking_dispute()).';

-- Backfill BEFORE the seat-count trigger below starts reacting to seats_consumed: the trigger still
-- installed at this point ignores the column, so this UPDATE does not move any counts.
-- Private bookings used to consume the schedule's whole capacity; joiner/solo bookings their seats.
UPDATE public.bookings b
SET seats_consumed = CASE WHEN t.format::text = 'private' THEN greatest(ts.capacity, 1) ELSE b.seats END
FROM public.tour_schedules ts
JOIN public.tours t ON t.id = ts.tour_id
WHERE ts.id = b.tour_schedule_id
  AND b.seats_consumed IS NULL;

-- Orphans (should not exist: the FK is RESTRICT) fall back to their seats.
UPDATE public.bookings SET seats_consumed = seats WHERE seats_consumed IS NULL;

ALTER TABLE public.bookings ALTER COLUMN seats_consumed SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_seats_consumed_positive'
                 AND conrelid = 'public.bookings'::regclass) THEN
    ALTER TABLE public.bookings ADD CONSTRAINT bookings_seats_consumed_positive CHECK (seats_consumed > 0);
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Seat accounting on seats_consumed (BIZ-19)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_tour_schedule_booked_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status::text IN ('pending', 'confirmed', 'completed') THEN
      UPDATE public.tour_schedules SET booked_count = booked_count + NEW.seats_consumed
      WHERE id = NEW.tour_schedule_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       OR NEW.seats_consumed IS DISTINCT FROM OLD.seats_consumed
       OR NEW.tour_schedule_id IS DISTINCT FROM OLD.tour_schedule_id THEN
      IF OLD.status::text IN ('pending', 'confirmed', 'completed') THEN
        UPDATE public.tour_schedules SET booked_count = booked_count - OLD.seats_consumed
        WHERE id = OLD.tour_schedule_id;
      END IF;
      IF NEW.status::text IN ('pending', 'confirmed', 'completed') THEN
        UPDATE public.tour_schedules SET booked_count = booked_count + NEW.seats_consumed
        WHERE id = NEW.tour_schedule_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status::text IN ('pending', 'confirmed', 'completed') THEN
      UPDATE public.tour_schedules SET booked_count = booked_count - OLD.seats_consumed
      WHERE id = OLD.tour_schedule_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

-- One-time reconciliation: booked_count = seats consumed by active bookings. Schedules whose true
-- count would exceed capacity (only possible after an old capacity edit) are left alone and reported.
DO $$
DECLARE
  v_fixed integer;
  v_over integer;
BEGIN
  WITH actual AS (
    SELECT ts.id, ts.capacity, ts.booked_count,
           coalesce(sum(b.seats_consumed) FILTER (WHERE b.status::text IN ('pending', 'confirmed', 'completed')), 0)::integer AS n
    FROM public.tour_schedules ts
    LEFT JOIN public.bookings b ON b.tour_schedule_id = ts.id
    GROUP BY ts.id
  ), fixed AS (
    UPDATE public.tour_schedules ts SET booked_count = a.n
    FROM actual a
    WHERE a.id = ts.id AND a.booked_count <> a.n AND a.n <= a.capacity
    RETURNING ts.id
  )
  SELECT count(*) INTO v_fixed FROM fixed;

  SELECT count(*) INTO v_over
  FROM (
    SELECT ts.id
    FROM public.tour_schedules ts
    JOIN public.bookings b ON b.tour_schedule_id = ts.id AND b.status::text IN ('pending', 'confirmed', 'completed')
    GROUP BY ts.id, ts.capacity
    HAVING sum(b.seats_consumed) > ts.capacity
  ) over_capacity;

  RAISE NOTICE 'booked_count reconciled on % schedule(s); % schedule(s) over capacity need manual review', v_fixed, v_over;
END;
$$;

-- -----------------------------------------------------------------------------
-- 3. Private tours (D3, BIZ-05) and server-side bookability (BIZ-01)
-- -----------------------------------------------------------------------------
-- Seats a booking request really takes: the whole capacity for a private tour, else what was asked.
CREATE OR REPLACE FUNCTION public.booking_seats(p_schedule_id uuid, p_seats integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN t.format::text = 'private' THEN ts.capacity ELSE p_seats END
  FROM public.tour_schedules ts
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE ts.id = p_schedule_id
$$;

REVOKE ALL ON FUNCTION public.booking_seats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_seats(uuid, integer) TO authenticated, service_role;

-- Server-side price and bookability. Same formula as lib/services/bookings.ts.
-- Private: per-person price x capacity, whatever p_seats says, and only while nobody holds the date.
CREATE OR REPLACE FUNCTION public.booking_quote(p_schedule_id uuid, p_seats integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule record;
  v_price numeric;
BEGIN
  SELECT ts.status::text AS schedule_status, ts.deleted_at AS schedule_deleted_at, ts.start_date,
         ts.capacity, ts.booked_count, ts.price_per_person AS schedule_price,
         t.status::text AS tour_status, t.deleted_at AS tour_deleted_at, t.price_per_person AS tour_price,
         t.format::text AS tour_format
  INTO v_schedule
  FROM public.tour_schedules ts
  JOIN public.tours t ON t.id = ts.tour_id
  WHERE ts.id = p_schedule_id;

  IF NOT FOUND
     OR v_schedule.schedule_deleted_at IS NOT NULL
     OR v_schedule.tour_deleted_at IS NOT NULL
     OR v_schedule.tour_status <> 'published' THEN
    RAISE EXCEPTION 'This tour is not available for booking.' USING ERRCODE = 'P0001';
  END IF;

  IF v_schedule.schedule_status <> 'open' THEN
    RAISE EXCEPTION 'This schedule is not open for booking.' USING ERRCODE = 'P0001';
  END IF;

  IF v_schedule.start_date <= (now() AT TIME ZONE 'Asia/Manila')::date THEN
    RAISE EXCEPTION 'This schedule has already started.' USING ERRCODE = 'P0001';
  END IF;

  IF p_seats IS NULL OR p_seats < 1 THEN
    RAISE EXCEPTION 'Invalid number of seats.' USING ERRCODE = 'P0001';
  END IF;

  v_price := coalesce(v_schedule.schedule_price, v_schedule.tour_price);
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'Price not configured.' USING ERRCODE = 'P0001';
  END IF;

  IF v_schedule.tour_format = 'private' THEN
    IF coalesce(v_schedule.booked_count, 0) > 0 THEN
      RAISE EXCEPTION 'This private tour date is already booked.' USING ERRCODE = 'P0001';
    END IF;
    RETURN v_price * v_schedule.capacity;
  END IF;

  -- Friendly pre-check; check_capacity_not_exceeded stays the real guard under concurrency.
  IF p_seats > v_schedule.capacity - coalesce(v_schedule.booked_count, 0) THEN
    RAISE EXCEPTION 'Not enough seats available.' USING ERRCODE = 'P0001';
  END IF;

  RETURN v_price * p_seats;
END;
$$;

REVOKE ALL ON FUNCTION public.booking_quote(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bookings_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- D3: a private booking always books the whole group (every caller, service role included).
  NEW.seats := coalesce(public.booking_seats(NEW.tour_schedule_id, NEW.seats), NEW.seats);
  NEW.seats_consumed := NEW.seats;

  IF public.is_end_user_request() THEN
    NEW.total_amount := public.booking_quote(NEW.tour_schedule_id, NEW.seats);
    NEW.status := 'pending';
    NEW.dispute_status := 'none';
    NEW.dispute_reason := NULL;
    NEW.dispute_opened_at := NULL;
    NEW.paymongo_session_id := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bookings_before_insert ON public.bookings;
CREATE TRIGGER bookings_before_insert
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.bookings_before_insert();

-- -----------------------------------------------------------------------------
-- 4. Payments for bookings on a cancelled schedule are never applied (BIZ-04)
-- Same as 20261023120000 except the cancelled-schedule check.
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
  SELECT b.*, ts.start_date, ts.status::text AS schedule_status, ts.deleted_at AS schedule_deleted_at
  INTO v_booking
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
  ELSIF v_booking.schedule_status = 'cancelled' OR v_booking.schedule_deleted_at IS NOT NULL THEN
    -- The organizer cancelled the date (or it was removed) before the money arrived.
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

REVOKE ALL ON FUNCTION public.confirm_booking_payment(uuid, text, text, bigint, bigint, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_booking_payment(uuid, text, text, bigint, bigint, text) TO service_role;

-- An organizer cannot cancel or soft-delete a schedule that still holds pending or paid bookings
-- straight through the API: that would strand the travelers' money. actions/schedules.ts
-- cancelSchedule() does it with the service role and refunds/cancels every booking (BIZ-04).
CREATE OR REPLACE FUNCTION public.tour_schedules_guard_cancel()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request()
     AND ((NEW.status::text = 'cancelled' AND OLD.status::text <> 'cancelled')
          OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL))
     AND EXISTS (SELECT 1 FROM public.bookings b
                 WHERE b.tour_schedule_id = NEW.id AND b.status::text IN ('pending', 'confirmed')) THEN
    RAISE EXCEPTION 'This schedule has active bookings. Use "Cancel schedule" so travelers are refunded.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tour_schedules_guard_cancel ON public.tour_schedules;
CREATE TRIGGER tour_schedules_guard_cancel
  BEFORE UPDATE ON public.tour_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tour_schedules_guard_cancel();

-- -----------------------------------------------------------------------------
-- 5. Disputes with a reason (BIZ-17). The two-argument version is replaced (callers updated).
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.open_booking_dispute(uuid, uuid);

CREATE OR REPLACE FUNCTION public.open_booking_dispute(p_booking_id uuid, p_traveler_profile_id uuid, p_reason text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
  v_holding integer;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  IF char_length(v_reason) < 20 OR char_length(v_reason) > 2000 THEN
    RAISE EXCEPTION 'Please describe the problem in 20 to 2000 characters.' USING ERRCODE = 'P0001';
  END IF;

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

  UPDATE public.bookings
  SET dispute_status = 'open', dispute_reason = v_reason, dispute_opened_at = now(), updated_at = now()
  WHERE id = p_booking_id;
  RETURN 'open';
END;
$$;

REVOKE ALL ON FUNCTION public.open_booking_dispute(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.open_booking_dispute(uuid, uuid, text) TO service_role;
