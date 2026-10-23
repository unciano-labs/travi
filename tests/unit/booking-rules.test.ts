import { describe, expect, it } from 'vitest';
import { addDays, bookingFlags } from '@/components/traveler/bookingRules';

const TODAY = '2026-10-23';
const WINDOW = 3; // escrow_holding_days

const booking = (over: Partial<Parameters<typeof bookingFlags>[0]> = {}) => ({
  status: 'confirmed',
  dispute_status: 'none',
  start_date: '2026-11-01',
  end_date: '2026-11-03',
  ...over,
});

describe('addDays', () => {
  it('adds calendar days across month, year and leap-day boundaries', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-23', 0)).toBe('2026-10-23');
  });
});

describe('bookingFlags', () => {
  it('pending, future trip: can pay and cancel, cannot dispute', () => {
    expect(bookingFlags(booking({ status: 'pending' }), TODAY, WINDOW)).toEqual({ canPay: true, canCancel: true, canDispute: false });
  });

  it('confirmed, future trip: can cancel only', () => {
    expect(bookingFlags(booking(), TODAY, WINDOW)).toEqual({ canPay: false, canCancel: true, canDispute: false });
  });

  it('nothing can be paid or cancelled once the trip has started (start_date is today)', () => {
    const flags = bookingFlags(booking({ status: 'pending', start_date: TODAY, end_date: TODAY }), TODAY, WINDOW);
    expect(flags.canPay).toBe(false);
    expect(flags.canCancel).toBe(false);
  });

  it('confirmed, trip started: can dispute until end_date + window (inclusive)', () => {
    const started = { start_date: '2026-10-15', end_date: '2026-10-20' };
    expect(bookingFlags(booking(started), '2026-10-20', WINDOW).canDispute).toBe(true);
    expect(bookingFlags(booking(started), '2026-10-23', WINDOW).canDispute).toBe(true);
    expect(bookingFlags(booking(started), '2026-10-24', WINDOW).canDispute).toBe(false);
  });

  it('a dispute window of 0 days still allows disputing on the end date', () => {
    const started = { start_date: '2026-10-20', end_date: '2026-10-23' };
    expect(bookingFlags(booking(started), TODAY, 0).canDispute).toBe(true);
    expect(bookingFlags(booking(started), '2026-10-24', 0).canDispute).toBe(false);
  });

  it('cannot dispute twice, or a booking that is not confirmed', () => {
    const started = { start_date: '2026-10-20', end_date: '2026-10-22' };
    expect(bookingFlags(booking({ ...started, dispute_status: 'open' }), TODAY, WINDOW).canDispute).toBe(false);
    expect(bookingFlags(booking({ ...started, dispute_status: 'resolved_denied' }), TODAY, WINDOW).canDispute).toBe(false);
    for (const status of ['pending', 'canceled', 'refunded', 'completed']) {
      expect(bookingFlags(booking({ ...started, status }), TODAY, WINDOW).canDispute).toBe(false);
    }
  });

  it('treats a null dispute_status as none', () => {
    const started = { start_date: '2026-10-20', end_date: '2026-10-22', dispute_status: null };
    expect(bookingFlags(booking(started), TODAY, WINDOW).canDispute).toBe(true);
  });

  it.each(['canceled', 'refunded', 'completed'])('%s bookings allow nothing', (status) => {
    expect(bookingFlags(booking({ status }), TODAY, WINDOW)).toEqual({ canPay: false, canCancel: false, canDispute: false });
  });

  it('without dates nothing is cancellable or disputable', () => {
    expect(bookingFlags(booking({ start_date: null, end_date: null }), TODAY, WINDOW)).toMatchObject({ canCancel: false, canDispute: false });
  });
});
