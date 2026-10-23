// Formatting helpers for admin finance screens and CSV exports. Pure functions, safe on server and client.

/** Show only the last 4 characters of an account / wallet number (AGENTS.md §5.6: mask account numbers). */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = String(value).replace(/\s+/g, '');
  if (compact.length <= 4) return `••${compact.slice(-2)}`;
  return `••••${compact.slice(-4)}`;
}

/** ₱1,234.50 */
export function peso(amount: number | string | null | undefined): string {
  const n = Number(amount ?? 0);
  return `₱${(Number.isFinite(n) ? n : 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** "Oct 23, 2026, 2:05 PM" in Manila time. */
export function manilaDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-US', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** "Oct 23, 2026" for a date-only value (no time-zone shift). */
export function shortDate(value: string | null | undefined): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' });
}

/** Human labels for booking_payments.review_reason. */
export const REVIEW_REASON_LABELS: Record<string, string> = {
  amount_mismatch: 'Wrong amount',
  duplicate_payment: 'Duplicate payment',
  late_payment_needs_refund: 'Late payment, no seats',
  booking_closed_needs_refund: 'Booking already closed',
};
