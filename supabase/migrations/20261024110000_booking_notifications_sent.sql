-- Phase 3.6 Communications (BIZ-14): send-once log for booking messages.
--   trip_reminder   one per booking, sent by GET /api/cron/trip-reminders (dedupe_key '')
--   payment_review  one per PayMongo payment that could not be applied (dedupe_key = provider payment id);
--                   the success page and the webhook both report the same payment, the traveler hears once.
-- lib/notifications.ts claims a row (INSERT ... ON CONFLICT DO NOTHING) before sending and deletes it if
-- every channel failed, so a later run retries.
-- Server-only: RLS on, no policies, and no table privileges for end users.

CREATE TABLE IF NOT EXISTS public.booking_notifications_sent (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('trip_reminder', 'payment_review')),
  dedupe_key text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT booking_notifications_sent_once UNIQUE (booking_id, kind, dedupe_key)
);

ALTER TABLE public.booking_notifications_sent ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_notifications_sent FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.booking_notifications_sent TO service_role;

-- Confirmed bookings on live schedules starting 1 to 2 days from today (Manila), not yet reminded.
-- The 1-day lower bound lets a missed or failed run catch up the next day.
CREATE OR REPLACE FUNCTION public.bookings_due_for_trip_reminder()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT b.id
  FROM public.bookings b
  JOIN public.tour_schedules ts ON ts.id = b.tour_schedule_id
  WHERE b.status = 'confirmed'
    AND ts.deleted_at IS NULL
    AND ts.status::text <> 'cancelled'
    AND ts.start_date BETWEEN public.manila_today() + 1 AND public.manila_today() + 2
    AND NOT EXISTS (
      SELECT 1 FROM public.booking_notifications_sent n
      WHERE n.booking_id = b.id AND n.kind = 'trip_reminder'
    )
$$;

REVOKE ALL ON FUNCTION public.bookings_due_for_trip_reminder() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bookings_due_for_trip_reminder() TO service_role;
