import Link from 'next/link';
import LegalPage, { BusinessIdentity, legalMetadata } from '@/components/legal/LegalPage';

export const metadata = legalMetadata(
  'About Travi',
  'Travi is a Philippine marketplace where travelers book tours from verified local organizers and pay securely with GCash or Maya.',
  '/about'
);

// Content page. Only verifiable statements about how the platform works (LEG-07: no unverifiable claims).
export default function AboutPage() {
  return (
    <LegalPage doc={null} eyebrow="About" title="About Travi">
      <p>
        Travi is an online marketplace for tours in the Philippines. Local tour organizers list their tours, and travelers
        compare, book and pay for them in one place.
      </p>

      <h2>How it works</h2>
      <ul>
        <li><strong>Travelers</strong> browse published tours, book seats on a date, and pay with GCash or Maya through our payment provider, PayMongo.</li>
        <li><strong>Organizers</strong> are independent businesses and individuals. Before they can publish tours, our team reviews their identity and business documents. Each tour page shows who operates it.</li>
        <li><strong>Transporters</strong> offer vans, buses and other vehicles that organizers can request for their trips.</li>
      </ul>

      <h2>Why book through Travi</h2>
      <ul>
        <li>Your payment is held by Travi and released to the organizer only after the trip, so you can raise a problem if the tour was not as described.</li>
        <li>You can cancel a booking before the trip’s start date for a full refund (see our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>).</li>
        <li>Reviews come from travelers with a completed booking and are checked before they are published.</li>
      </ul>

      <h2>Who we are</h2>
      <BusinessIdentity />

      <p>
        Want to list your tours or vehicles? <Link href="/signup?role=organizer">Become an organizer</Link> or{' '}
        <Link href="/signup?role=transporter">register as a transporter</Link>. Questions? <Link href="/contact">Contact us</Link>.
      </p>
    </LegalPage>
  );
}
