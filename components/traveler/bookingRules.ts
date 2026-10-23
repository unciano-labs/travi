// What a traveler may do with a booking. Dates are Manila business dates (YYYY-MM-DD strings, see
// lib/datetime.ts); `today` comes from the server. The server actions and DB functions re-check all
// of this; these flags only decide which buttons to show.

export interface BookingRuleInput {
  status: string;
  dispute_status: string | null;
  start_date: string | null;
  end_date: string | null;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function bookingFlags(b: BookingRuleInput, today: string, disputeWindowDays: number) {
  const started = Boolean(b.start_date && b.start_date <= today);
  const canPay = b.status === 'pending' && !started;
  const canCancel = (b.status === 'pending' || b.status === 'confirmed') && Boolean(b.start_date) && !started;
  // open_booking_dispute(): confirmed, no dispute yet, until end_date + escrow_holding_days. Before the
  // trip starts, cancelling (full refund) is the right tool, so the button only shows once it has started.
  const canDispute =
    b.status === 'confirmed' &&
    (b.dispute_status ?? 'none') === 'none' &&
    started &&
    Boolean(b.end_date) &&
    addDays(b.end_date as string, disputeWindowDays) >= today;
  return { canPay, canCancel, canDispute };
}
