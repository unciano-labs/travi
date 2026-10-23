import { describe, expect, it } from 'vitest';
import { csvCell, csvLine } from '@/lib/csv';
import { maskAccountNumber } from '@/lib/finance-format';

describe('csvCell', () => {
  it.each(['=HYPERLINK("http://evil","x")', '+1+1', '-2+3', '@SUM(A1:A2)', '\t=1', '\r=1'])(
    'neutralises spreadsheet formula %j with a leading apostrophe',
    (value) => {
      const cell = csvCell(value);
      const unquoted = cell.startsWith('"') ? cell.slice(1, -1).replace(/""/g, '"') : cell;
      expect(unquoted.startsWith("'")).toBe(true);
      expect(unquoted.slice(1)).toBe(value);
    }
  );

  it('quotes cells with commas, quotes and line breaks (RFC 4180)', () => {
    expect(csvCell('Coron, Palawan')).toBe('"Coron, Palawan"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\r\nline2')).toBe('"line1\r\nline2"');
  });

  it('applies the formula guard before quoting', () => {
    expect(csvCell('=1,2')).toBe(`"'=1,2"`);
  });

  it('leaves ordinary text alone', () => {
    expect(csvCell('BK-1A2B3C')).toBe('BK-1A2B3C');
    expect(csvCell('juan@example.com')).toBe('juan@example.com');
  });

  it('formats non-string values', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
    expect(csvCell(1500.5)).toBe('1500.5');
    expect(csvCell(-25)).toBe('-25'); // numbers are data, not formulas
    expect(csvCell(Number.NaN)).toBe('');
    expect(csvCell(Number.POSITIVE_INFINITY)).toBe('');
    expect(csvCell(true)).toBe('true');
    expect(csvCell(false)).toBe('false');
  });
});

describe('csvLine', () => {
  it('joins cells with commas and ends with CRLF', () => {
    expect(csvLine(['BK-1', 'Tour, A', 100, null, '=cmd'])).toBe(`BK-1,"Tour, A",100,,'=cmd\r\n`);
  });
});

describe('maskAccountNumber', () => {
  it('shows only the last 4 characters', () => {
    expect(maskAccountNumber('09171234567')).toBe('••••4567');
    expect(maskAccountNumber('1234 5678 9012')).toBe('••••9012');
  });

  it('never reveals more than 2 characters of a short number', () => {
    expect(maskAccountNumber('1234')).toBe('••34');
    expect(maskAccountNumber('12')).toBe('••12');
  });

  it('returns null for empty values', () => {
    expect(maskAccountNumber(null)).toBeNull();
    expect(maskAccountNumber(undefined)).toBeNull();
    expect(maskAccountNumber('')).toBeNull();
  });

  it('never contains the full number', () => {
    const number = '001234567890';
    expect(maskAccountNumber(number)).not.toContain(number.slice(0, 8));
  });
});

// Money and date formatting: see format.test.ts.
