-- =============================================================================
-- Phase 3.3 Partner approval & KYC, 3.9 Publish rules, SEC-13 signed-in PII
-- docs/MVP_LAUNCH_READINESS.md: BIZ-06, BIZ-07, BIZ-08, BIZ-09, LEG-06, LEG-09, SEC-13
--
--   1. New partner profiles start 'pending' (admin approval). Existing approved partners stay approved.
--   2. KYC columns on partner profiles; identity fields are fill-once after approval, and editing them
--      after a rejection puts the application back to 'pending' (resubmission).
--   3. Company-type partners need a company name (CHECK, NOT VALID: enforced for new writes).
--   4. Only approved organizers can publish a tour; only approved transporters can be requested.
--   5. partner_documents table + private 'partner-documents' storage bucket for KYC uploads.
--   6. SEC-13: partner profiles, vehicles and availability are owner/admin-only base tables for
--      signed-in users; public-safe columns go through definer views (public_organizer_profiles,
--      public_transporter_profiles, public_vehicles). Contact details (phone, account email, plate)
--      are shown only to the counterparty of an accepted transport booking. Organizers read their
--      travelers through organizer_traveler_contacts() (name always, email only with a confirmed
--      or completed booking). Vehicle discovery is the available_vehicles() RPC.
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS). Tests: supabase/tests/rls/partners.test.mjs
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Helpers
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.id = ur.user_profile_id
    JOIN public.website_roles wr ON wr.id = ur.website_role_id
    WHERE up.user_id = auth.uid() AND wr.role::text = 'admin'
  )
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.organizer_is_approved(p_organizer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organizer_profiles
    WHERE id = p_organizer_id AND status = 'approved' AND deleted_at IS NULL
  )
$$;

CREATE OR REPLACE FUNCTION public.transporter_is_approved(p_transporter_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transporter_profiles
    WHERE id = p_transporter_id AND status = 'approved' AND deleted_at IS NULL
  )
$$;

-- Counterparties of a transport booking (the caller is the other side). p_confirmed_only: only
-- accepted/completed bookings, which is when contact details are shared.
CREATE OR REPLACE FUNCTION public.is_transport_counterparty_of_organizer(p_organizer_id uuid, p_confirmed_only boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.organizer_id = p_organizer_id
      AND tb.transporter_id = public.current_transporter_profile_id()
      AND tb.deleted_at IS NULL
      AND (NOT p_confirmed_only OR tb.status IN ('accepted', 'completed'))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_transport_counterparty_of_transporter(p_transporter_id uuid, p_confirmed_only boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.transporter_id = p_transporter_id
      AND tb.organizer_id = public.current_organizer_profile_id()
      AND tb.deleted_at IS NULL
      AND (NOT p_confirmed_only OR tb.status IN ('accepted', 'completed'))
  )
$$;

CREATE OR REPLACE FUNCTION public.is_transport_counterparty_of_vehicle(p_vehicle_id uuid, p_confirmed_only boolean)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transport_bookings tb
    WHERE tb.vehicle_id = p_vehicle_id
      AND tb.organizer_id = public.current_organizer_profile_id()
      AND tb.deleted_at IS NULL
      AND (NOT p_confirmed_only OR tb.status IN ('accepted', 'completed'))
  )
$$;

GRANT EXECUTE ON FUNCTION public.organizer_is_approved(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.transporter_is_approved(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_transport_counterparty_of_organizer(uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_transport_counterparty_of_transporter(uuid, boolean) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_transport_counterparty_of_vehicle(uuid, boolean) TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 1. KYC and review columns (LEG-06, LEG-09, BIZ-07)
-- -----------------------------------------------------------------------------
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS legal_name text,                 -- registered business name / individual's legal name
  ADD COLUMN IF NOT EXISTS tin text,                        -- BIR TIN
  ADD COLUMN IF NOT EXISTS business_registration_no text,   -- DTI / SEC registration number
  ADD COLUMN IF NOT EXISTS dot_accreditation_no text,       -- DOT tour-operator accreditation (optional)
  ADD COLUMN IF NOT EXISTS public_contact_email text,       -- customer contact shown on tour pages (RA 11967)
  ADD COLUMN IF NOT EXISTS review_note text,                -- admin: rejection reason / information request
  ADD COLUMN IF NOT EXISTS info_requested_at timestamptz,   -- admin asked for more information (status stays pending)
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

ALTER TABLE public.transporter_profiles
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS tin text,
  ADD COLUMN IF NOT EXISTS business_registration_no text,
  ADD COLUMN IF NOT EXISTS ltfrb_franchise_no text,         -- LTFRB franchise / DOT tourist-transport accreditation
  ADD COLUMN IF NOT EXISTS review_note text,
  ADD COLUMN IF NOT EXISTS info_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- BIZ-08: a company-type partner must name the company. NOT VALID: historical rows are not checked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'organizer_profiles_company_name_required') THEN
    ALTER TABLE public.organizer_profiles
      ADD CONSTRAINT organizer_profiles_company_name_required
      CHECK (organizer_type <> 'company' OR nullif(btrim(company_name), '') IS NOT NULL) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'transporter_profiles_company_name_required') THEN
    ALTER TABLE public.transporter_profiles
      ADD CONSTRAINT transporter_profiles_company_name_required
      CHECK (transporter_type <> 'company' OR nullif(btrim(company_name), '') IS NOT NULL) NOT VALID;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Approval policy: new partners start pending (BIZ-06). Replaces the auto-approve switch in
--    20261023090000_rls_hardening.sql. Existing rows are untouched.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.organizer_profiles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.status := 'pending';
    NEW.review_note := NULL;
    NEW.info_requested_at := NULL;
    NEW.reviewed_at := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.transporter_profiles_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.status := 'pending';
    NEW.average_rating := 0;
    NEW.review_count := 0;
    NEW.review_note := NULL;
    NEW.info_requested_at := NULL;
    NEW.reviewed_at := NULL;
    NEW.deleted_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

-- Review columns are server-owned too.
DROP TRIGGER IF EXISTS organizer_profiles_guard_columns ON public.organizer_profiles;
CREATE TRIGGER organizer_profiles_guard_columns
  BEFORE UPDATE ON public.organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'user_profile_id', 'status', 'deleted_at', 'review_note', 'info_requested_at', 'reviewed_at'
  );

DROP TRIGGER IF EXISTS transporter_profiles_guard_columns ON public.transporter_profiles;
CREATE TRIGGER transporter_profiles_guard_columns
  BEFORE UPDATE ON public.transporter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'user_profile_id', 'status', 'average_rating', 'review_count', 'deleted_at',
    'review_note', 'info_requested_at', 'reviewed_at'
  );

-- Identity (KYC) fields, listed in TG_ARGV. End users:
--   * approved: may fill a blank field, never change a value that was verified;
--   * rejected: any change re-submits the application (status -> pending).
-- Fires after *_guard_columns (triggers run in name order), so the status change here is allowed.
CREATE OR REPLACE FUNCTION public.partner_profiles_kyc_rules()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  col text;
  v_old text;
  v_new text;
  v_changed boolean := false;
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;
  FOREACH col IN ARRAY TG_ARGV LOOP
    v_old := nullif(btrim(to_jsonb(OLD) ->> col), '');
    v_new := nullif(btrim(to_jsonb(NEW) ->> col), '');
    IF v_old IS DISTINCT FROM v_new THEN
      v_changed := true;
      IF OLD.status = 'approved' AND v_old IS NOT NULL THEN
        RAISE EXCEPTION 'Verified business details (%) can no longer be changed. Contact support to update them.', col
          USING ERRCODE = '42501';
      END IF;
    END IF;
  END LOOP;
  IF v_changed AND OLD.status = 'rejected' THEN
    NEW.status := 'pending';
    NEW.reviewed_at := NULL;
    NEW.info_requested_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizer_profiles_kyc_rules ON public.organizer_profiles;
CREATE TRIGGER organizer_profiles_kyc_rules
  BEFORE UPDATE ON public.organizer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.partner_profiles_kyc_rules(
    'organizer_type', 'company_name', 'legal_name', 'tin', 'business_registration_no', 'dot_accreditation_no'
  );

DROP TRIGGER IF EXISTS transporter_profiles_kyc_rules ON public.transporter_profiles;
CREATE TRIGGER transporter_profiles_kyc_rules
  BEFORE UPDATE ON public.transporter_profiles
  FOR EACH ROW EXECUTE FUNCTION public.partner_profiles_kyc_rules(
    'transporter_type', 'company_name', 'legal_name', 'tin', 'business_registration_no', 'ltfrb_franchise_no'
  );

-- -----------------------------------------------------------------------------
-- 3. Publishing requires an approved organizer (BIZ-06, BIZ-09). The rest of the publish checklist
--    (itinerary, open future schedule, price, cover image) is enforced in lib/services/tours.ts.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tours_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request()
     AND NEW.status = 'published'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'published')
     AND NOT public.organizer_is_approved(NEW.organizer_id) THEN
    RAISE EXCEPTION 'Your organizer account must be approved before you can publish tours.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tours_publish_guard ON public.tours;
CREATE TRIGGER tours_publish_guard
  BEFORE INSERT OR UPDATE ON public.tours
  FOR EACH ROW EXECUTE FUNCTION public.tours_publish_guard();

-- -----------------------------------------------------------------------------
-- 4. Transport requests only to approved transporters' active vehicles (BIZ-06)
-- -----------------------------------------------------------------------------
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
    JOIN public.transporter_profiles tp ON tp.id = v.transporter_id
    WHERE v.id = p_vehicle_id AND v.transporter_id = p_transporter_id
      AND v.deleted_at IS NULL AND v.status = 'active'
      AND tp.status = 'approved' AND tp.deleted_at IS NULL
  )
$$;

-- -----------------------------------------------------------------------------
-- 5. KYC documents (LEG-06, LEG-09)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_profile_id uuid NOT NULL REFERENCES public.user_profiles(id) ON DELETE RESTRICT,
  partner_type text NOT NULL CHECK (partner_type IN ('organizer', 'transporter')),
  doc_type text NOT NULL CHECK (doc_type IN (
    'government_id', 'business_registration', 'bir_registration', 'dot_accreditation',
    'ltfrb_franchise', 'vehicle_orcr', 'insurance', 'other'
  )),
  vehicle_id uuid REFERENCES public.vehicles(id) ON DELETE SET NULL,
  storage_path text NOT NULL UNIQUE,         -- object name in the private 'partner-documents' bucket
  file_name text,
  mime_type text CHECK (mime_type IS NULL OR mime_type IN ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer CHECK (size_bytes IS NULL OR (size_bytes > 0 AND size_bytes <= 10485760)),
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'verified', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES public.user_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT partner_documents_vehicle_is_transporter CHECK (vehicle_id IS NULL OR partner_type = 'transporter')
);

CREATE INDEX IF NOT EXISTS idx_partner_documents_owner
  ON public.partner_documents (owner_profile_id, partner_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_documents_vehicle
  ON public.partner_documents (vehicle_id) WHERE vehicle_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.partner_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_documents FROM anon;
REVOKE DELETE, TRUNCATE ON public.partner_documents FROM authenticated;

DROP POLICY IF EXISTS "Owners read own partner documents" ON public.partner_documents;
CREATE POLICY "Owners read own partner documents" ON public.partner_documents
  FOR SELECT TO authenticated USING (owner_profile_id = public.current_user_profile_id());

DROP POLICY IF EXISTS "Admins read partner documents" ON public.partner_documents;
CREATE POLICY "Admins read partner documents" ON public.partner_documents
  FOR SELECT TO authenticated USING (public.is_platform_admin());

DROP POLICY IF EXISTS "Owners add own partner documents" ON public.partner_documents;
CREATE POLICY "Owners add own partner documents" ON public.partner_documents
  FOR INSERT TO authenticated WITH CHECK (owner_profile_id = public.current_user_profile_id());

-- Owners may only withdraw (soft-delete) their own documents; every other column is guarded.
DROP POLICY IF EXISTS "Owners withdraw own partner documents" ON public.partner_documents;
CREATE POLICY "Owners withdraw own partner documents" ON public.partner_documents
  FOR UPDATE TO authenticated
  USING (owner_profile_id = public.current_user_profile_id())
  WITH CHECK (owner_profile_id = public.current_user_profile_id());

CREATE OR REPLACE FUNCTION public.partner_documents_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.status := 'submitted';
    NEW.review_note := NULL;
    NEW.reviewed_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.deleted_at := NULL;
    NEW.created_at := now();
    -- The file must be in the uploader's own folder of the private bucket.
    IF auth.uid() IS NULL OR NEW.storage_path NOT LIKE auth.uid()::text || '/%' OR NEW.storage_path LIKE '%..%' THEN
      RAISE EXCEPTION 'Invalid document path' USING ERRCODE = '42501';
    END IF;
    IF NEW.vehicle_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vehicles v
      WHERE v.id = NEW.vehicle_id AND v.transporter_id = public.current_transporter_profile_id()
    ) THEN
      RAISE EXCEPTION 'Vehicle not found' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_documents_before_insert ON public.partner_documents;
CREATE TRIGGER partner_documents_before_insert
  BEFORE INSERT ON public.partner_documents
  FOR EACH ROW EXECUTE FUNCTION public.partner_documents_before_insert();

DROP TRIGGER IF EXISTS partner_documents_guard_columns ON public.partner_documents;
CREATE TRIGGER partner_documents_guard_columns
  BEFORE UPDATE ON public.partner_documents
  FOR EACH ROW EXECUTE FUNCTION public.guard_readonly_columns(
    'owner_profile_id', 'partner_type', 'doc_type', 'vehicle_id', 'storage_path', 'file_name', 'mime_type',
    'size_bytes', 'status', 'review_note', 'reviewed_at', 'reviewed_by', 'created_at'
  );

-- Private bucket: owners upload/read inside "<auth.uid()>/…"; admins use service-role signed URLs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('partner-documents', 'partner-documents', false, 10485760,
        ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Partners upload own documents" ON storage.objects;
CREATE POLICY "Partners upload own documents" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'partner-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Partners read own documents" ON storage.objects;
CREATE POLICY "Partners read own documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'partner-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- -----------------------------------------------------------------------------
-- 6. SEC-13: base tables are owner/admin-only for signed-in users
-- -----------------------------------------------------------------------------
-- organizer_profiles: owners keep "organizer select own"; anon keeps column-limited approved rows.
DROP POLICY IF EXISTS "public read approved" ON public.organizer_profiles;
DROP POLICY IF EXISTS "Anon read approved organizers" ON public.organizer_profiles;
CREATE POLICY "Anon read approved organizers" ON public.organizer_profiles
  FOR SELECT TO anon USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Admins read organizer profiles" ON public.organizer_profiles;
CREATE POLICY "Admins read organizer profiles" ON public.organizer_profiles
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- transporter_profiles
DROP POLICY IF EXISTS "Allow public read transporter profiles" ON public.transporter_profiles;
DROP POLICY IF EXISTS "Anon read approved transporters" ON public.transporter_profiles;
CREATE POLICY "Anon read approved transporters" ON public.transporter_profiles
  FOR SELECT TO anon USING (status = 'approved' AND deleted_at IS NULL);
DROP POLICY IF EXISTS "Transporters read own profile" ON public.transporter_profiles;
CREATE POLICY "Transporters read own profile" ON public.transporter_profiles
  FOR SELECT USING (user_profile_id = public.current_user_profile_id());
DROP POLICY IF EXISTS "Admins read transporter profiles" ON public.transporter_profiles;
CREATE POLICY "Admins read transporter profiles" ON public.transporter_profiles
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- vehicles: owners keep "Transporters can manage own vehicles" (FOR ALL).
DROP POLICY IF EXISTS "Public can view active vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "Anon read active vehicles" ON public.vehicles;
CREATE POLICY "Anon read active vehicles" ON public.vehicles
  FOR SELECT TO anon
  USING (status = 'active' AND deleted_at IS NULL AND public.transporter_is_approved(transporter_id));
DROP POLICY IF EXISTS "Admins read vehicles" ON public.vehicles;
CREATE POLICY "Admins read vehicles" ON public.vehicles
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- vehicle_availability: owners keep "Transporters can manage own vehicle availability" (FOR ALL).
DROP POLICY IF EXISTS "Public can view vehicle availability" ON public.vehicle_availability;
DROP POLICY IF EXISTS "Admins read vehicle availability" ON public.vehicle_availability;
CREATE POLICY "Admins read vehicle availability" ON public.vehicle_availability
  FOR SELECT TO authenticated USING (public.is_platform_admin());

-- user_profiles: organizers no longer read whole traveler rows (use organizer_traveler_contacts()).
DROP POLICY IF EXISTS "Organizers can read profiles of travelers who booked their tours" ON public.user_profiles;

-- -----------------------------------------------------------------------------
-- 7. SEC-13: public-safe views (definer views: they read the base tables as the owner, so every
--    row filter and column choice below IS the access policy). Read-only for API roles.
-- -----------------------------------------------------------------------------
DROP VIEW IF EXISTS public.public_organizer_profiles;
CREATE VIEW public.public_organizer_profiles WITH (security_barrier = true) AS
SELECT
  op.id,
  op.organizer_type,
  op.company_name,
  op.display_name,
  op.description,
  op.legal_name,
  op.public_contact_email,
  op.dot_accreditation_no,
  op.status,
  op.created_at,
  CASE WHEN public.is_transport_counterparty_of_organizer(op.id, true) THEN op.phone END AS phone,
  CASE WHEN public.is_transport_counterparty_of_organizer(op.id, true)
       THEN (SELECT up.email FROM public.user_profiles up WHERE up.id = op.user_profile_id) END AS contact_email
FROM public.organizer_profiles op
WHERE op.deleted_at IS NULL
  AND (op.status = 'approved' OR public.is_transport_counterparty_of_organizer(op.id, false));

DROP VIEW IF EXISTS public.public_transporter_profiles;
CREATE VIEW public.public_transporter_profiles WITH (security_barrier = true) AS
SELECT
  tp.id,
  tp.transporter_type,
  tp.company_name,
  tp.display_name,
  tp.description,
  tp.service_areas,
  tp.ltfrb_franchise_no,
  tp.average_rating,
  tp.review_count,
  tp.status,
  tp.created_at,
  CASE WHEN public.is_transport_counterparty_of_transporter(tp.id, true) THEN tp.phone END AS phone,
  CASE WHEN public.is_transport_counterparty_of_transporter(tp.id, true)
       THEN (SELECT up.email FROM public.user_profiles up WHERE up.id = tp.user_profile_id) END AS contact_email
FROM public.transporter_profiles tp
WHERE tp.deleted_at IS NULL
  AND (tp.status = 'approved' OR public.is_transport_counterparty_of_transporter(tp.id, false));

DROP VIEW IF EXISTS public.public_vehicles;
CREATE VIEW public.public_vehicles WITH (security_barrier = true) AS
SELECT
  v.id,
  v.transporter_id,
  v.name,
  v.vehicle_type,
  v.seat_capacity,
  v.description,
  v.rate_per_day,
  v.photos,
  v.status,
  v.created_at,
  CASE WHEN public.is_transport_counterparty_of_vehicle(v.id, true) THEN v.plate_number END AS plate_number
FROM public.vehicles v
WHERE v.deleted_at IS NULL
  AND (
    (v.status = 'active' AND public.transporter_is_approved(v.transporter_id))
    OR public.is_transport_counterparty_of_vehicle(v.id, false)
  );

-- Views are auto-updatable in Postgres and would write as the owner: SELECT only.
REVOKE ALL ON public.public_organizer_profiles, public.public_transporter_profiles, public.public_vehicles
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_organizer_profiles, public.public_transporter_profiles, public.public_vehicles
  TO anon, authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 8. SEC-13: organizer → traveler contact details, column-limited
-- -----------------------------------------------------------------------------
-- Travelers who booked the calling organizer's tours: name always; account email only when the
-- traveler has a confirmed or completed booking with this organizer (needed for coordination).
CREATE OR REPLACE FUNCTION public.organizer_traveler_contacts(p_traveler_ids uuid[] DEFAULT NULL)
RETURNS TABLE (traveler_id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    up.id,
    up.full_name,
    CASE WHEN bool_or(b.status::text IN ('confirmed', 'completed')) THEN up.email END
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  JOIN public.tours t ON t.id = ts.tour_id
  JOIN public.user_profiles up ON up.id = b.traveler_id
  WHERE t.organizer_id = public.current_organizer_profile_id()
    AND (p_traveler_ids IS NULL OR b.traveler_id = ANY (p_traveler_ids))
  GROUP BY up.id, up.full_name, up.email
$$;

REVOKE ALL ON FUNCTION public.organizer_traveler_contacts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.organizer_traveler_contacts(uuid[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 9. Vehicle discovery for organizers (replaces the client-side join that exposed phones/plates)
-- -----------------------------------------------------------------------------
-- Active vehicles of approved transporters with enough seats and no availability row (blocked or
-- booked) overlapping [p_start, p_end]. Only callable by organizers (and admins).
CREATE OR REPLACE FUNCTION public.available_vehicles(p_start date, p_end date, p_min_seats integer DEFAULT 1)
RETURNS TABLE (
  id uuid,
  transporter_id uuid,
  name text,
  vehicle_type text,
  seat_capacity integer,
  rate_per_day numeric,
  photos text[],
  transporter_display_name text,
  transporter_company_name text,
  transporter_average_rating numeric,
  transporter_review_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT v.id, v.transporter_id, v.name, v.vehicle_type, v.seat_capacity, v.rate_per_day, v.photos,
         tp.display_name, tp.company_name, tp.average_rating, tp.review_count
  FROM public.vehicles v
  JOIN public.transporter_profiles tp ON tp.id = v.transporter_id
  WHERE (public.current_organizer_profile_id() IS NOT NULL OR public.is_platform_admin())
    AND p_start IS NOT NULL AND p_end IS NOT NULL AND p_start <= p_end
    AND v.status = 'active' AND v.deleted_at IS NULL
    AND tp.status = 'approved' AND tp.deleted_at IS NULL
    AND v.seat_capacity >= greatest(coalesce(p_min_seats, 1), 1)
    AND NOT EXISTS (
      SELECT 1 FROM public.vehicle_availability va
      WHERE va.vehicle_id = v.id
        AND va.deleted_at IS NULL
        AND va.start_date <= p_end
        AND va.end_date >= p_start
    )
  ORDER BY v.seat_capacity, v.rate_per_day NULLS LAST, v.id
$$;

REVOKE ALL ON FUNCTION public.available_vehicles(date, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.available_vehicles(date, date, integer) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 10. Catalog search reads organizers through the public view (signed-in callers no longer see
--     other organizers in the base table). Body identical to 20261024100000 otherwise.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_public_tours(
  p_q          text    DEFAULT NULL,
  p_destination text   DEFAULT NULL,
  p_from       date    DEFAULT NULL,
  p_to         date    DEFAULT NULL,
  p_guests     integer DEFAULT NULL,
  p_min_price  numeric DEFAULT NULL,
  p_max_price  numeric DEFAULT NULL,
  p_min_days   integer DEFAULT NULL,
  p_max_days   integer DEFAULT NULL,
  p_format     text    DEFAULT NULL,
  p_theme      text    DEFAULT NULL,
  p_sort       text    DEFAULT 'soonest',
  p_limit      integer DEFAULT 12,
  p_offset     integer DEFAULT 0
)
RETURNS TABLE (
  id                uuid,
  title             text,
  slug              text,
  location          text,
  city              text,
  province          text,
  duration_days     integer,
  format            text,
  themes            text[],
  cover_image_url   text,
  image_urls        text[],
  organizer_name    text,
  lowest_price      numeric,
  original_price    numeric,
  max_capacity      integer,
  seats_left        integer,
  next_start_date   date,
  rating_avg        numeric,
  review_count      integer,
  total_count       bigint
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH params AS (
    SELECT
      nullif(btrim(replace(replace(replace(coalesce(p_q, ''), '\', '\\'), '%', '\%'), '_', '\_')), '') AS q,
      nullif(btrim(replace(replace(replace(coalesce(p_destination, ''), '\', '\\'), '%', '\%'), '_', '\_')), '') AS dest,
      greatest(coalesce(p_guests, 1), 1) AS guests,
      (now() AT TIME ZONE 'Asia/Manila')::date AS today
  ),
  matching AS (
    SELECT
      s.tour_id,
      s.start_date,
      s.capacity,
      s.capacity - greatest(s.booked_count, 0) AS seats_left,
      coalesce(s.price_per_person, t.price_per_person) AS effective_price,
      s.original_price
    FROM public.tour_schedules s
    JOIN public.tours t ON t.id = s.tour_id
    CROSS JOIN params p
    WHERE s.deleted_at IS NULL
      AND s.status = 'open'
      AND s.start_date >= p.today
      AND (p_from IS NULL OR s.start_date >= p_from)
      AND (p_to IS NULL OR s.start_date <= p_to)
      AND s.capacity - greatest(s.booked_count, 0) >= p.guests
      AND (p_min_price IS NULL OR coalesce(s.price_per_person, t.price_per_person) >= p_min_price)
      AND (p_max_price IS NULL OR coalesce(s.price_per_person, t.price_per_person) <= p_max_price)
  ),
  per_tour AS (
    SELECT
      m.tour_id,
      min(m.effective_price) AS lowest_price,
      (array_agg(m.original_price ORDER BY m.effective_price, m.start_date))[1] AS original_price,
      max(m.capacity) AS max_capacity,
      max(m.seats_left) AS seats_left,
      min(m.start_date) AS next_start_date
    FROM matching m
    GROUP BY m.tour_id
  ),
  listed AS (
    SELECT
      t.id, t.title, t.slug, t.location, t.city, t.province, t.duration_days,
      t.format::text AS format, t.themes, t.cover_image_url, t.image_urls, t.created_at,
      coalesce(op.display_name, op.company_name) AS organizer_name,
      pt.lowest_price, pt.original_price, pt.max_capacity, pt.seats_left, pt.next_start_date
    FROM per_tour pt
    JOIN public.tours t ON t.id = pt.tour_id
    JOIN public.public_organizer_profiles op ON op.id = t.organizer_id
    CROSS JOIN params p
    WHERE t.status = 'published'
      AND t.deleted_at IS NULL
      AND op.status = 'approved'
      AND (p_format IS NULL OR t.format::text = p_format)
      AND (p_theme IS NULL OR p_theme = ANY (t.themes))
      AND (p_min_days IS NULL OR t.duration_days >= p_min_days)
      AND (p_max_days IS NULL OR t.duration_days <= p_max_days)
      AND (p.q IS NULL
           OR t.title ILIKE '%' || p.q || '%'
           OR t.location ILIKE '%' || p.q || '%'
           OR coalesce(t.city, '') ILIKE '%' || p.q || '%'
           OR coalesce(t.province, '') ILIKE '%' || p.q || '%')
      AND (p.dest IS NULL
           OR t.location ILIKE '%' || p.dest || '%'
           OR coalesce(t.city, '') ILIKE '%' || p.dest || '%'
           OR coalesce(t.province, '') ILIKE '%' || p.dest || '%')
  ),
  page AS (
    SELECT l.*, count(*) OVER () AS total_count
    FROM listed l
    ORDER BY
      CASE WHEN p_sort = 'price_asc' THEN l.lowest_price END ASC NULLS LAST,
      CASE WHEN p_sort = 'price_desc' THEN l.lowest_price END DESC NULLS LAST,
      CASE WHEN p_sort = 'newest' THEN l.created_at END DESC NULLS LAST,
      l.next_start_date ASC,
      l.id
    LIMIT least(greatest(coalesce(p_limit, 12), 1), 48)
    OFFSET greatest(coalesce(p_offset, 0), 0)
  )
  SELECT
    pg.id, pg.title, pg.slug, pg.location, pg.city, pg.province, pg.duration_days, pg.format,
    pg.themes, pg.cover_image_url, pg.image_urls, pg.organizer_name,
    pg.lowest_price, pg.original_price, pg.max_capacity, pg.seats_left, pg.next_start_date,
    r.rating_avg, coalesce(r.review_count, 0)::integer AS review_count,
    pg.total_count
  FROM page pg
  LEFT JOIN LATERAL (
    SELECT round(avg(rv.rating)::numeric, 1) AS rating_avg, count(*) AS review_count
    FROM public.reviews rv
    WHERE rv.tour_id = pg.id AND rv.status = 'published' AND rv.deleted_at IS NULL
  ) r ON true
  ORDER BY
    CASE WHEN p_sort = 'price_asc' THEN pg.lowest_price END ASC NULLS LAST,
    CASE WHEN p_sort = 'price_desc' THEN pg.lowest_price END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN pg.created_at END DESC NULLS LAST,
    pg.next_start_date ASC,
    pg.id;
$$;
