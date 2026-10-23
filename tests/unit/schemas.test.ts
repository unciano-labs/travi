import { describe, expect, it } from 'vitest';
import {
  emailSchema,
  passwordSchema,
  phPhoneSchema,
  otpCodeSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/schemas/auth';
import { adminCancelBookingSchema, createBookingSchema, openDisputeSchema } from '@/lib/schemas/booking';
import { catalogHref, parseCatalogSearch } from '@/lib/schemas/catalog';
import {
  organizerProfileSchema,
  partnerDocumentInputSchema,
  partnerDocumentsFieldSchema,
  tinSchema,
  transporterProfileSchema,
  vehicleSchema,
} from '@/lib/schemas/partner';
import { createReviewSchema } from '@/lib/schemas/review';
import { parseScheduleForm, scheduleFormSchema } from '@/lib/schemas/schedule';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const issuePaths = (result: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  (result.error?.issues ?? []).map((i) => i.path.join('.'));

// ─── Booking ───

describe('createBookingSchema', () => {
  it('accepts a schedule id and a whole number of seats', () => {
    expect(createBookingSchema.parse({ scheduleId: ID, seats: 2 })).toEqual({ scheduleId: ID, seats: 2 });
  });

  it.each([0, -1, 1.5, 501, Number.NaN])('rejects %s seats', (seats) => {
    expect(createBookingSchema.safeParse({ scheduleId: ID, seats }).success).toBe(false);
  });

  it('does not coerce strings (the client cannot smuggle in "2" or a total)', () => {
    expect(createBookingSchema.safeParse({ scheduleId: ID, seats: '2' }).success).toBe(false);
  });

  it('strips client-supplied pricing fields', () => {
    const parsed = createBookingSchema.parse({ scheduleId: ID, seats: 1, total_amount: 1 });
    expect(parsed).not.toHaveProperty('total_amount');
  });

  it('rejects a non-uuid schedule id', () => {
    expect(createBookingSchema.safeParse({ scheduleId: '1 OR 1=1', seats: 1 }).success).toBe(false);
  });
});

describe('openDisputeSchema', () => {
  it('trims the reason before checking its length', () => {
    expect(openDisputeSchema.safeParse({ bookingId: ID, reason: `   ${'x'.repeat(19)}   ` }).success).toBe(false);
    expect(openDisputeSchema.parse({ bookingId: ID, reason: `  ${'x'.repeat(20)}  ` }).reason).toBe('x'.repeat(20));
  });

  it('caps the reason at 2000 characters', () => {
    expect(openDisputeSchema.safeParse({ bookingId: ID, reason: 'x'.repeat(2001) }).success).toBe(false);
  });
});

describe('adminCancelBookingSchema', () => {
  const base = { bookingId: ID, reason: 'Organizer canceled' };

  it('omitting amount means a full refund', () => {
    expect(adminCancelBookingSchema.parse(base).amount).toBeUndefined();
  });

  it.each([10.05, 0.01, 1500, 0.1 + 0.2])('accepts peso amount %s (at most 2 decimals)', (amount) => {
    expect(adminCancelBookingSchema.safeParse({ ...base, amount }).success).toBe(true);
  });

  it.each([0, -5, 10.005, 10_000_001])('rejects amount %s', (amount) => {
    expect(adminCancelBookingSchema.safeParse({ ...base, amount }).success).toBe(false);
  });

  it('requires a reason', () => {
    expect(adminCancelBookingSchema.safeParse({ bookingId: ID, reason: '   ok  ' }).success).toBe(false);
  });
});

// ─── Catalog (lenient) ───

describe('parseCatalogSearch', () => {
  it('returns defaults for an empty query', () => {
    const search = parseCatalogSearch({});
    expect(search).toMatchObject({ sort: 'soonest', page: 1 });
    expect(search.q).toBeUndefined();
    expect(search.guests).toBeUndefined();
  });

  it('drops invalid values instead of failing the page', () => {
    const search = parseCatalogSearch({
      guests: 'abc',
      min: '-5',
      from: '2026-13-45',
      format: 'party',
      theme: 'casino',
      sort: 'random',
      page: '0',
      duration: '99',
    });
    expect(search).toMatchObject({
      guests: undefined,
      min: undefined,
      from: undefined,
      format: undefined,
      theme: undefined,
      sort: 'soonest',
      page: 1,
      duration: undefined,
    });
  });

  it('treats blank values as not set', () => {
    expect(parseCatalogSearch({ q: '   ', destination: '' })).toMatchObject({ q: undefined, destination: undefined });
  });

  it('coerces numbers and trims text', () => {
    expect(parseCatalogSearch({ q: '  coron ', guests: '4', min: '1000', page: '3' })).toMatchObject({
      q: 'coron',
      guests: 4,
      min: 1000,
      page: 3,
    });
  });

  it('uses the first value of repeated params', () => {
    expect(parseCatalogSearch({ format: ['private', 'joiner'] }).format).toBe('private');
  });

  it('swaps reversed date and price ranges', () => {
    expect(parseCatalogSearch({ from: '2026-12-01', to: '2026-11-01', min: '5000', max: '1000' })).toMatchObject({
      from: '2026-11-01',
      to: '2026-12-01',
      min: 1000,
      max: 5000,
    });
  });

  it('drops over-long text', () => {
    expect(parseCatalogSearch({ q: 'x'.repeat(81) }).q).toBeUndefined();
  });

  // BUG: the isoDate check (lib/schemas/catalog.ts:45-48) uses Date.parse, which rolls impossible days
  // over (Feb 31 -> Mar 3) instead of failing. "?from=2026-02-31" therefore reaches the
  // search_public_tours RPC, Postgres rejects the DATE, and the catalog returns nothing (plus a Sentry
  // event) instead of ignoring the bad filter. Flip to `it` once the refine checks the round-trip.
  it.fails('drops impossible calendar dates', () => {
    expect(parseCatalogSearch({ from: '2026-02-31' }).from).toBeUndefined();
  });
});

describe('catalogHref', () => {
  it('drops defaults so URLs stay canonical', () => {
    expect(catalogHref({ sort: 'soonest', page: 1 })).toBe('/tours');
  });

  it('keeps set filters and applies overrides', () => {
    expect(catalogHref({ q: 'el nido', guests: 2, sort: 'price_asc', page: 1 }, { page: 2 })).toBe(
      '/tours?q=el+nido&guests=2&sort=price_asc&page=2'
    );
  });

  it('round-trips through parseCatalogSearch', () => {
    const search = parseCatalogSearch({ destination: 'Palawan', format: 'joiner', from: '2026-11-01', page: '2' });
    const params = Object.fromEntries(new URLSearchParams(catalogHref(search).split('?')[1]));
    expect(parseCatalogSearch(params)).toEqual(search);
  });
});

// ─── Partners ───

const organizer = {
  organizerType: 'individual' as const,
  displayName: 'Juan Tours',
  legalName: 'Juan dela Cruz',
  tin: '123-456-789-000',
  phone: '+63 917 123 4567',
  publicContactEmail: 'hello@juantours.ph',
  providesTransport: false,
};

describe('organizerProfileSchema (BIZ-08 company rules)', () => {
  it('individuals need no company details; blank optional text becomes null', () => {
    const parsed = organizerProfileSchema.parse({ ...organizer, companyName: '', businessRegistrationNo: '  ' });
    expect(parsed.companyName).toBeNull();
    expect(parsed.businessRegistrationNo).toBeNull();
  });

  it('companies need a company name and a DTI/SEC number', () => {
    const result = organizerProfileSchema.safeParse({ ...organizer, organizerType: 'company', companyName: '   ' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toEqual(expect.arrayContaining(['companyName', 'businessRegistrationNo']));
  });

  it('accepts a complete company', () => {
    const result = organizerProfileSchema.safeParse({
      ...organizer,
      organizerType: 'company',
      companyName: 'Juan Tours Inc.',
      businessRegistrationNo: 'SEC-2026-0001',
    });
    expect(result.success).toBe(true);
  });

  it('applies the same rule to transporters', () => {
    const { displayName, legalName, tin, phone } = organizer;
    const result = transporterProfileSchema.safeParse({
      displayName,
      legalName,
      tin,
      phone,
      transporterType: 'company',
      serviceAreas: ['Palawan'],
    });
    expect(issuePaths(result)).toEqual(expect.arrayContaining(['companyName', 'businessRegistrationNo']));
  });
});

describe('tinSchema', () => {
  it.each(['123456789', '123-456-789', '123 456 789 000', '123-456-789-00000'])('accepts %s', (tin) => {
    expect(tinSchema.safeParse(tin).success).toBe(true);
  });

  it.each(['12345678', '123-456-789-00', 'ABC-DEF-GHI', '123-456-789-000000'])('rejects %s', (tin) => {
    expect(tinSchema.safeParse(tin).success).toBe(false);
  });
});

describe('partner documents', () => {
  const doc = {
    docType: 'government_id',
    storagePath: `${ID}/passport.pdf`,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
  };

  it('accepts a file inside the uploader folder', () => {
    expect(partnerDocumentInputSchema.safeParse(doc).success).toBe(true);
  });

  it.each([`${ID}/../other/passport.pdf`, `../${ID}/x.pdf`, 'passport.pdf', `${ID}/sub/dir.pdf`, `${ID}/a b.pdf`])(
    'rejects storage path %s',
    (storagePath) => {
      expect(partnerDocumentInputSchema.safeParse({ ...doc, storagePath }).success).toBe(false);
    }
  );

  it('rejects other MIME types and files over 10 MB', () => {
    expect(partnerDocumentInputSchema.safeParse({ ...doc, mimeType: 'text/html' }).success).toBe(false);
    expect(partnerDocumentInputSchema.safeParse({ ...doc, sizeBytes: 10 * 1024 * 1024 + 1 }).success).toBe(false);
  });

  it('parses the JSON documents field', () => {
    expect(partnerDocumentsFieldSchema.parse(undefined)).toEqual([]);
    expect(partnerDocumentsFieldSchema.parse(JSON.stringify([doc]))).toHaveLength(1);
    expect(partnerDocumentsFieldSchema.safeParse('{not json').success).toBe(false);
    expect(partnerDocumentsFieldSchema.safeParse(JSON.stringify(Array(11).fill(doc))).success).toBe(false);
  });
});

describe('vehicleSchema', () => {
  it('normalises form input', () => {
    const parsed = vehicleSchema.parse({ name: 'Hiace', vehicleType: 'van', seatCapacity: '14', plateNumber: 'abc 1234', ratePerDay: '' });
    expect(parsed).toMatchObject({ seatCapacity: 14, plateNumber: 'ABC 1234', ratePerDay: null, status: 'active', photos: [] });
  });

  it('rejects impossible capacities and negative rates', () => {
    expect(vehicleSchema.safeParse({ name: 'Hiace', vehicleType: 'van', seatCapacity: '0' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ name: 'Hiace', vehicleType: 'van', seatCapacity: '2.5' }).success).toBe(false);
    expect(vehicleSchema.safeParse({ name: 'Hiace', vehicleType: 'van', seatCapacity: '10', ratePerDay: '-1' }).success).toBe(false);
  });
});

// ─── Schedules ───

describe('scheduleFormSchema', () => {
  const base = { startDate: '2026-11-01', endDate: '2026-11-03', capacity: '12' };

  it('coerces form strings and treats blank prices as not set', () => {
    expect(scheduleFormSchema.parse({ ...base, price_per_person: '', original_price: '' })).toEqual({
      startDate: '2026-11-01',
      endDate: '2026-11-03',
      capacity: 12,
      price_per_person: undefined,
      original_price: undefined,
      transport_type: 'none',
    });
  });

  it('allows a single-day schedule and rejects an end before the start', () => {
    expect(scheduleFormSchema.safeParse({ ...base, endDate: base.startDate }).success).toBe(true);
    const result = scheduleFormSchema.safeParse({ ...base, endDate: '2026-10-31' });
    expect(issuePaths(result)).toContain('endDate');
  });

  it.each([
    ['capacity', '0'],
    ['capacity', '1.5'],
    ['capacity', '1001'],
    ['price_per_person', '0'],
    ['price_per_person', '-100'],
    ['transport_type', 'helicopter'],
    ['startDate', '11/01/2026'],
  ])('rejects %s = %s', (field, value) => {
    expect(scheduleFormSchema.safeParse({ ...base, [field]: value }).success).toBe(false);
  });

  it('parseScheduleForm reads only known FormData fields', () => {
    const form = new FormData();
    form.set('startDate', '2026-11-01');
    form.set('endDate', '2026-11-02');
    form.set('capacity', '8');
    form.set('price_per_person', '2500');
    form.set('booked_count', '999');
    expect(parseScheduleForm(form)).toMatchObject({ capacity: 8, price_per_person: 2500 });
    expect(parseScheduleForm(form)).not.toHaveProperty('booked_count');
  });
});

// ─── Reviews ───

describe('createReviewSchema', () => {
  it('coerces the rating and turns a blank comment into null', () => {
    expect(createReviewSchema.parse({ bookingId: ID, rating: '5', comment: '   ' })).toEqual({ bookingId: ID, rating: 5, comment: null });
  });

  it.each([0, 6, 4.5, 'abc'])('rejects rating %s', (rating) => {
    expect(createReviewSchema.safeParse({ bookingId: ID, rating }).success).toBe(false);
  });

  it('caps the comment at 1000 characters', () => {
    expect(createReviewSchema.safeParse({ bookingId: ID, rating: 4, comment: 'x'.repeat(1001) }).success).toBe(false);
  });
});

// ─── Auth ───

describe('passwordSchema (BIZ-15)', () => {
  it('requires 8 to 72 characters', () => {
    expect(passwordSchema.safeParse('1234567').success).toBe(false);
    expect(passwordSchema.safeParse('12345678').success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(72)).success).toBe(true);
    expect(passwordSchema.safeParse('x'.repeat(73)).success).toBe(false);
  });

  it('is enforced on signup and reset', () => {
    const signup = { email: 'a@b.ph', password: 'short', firstName: 'A', lastName: 'B', role: 'traveler' };
    expect(issuePaths(signupSchema.safeParse(signup))).toContain('password');
    expect(resetPasswordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success).toBe(false);
  });

  it('reset requires matching passwords', () => {
    const result = resetPasswordSchema.safeParse({ password: 'longenough1', confirmPassword: 'longenough2' });
    expect(issuePaths(result)).toEqual(['confirmPassword']);
  });

  it('signup cannot self-assign admin', () => {
    const result = signupSchema.safeParse({ email: 'a@b.ph', password: 'longenough', firstName: 'A', lastName: 'B', role: 'admin' });
    expect(issuePaths(result)).toContain('role');
  });
});

describe('emailSchema', () => {
  it('trims and lower-cases', () => {
    expect(emailSchema.parse('  Juan@Example.PH ')).toBe('juan@example.ph');
  });

  it.each(['not-an-email', 'a@', '@b.ph', ''])('rejects %j', (email) => {
    expect(emailSchema.safeParse(email).success).toBe(false);
  });
});

describe('phPhoneSchema and otpCodeSchema', () => {
  it.each([
    ['09171234567', '09171234567'],
    ['0917 123 4567', '09171234567'],
    ['0917-123-4567', '09171234567'],
    ['+639171234567', '+639171234567'],
  ])('accepts %s', (input, expected) => {
    expect(phPhoneSchema.parse(input)).toBe(expected);
  });

  it.each(['08171234567', '0917123456', '+6309171234567', '639171234567', '091712345678'])('rejects %s', (input) => {
    expect(phPhoneSchema.safeParse(input).success).toBe(false);
  });

  it('OTP codes are exactly 6 digits', () => {
    expect(otpCodeSchema.parse(' 123456 ')).toBe('123456');
    expect(otpCodeSchema.safeParse('12345').success).toBe(false);
    expect(otpCodeSchema.safeParse('12345a').success).toBe(false);
  });
});
