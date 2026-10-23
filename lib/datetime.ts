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

const MANILA_UTC_OFFSET = '+08:00'; // Asia/Manila has no daylight saving time.

/**
 * True only for a real calendar date in YYYY-MM-DD form. `Date.parse` rolls impossible days over
 * (2026-02-30 → March 2), so check that the parsed date round-trips to the same components.
 */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value);

/** Manila calendar date (YYYY-MM-DD) of an instant, e.g. a timestamptz pickup time. */
export function manilaDateOf(value: string | Date): string {
  return manilaToday(toDate(value));
}

/** Manila wall-clock time (HH:mm, 24h) of an instant. */
export function manilaTimeOf(value: string | Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(toDate(value));
}

/**
 * ISO timestamp (UTC) for a Manila date (YYYY-MM-DD) and wall-clock time (HH:mm). Use this instead
 * of `${date}T${time}`, which Postgres and `new Date()` would read as UTC or browser time.
 */
export function manilaDateTimeToIso(date: string, time: string): string {
  if (!isCalendarDate(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Invalid date or time');
  const parsed = new Date(`${date}T${time}:00${MANILA_UTC_OFFSET}`);
  if (Number.isNaN(parsed.getTime())) throw new Error('Invalid date or time');
  return parsed.toISOString();
}

/** Format an instant in Manila time (default: "Oct 23, 2026, 8:00 AM"). */
export function formatManilaDateTime(
  value: string | Date,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }
): string {
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: BUSINESS_TIME_ZONE }).format(toDate(value));
}

/** Format an instant's Manila time of day ("8:00 AM"). */
export function formatManilaTime(value: string | Date): string {
  return formatManilaDateTime(value, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Format a DATE column value (YYYY-MM-DD) as a calendar date. A DATE has no time zone, so it is
 * formatted in UTC; `new Date('2026-10-23')` shown in a browser's zone can drift by a day.
 */
export function formatBusinessDate(
  date: string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }
): string {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'UTC' }).format(parsed);
}
