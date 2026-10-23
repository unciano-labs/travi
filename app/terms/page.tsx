import Link from 'next/link';
import LegalPage, { BusinessIdentity, legalMetadata } from '@/components/legal/LegalPage';
import { COMPANY, legalValue } from '@/lib/legal/company';
import { formatDays, getPolicySettings } from '@/lib/legal/settings';

export const metadata = legalMetadata(
  'Terms of Service',
  'The terms for using Travi to find, book and pay for tours from independent organizers in the Philippines.',
  '/terms'
);

// LEG-01 draft. Grounded in AGENTS.md §4 (booking, payment, cancellation, dispute rules).
export default async function TermsPage() {
  const settings = await getPolicySettings();
  const holding = formatDays(settings.escrowHoldingDays);

  return (
    <LegalPage doc="terms" eyebrow="Legal" title="Terms of Service">
      <p>
        These Terms of Service (“Terms”) govern your use of the Travi website and services (“Travi”, “we”, “us”).
        By creating an account or booking a tour you agree to these Terms, our{' '}
        <Link href="/privacy">Privacy Notice</Link> and our{' '}
        <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>. If you do not agree, please do not use Travi.
      </p>

      <h2>1. Who we are</h2>
      <p>Travi is operated by:</p>
      <BusinessIdentity />

      <h2>2. What Travi is (and is not)</h2>
      <p>
        Travi is an online marketplace. Independent tour <strong>organizers</strong> list tours on Travi, and travelers book
        and pay for them through Travi. Independent <strong>transporters</strong> may provide vehicles to organizers.
      </p>
      <ul>
        <li>
          <strong>The organizer runs the tour.</strong> The organizer named on each tour page (“Operated by”) is responsible
          for the tour itself: the itinerary, accommodation, guides, activities, safety, permits and any transport they
          arrange. Your contract for the tour services is with that organizer.
        </li>
        <li>
          <strong>Travi provides the platform.</strong> We provide the listing, booking and payment tools, hold your payment
          until after the trip (see section 6), handle cancellations and refunds under our policy, and help resolve
          disputes and complaints.
        </li>
        <li>
          We review organizers before they can publish tours (identity and business documents), but we do not inspect every
          tour and cannot guarantee an organizer’s performance.
        </li>
      </ul>

      <h2>3. Your account</h2>
      <ul>
        <li>You must be at least <strong>18 years old</strong> to create an account and book. If you book for minors, you are responsible for them.</li>
        <li>Give accurate information and keep your password safe. You are responsible for activity on your account.</li>
        <li>You must confirm your email address before you can book.</li>
        <li>We may suspend or close accounts that break these Terms, are used for fraud, or put other users at risk.</li>
      </ul>

      <h2>4. Booking a tour</h2>
      <ul>
        <li>
          Prices are in Philippine pesos (PHP) and are shown per person. The total is calculated by Travi when you book
          (price per person × number of guests). Travi does not add a booking fee for travelers.
        </li>
        <li>
          <strong>Private tours</strong> are booked for the whole group: one booking reserves every seat on that date and the
          price covers the full group size shown.
        </li>
        <li>
          A new booking is held for <strong>15 minutes</strong> while you pay. If payment is not completed in time, the
          booking is canceled automatically and the seats are released.
        </li>
        <li>
          Your booking is <strong>confirmed only when your payment is verified</strong>. You will receive a confirmation
          email and can see the booking in your account.
        </li>
        <li>
          The organizer receives your name and email for confirmed bookings so they can run the tour and contact you.
        </li>
      </ul>

      <h2>5. Payment</h2>
      <p>
        Payments are processed by our payment provider <strong>PayMongo</strong> using GCash or Maya. We do not receive or
        store your e-wallet credentials. Your payment is also subject to PayMongo’s and your e-wallet provider’s terms.
      </p>

      <h2>6. How we hold your payment</h2>
      <p>
        When you pay, the money is held by Travi for the organizer and is <strong>not</strong> released to them right away.
        It becomes available to the organizer {holding} after your trip ends, unless a dispute is open. This gives you time
        to raise a problem with the tour (see section 8).
      </p>

      <h2>7. Cancellations and refunds</h2>
      <ul>
        <li>
          <strong>You cancel:</strong> you can cancel a booking from your account until the day before the trip starts
          (Philippine time). If you already paid, you get a <strong>full refund</strong> to your original payment method.
          Bookings cannot be canceled on or after the start date.
        </li>
        <li>
          <strong>The organizer cancels a date:</strong> if an organizer cancels the scheduled date, every paid booking on
          that date is <strong>fully refunded</strong> and unpaid bookings are canceled.
        </li>
        <li>
          Refunds are sent through PayMongo. How long it takes for the money to appear depends on PayMongo and your e-wallet.
        </li>
      </ul>
      <p>The full rules are in our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</p>

      <h2>8. Problems with a tour (disputes)</h2>
      <p>
        If a paid tour was not delivered as described, you can open a dispute from your booking page from the day the trip
        starts until <strong>{holding} after it ends</strong>. Describe what went wrong. While a dispute is open, the
        organizer is not paid for that booking. Our team reviews the dispute with you and the organizer and then either
        refunds the booking in full or denies the dispute. Either way, we tell you the outcome by email. You can also <Link href="/contact">contact us</Link> or
        file a complaint about an organizer at any time.
      </p>

      <h2>9. Reviews</h2>
      <p>
        You can review a tour after a completed booking. Reviews must be honest, based on your own experience, and must not
        contain illegal, abusive or personal information about others. We moderate reviews before they are published and may
        hide reviews that break these rules.
      </p>

      <h2>10. Acceptable use</h2>
      <p>Do not misuse Travi: no fraud, fake bookings or payments, scraping, attempts to bypass security, or contacting organizers to pay them outside Travi for a tour you found here.</p>

      <h2>11. Liability</h2>
      <ul>
        <li>
          The organizer is responsible for the tour services and for the safety of the activities they run. Travi is
          responsible for operating the platform with reasonable care and for handling your payment, cancellation and refund
          as described in these Terms.
        </li>
        <li>
          To the extent the law allows, Travi’s total liability to you for a booking is limited to the amount you paid for
          that booking. Nothing in these Terms limits rights you have under Philippine law that cannot be waived, including
          your rights under the Consumer Act (RA 7394) and the Internet Transactions Act (RA 11967).
        </li>
        <li>We are not responsible for delays or failures caused by events outside our reasonable control (for example, typhoons, government travel restrictions or outages of payment providers).</li>
      </ul>

      <h2>12. Complaints</h2>
      <p>
        Contact us first through our <Link href="/contact">contact page</Link> or at {legalValue(COMPANY.supportEmail)}. We aim
        to reply within {legalValue(COMPANY.supportResponseTime)}. If you are not satisfied, you may bring your complaint to
        the Department of Trade and Industry (DTI) or another competent government agency.
      </p>

      <h2>13. Changes</h2>
      <p>
        We may update these Terms. Each version has a version number and date at the top of this page, and we record which
        version you accepted. Changes do not affect bookings that are already confirmed.
      </p>

      <h2>14. Governing law</h2>
      <p>These Terms are governed by the laws of the Republic of the Philippines.</p>
    </LegalPage>
  );
}
