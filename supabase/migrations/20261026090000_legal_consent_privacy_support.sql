-- =============================================================================
-- Phase 4: legal acceptances, data subject requests and support messages
-- docs/MVP_LAUNCH_READINESS.md LEG-01, LEG-02, LEG-05, LEG-06, LEG-10, OPS-05 (Phase 4.3, 4.5)
--
--   1. legal_acceptances: append-only record of which version of which document a user accepted
--      (terms | privacy at signup, checkout_terms at payment, partner_terms at partner onboarding).
--      Signup acceptance: signupUser() puts the accepted versions in the auth metadata
--      (options.data.legal_acceptance); an AFTER INSERT trigger on user_profiles copies them into
--      legal_acceptances. That works whoever creates the profile (the auth.users trigger from
--      20261024090000, or the app fallback ensureAccountProvisioned()), with "Confirm email" ON or OFF,
--      and leaves handle_new_auth_user() untouched.
--   2. data_requests: account deletion / access / correction requests (RA 10173 rights). Users file
--      and read their own; admins handle them with the service role (app/admin/requests).
--   3. support_messages: the /contact form (complaints and redress, RA 11967). Anyone may insert
--      (anon included; the Server Action rate-limits by IP); only admins can read.
--
-- End users never set server-owned columns (ids, status, timestamps, admin fields): the
-- *_before_insert triggers overwrite them when public.is_end_user_request(). Service-role writes are
-- unaffected. Requires 20261023090000_rls_hardening.sql. Idempotent.
-- Tests: supabase/tests/rls/legal.test.mjs (npm run test:rls).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. legal_acceptances
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No ON DELETE CASCADE: acceptance records are evidence. Profiles are soft-deleted; an erasure
  -- that hard-deletes a profile must remove these rows deliberately (service role).
  user_profile_id uuid NOT NULL REFERENCES public.user_profiles(id),
  document text NOT NULL,
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  -- Keyed hash of the client IP (lib/legal/consent.ts), never the raw IP.
  ip_hash text,
  user_agent text,
  -- checkout_terms: the booking being paid for.
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT legal_acceptances_document_check
    CHECK (document IN ('terms', 'privacy', 'partner_terms', 'checkout_terms')),
  CONSTRAINT legal_acceptances_version_check CHECK (version ~ '^[A-Za-z0-9._-]{1,32}$'),
  CONSTRAINT legal_acceptances_ip_hash_check CHECK (ip_hash IS NULL OR ip_hash ~ '^[0-9a-f]{16,64}$'),
  CONSTRAINT legal_acceptances_user_agent_check CHECK (user_agent IS NULL OR length(user_agent) <= 200)
);

CREATE INDEX IF NOT EXISTS legal_acceptances_profile_idx
  ON public.legal_acceptances (user_profile_id, document, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Append-only for everyone but the service role.
REVOKE ALL ON public.legal_acceptances FROM PUBLIC, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.legal_acceptances FROM authenticated;
GRANT SELECT, INSERT ON public.legal_acceptances TO authenticated;

DROP POLICY IF EXISTS "Users read own legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Users read own legal acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (user_profile_id = public.current_user_profile_id());

DROP POLICY IF EXISTS "Admins read legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Admins read legal acceptances" ON public.legal_acceptances
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.website_roles wr ON ur.website_role_id = wr.id
    JOIN public.user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users record own legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Users record own legal acceptances" ON public.legal_acceptances
  FOR INSERT TO authenticated
  WITH CHECK (user_profile_id = public.current_user_profile_id());

-- End users: the row is always theirs, timestamped now, and a reference must be their own booking.
-- Not SECURITY DEFINER: is_end_user_request() must see the caller's role.
CREATE OR REPLACE FUNCTION public.legal_acceptances_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  v_profile_id := public.current_user_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to accept terms' USING ERRCODE = '42501';
  END IF;

  NEW.id := gen_random_uuid();
  NEW.user_profile_id := v_profile_id;
  NEW.accepted_at := now();
  NEW.created_at := now();

  IF NEW.reference_id IS NOT NULL THEN
    IF NEW.document <> 'checkout_terms' OR NOT EXISTS (
      SELECT 1 FROM public.bookings b WHERE b.id = NEW.reference_id AND b.traveler_id = v_profile_id
    ) THEN
      RAISE EXCEPTION 'Invalid acceptance reference' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS legal_acceptances_before_insert ON public.legal_acceptances;
CREATE TRIGGER legal_acceptances_before_insert
  BEFORE INSERT ON public.legal_acceptances
  FOR EACH ROW EXECUTE FUNCTION public.legal_acceptances_before_insert();

-- Signup acceptance: copy auth metadata `legal_acceptance` {terms, privacy, ip_hash, ua} into
-- legal_acceptances when the profile is created. The metadata is user-controlled (public anon key),
-- but it can only ever record an acceptance for the user's own new profile, and every value is
-- validated. Never blocks profile creation.
CREATE OR REPLACE FUNCTION public.user_profiles_record_signup_acceptances()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta jsonb;
  v_doc text;
  v_version text;
  v_ip_hash text;
  v_ua text;
BEGIN
  BEGIN
    SELECT u.raw_user_meta_data -> 'legal_acceptance' INTO v_meta
    FROM auth.users u WHERE u.id = NEW.user_id;

    IF v_meta IS NULL OR jsonb_typeof(v_meta) <> 'object' THEN
      RETURN NEW;
    END IF;

    v_ip_hash := v_meta ->> 'ip_hash';
    IF v_ip_hash IS NULL OR v_ip_hash !~ '^[0-9a-f]{16,64}$' THEN
      v_ip_hash := NULL;
    END IF;
    v_ua := nullif(left(btrim(coalesce(v_meta ->> 'ua', '')), 200), '');

    FOREACH v_doc IN ARRAY ARRAY['terms', 'privacy'] LOOP
      v_version := v_meta ->> v_doc;
      IF v_version IS NOT NULL AND v_version ~ '^[A-Za-z0-9._-]{1,32}$' THEN
        INSERT INTO public.legal_acceptances (user_profile_id, document, version, ip_hash, user_agent)
        VALUES (NEW.id, v_doc, v_version, v_ip_hash, v_ua);
      END IF;
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'user_profiles_record_signup_acceptances: profile %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.user_profiles_record_signup_acceptances() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS user_profiles_record_signup_acceptances ON public.user_profiles;
CREATE TRIGGER user_profiles_record_signup_acceptances
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.user_profiles_record_signup_acceptances();

-- -----------------------------------------------------------------------------
-- 2. data_requests (RA 10173 data subject rights, LEG-10)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_profile_id uuid NOT NULL REFERENCES public.user_profiles(id),
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  details text,
  admin_note text,
  handled_by uuid REFERENCES public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_requests_type_check CHECK (request_type IN ('deletion', 'access', 'correction')),
  CONSTRAINT data_requests_status_check CHECK (status IN ('open', 'in_progress', 'completed', 'rejected')),
  CONSTRAINT data_requests_details_check CHECK (details IS NULL OR length(details) <= 2000),
  CONSTRAINT data_requests_admin_note_check CHECK (admin_note IS NULL OR length(admin_note) <= 2000),
  CONSTRAINT data_requests_resolved_check CHECK ((status IN ('completed', 'rejected')) = (resolved_at IS NOT NULL))
);

-- One active request of each type per user.
CREATE UNIQUE INDEX IF NOT EXISTS data_requests_one_active_idx
  ON public.data_requests (user_profile_id, request_type) WHERE status IN ('open', 'in_progress');
CREATE INDEX IF NOT EXISTS data_requests_status_idx ON public.data_requests (status, created_at DESC);

ALTER TABLE public.data_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.data_requests FROM PUBLIC, anon;
REVOKE UPDATE, DELETE, TRUNCATE ON public.data_requests FROM authenticated;
GRANT SELECT, INSERT ON public.data_requests TO authenticated;

DROP POLICY IF EXISTS "Users read own data requests" ON public.data_requests;
CREATE POLICY "Users read own data requests" ON public.data_requests
  FOR SELECT TO authenticated
  USING (user_profile_id = public.current_user_profile_id());

DROP POLICY IF EXISTS "Admins read data requests" ON public.data_requests;
CREATE POLICY "Admins read data requests" ON public.data_requests
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.website_roles wr ON ur.website_role_id = wr.id
    JOIN public.user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  ));

DROP POLICY IF EXISTS "Users file own data requests" ON public.data_requests;
CREATE POLICY "Users file own data requests" ON public.data_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_profile_id = public.current_user_profile_id());

-- Not SECURITY DEFINER: is_end_user_request() must see the caller's role.
CREATE OR REPLACE FUNCTION public.data_requests_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  v_profile_id := public.current_user_profile_id();
  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Sign in to make a data request' USING ERRCODE = '42501';
  END IF;

  NEW.id := gen_random_uuid();
  NEW.user_profile_id := v_profile_id;
  NEW.status := 'open';
  NEW.admin_note := NULL;
  NEW.handled_by := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS data_requests_before_insert ON public.data_requests;
CREATE TRIGGER data_requests_before_insert
  BEFORE INSERT ON public.data_requests
  FOR EACH ROW EXECUTE FUNCTION public.data_requests_before_insert();

-- -----------------------------------------------------------------------------
-- 3. support_messages (/contact: support, complaints and redress; LEG-06, OPS-05)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Set by the trigger for signed-in senders; NULL for anonymous visitors.
  user_profile_id uuid REFERENCES public.user_profiles(id),
  name text NOT NULL,
  email text NOT NULL,
  topic text NOT NULL,
  booking_ref text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  admin_note text,
  handled_by uuid REFERENCES public.user_profiles(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_messages_name_check CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT support_messages_email_check CHECK (length(email) <= 254 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  CONSTRAINT support_messages_topic_check CHECK (topic IN (
    'booking', 'payment_refund', 'complaint_organizer', 'complaint_transporter', 'partner', 'privacy', 'other'
  )),
  CONSTRAINT support_messages_booking_ref_check CHECK (booking_ref IS NULL OR booking_ref ~ '^BK-[0-9A-F]{6}$'),
  CONSTRAINT support_messages_message_check CHECK (length(btrim(message)) BETWEEN 10 AND 5000),
  CONSTRAINT support_messages_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  CONSTRAINT support_messages_admin_note_check CHECK (admin_note IS NULL OR length(admin_note) <= 2000),
  CONSTRAINT support_messages_resolved_check CHECK ((status IN ('resolved', 'closed')) = (resolved_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS support_messages_status_idx ON public.support_messages (status, created_at DESC);

ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- Insert-only for end users (anon included). Reads: admins only (the console uses the service role).
REVOKE ALL ON public.support_messages FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.support_messages TO anon, authenticated;
GRANT SELECT ON public.support_messages TO authenticated;

DROP POLICY IF EXISTS "Anyone can send a support message" ON public.support_messages;
CREATE POLICY "Anyone can send a support message" ON public.support_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins read support messages" ON public.support_messages;
CREATE POLICY "Admins read support messages" ON public.support_messages
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.website_roles wr ON ur.website_role_id = wr.id
    JOIN public.user_profiles up ON up.id = ur.user_profile_id
    WHERE up.user_id = auth.uid() AND wr.role = 'admin'
  ));

-- Not SECURITY DEFINER: is_end_user_request() must see the caller's role.
CREATE OR REPLACE FUNCTION public.support_messages_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_end_user_request() THEN
    RETURN NEW;
  END IF;

  NEW.id := gen_random_uuid();
  -- Never trust a client-supplied sender profile: derive it from the session (NULL for anon).
  NEW.user_profile_id := public.current_user_profile_id();
  NEW.status := 'open';
  NEW.admin_note := NULL;
  NEW.handled_by := NULL;
  NEW.resolved_at := NULL;
  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_messages_before_insert ON public.support_messages;
CREATE TRIGGER support_messages_before_insert
  BEFORE INSERT ON public.support_messages
  FOR EACH ROW EXECUTE FUNCTION public.support_messages_before_insert();
