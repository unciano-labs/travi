-- =============================================================================
-- Phase 3.4 Accounts: create user_profiles (and the signup role) from auth.users (BIZ-12)
-- docs/MVP_LAUNCH_READINESS.md §5 Phase 3.4
--
-- With Supabase "Confirm email" ON, signUp() returns no session, so the app cannot insert the
-- profile under RLS. The profile is now created by an AFTER INSERT trigger on auth.users, which
-- works with "Confirm email" ON or OFF. The app keeps an insert-or-ignore fallback.
--
-- Signup metadata (options.data, user-controlled through the public anon key):
--   full_name | first_name + last_name   → user_profiles.full_name
--   signup_role                           → only traveler | organizer | transporter (never admin)
--   signup_website_id                     → must be an existing website_roles.website_id
-- Granting one of the three self-service roles is no more than assign_self_role() already allows
-- any signed-in user, so trusting this metadata does not widen privileges.
--
-- auth.users.email_confirmed_at is mirrored into user_profiles.email_verified_at (on insert and
-- when the user confirms later). Columns are read through to_jsonb() so the functions compile on
-- any auth.users shape (the local test harness has a minimal one).
--
-- Idempotent and safe to re-run. Test: supabase/tests/rls/accounts.test.mjs (npm run test:rls).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. ON CONFLICT (user_id) needs a plain unique index on user_profiles.user_id
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
    WHERE i.indrelid = 'public.user_profiles'::regclass
      AND i.indisunique
      AND i.indnatts = 1
      AND i.indpred IS NULL
      AND a.attname = 'user_id'
  ) THEN
    ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_user_id_key UNIQUE (user_id);
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. auth.users INSERT → user_profiles (+ signup role)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_meta jsonb := coalesce(NEW.raw_user_meta_data, '{}'::jsonb);
  v_full_name text;
  v_confirmed_at timestamptz;
  v_role text := v_meta ->> 'signup_role';
  v_website_id uuid;
  v_profile_id uuid;
  v_role_id uuid;
BEGIN
  v_full_name := left(nullif(btrim(coalesce(
    v_meta ->> 'full_name',
    concat_ws(' ', v_meta ->> 'first_name', v_meta ->> 'last_name')
  )), ''), 200);
  v_confirmed_at := nullif(to_jsonb(NEW) ->> 'email_confirmed_at', '')::timestamptz;

  -- Never block signup: a failure here only means the app-side fallback creates the profile.
  BEGIN
    INSERT INTO public.user_profiles (user_id, email, full_name, email_verified_at)
    VALUES (NEW.id, coalesce(NEW.email, ''), v_full_name, v_confirmed_at)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT id INTO v_profile_id FROM public.user_profiles WHERE user_id = NEW.id;

    IF v_profile_id IS NOT NULL AND v_role IN ('traveler', 'organizer', 'transporter') THEN
      BEGIN
        v_website_id := nullif(v_meta ->> 'signup_website_id', '')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        v_website_id := NULL;
      END;

      IF v_website_id IS NOT NULL THEN
        SELECT wr.id INTO v_role_id
        FROM public.website_roles wr
        WHERE wr.website_id = v_website_id AND wr.role::text = v_role
        ORDER BY wr.created_at
        LIMIT 1;

        IF v_role_id IS NOT NULL THEN
          INSERT INTO public.user_roles (user_profile_id, website_role_id)
          SELECT v_profile_id, v_role_id
          WHERE NOT EXISTS (
            SELECT 1 FROM public.user_roles
            WHERE user_profile_id = v_profile_id AND website_role_id = v_role_id
          );
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user: could not provision user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 3. auth.users email confirmation → user_profiles.email_verified_at
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_auth_user_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new timestamptz := nullif(to_jsonb(NEW) ->> 'email_confirmed_at', '')::timestamptz;
  v_old timestamptz := nullif(to_jsonb(OLD) ->> 'email_confirmed_at', '')::timestamptz;
BEGIN
  IF v_new IS NOT NULL AND v_old IS NULL THEN
    BEGIN
      UPDATE public.user_profiles
      SET email_verified_at = coalesce(email_verified_at, v_new)
      WHERE user_id = NEW.id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_auth_user_email_confirmed: %', SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_auth_user_email_confirmed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_email_confirmed();

-- -----------------------------------------------------------------------------
-- 4. Backfill: accounts that signed up while "Confirm email" broke profile creation, and
--    verification stamps for accounts Supabase already confirmed.
-- -----------------------------------------------------------------------------
INSERT INTO public.user_profiles (user_id, email, full_name, email_verified_at)
SELECT
  u.id,
  coalesce(u.email, ''),
  left(nullif(btrim(coalesce(
    u.raw_user_meta_data ->> 'full_name',
    concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')
  )), ''), 200),
  nullif(to_jsonb(u) ->> 'email_confirmed_at', '')::timestamptz
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles p WHERE p.user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

UPDATE public.user_profiles p
SET email_verified_at = nullif(to_jsonb(u) ->> 'email_confirmed_at', '')::timestamptz
FROM auth.users u
WHERE u.id = p.user_id
  AND p.email_verified_at IS NULL
  AND nullif(to_jsonb(u) ->> 'email_confirmed_at', '') IS NOT NULL;
