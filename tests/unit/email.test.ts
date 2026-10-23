import { describe, expect, it, vi } from 'vitest';
import { escapeHtml, maskEmail, siteUrl } from '@/lib/email';
import * as templates from '@/lib/email-templates';
import type { EmailContent } from '@/lib/email-templates';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_SITE_URL: 'https://staging.travi.ph/', RESEND_API_KEY: undefined, RESEND_FROM_EMAIL: undefined },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  captureException: vi.fn(),
}));

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe('&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
  });

  it('escapes & first, so existing entities are not double-decoded', () => {
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  it('leaves plain text untouched', () => {
    expect(escapeHtml('Juan dela Cruz — El Nido ₱1,500')).toBe('Juan dela Cruz — El Nido ₱1,500');
  });
});

describe('maskEmail', () => {
  it('keeps two characters of the local part and the domain', () => {
    expect(maskEmail('juan.delacruz@example.com')).toBe('ju***@example.com');
    expect(maskEmail('a@example.com')).toBe('a***@example.com');
  });

  it('never returns the full local part', () => {
    expect(maskEmail('secretname@example.com')).not.toContain('secretname');
  });

  it('masks anything that is not an email', () => {
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('')).toBe('***');
  });
});

describe('siteUrl', () => {
  it('joins NEXT_PUBLIC_SITE_URL and the path with exactly one slash', () => {
    expect(siteUrl('/dashboard/traveler/bookings')).toBe('https://staging.travi.ph/dashboard/traveler/bookings');
    expect(siteUrl('tours')).toBe('https://staging.travi.ph/tours');
    expect(siteUrl()).toBe('https://staging.travi.ph/');
  });
});

// ─── Templates: every user-controlled string must be escaped in the HTML ───

const XSS = `<script>alert("x")</script><img src=x onerror='alert(1)'>`;
const RAW_FRAGMENTS = ['<script>', '<img src=x', `onerror='`, `alert("x")`];
const CTA_URL = 'https://staging.travi.ph/dashboard?x=1&y="2"';

function expectEscaped(email: EmailContent) {
  for (const fragment of RAW_FRAGMENTS) expect(email.html).not.toContain(fragment);
  expect(email.html).toContain('&lt;script&gt;');
  // The plain-text part is not HTML: it keeps the text as written.
  expect(email.text).toContain(XSS);
  expect(email.subject.length).toBeGreaterThan(0);
}

const booking = {
  travelerName: XSS,
  bookingRef: 'BK-1A2B3C',
  tourTitle: XSS,
  location: XSS,
  startDate: '2026-11-01',
  endDate: '2026-11-03',
  seats: 2,
  amount: 3000,
};

const cases: [string, () => EmailContent][] = [
  ['bookingConfirmedEmail', () => templates.bookingConfirmedEmail({ ...booking, bookingUrl: CTA_URL })],
  [
    'paymentNeedsReviewEmail',
    () =>
      templates.paymentNeedsReviewEmail({ travelerName: XSS, bookingRef: 'BK-1', tourTitle: XSS, reason: 'amount_mismatch', bookingsUrl: CTA_URL }),
  ],
  [
    'bookingCanceledEmail',
    () =>
      templates.bookingCanceledEmail({ travelerName: XSS, bookingRef: 'BK-1', tourTitle: XSS, startDate: '2026-11-01', refundAmount: 100, bookingsUrl: CTA_URL }),
  ],
  ['tripReminderEmail', () => templates.tripReminderEmail({ ...booking, organizerName: XSS, bookingUrl: CTA_URL })],
  ['disputeOpenedTravelerEmail', () => templates.disputeOpenedTravelerEmail({ travelerName: XSS, bookingRef: 'BK-1', tourTitle: XSS, bookingsUrl: CTA_URL })],
  [
    'disputeOpenedOrganizerEmail',
    () => templates.disputeOpenedOrganizerEmail({ organizerName: XSS, travelerName: XSS, bookingRef: 'BK-1', tourTitle: XSS, bookingsUrl: CTA_URL }),
  ],
  [
    'disputeResolvedEmail',
    () => templates.disputeResolvedEmail({ travelerName: XSS, bookingRef: 'BK-1', tourTitle: XSS, outcome: 'refunded', refundAmount: 50, bookingsUrl: CTA_URL }),
  ],
  [
    'newBookingOrganizerEmail',
    () => templates.newBookingOrganizerEmail({ organizerName: XSS, travelerName: XSS, seats: 1, tourTitle: XSS, bookingRef: 'BK-1', bookingsUrl: CTA_URL }),
  ],
  ['transportRequestEmail', () => templates.transportRequestEmail({ transporterName: XSS, startDate: '2026-11-01', requestsUrl: CTA_URL })],
  [
    'transportRequestStatusEmail',
    () => templates.transportRequestStatusEmail({ organizerName: XSS, transporterName: XSS, status: 'accepted', scheduleUrl: CTA_URL }),
  ],
  [
    'transportRequestCanceledEmail',
    () =>
      templates.transportRequestCanceledEmail({
        transporterName: XSS,
        organizerName: XSS,
        tourTitle: XSS,
        startDate: '2026-11-01',
        wasAccepted: true,
        requestsUrl: CTA_URL,
      }),
  ],
  [
    'partnerAccountStatusEmail',
    () => templates.partnerAccountStatusEmail({ name: XSS, partner: 'organizer', status: 'deactivated', reason: XSS, dashboardUrl: CTA_URL }),
  ],
  ['tourModerationEmail', () => templates.tourModerationEmail({ name: XSS, tourTitle: XSS, action: 'unpublished', reason: XSS, toursUrl: CTA_URL })],
  ['partnerInfoRequestedEmail', () => templates.partnerInfoRequestedEmail({ name: XSS, partner: 'transporter', note: XSS, profileUrl: CTA_URL })],
  ['payoutRequestedEmail', () => templates.payoutRequestedEmail({ name: XSS, amount: 500, methodName: XSS })],
  ['payoutPaidEmail', () => templates.payoutPaidEmail({ name: XSS, amount: 500, reference: XSS })],
  ['payoutRejectedEmail', () => templates.payoutRejectedEmail({ name: XSS, amount: 500, reason: XSS })],
];

describe('email templates escape user input', () => {
  it.each(cases)('%s', (_name, build) => {
    expectEscaped(build());
  });

  it('escapes quotes in CTA URLs so they cannot break out of href', () => {
    const email = templates.bookingConfirmedEmail({ ...booking, bookingUrl: CTA_URL });
    expect(email.html).toContain('href="https://staging.travi.ph/dashboard?x=1&amp;y=&quot;2&quot;"');
  });

  it('escapes the <title> built from a user-controlled subject', () => {
    const email = templates.bookingConfirmedEmail({ ...booking, bookingUrl: CTA_URL });
    expect(email.html).toMatch(/<title>Booking confirmed: &lt;script&gt;/);
  });
});

describe('email template content', () => {
  it('builds the booking receipt with the formatted amount, dates and guests', () => {
    const email = templates.bookingConfirmedEmail({ ...booking, travelerName: 'Juan', tourTitle: 'Coron Escape', location: null, bookingUrl: CTA_URL });
    expect(email.subject).toBe('Booking confirmed: Coron Escape (BK-1A2B3C)');
    expect(email.text).toContain('Hi Juan,');
    expect(email.text).toContain('Amount paid: ₱3,000.00');
    expect(email.text).toContain('Guests: 2');
    expect(email.text).not.toContain('Location:');
  });

  it('greets "there" when the name is missing or blank', () => {
    expect(templates.payoutPaidEmail({ name: '   ', amount: 1, reference: 'R' }).text).toContain('Hi there,');
    expect(templates.payoutPaidEmail({ name: null, amount: 1, reference: 'R' }).text).toContain('Hi there,');
  });

  it('only mentions a refund when one was issued', () => {
    const refunded = templates.bookingCanceledEmail({ bookingRef: 'BK-1', tourTitle: 'T', refundAmount: 1500, bookingsUrl: CTA_URL });
    const notRefunded = templates.bookingCanceledEmail({ bookingRef: 'BK-1', tourTitle: 'T', refundAmount: 0, bookingsUrl: CTA_URL });
    expect(refunded.subject).toContain('refunded');
    expect(refunded.text).toContain('Refund: ₱1,500.00');
    expect(notRefunded.subject).not.toContain('refunded');
    expect(notRefunded.text).not.toContain('Refund:');
  });

  it('formats DATE values without time-zone drift', () => {
    // Exact punctuation depends on the ICU build; the day must not shift (2026-11-01 is a Sunday).
    const nov1 = templates.formatDate('2026-11-01');
    expect(nov1).toMatch(/^Sun, /);
    expect(nov1).toMatch(/\b1\b/);
    expect(nov1).toContain('Nov');
    expect(nov1).toContain('2026');
    expect(templates.formatDateRange('2026-11-01', '2026-11-01')).toBe(nov1);
    expect(templates.formatDateRange('2026-11-01', '2026-11-03')).toBe(`${nov1} – ${templates.formatDate('2026-11-03')}`);
    expect(templates.formatDate('2026-11-03')).toMatch(/^Tue, /);
    expect(templates.formatDate('nope')).toBe('nope');
  });

  it('formats amounts with the shared formatPHP (always with centavos)', () => {
    expect(templates.formatPeso(1500)).toBe('₱1,500.00');
    expect(templates.formatPeso('1234.5')).toBe('₱1,234.50');
  });
});
