import { describe, expect, it } from 'vitest';
import {
  EMPTY_VALUE,
  formatDate,
  formatDateOfInstant,
  formatDateRange,
  formatDateTime,
  formatNumber,
  formatPHP,
  formatTimeOfInstant,
  toAmount,
} from '@/lib/format';

// vitest.config.mts runs these with TZ=America/New_York, so any leak of the process zone shows up.
// Normalise the narrow no-break space some ICU versions put before AM/PM.
const plain = (s: string) => s.replace(/[  ]/g, ' ');

describe('toAmount', () => {
  it('accepts numbers and numeric strings (Postgres numeric)', () => {
    expect(toAmount(12.5)).toBe(12.5);
    expect(toAmount('1500.00')).toBe(1500);
    expect(toAmount(' 7 ')).toBe(7);
    expect(toAmount(0)).toBe(0);
  });

  it('returns null for missing or non-numeric values', () => {
    expect(toAmount(null)).toBeNull();
    expect(toAmount(undefined)).toBeNull();
    expect(toAmount('')).toBeNull();
    expect(toAmount('abc')).toBeNull();
    expect(toAmount(Number.NaN)).toBeNull();
    expect(toAmount(Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe('formatPHP', () => {
  it('formats pesos with centavos and thousands separators by default', () => {
    expect(formatPHP(1234.5)).toBe('₱1,234.50');
    expect(formatPHP('1000000')).toBe('₱1,000,000.00');
    expect(formatPHP(1500)).toBe('₱1,500.00');
    expect(formatPHP(0)).toBe('₱0.00');
  });

  it('rounds to the centavo', () => {
    expect(formatPHP(0.005)).toBe('₱0.01');
    expect(formatPHP(19.999)).toBe('₱20.00');
    expect(formatPHP('2499.994')).toBe('₱2,499.99');
  });

  it("drops .00 for whole pesos with cents: 'auto', but keeps real centavos", () => {
    expect(formatPHP(1500, { cents: 'auto' })).toBe('₱1,500');
    expect(formatPHP('1500.00', { cents: 'auto' })).toBe('₱1,500');
    expect(formatPHP(1499.5, { cents: 'auto' })).toBe('₱1,499.50');
    expect(formatPHP(1499.999, { cents: 'auto' })).toBe('₱1,500');
  });

  it('shows a dash (or the given fallback) for missing amounts, never ₱0.00', () => {
    expect(formatPHP(null)).toBe(EMPTY_VALUE);
    expect(formatPHP(undefined)).toBe('—');
    expect(formatPHP('')).toBe('—');
    expect(formatPHP('abc')).toBe('—');
    expect(formatPHP(Number.NaN)).toBe('—');
    expect(formatPHP(null, { fallback: 'Contact for rate' })).toBe('Contact for rate');
  });

  it('formats negatives, and signs on request', () => {
    expect(formatPHP(-25)).toBe('-₱25.00');
    expect(formatPHP(25, { signDisplay: 'exceptZero' })).toBe('+₱25.00');
    expect(formatPHP(-25, { signDisplay: 'exceptZero' })).toBe('-₱25.00');
    expect(formatPHP(0, { signDisplay: 'exceptZero' })).toBe('₱0.00');
    expect(formatPHP(-0.001)).toBe('₱0.00');
  });
});

describe('formatNumber', () => {
  it('groups with en-PH separators regardless of the runtime locale', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber('12.345')).toBe('12.35');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(null)).toBe('—');
  });
});

describe('formatDate (DATE columns)', () => {
  it('never shifts a day in a non-Manila process zone', () => {
    expect(formatDate('2026-10-23')).toBe('Oct 23, 2026');
    expect(formatDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatDate('2026-10-23T23:00:00Z')).toBe('Oct 23, 2026');
  });

  it('shows a dash when missing and the raw value when unparseable', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('garbage')).toBe('garbage');
  });

  it('accepts custom options', () => {
    expect(formatDate('2026-10-23', { month: 'short', day: 'numeric' })).toBe('Oct 23');
  });
});

describe('formatDateRange', () => {
  it('collapses the year within one year', () => {
    expect(formatDateRange('2026-10-23', '2026-10-25')).toBe('Oct 23 – Oct 25, 2026');
  });

  it('keeps both years across a year boundary', () => {
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe('Dec 30, 2026 – Jan 2, 2027');
  });

  it('shows one date for a single-day trip or a missing end', () => {
    expect(formatDateRange('2026-10-23', '2026-10-23')).toBe('Oct 23, 2026');
    expect(formatDateRange('2026-10-23', null)).toBe('Oct 23, 2026');
    expect(formatDateRange(null, '2026-10-23')).toBe('—');
  });
});

describe('formatDateTime / formatDateOfInstant / formatTimeOfInstant (instants)', () => {
  it('shows the Manila wall clock, not the process zone', () => {
    // 16:05 UTC on Oct 22 is 00:05 on Oct 23 in Manila (and 12:05 PM on Oct 22 in New York).
    expect(plain(formatDateTime('2026-10-22T16:05:00Z'))).toBe('Oct 23, 2026, 12:05 AM');
    expect(formatDateOfInstant('2026-10-22T16:05:00Z')).toBe('Oct 23, 2026');
    expect(plain(formatTimeOfInstant('2026-10-22T16:05:00Z'))).toBe('12:05 AM');
    expect(plain(formatDateTime(new Date('2026-10-23T00:00:00Z')))).toBe('Oct 23, 2026, 8:00 AM');
  });

  it('shows a dash for missing or invalid instants instead of throwing', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('not a date')).toBe('—');
    expect(formatDateOfInstant(undefined)).toBe('—');
    expect(formatTimeOfInstant(null)).toBe('—');
  });
});
