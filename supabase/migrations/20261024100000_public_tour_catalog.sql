-- =============================================================================
-- Phase 3.5: public tour catalog search (BIZ-13, ENG-10)
--
-- The catalog used to select every published tour with every schedule and review and then filter,
-- sort and paginate in JavaScript (and silently stopped at PostgREST's 1000-row cap). This moves all
-- of it into one STABLE, SECURITY INVOKER function, so the caller's RLS still applies (anon sees
-- only published tours, approved organizers and published reviews) and the database does the work.
--
-- A tour is listed when it is published, not soft-deleted, run by an approved, non-deleted
-- organizer, and has at least one MATCHING schedule: open, not soft-deleted, starting today or
-- later (Manila date), inside [p_from, p_to] when given, with at least max(p_guests, 1) seats left
-- and an effective price (schedule price, else tour price) inside [p_min_price, p_max_price].
-- Price, seat and date figures returned for a tour are computed over its matching schedules only.
-- =============================================================================

-- Supports the "open future schedules of a tour" lookups the catalog does per tour.
CREATE INDEX IF NOT EXISTS idx_tour_schedules_open_by_tour
  ON public.tour_schedules (tour_id, start_date)
  WHERE deleted_at IS NULL AND status = 'open';

CREATE INDEX IF NOT EXISTS idx_reviews_published_by_tour
  ON public.reviews (tour_id)
  WHERE status = 'published' AND deleted_at IS NULL;

DROP FUNCTION IF EXISTS public.search_public_tours(text, text, date, date, integer, numeric, numeric,
  integer, integer, text, text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.search_public_tours(
  p_q          text    DEFAULT NULL,  -- free text: title, location, city, province
  p_destination text   DEFAULT NULL,  -- location, city or province
  p_from       date    DEFAULT NULL,  -- a matching schedule starts on or after this date
  p_to         date    DEFAULT NULL,  -- ... and on or before this date
  p_guests     integer DEFAULT NULL,  -- seats left on a matching schedule >= this
  p_min_price  numeric DEFAULT NULL,  -- effective per-person price bounds (pesos)
  p_max_price  numeric DEFAULT NULL,
  p_min_days   integer DEFAULT NULL,  -- tours.duration_days bounds
  p_max_days   integer DEFAULT NULL,
  p_format     text    DEFAULT NULL,  -- joiner | private | solo
  p_theme      text    DEFAULT NULL,  -- one of tours.themes
  p_sort       text    DEFAULT 'soonest', -- soonest | price_asc | price_desc | newest
  p_limit      integer DEFAULT 12,    -- clamped to 1..48
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
      -- Escape LIKE wildcards so user text is matched literally.
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
    JOIN public.organizer_profiles op ON op.id = t.organizer_id
    CROSS JOIN params p
    WHERE t.status = 'published'
      AND t.deleted_at IS NULL
      AND op.status = 'approved'
      AND op.deleted_at IS NULL
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

COMMENT ON FUNCTION public.search_public_tours(text, text, date, date, integer, numeric, numeric,
  integer, integer, text, text, text, integer, integer) IS
  'Public catalog search (SECURITY INVOKER: caller RLS applies). Filters, sorts and paginates published tours with an open future schedule. total_count is the full match count.';

REVOKE ALL ON FUNCTION public.search_public_tours(text, text, date, date, integer, numeric, numeric,
  integer, integer, text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_public_tours(text, text, date, date, integer, numeric, numeric,
  integer, integer, text, text, text, integer, integer) TO anon, authenticated, service_role;
