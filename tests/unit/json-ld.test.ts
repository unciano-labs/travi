import { describe, expect, it } from 'vitest';
import { serializeJsonLd } from '@/lib/json-ld';

// Built at runtime: literal line/paragraph separators in source are line terminators and confuse tooling.
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe('serializeJsonLd', () => {
  it('cannot close the surrounding <script> tag', () => {
    const out = serializeJsonLd({ name: '</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(out).not.toContain('>');
    expect(out.toLowerCase()).not.toContain('</script');
  });

  it('escapes &, <, > and the JS line/paragraph separators as \\uXXXX', () => {
    const out = serializeJsonLd({ a: '<>&', b: `x${LS}y${PS}z` });
    expect(out).toContain('\\u003c\\u003e\\u0026');
    expect(out).toContain('\\u2028');
    expect(out).toContain('\\u2029');
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
  });

  it('parses back to exactly the original data', () => {
    const data = {
      '@context': 'https://schema.org',
      '@type': 'TouristTrip',
      name: `Tom & Jerry's <El Nido> "tour"${LS}`,
      offers: { price: 1500.5, priceCurrency: 'PHP' },
      tags: ['a', null, true],
    };
    expect(JSON.parse(serializeJsonLd(data))).toEqual(data);
  });

  it('leaves plain text untouched', () => {
    expect(serializeJsonLd({ name: 'Coron Island Hopping' })).toBe('{"name":"Coron Island Hopping"}');
  });
});
