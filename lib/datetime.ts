// Business dates are Philippine dates. The server runs in UTC, so never compare a DATE column with
// `new Date()` directly: use these helpers (and `manila_today()` in SQL).
export const BUSINESS_TIME_ZONE = 'Asia/Manila';

/** Today's date in Manila as YYYY-MM-DD, comparable with Postgres DATE strings. */
export function manilaToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
