-- =============================================================================
-- Phase 1: database security hardening
-- docs/MVP_LAUNCH_READINESS.md §5 Phase 1 (SEC-01…05, SEC-13, SEC-14, SEC-17, SEC-20, FIN-13)
--
-- The anon key is public, so every RLS policy is effectively a public API. This migration:
--   * removes the self-service paths to admin, booking, payout, transport and review forgery;
--   * makes server-owned columns (statuses, prices, ratings, verification stamps) read-only for
--     end users via BEFORE triggers ("end user" = the anon/authenticated roles PostgREST uses);
--   * runs the seat-count and booking-ref triggers with definer rights so they work for travelers;
--   * locks wallet/ledger functions to the service role and adds balance/ledger invariants;
--   * restricts what the anonymous role can read, and confines uploads to the uploader's folder.
--
-- Idempotent and safe to re-run (DROP … IF EXISTS / CREATE OR REPLACE / guarded DO blocks).
-- Test: the RLS harness in supabase/tests/rls (npm run test:rls) replays all migrations locally.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Missing columns the app already uses (exist in the live DB, never migrated; §4.7)
-- -----------------------------------------------------------------------------
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS paymongo_session_id text;
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS latitude double precision;
ALTER TABLE public.tours ADD COLUMN IF NOT EXISTS longitude double precision;

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- True when the statement comes from an end user through PostgREST (not the service role,
-- not a definer function, not pg_cron). Must stay SECURITY INVOKER to see the real role.
CREATE OR REPLACE FUNCTION public.is_end_user_request()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT current_user IN ('anon', 'authenticated')
$$;

CREATE OR REPLACE FUNCTION public.current_user_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT id FROM public.user_profiles WHERE user_id = auth.uid() AND deleted_at IS NULL LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_organizer_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT op.id
  FROM public.organizer_profiles op
  JOIN public.user_profiles up ON up.id = op.user_profile_id
  WHERE up.user_id = auth.uid() AND op.deleted_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_transporter_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT tp.id
  FROM public.transporter_profiles tp
  JOIN public.user_profiles up ON up.id = tp.user_profile_id
  WHERE up.user_id = auth.uid() AND tp.deleted_at IS NULL
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.auth_user_email()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT email FROM auth.users WHERE id = auth.uid()
$$;

-- Generic guard: end users may not change the listed columns (TG_ARGV) on UPDATE.
CREATE OR REPLACE FUNCTION public.guard_readonly_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  col text;
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    IF (to_jsonb(NEW) -> col) IS DISTINCT FROM (to_jsonb(OLD) -> col) THEN
      RAISE EXCEPTION 'Column %.% can only be changed by the server', TG_TABLE_NAME, col
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Roles: no self-granted roles (SEC-01)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow users to insert their own roles" ON public.user_roles;

-- The only way for a user to add a role to themselves. Admin can never be self-assigned.
CREATE OR REPLACE FUNCTION public.assign_self_role(p_role text, p_website_id uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
  v_role_id uuid;
BEGIN
  IF p_role NOT IN ('traveler', 'organizer', 'transporter') THEN
    RAISE EXCEPTION 'Role % cannot be self-assigned', p_role USING ERRCODE = '42501';
  END IF;

  v_profile_id := public.current_user_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'User profile not found' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_role_id
  FROM public.website_roles
  WHERE role::text = p_role
    AND (p_website_id IS NULL OR website_id = p_website_id)
  ORDER BY created_at
  LIMIT 1;

  IF v_role_id IS NULL THEN
    RAISE EXCEPTION 'Unknown role %', p_role;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_profile_id = v_profile_id AND website_role_id = v_role_id
  ) THEN
    INSERT INTO public.user_roles (user_profile_id, website_role_id) VALUES (v_profile_id, v_role_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_self_role(text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assign_self_role(text, uuid) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 3. user_profiles: server-owned identity columns (SEC-05)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_profiles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    -- Email comes from the authenticated account, never from the client (ADMIN_EMAIL spoofing).
    NEW.email := coalesce(public.auth_user_email(), NEW.email);
    NEW.email_verified_at := NULL;
    NEW.phone_verified_at := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_profiles_before_insert ON public.user_profiles;
CREATE TRIGGER user_profiles_before_insert
  BEFORE INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_before_insert();

DROP TRIGGER IF EXISTS user_profiles_guard_columns ON public.user_profiles;
CREATE TRIGGER user_profiles_guard_columns
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'user_id', 'email', 'phone', 'email_verified_at', 'phone_verified_at', 'deleted_at'
  );

-- -----------------------------------------------------------------------------
-- 4. Partner profiles: approval status and ratings are server-owned (SEC-05)
-- -----------------------------------------------------------------------------
-- Partner approval policy lives here. Today partners are auto-approved (product decision, see
-- BIZ-06); switch 'approved' to 'pending' in both functions when admin approval goes live.
CREATE OR REPLACE FUNCTION public.organizer_profiles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.status := 'approved';
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizer_profiles_before_insert ON public.organizer_profiles;
CREATE TRIGGER organizer_profiles_before_insert
  BEFORE INSERT ON public.organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.organizer_profiles_before_insert();

DROP TRIGGER IF EXISTS organizer_profiles_guard_columns ON public.organizer_profiles;
CREATE TRIGGER organizer_profiles_guard_columns
  BEFORE UPDATE ON public.organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns('user_profile_id', 'status', 'deleted_at');

CREATE OR REPLACE FUNCTION public.transporter_profiles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.status := 'approved';
    NEW.average_rating := 0;
    NEW.review_count := 0;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transporter_profiles_before_insert ON public.transporter_profiles;
CREATE TRIGGER transporter_profiles_before_insert
  BEFORE INSERT ON public.transporter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.transporter_profiles_before_insert();

DROP TRIGGER IF EXISTS transporter_profiles_guard_columns ON public.transporter_profiles;
CREATE TRIGGER transporter_profiles_guard_columns
  BEFORE UPDATE ON public.transporter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'user_profile_id', 'status', 'average_rating', 'review_count', 'deleted_at'
  );

-- -----------------------------------------------------------------------------
-- 5. Bookings: travelers create pending, server-priced bookings and change nothing after (SEC-02, BIZ-01)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Traveler update own bookings" ON public.bookings;

DROP POLICY IF EXISTS "Traveler insert own bookings" ON public.bookings;
CREATE POLICY "Traveler insert own bookings" ON public.bookings
  FOR INSERT
  WITH CHECK (traveler_id = public.current_user_profile_id());

-- Server-side price and bookability. Same formula as lib/services/bookings.ts.
CREATE OR REPLACE FUNCTION public.booking_quote(p_schedule_id uuid, p_seats integer)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule record;
BEGIN
  SELECT ts.status::text AS schedule_status, ts.deleted_at AS schedule_deleted_at, ts.start_date,
         ts.price_per_person AS schedule_price,
         t.status::text AS tour_status, t.deleted_at AS tour_deleted_at, t.price_per_person AS tour_price
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

  IF coalesce(v_schedule.schedule_price, v_schedule.tour_price) IS NULL THEN
    RAISE EXCEPTION 'Price not configured.' USING ERRCODE = 'P0001';
  END IF;

  RETURN coalesce(v_schedule.schedule_price, v_schedule.tour_price) * p_seats;
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
  IF public.is_end_user_request() THEN
    NEW.total_amount := public.booking_quote(NEW.tour_schedule_id, NEW.seats);
    NEW.status := 'pending';
    NEW.dispute_status := 'none';
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

-- The seat-count trigger updates tour_schedules, which travelers cannot update. Run it (and the
-- booking-ref generator, which must see every booking to stay unique) with definer rights.
ALTER FUNCTION public.update_tour_schedule_booked_count() SECURITY DEFINER SET search_path = public, pg_temp;
ALTER FUNCTION public.generate_booking_ref() SECURITY DEFINER SET search_path = public, pg_temp;

-- Paid bookings must never disappear with their schedule or traveler (SEC-14).
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%ON DELETE CASCADE%'
  LOOP
    EXECUTE format('ALTER TABLE public.bookings DROP CONSTRAINT %I', fk.conname);
    EXECUTE format(
      'ALTER TABLE public.bookings ADD CONSTRAINT %I %s',
      fk.conname,
      replace(fk.def, 'ON DELETE CASCADE', 'ON DELETE RESTRICT')
    );
  END LOOP;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Tours and schedules: no hard deletes, seat counts are trigger-owned (SEC-14)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "organizer manage own tours" ON public.tours;
DROP POLICY IF EXISTS "organizer read own tours" ON public.tours;
DROP POLICY IF EXISTS "organizer insert own tours" ON public.tours;
DROP POLICY IF EXISTS "organizer update own tours" ON public.tours;

CREATE POLICY "organizer read own tours" ON public.tours
  FOR SELECT USING (organizer_id = public.current_organizer_profile_id());
CREATE POLICY "organizer insert own tours" ON public.tours
  FOR INSERT WITH CHECK (organizer_id = public.current_organizer_profile_id());
CREATE POLICY "organizer update own tours" ON public.tours
  FOR UPDATE USING (organizer_id = public.current_organizer_profile_id())
  WITH CHECK (organizer_id = public.current_organizer_profile_id());

DROP POLICY IF EXISTS "Organizers can delete own tour_schedules" ON public.tour_schedules;

CREATE OR REPLACE FUNCTION public.tour_schedules_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.booked_count := 0;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tour_schedules_before_insert ON public.tour_schedules;
CREATE TRIGGER tour_schedules_before_insert
  BEFORE INSERT ON public.tour_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tour_schedules_before_insert();

DROP TRIGGER IF EXISTS tour_schedules_guard_columns ON public.tour_schedules;
CREATE TRIGGER tour_schedules_guard_columns
  BEFORE UPDATE ON public.tour_schedules
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns('tour_id', 'booked_count');

DROP TRIGGER IF EXISTS tours_guard_columns ON public.tours;
CREATE TRIGGER tours_guard_columns
  BEFORE UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns('organizer_id', 'slug');

-- -----------------------------------------------------------------------------
-- 7. Transport bookings: requests only, prices and acceptance are not forgeable (SEC-03)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Transporters can view and update their bookings" ON public.transport_bookings;
DROP POLICY IF EXISTS "Organizers can create and view their transport bookings" ON public.transport_bookings;
DROP POLICY IF EXISTS "Parties read own transport bookings" ON public.transport_bookings;
DROP POLICY IF EXISTS "Organizers create transport requests" ON public.transport_bookings;
DROP POLICY IF EXISTS "Parties update own transport bookings" ON public.transport_bookings;

CREATE POLICY "Parties read own transport bookings" ON public.transport_bookings
  FOR SELECT USING (
    organizer_id = public.current_organizer_profile_id()
    OR transporter_id = public.current_transporter_profile_id()
  );

CREATE POLICY "Organizers create transport requests" ON public.transport_bookings
  FOR INSERT WITH CHECK (organizer_id = public.current_organizer_profile_id());

CREATE POLICY "Parties update own transport bookings" ON public.transport_bookings
  FOR UPDATE USING (
    organizer_id = public.current_organizer_profile_id()
    OR transporter_id = public.current_transporter_profile_id()
  );

-- The schedule must belong to the organizer, and the vehicle to the transporter.
CREATE OR REPLACE FUNCTION public.transport_request_is_valid(
  p_schedule_id uuid, p_organizer_id uuid, p_transporter_id uuid, p_vehicle_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tour_schedules ts
    JOIN public.tours t ON t.id = ts.tour_id
    WHERE ts.id = p_schedule_id AND t.organizer_id = p_organizer_id AND ts.deleted_at IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.vehicles v
    WHERE v.id = p_vehicle_id AND v.transporter_id = p_transporter_id
      AND v.deleted_at IS NULL AND v.status = 'active'
  )
$$;

CREATE OR REPLACE FUNCTION public.transport_bookings_before_write()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_transporter boolean;
  v_is_organizer boolean;
  v_changed text[];
  v_allowed text[];
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status := 'pending';
    NEW.estimated_price := NULL;
    NEW.deleted_at := NULL;
    IF NOT public.transport_request_is_valid(NEW.tour_schedule_id, NEW.organizer_id, NEW.transporter_id, NEW.vehicle_id) THEN
      RAISE EXCEPTION 'Invalid transport request: schedule or vehicle does not match.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  -- coalesce: a NULL profile id must mean "not this party", not unknown (NOT NULL is NULL).
  v_is_transporter := coalesce(OLD.transporter_id = public.current_transporter_profile_id(), false);
  v_is_organizer := coalesce(OLD.organizer_id = public.current_organizer_profile_id(), false);

  SELECT coalesce(array_agg(n.key), '{}')
  INTO v_changed
  FROM jsonb_each(to_jsonb(NEW)) n
  JOIN jsonb_each(to_jsonb(OLD)) o ON o.key = n.key
  WHERE n.value IS DISTINCT FROM o.value AND n.key <> 'updated_at';

  IF v_is_transporter AND NOT v_is_organizer THEN
    -- Transporters only respond to requests and mark accepted trips done.
    IF v_changed <> '{}' AND NOT (v_changed <@ ARRAY['status']) THEN
      RAISE EXCEPTION 'Transporters can only change the request status' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
         (OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined'))
      OR (OLD.status = 'accepted' AND NEW.status = 'completed')
    ) THEN
      RAISE EXCEPTION 'Invalid transport status change % -> %', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF v_is_organizer THEN
    -- Organizers may edit a pending request or cancel; they can never accept on the transporter's behalf.
    v_allowed := ARRAY['status'];
    IF OLD.status = 'pending' THEN
      v_allowed := v_allowed || ARRAY['vehicle_id', 'transporter_id', 'pickup_location', 'dropoff_location',
                                      'pickup_datetime', 'return_datetime', 'seats_required'];
    END IF;
    IF NOT (v_changed <@ v_allowed) THEN
      RAISE EXCEPTION 'This transport request can no longer be edited' USING ERRCODE = '42501';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status AND NOT (
      OLD.status IN ('pending', 'accepted') AND NEW.status = 'canceled'
    ) THEN
      RAISE EXCEPTION 'Invalid transport status change % -> %', OLD.status, NEW.status USING ERRCODE = '42501';
    END IF;
    IF NOT public.transport_request_is_valid(NEW.tour_schedule_id, NEW.organizer_id, NEW.transporter_id, NEW.vehicle_id) THEN
      RAISE EXCEPTION 'Invalid transport request: schedule or vehicle does not match.' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Not a party to this transport request' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS transport_bookings_before_write ON public.transport_bookings;
CREATE TRIGGER transport_bookings_before_write
  BEFORE INSERT OR UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.transport_bookings_before_write();

-- -----------------------------------------------------------------------------
-- 8. Money: payouts and ledger are server-only (SEC-04, FIN-13)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "User insert own payout requests" ON public.payout_requests;

REVOKE EXECUTE ON FUNCTION public.ensure_user_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_escrow_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_available_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_user_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_escrow_balance(uuid, numeric) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_available_balance(uuid, numeric) TO service_role;

DO $$
BEGIN
  IF to_regprocedure('public.expire_pending_bookings()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.expire_pending_bookings() FROM PUBLIC, anon, authenticated;
  END IF;
END;
$$;

-- Balances can never go negative. NOT VALID: enforced for every new write without failing on
-- historical rows; run VALIDATE CONSTRAINT after the Phase 2 reconciliation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_wallets_balances_non_negative') THEN
    ALTER TABLE public.user_wallets
      ADD CONSTRAINT user_wallets_balances_non_negative
      CHECK (available_balance >= 0 AND escrow_balance >= 0) NOT VALID;
  END IF;
END;
$$;

-- One ledger row per (wallet, reference, type): makes every ledger write idempotent at the DB level.
-- Skipped with a notice if historical duplicates exist; Phase 2 reconciliation must clean them first.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'wallet_transactions_reference_unique') THEN
    IF EXISTS (
      SELECT 1 FROM public.wallet_transactions
      GROUP BY wallet_id, reference_type, reference_id, type
      HAVING count(*) > 1
    ) THEN
      RAISE NOTICE 'wallet_transactions has duplicate (wallet, reference, type) rows; unique index NOT created';
    ELSE
      CREATE UNIQUE INDEX wallet_transactions_reference_unique
        ON public.wallet_transactions (wallet_id, reference_type, reference_id, type);
    END IF;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 9. Reviews and notifications (SEC-05)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviewers insert pending reviews" ON public.reviews;
CREATE POLICY "Reviewers insert pending reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_profile_id = public.current_user_profile_id()
    AND status = 'pending'
  );

-- Notifications are created by the server (service role) only; users may only mark them read.
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

DROP TRIGGER IF EXISTS notifications_guard_columns ON public.notifications;
CREATE TRIGGER notifications_guard_columns
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'user_id', 'type', 'title', 'message', 'link', 'created_at'
  );

-- -----------------------------------------------------------------------------
-- 10. Anonymous reads: only what public pages need (SEC-13, partial)
-- Signed-in users keep table-wide SELECT (owners read their own rows with select('*')).
-- -----------------------------------------------------------------------------
REVOKE SELECT ON public.organizer_profiles FROM anon;
GRANT SELECT (id, organizer_type, company_name, display_name, description, status, deleted_at, created_at)
  ON public.organizer_profiles TO anon;

REVOKE SELECT ON public.transporter_profiles FROM anon;
GRANT SELECT (id, transporter_type, company_name, display_name, description, service_areas, status,
              average_rating, review_count, deleted_at, created_at)
  ON public.transporter_profiles TO anon;

REVOKE SELECT ON public.vehicles FROM anon;
GRANT SELECT (id, transporter_id, name, vehicle_type, seat_capacity, description, rate_per_day, photos,
              status, deleted_at, created_at)
  ON public.vehicles TO anon;

REVOKE SELECT ON public.vehicle_availability FROM anon;

-- -----------------------------------------------------------------------------
-- 11. Storage: images only, size-limited, each user writes only inside their own folder (SEC-17)
-- -----------------------------------------------------------------------------
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'],
    file_size_limit = 10485760
WHERE id = 'tour-images';

DROP POLICY IF EXISTS "Authenticated users can upload tour-images" ON storage.objects;
DROP POLICY IF EXISTS "Users upload tour-images to own folder" ON storage.objects;
CREATE POLICY "Users upload tour-images to own folder" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tour-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 12. Function hygiene (SEC-20)
-- -----------------------------------------------------------------------------
ALTER FUNCTION public.is_organizer_for_traveler(uuid) SET search_path = public, pg_temp;
