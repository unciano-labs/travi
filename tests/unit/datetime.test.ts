import { describe, expect, it } from 'vitest';
import {
  formatBusinessDate,
  formatManilaDateTime,
  formatManilaTime,
  manilaDateOf,
  manilaDateTimeToIso,
  manilaTimeOf,
  manilaToday,
} from '@/lib/datetime';

// vitest.config.mts runs these with TZ=America/New_York, so any leak of the process zone shows up.

describe('manilaToday / manilaDateOf', () => {
  it('rolls over at Manila midnight (16:00 UTC), not UTC midnight', () => {
    expect(manilaToday(new Date('2026-10-22T15:59:59.999Z'))).toBe('2026-10-22');
    expect(manilaToday(new Date('2026-10-22T16:00:00.000Z'))).toBe('2026-10-23');
  });

  it('is already "tomorrow" in Manila while it is still "today" in UTC', () => {
    const lateUtcEvening = new Date('2026-10-22T23:30:00Z');
    expect(lateUtcEvening.toISOString().slice(0, 10)).toBe('2026-10-22');
    expect(manilaToday(lateUtcEvening)).toBe('2026-10-23');
  });

  it('handles month and year boundaries', () => {
    expect(manilaToday(new Date('2026-12-31T16:00:00Z'))).toBe('2027-01-01');
    expect(manilaToday(new Date('2028-02-28T16:00:00Z'))).toBe('2028-02-29');
  });

  it('returns a YYYY-MM-DD string comparable with Postgres DATE values', () => {
    expect(manilaToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('manilaDateOf accepts ISO strings and Date objects', () => {
    expect(manilaDateOf('2026-10-22T16:30:00Z')).toBe('2026-10-23');
    expect(manilaDateOf('2026-10-23T00:30:00+08:00')).toBe('2026-10-23');
    expect(manilaDateOf(new Date('2026-10-22T10:00:00Z'))).toBe('2026-10-22');
  });
});

describe('manilaTimeOf', () => {
  it('formats the Manila wall-clock time as 24h HH:mm', () => {
    expect(manilaTimeOf('2026-10-22T16:05:00Z')).toBe('00:05');
    expect(manilaTimeOf('2026-10-23T05:30:00Z')).toBe('13:30');
  });
});

describe('manilaDateTimeToIso', () => {
  it('reads date + time as Manila time (UTC+8, no DST)', () => {
    expect(manilaDateTimeToIso('2026-10-23', '08:00')).toBe('2026-10-23T00:00:00.000Z');
    expect(manilaDateTimeToIso('2026-10-23', '00:30')).toBe('2026-10-22T16:30:00.000Z');
    expect(manilaDateTimeToIso('2026-06-15', '23:59')).toBe('2026-06-15T15:59:00.000Z');
  });

  it('round-trips with manilaDateOf / manilaTimeOf', () => {
    const iso = manilaDateTimeToIso('2027-01-01', '00:15');
    expect(manilaDateOf(iso)).toBe('2027-01-01');
    expect(manilaTimeOf(iso)).toBe('00:15');
  });

  it.each([
    ['', '08:00'],
    ['2026-10-23', ''],
    ['not-a-date', '08:00'],
    ['2026-13-01', '08:00'],
    ['2026-10-23', '25:00'],
    ['2026-10-23', '8am'],
  ])('throws on invalid input %j %j', (date, time) => {
    expect(() => manilaDateTimeToIso(date, time)).toThrow('Invalid date or time');
  });

  // BUG: V8's Date parser rolls impossible calendar days over (Feb 30 -> Mar 2) instead of returning
  // NaN, so manilaDateTimeToIso() (lib/datetime.ts:39-43) silently returns a different day instead of
  // throwing. Flip to `it` once the helper validates the round-trip.
  it.fails('throws on an impossible calendar day', () => {
    expect(() => manilaDateTimeToIso('2026-02-30', '08:00')).toThrow('Invalid date or time');
  });
});

describe('formatBusinessDate', () => {
  it('formats a DATE value without drifting a day in any process time zone', () => {
    expect(formatBusinessDate('2026-10-23')).toBe('Oct 23, 2026');
    expect(formatBusinessDate('2026-01-01')).toBe('Jan 1, 2026');
  });

  it('ignores a time part', () => {
    expect(formatBusinessDate('2026-10-23T23:59:59+08:00')).toBe('Oct 23, 2026');
  });

  it('accepts custom options', () => {
    expect(formatBusinessDate('2026-10-23', { weekday: 'long' })).toBe('Friday');
  });

  it('returns the input unchanged when it is not a date', () => {
    expect(formatBusinessDate('soon')).toBe('soon');
  });
});

describe('formatManilaDateTime / formatManilaTime', () => {
  it('formats in Manila time regardless of the process zone', () => {
    const out = formatManilaDateTime('2026-10-23T00:00:00Z');
    expect(out).toContain('Oct 23, 2026');
    expect(out).toMatch(/8:00\s?AM/i);
    expect(formatManilaTime('2026-10-22T16:05:00Z')).toMatch(/12:05\s?AM/i);
  });
});
