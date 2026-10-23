-- =============================================================================
-- Phase 3.10: transport coordination (decision D2: no on-platform transport payments)
-- docs/MVP_LAUNCH_READINESS.md BIZ-23 (double booking), BIZ-24 (lifecycle), ENG-08 (Manila dates)
--
-- The database is the guard; the Server Actions only add friendlier messages:
--   * a vehicle can never hold two overlapping live 'booked'/'blocked' availability rows
--     (per-vehicle row lock + overlap check, so concurrent accepts/blocks serialize);
--   * a request cannot be sent (or edited) for a vehicle already booked/blocked on those dates;
--   * accepting a request inserts the 'booked' availability row in the same statement, so the
--     accept fails as a whole when the vehicle is taken, inactive, or the schedule is gone;
--   * declining, canceling or soft-deleting a request releases (soft-deletes) its booked row;
--   * a request can only be completed once the trip's end date (Manila) has been reached;
--   * end users cannot create, edit or delete 'booked' availability rows directly;
--   * a schedule's dates cannot change while it has an accepted transport booking.
--
-- Dates: availability rows are Manila calendar dates derived from pickup/return timestamps.
-- Idempotent: CREATE OR REPLACE / DROP … IF EXISTS. Tests: supabase/tests/rls/transport.test.mjs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helpers
-- -----------------------------------------------------------------------------

-- Calendar date of a timestamp in Asia/Manila (the business time zone; no DST).
CREATE OR REPLACE FUNCTION public.manila_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT (p_ts AT TIME ZONE 'Asia/Manila')::date
$$;

-- True when the vehicle has no live booked/blocked availability row overlapping [p_start, p_end].
-- p_exclude_id skips one availability row (the row being updated); p_exclude_booking skips rows
-- that belong to that transport booking.
CREATE OR REPLACE FUNCTION public.vehicle_is_free(
  p_vehicle_id uuid,
  p_start date,
  p_end date,
  p_exclude_id uuid DEFAULT NULL,
  p_exclude_booking uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.vehicle_availability va
    WHERE va.vehicle_id = p_vehicle_id
      AND va.deleted_at IS NULL
      AND va.status IN ('booked', 'blocked')
      AND va.start_date <= p_end
      AND va.end_date >= p_start
      AND (p_exclude_id IS NULL OR va.id <> p_exclude_id)
      AND (p_exclude_booking IS NULL OR va.transport_booking_id IS DISTINCT FROM p_exclude_booking)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.vehicle_is_free(uuid, date, date, uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Manila date range a transport booking occupies: pickup date to return date (or pickup date).
CREATE OR REPLACE FUNCTION public.transport_booking_start_date(p_pickup timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.manila_date(p_pickup)
$$;

CREATE OR REPLACE FUNCTION public.transport_booking_end_date(p_pickup timestamptz, p_return timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT public.manila_date(coalesce(p_return, p_pickup))
$$;

-- -----------------------------------------------------------------------------
-- 2. vehicle_availability: no overlaps, and 'booked' rows belong to the transport lifecycle
-- -----------------------------------------------------------------------------

-- End users (anon/authenticated through PostgREST) may only manage their own 'blocked' rows.
-- SECURITY INVOKER on purpose: is_end_user_request() must see the caller's real role.
CREATE OR REPLACE FUNCTION public.vehicle_availability_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_end_user_request() THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    IF OLD.status = 'booked' THEN
      RAISE EXCEPTION 'Booked dates are released by canceling or declining the transport request.'
        USING ERRCODE = '42501';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'booked' THEN
    RAISE EXCEPTION 'Booked dates are released by canceling or declining the transport request.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.status = 'booked' OR NEW.transport_booking_id IS NOT NULL THEN
    RAISE EXCEPTION 'Booked dates are created by accepting a transport request.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_availability_guard ON public.vehicle_availability;
CREATE TRIGGER vehicle_availability_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.vehicle_availability
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_availability_guard();

-- Overlap check for every writer (end users, service role, the accept trigger below).
-- The vehicle row lock serializes concurrent writers for the same vehicle, so two transactions
-- cannot both pass the check and commit overlapping rows.
CREATE OR REPLACE FUNCTION public.vehicle_availability_no_overlap()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.end_date < NEW.start_date THEN
    RAISE EXCEPTION 'The end date cannot be before the start date.' USING ERRCODE = '23514';
  END IF;

  IF NEW.deleted_at IS NOT NULL OR NEW.status NOT IN ('booked', 'blocked') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.vehicle_id IS NOT DISTINCT FROM OLD.vehicle_id
     AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
     AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND OLD.deleted_at IS NULL THEN
    RETURN NEW; -- nothing that affects occupancy changed
  END IF;

  PERFORM 1 FROM public.vehicles WHERE id = NEW.vehicle_id FOR UPDATE;

  IF NOT public.vehicle_is_free(NEW.vehicle_id, NEW.start_date, NEW.end_date, NEW.id, NULL) THEN
    RAISE EXCEPTION 'This vehicle is already booked or blocked for those dates.' USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vehicle_availability_no_overlap ON public.vehicle_availability;
CREATE TRIGGER vehicle_availability_no_overlap
  BEFORE INSERT OR UPDATE ON public.vehicle_availability
  FOR EACH ROW EXECUTE FUNCTION public.vehicle_availability_no_overlap();

CREATE INDEX IF NOT EXISTS idx_vehicle_availability_vehicle_dates
  ON public.vehicle_availability (vehicle_id, start_date, end_date)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vehicle_availability_transport_booking
  ON public.vehicle_availability (transport_booking_id)
  WHERE transport_booking_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. transport_bookings: conflict check on send/edit, accept prerequisites, completion date
-- Runs after transport_bookings_before_write (Phase 1 party/transition rules; triggers fire in
-- name order), for every writer.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transport_bookings_lifecycle_check()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_start date := public.transport_booking_start_date(NEW.pickup_datetime);
  v_end date := public.transport_booking_end_date(NEW.pickup_datetime, NEW.return_datetime);
  v_vehicle record;
  v_schedule record;
  v_trip_end date;
BEGIN
  IF NEW.return_datetime IS NOT NULL AND NEW.return_datetime < NEW.pickup_datetime THEN
    RAISE EXCEPTION 'The return time must be after the pickup time.' USING ERRCODE = '23514';
  END IF;

  -- Sending a request, or editing the vehicle/dates of a pending one: the vehicle must be free.
  IF NEW.status = 'pending' AND NEW.deleted_at IS NULL AND (
       TG_OP = 'INSERT'
       OR NEW.vehicle_id IS DISTINCT FROM OLD.vehicle_id
       OR NEW.pickup_datetime IS DISTINCT FROM OLD.pickup_datetime
       OR NEW.return_datetime IS DISTINCT FROM OLD.return_datetime
       OR OLD.status IS DISTINCT FROM 'pending'
     ) THEN
    IF NOT public.vehicle_is_free(NEW.vehicle_id, v_start, v_end, NULL, NEW.id) THEN
      RAISE EXCEPTION 'This vehicle is already booked or blocked for those dates.' USING ERRCODE = '23P01';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Accepting: the vehicle must still be active and the schedule still running. The booked
  -- availability row is inserted by transport_bookings_sync_availability (AFTER), whose overlap
  -- check makes the whole accept fail if the vehicle was taken in the meantime.
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' THEN
    SELECT status, deleted_at INTO v_vehicle FROM public.vehicles WHERE id = NEW.vehicle_id;
    IF NOT FOUND OR v_vehicle.deleted_at IS NOT NULL OR v_vehicle.status <> 'active' THEN
      RAISE EXCEPTION 'This vehicle is not active. Reactivate it before accepting the request.'
        USING ERRCODE = '55000';
    END IF;
    SELECT status::text AS status, deleted_at INTO v_schedule
    FROM public.tour_schedules WHERE id = NEW.tour_schedule_id;
    IF NOT FOUND OR v_schedule.deleted_at IS NOT NULL OR v_schedule.status = 'cancelled' THEN
      RAISE EXCEPTION 'This tour schedule was cancelled, so the request can no longer be accepted.'
        USING ERRCODE = '55000';
    END IF;
  END IF;

  -- Completing: only an accepted trip, and only once its end date (Manila) has been reached.
  -- The trip ends on the later of the schedule's end date and the transport's return date.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    IF OLD.status IS DISTINCT FROM 'accepted' THEN
      RAISE EXCEPTION 'Only an accepted transport booking can be completed.' USING ERRCODE = '55000';
    END IF;
    SELECT greatest(ts.end_date, v_end) INTO v_trip_end
    FROM public.tour_schedules ts WHERE ts.id = NEW.tour_schedule_id;
    v_trip_end := coalesce(v_trip_end, v_end);
    IF public.manila_today() < v_trip_end THEN
      RAISE EXCEPTION 'This trip can be marked complete from % (its end date).', to_char(v_trip_end, 'YYYY-MM-DD')
        USING ERRCODE = '55000';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transport_bookings_lifecycle_check ON public.transport_bookings;
CREATE TRIGGER transport_bookings_lifecycle_check
  BEFORE INSERT OR UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.transport_bookings_lifecycle_check();

-- Keeps the vehicle calendar in step with the request: accept books it, decline/cancel/delete
-- releases it. Same statement (and transaction) as the status change.
CREATE OR REPLACE FUNCTION public.transport_bookings_sync_availability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM 'accepted' AND NEW.deleted_at IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.vehicle_availability
      WHERE transport_booking_id = NEW.id AND deleted_at IS NULL AND status = 'booked'
    ) THEN
      INSERT INTO public.vehicle_availability (vehicle_id, start_date, end_date, status, transport_booking_id, notes)
      VALUES (
        NEW.vehicle_id,
        public.transport_booking_start_date(NEW.pickup_datetime),
        public.transport_booking_end_date(NEW.pickup_datetime, NEW.return_datetime),
        'booked',
        NEW.id,
        'Booked for transport request #' || left(NEW.id::text, 8)
      );
    END IF;
  END IF;

  IF (NEW.status IN ('declined', 'canceled') AND OLD.status IS DISTINCT FROM NEW.status)
     OR (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL) THEN
    UPDATE public.vehicle_availability
    SET deleted_at = now()
    WHERE transport_booking_id = NEW.id AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS transport_bookings_sync_availability ON public.transport_bookings;
CREATE TRIGGER transport_bookings_sync_availability
  AFTER UPDATE ON public.transport_bookings
  FOR EACH ROW EXECUTE FUNCTION public.transport_bookings_sync_availability();

-- -----------------------------------------------------------------------------
-- 4. tour_schedules: dates are frozen while transport is confirmed
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tour_schedules_guard_transport_dates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.start_date IS DISTINCT FROM OLD.start_date OR NEW.end_date IS DISTINCT FROM OLD.end_date)
     AND EXISTS (
       SELECT 1 FROM public.transport_bookings tb
       WHERE tb.tour_schedule_id = NEW.id AND tb.status = 'accepted' AND tb.deleted_at IS NULL
     ) THEN
    RAISE EXCEPTION 'This schedule has a confirmed transport booking. Cancel the transport request before changing the dates.'
      USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tour_schedules_guard_transport_dates ON public.tour_schedules;
CREATE TRIGGER tour_schedules_guard_transport_dates
  BEFORE UPDATE ON public.tour_schedules
  FOR EACH ROW EXECUTE FUNCTION public.tour_schedules_guard_transport_dates();
