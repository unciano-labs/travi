import { describe, expect, it } from 'vitest';
import { safeNextPath } from '@/lib/safe-next';

describe('safeNextPath', () => {
  it.each([
    ['/dashboard', '/dashboard'],
    ['/dashboard/traveler/bookings', '/dashboard/traveler/bookings'],
    ['/tours/el-nido-123456?date=2026-11-01#book', '/tours/el-nido-123456?date=2026-11-01#book'],
    ['  /tours  ', '/tours'],
    ['/a/../b', '/b'],
  ])('allows same-site path %j', (input, expected) => {
    expect(safeNextPath(input)).toBe(expected);
  });

  it.each([
    ['protocol-relative', '//evil.example'],
    ['protocol-relative with path', '//evil.example/dashboard'],
    ['backslash after slash', '/\\evil.example'],
    ['backslash later in the path', '/dashboard\\..\\evil'],
    ['dot-segment that normalises to //', '/..//evil.example'],
    ['single-dot segment that normalises to //', '/.//evil.example'],
    ['encoded dot-segments that normalise to //', '/%2e%2e//evil.example'],
    ['absolute https URL', 'https://evil.example'],
    ['absolute http URL', 'http://travi.ph/dashboard'],
    ['javascript: URL', 'javascript:alert(1)'],
    ['data: URL', 'data:text/html,<script>alert(1)</script>'],
    ['relative path', 'dashboard'],
    ['tab inside', '/\t/evil.example'],
    ['newline inside', '/dash\nboard'],
    ['NUL inside', '/dash\u0000board'],
    ['DEL inside', '/dash\u007fboard'],
    ['empty', ''],
    ['whitespace only', '   '],
  ])('rejects %s', (_label, input) => {
    expect(safeNextPath(input)).toBeNull();
  });

  it('keeps percent-encoded slashes encoded (a browser treats them as one path segment)', () => {
    for (const input of ['/%2F%2Fevil.example', '/%2f%2fevil.example', '/%5Cevil.example']) {
      const out = safeNextPath(input);
      expect(out).not.toBeNull();
      expect(out!.startsWith('//')).toBe(false);
      expect(out!.startsWith('/\\')).toBe(false);
    }
  });

  it('never returns a value a browser would read as another origin', () => {
    const tricky = ['/..//evil', '/./..//evil', '/a/../..//evil', '/%2e//evil', '/.%2e//evil', '//\\evil', '/\\/evil'];
    for (const input of tricky) {
      const out = safeNextPath(input);
      if (out !== null) {
        expect(new URL(out, 'https://travi.ph').origin).toBe('https://travi.ph');
      }
    }
  });

  it('bounds the length', () => {
    expect(safeNextPath(`/${'a'.repeat(511)}`)).toBe(`/${'a'.repeat(511)}`);
    expect(safeNextPath(`/${'a'.repeat(512)}`)).toBeNull();
  });

  it.each([null, undefined, 42, {}, ['/dashboard']])('rejects non-string %j', (input) => {
    expect(safeNextPath(input)).toBeNull();
  });
});
