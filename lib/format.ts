// Shared display formatters (ENG-09). Pure, and pinned to the en-PH locale and the Asia/Manila (or,
// for DATE columns, UTC) time zone, so the server and the browser render the same text whatever the
// process or browser defaults are. Never call a locale-less `toLocaleString()` on money, counts or
// dates that are rendered by a Server Component AND hydrated: the server and browser disagree.
//
// Decisions:
// - Money is PHP with `Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' })` → "₱1,234.50".
//   Amounts people act on (totals, payments, refunds, wallet, payouts, emails) always show centavos:
//   "₱1,500.00" (the default, `cents: 'always'`). Listing prices (catalog, tour cards, price chips,
//   "from" prices, policy copy) use `cents: 'auto'`: "₱1,500", but "₱1,499.50" when there are centavos.
// - Missing or non-numeric amounts (null, undefined, '', NaN, Infinity) render as an em dash ("—"),
//   never as "₱0.00", which would claim a value we do not have. Pass `fallback` to override.
// - Postgres `numeric` arrives as a string; numeric strings are accepted.
// - Dates: DATE columns (schedule start/end, YYYY-MM-DD) go through formatBusinessDate (UTC, never
//   shifts a day). Instants (timestamptz: created_at, paid at, pickup time) show in Asia/Manila.
import { formatBusinessDate, formatManilaDateTime } from '@/lib/datetime';

export { formatBusinessDate, formatManilaDateTime, formatManilaTime } from '@/lib/datetime';

/** Shown for a missing amount or date. */
export const EMPTY_VALUE = '—';

export interface FormatPHPOptions {
  /** 'always' (default): "₱1,500.00". 'auto': "₱1,500", or "₱1,499.50" when there are centavos. */
  cents?: 'always' | 'auto';
  /** Returned for null/undefined/''/non-numeric input. Default "—". */
  fallback?: string;
  /** 'exceptZero' renders "+₱25.00" / "-₱25.00" (e.g. ledger rows). Default 'auto' ("-₱25.00" only). */
  signDisplay?: 'auto' | 'exceptZero';
}

const pesoFormatters = new Map<string, Intl.NumberFormat>();
function pesoFormatter(fractionDigits: 0 | 2, signDisplay: 'auto' | 'exceptZero'): Intl.NumberFormat {
  const key = `${fractionDigits}:${signDisplay}`;
  let formatter = pesoFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
      signDisplay,
    });
    pesoFormatters.set(key, formatter);
  }
  return formatter;
}

/** A finite number from a number or numeric string (Postgres `numeric`), else null. */
export function toAmount(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** "₱1,234.50". See the decisions at the top of this file. */
export function formatPHP(amount: number | string | null | undefined, opts: FormatPHPOptions = {}): string {
  const n = toAmount(amount);
  if (n === null) return opts.fallback ?? EMPTY_VALUE;
  const centavos = Math.round(n * 100);
  const whole = opts.cents === 'auto' && centavos % 100 === 0;
  // Normalise -0 so a zero never renders as "-₱0.00".
  const value = centavos === 0 ? 0 : centavos / 100;
  return pesoFormatter(whole ? 0 : 2, opts.signDisplay ?? 'auto').format(value);
}

const numberFormatter = new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 });

/** "12,345" for counts and plain quantities (en-PH grouping). Missing → "—". */
export function formatNumber(value: number | string | null | undefined): string {
  const n = toAmount(value);
  return n === null ? EMPTY_VALUE : numberFormatter.format(n);
}

const isValidInstant = (value: string | Date) => !Number.isNaN((typeof value === 'string' ? new Date(value) : value).getTime());

/** A DATE column value ("Oct 23, 2026"), never shifted a day. Missing → "—"; unparseable → as given. */
export function formatDate(value: string | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return EMPTY_VALUE;
  return formatBusinessDate(value, options);
}

/** An instant in Manila time ("Oct 23, 2026, 8:00 AM"). Missing or invalid → "—". */
export function formatDateTime(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value || !isValidInstant(value)) return EMPTY_VALUE;
  return formatManilaDateTime(value, options);
}

/** The Manila calendar date of an instant ("Oct 23, 2026"), e.g. "booked on". Missing or invalid → "—". */
export function formatDateOfInstant(value: string | Date | null | undefined): string {
  return formatDateTime(value, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** The Manila time of day of an instant ("8:00 AM"). Missing or invalid → "—". */
export function formatTimeOfInstant(value: string | Date | null | undefined): string {
  return formatDateTime(value, { hour: 'numeric', minute: '2-digit' });
}

/**
 * A DATE range: "Oct 23 – Oct 25, 2026", or "Dec 30, 2026 – Jan 2, 2027" across years, or a single
 * date when both ends are the same day. Missing start → "—".
 */
export function formatDateRange(start: string | null | undefined, end?: string | null): string {
  if (!start) return EMPTY_VALUE;
  if (!end || end.slice(0, 10) === start.slice(0, 10)) return formatDate(start);
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  const startText = sameYear ? formatBusinessDate(start, { month: 'short', day: 'numeric' }) : formatBusinessDate(start);
  return `${startText} – ${formatBusinessDate(end)}`;
}
