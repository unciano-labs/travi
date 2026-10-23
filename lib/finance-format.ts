// Formatting helpers for admin finance screens and CSV exports. Pure functions, safe on server and client.
// Money and date formatting lives in lib/format.ts (formatPHP, formatDate, formatDateTime).

/** Show only the last 4 characters of an account / wallet number (AGENTS.md §5.6: mask account numbers). */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = String(value).replace(/\s+/g, '');
  if (compact.length <= 4) return `••${compact.slice(-2)}`;
  return `••••${compact.slice(-4)}`;
}

/** Human labels for booking_payments.review_reason. */
export const REVIEW_REASON_LABELS: Record<string, string> = {
  amount_mismatch: 'Wrong amount',
  duplicate_payment: 'Duplicate payment',
  late_payment_needs_refund: 'Late payment, no seats',
  booking_closed_needs_refund: 'Booking already closed',
};
