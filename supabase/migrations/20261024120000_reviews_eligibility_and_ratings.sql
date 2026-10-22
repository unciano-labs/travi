-- =============================================================================
-- Phase 3.8: reviews (docs/MVP_LAUNCH_READINESS.md BIZ-20)
--
--   * reviews.booking_id: a traveler review is tied to one booking (unique), so one review per trip;
--   * end users may insert only a `pending` tour review for their own `completed` booking of that tour
--     (checked by the SECURITY DEFINER helper can_review_booking);
--   * transporter_profiles.average_rating / review_count are maintained by a trigger from published,
--     non-deleted reviews (definer context: the Phase 1 guard only blocks end users);
--   * tour_rating_summary: per-tour average/count of published reviews, readable by anon.
--
-- Idempotent and safe to re-run. Tests: supabase/tests/rls/reviews.test.mjs (npm run test:rls).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. One review per booking
-- -----------------------------------------------------------------------------
-- Nullable: legacy and admin-created rows have no booking.
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS booking_id uuid REFERENCES public.bookings(id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_booking_id_key ON public.reviews (booking_id);
CREATE INDEX IF NOT EXISTS idx_reviews_tour_published ON public.reviews (tour_id) WHERE status = 'published' AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_reviews_transporter_id ON public.reviews (transporter_id);

-- Comment length matches the review form (≤ 1000). NOT VALID: legacy rows are not re-checked.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_comment_length_check') THEN
    ALTER TABLE public.reviews
      ADD CONSTRAINT reviews_comment_length_check CHECK (comment IS NULL OR char_length(comment) <= 1000) NOT VALID;
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 2. Eligibility: the caller's own completed booking, for this tour
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_review_booking(p_booking_id uuid, p_tour_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.bookings b
    JOIN public.tour_schedules s ON s.id = b.tour_schedule_id
    WHERE b.id = p_booking_id
      AND b.traveler_id = public.current_user_profile_id()
      AND b.status = 'completed'
      AND b.deleted_at IS NULL
      AND s.tour_id = p_tour_id
  )
$$;

REVOKE ALL ON FUNCTION public.can_review_booking(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_review_booking(uuid, uuid) TO authenticated, service_role;

-- Replaces the Phase 1 policy (20261023090000_rls_hardening.sql §9). Admins keep their FOR ALL policy.
DROP POLICY IF EXISTS "Authenticated users can insert reviews" ON public.reviews;
DROP POLICY IF EXISTS "Reviewers insert pending reviews" ON public.reviews;
CREATE POLICY "Reviewers insert pending reviews" ON public.reviews
  FOR INSERT WITH CHECK (
    reviewer_profile_id = public.current_user_profile_id()
    AND status = 'pending'
    AND deleted_at IS NULL
    AND transporter_id IS NULL
    AND booking_id IS NOT NULL
    AND tour_id IS NOT NULL
    AND public.can_review_booking(booking_id, tour_id)
  );

-- End users cannot backdate a review.
CREATE OR REPLACE FUNCTION public.reviews_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF public.is_end_user_request() THEN
    NEW.created_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_before_insert ON public.reviews;
CREATE TRIGGER reviews_before_insert
  BEFORE INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_before_insert();

-- -----------------------------------------------------------------------------
-- 3. Transporter rating aggregates (published, non-deleted reviews only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_transporter_rating(p_transporter_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.transporter_profiles tp
  SET average_rating = COALESCE(agg.avg_rating, 0),
      review_count = COALESCE(agg.cnt, 0)
  FROM (
    SELECT round(avg(r.rating)::numeric, 2) AS avg_rating, count(*)::int AS cnt
    FROM public.reviews r
    WHERE r.transporter_id = p_transporter_id
      AND r.status = 'published'
      AND r.deleted_at IS NULL
  ) agg
  WHERE tp.id = p_transporter_id
    AND (tp.average_rating IS DISTINCT FROM COALESCE(agg.avg_rating, 0)
         OR tp.review_count IS DISTINCT FROM COALESCE(agg.cnt, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_transporter_rating(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_transporter_rating(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.reviews_refresh_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status IS NOT DISTINCT FROM OLD.status
     AND NEW.rating IS NOT DISTINCT FROM OLD.rating
     AND NEW.deleted_at IS NOT DISTINCT FROM OLD.deleted_at
     AND NEW.transporter_id IS NOT DISTINCT FROM OLD.transporter_id THEN
    RETURN NULL;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') AND OLD.transporter_id IS NOT NULL THEN
    PERFORM public.refresh_transporter_rating(OLD.transporter_id);
  END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.transporter_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.transporter_id IS DISTINCT FROM OLD.transporter_id) THEN
    PERFORM public.refresh_transporter_rating(NEW.transporter_id);
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.reviews_refresh_ratings() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS reviews_refresh_ratings ON public.reviews;
CREATE TRIGGER reviews_refresh_ratings
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.reviews_refresh_ratings();

-- Backfill: seeded/demo values are replaced by the real published counts.
UPDATE public.transporter_profiles tp
SET average_rating = COALESCE(agg.avg_rating, 0),
    review_count = COALESCE(agg.cnt, 0)
FROM public.transporter_profiles t
LEFT JOIN (
  SELECT r.transporter_id, round(avg(r.rating)::numeric, 2) AS avg_rating, count(*)::int AS cnt
  FROM public.reviews r
  WHERE r.transporter_id IS NOT NULL AND r.status = 'published' AND r.deleted_at IS NULL
  GROUP BY r.transporter_id
) agg ON agg.transporter_id = t.id
WHERE tp.id = t.id
  AND (tp.average_rating IS DISTINCT FROM COALESCE(agg.avg_rating, 0)
       OR tp.review_count IS DISTINCT FROM COALESCE(agg.cnt, 0));

-- -----------------------------------------------------------------------------
-- 4. Tour rating summary for the public catalog
-- security_invoker: reads go through the reviews RLS (anyone may read published reviews).
-- Tours without published reviews have no row (LEFT JOIN and treat as "no ratings yet").
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.tour_rating_summary
WITH (security_invoker = true) AS
SELECT
  r.tour_id,
  round(avg(r.rating)::numeric, 2) AS average_rating,
  count(*)::int AS review_count
FROM public.reviews r
WHERE r.tour_id IS NOT NULL
  AND r.status = 'published'
  AND r.deleted_at IS NULL
GROUP BY r.tour_id;

REVOKE ALL ON public.tour_rating_summary FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.tour_rating_summary TO anon, authenticated, service_role;
