-- Phase 5.7 (SEC-09, SEC-11): server-side one-time codes.
--
-- Before: the 6-digit code sat in a signed (not encrypted) JWT cookie, so anyone holding the browser
-- session could read it, and there was no attempt limit. Now:
--   * the app generates the code with crypto.randomInt and stores only HMAC-SHA256(OTP_SECRET,
--     challenge id | user id | action | code) here; the cookie holds only the opaque challenge id;
--   * a challenge is bound to one auth user, one action and (for email/phone changes) one target
--     address, expires after 10 minutes, allows 5 attempts, and is single use;
--   * at most 5 codes per user and action per hour (email-bombing guard that works without Upstash);
--   * issuing a new code supersedes the previous open one.
--
-- Access: service role only (no RLS policies, no grants to anon/authenticated). The functions are
-- SECURITY INVOKER and executable only by service_role.
--
-- Also locks down the unused legacy table payout_otps (its policy let users read and write their
-- own rows, i.e. mint their own codes if it were ever used).

CREATE TABLE IF NOT EXISTS public.otp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN (
    'add_payout_method', 'change_email', 'change_phone',
    'change_password_email', 'change_password_phone', 'verify_email'
  )),
  channel text NOT NULL CHECK (channel IN ('email', 'phone')),
  -- New email/phone this challenge proves (change_email / change_phone); NULL = the account's own.
  target text CHECK (target IS NULL OR char_length(target) BETWEEN 3 AND 320),
  code_hash text NOT NULL CHECK (code_hash ~ '^[0-9a-f]{64}$'),
  attempts smallint NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  max_attempts smallint NOT NULL DEFAULT 5 CHECK (max_attempts BETWEEN 1 AND 10),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT otp_challenges_ttl_check CHECK (expires_at > created_at AND expires_at <= created_at + interval '30 minutes')
);

CREATE INDEX IF NOT EXISTS otp_challenges_user_action_idx
  ON public.otp_challenges (user_id, action, created_at DESC);

ALTER TABLE public.otp_challenges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.otp_challenges FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.otp_challenges TO service_role;

-- ─── otp_issue: create a challenge (rate-capped, supersedes the open one) ───
CREATE OR REPLACE FUNCTION public.otp_issue(
  p_id uuid,
  p_user_id uuid,
  p_action text,
  p_channel text,
  p_target text,
  p_code_hash text,
  p_ttl_seconds integer DEFAULT 600,
  p_max_per_hour integer DEFAULT 5
) RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent integer;
BEGIN
  IF p_ttl_seconds IS NULL OR p_ttl_seconds < 60 OR p_ttl_seconds > 1800 THEN
    RAISE EXCEPTION 'otp_invalid_ttl';
  END IF;

  -- Serialise issues per user + action so the hourly cap cannot be raced.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action, 0));

  SELECT count(*) INTO v_recent
  FROM public.otp_challenges
  WHERE user_id = p_user_id AND action = p_action AND created_at > now() - interval '1 hour';

  IF v_recent >= p_max_per_hour THEN
    RAISE EXCEPTION 'otp_send_limit' USING ERRCODE = 'P0001';
  END IF;

  -- Only the newest code works.
  UPDATE public.otp_challenges
  SET consumed_at = now()
  WHERE user_id = p_user_id AND action = p_action AND consumed_at IS NULL;

  -- Housekeeping: nothing older than a day is ever needed (the hourly cap looks back one hour).
  DELETE FROM public.otp_challenges
  WHERE user_id = p_user_id AND created_at < now() - interval '1 day';

  INSERT INTO public.otp_challenges (id, user_id, action, channel, target, code_hash, expires_at)
  VALUES (p_id, p_user_id, p_action, p_channel, p_target, p_code_hash,
          now() + make_interval(secs => p_ttl_seconds));

  RETURN p_id;
END;
$$;

-- ─── otp_attempt: check a code (counts the attempt; optionally consumes on success) ───
-- status: verified | invalid | locked | expired | used | not_found
CREATE OR REPLACE FUNCTION public.otp_attempt(
  p_id uuid,
  p_user_id uuid,
  p_action text,
  p_code_hash text,
  p_consume boolean DEFAULT false
) RETURNS TABLE (status text, target text, attempts_left integer)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  c public.otp_challenges%ROWTYPE;
BEGIN
  SELECT * INTO c FROM public.otp_challenges WHERE id = p_id FOR UPDATE;

  -- Another user's or another action's challenge is indistinguishable from a missing one.
  IF NOT FOUND OR c.user_id <> p_user_id OR c.action <> p_action THEN
    RETURN QUERY SELECT 'not_found'::text, NULL::text, 0;
    RETURN;
  END IF;
  IF c.consumed_at IS NOT NULL OR c.verified_at IS NOT NULL THEN
    RETURN QUERY SELECT 'used'::text, NULL::text, 0;
    RETURN;
  END IF;
  IF c.expires_at <= now() THEN
    RETURN QUERY SELECT 'expired'::text, NULL::text, 0;
    RETURN;
  END IF;
  IF c.attempts >= c.max_attempts THEN
    RETURN QUERY SELECT 'locked'::text, NULL::text, 0;
    RETURN;
  END IF;

  IF c.code_hash = p_code_hash THEN
    UPDATE public.otp_challenges
    SET attempts = c.attempts + 1,
        verified_at = now(),
        consumed_at = CASE WHEN p_consume THEN now() ELSE NULL END
    WHERE id = p_id;
    RETURN QUERY SELECT 'verified'::text, c.target, c.max_attempts - c.attempts - 1;
    RETURN;
  END IF;

  UPDATE public.otp_challenges SET attempts = c.attempts + 1 WHERE id = p_id;
  IF c.attempts + 1 >= c.max_attempts THEN
    RETURN QUERY SELECT 'locked'::text, NULL::text, 0;
  ELSE
    RETURN QUERY SELECT 'invalid'::text, NULL::text, c.max_attempts - c.attempts - 1;
  END IF;
END;
$$;

-- ─── otp_verified: is a verified, unconsumed challenge still within its window? ───
-- With p_consume, atomically marks it used (single use): exactly one caller gets valid = true.
CREATE OR REPLACE FUNCTION public.otp_verified(
  p_id uuid,
  p_user_id uuid,
  p_action text,
  p_consume boolean DEFAULT false,
  p_window_seconds integer DEFAULT 900
) RETURNS TABLE (valid boolean, target text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target text;
  v_found boolean;
BEGIN
  IF p_consume THEN
    UPDATE public.otp_challenges c
    SET consumed_at = now()
    WHERE c.id = p_id AND c.user_id = p_user_id AND c.action = p_action
      AND c.verified_at IS NOT NULL AND c.consumed_at IS NULL
      AND c.verified_at > now() - make_interval(secs => p_window_seconds)
    RETURNING c.target, true INTO v_target, v_found;
  ELSE
    SELECT c.target, true INTO v_target, v_found
    FROM public.otp_challenges c
    WHERE c.id = p_id AND c.user_id = p_user_id AND c.action = p_action
      AND c.verified_at IS NOT NULL AND c.consumed_at IS NULL
      AND c.verified_at > now() - make_interval(secs => p_window_seconds);
  END IF;

  RETURN QUERY SELECT coalesce(v_found, false), v_target;
END;
$$;

REVOKE ALL ON FUNCTION public.otp_issue(uuid, uuid, text, text, text, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.otp_attempt(uuid, uuid, text, text, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.otp_verified(uuid, uuid, text, boolean, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_issue(uuid, uuid, text, text, text, text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.otp_attempt(uuid, uuid, text, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.otp_verified(uuid, uuid, text, boolean, integer) TO service_role;

-- ─── Legacy payout_otps: unused; remove end-user access ───
DO $$
BEGIN
  IF to_regclass('public.payout_otps') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own otps" ON public.payout_otps';
    EXECUTE 'REVOKE ALL ON public.payout_otps FROM anon, authenticated';
  END IF;
END;
$$;

COMMENT ON TABLE public.otp_challenges IS
  'One-time codes (SEC-09): HMAC of the code only, bound to user/action/target, 10 min, 5 attempts, single use. Service role only.';
