import Link from 'next/link';
import LegalPage, { BusinessIdentity, legalMetadata } from '@/components/legal/LegalPage';
import { formatDays, formatPercent, formatPesoAmount, getPolicySettings } from '@/lib/legal/settings';

export const metadata = legalMetadata(
  'Partner Terms',
  'Terms for tour organizers and transporters on Travi: verification, commission, escrow, payouts, cancellations, disputes, licensing and insurance.',
  '/partner-terms'
);

// LEG-05 draft. Commission, holding period and payout minimum are read from platform_settings, so the
// text always matches what the platform actually charges (AGENTS.md §4.4).
export default async function PartnerTermsPage() {
  const s = await getPolicySettings();
  const fee = formatPercent(s.organizerFeePercent);
  const holding = formatDays(s.escrowHoldingDays);
  const minPayout = formatPesoAmount(s.minPayoutAmount);

  return (
    <LegalPage doc="partnerTerms" eyebrow="For partners" title="Partner Terms">
      <p>
        These Partner Terms apply to tour <strong>organizers</strong> and <strong>transporters</strong> (“partners”, “you”)
        who offer services through Travi. They add to our <Link href="/terms">Terms of Service</Link> and{' '}
        <Link href="/privacy">Privacy Notice</Link>. You accept them when you submit your partner application.
      </p>
      <p>Travi is operated by:</p>
      <BusinessIdentity />

      <h2>1. Verification (know your partner)</h2>
      <ul>
        <li>You must give true and complete business details: legal name, TIN, contact details and, for companies, the DTI/SEC registration number; and upload a valid government-issued ID. We may ask for more documents (for example BIR registration, DOT accreditation, LTFRB franchise, vehicle OR/CR, insurance).</li>
        <li>New partners start as <em>pending</em>. Until we approve you, you can prepare listings but cannot publish tours, receive transport requests or request payouts.</li>
        <li>Once approved, your verified identity details are locked; contact us to change them. Your legal name, accreditation number and public contact email are shown to travelers on your tour pages, as the Internet Transactions Act (RA 11967) requires.</li>
        <li>You must tell us promptly if your details, permits or accreditation change, lapse or are revoked. We may suspend or remove partners whose details are false or no longer valid.</li>
      </ul>

      <h2>2. Your responsibilities</h2>
      <ul>
        <li><strong>Organizers</strong> are responsible for delivering each tour as listed: itinerary, inclusions, meeting point, guides, accommodation, activities and any transport they arrange, and for travelers’ safety during the tour.</li>
        <li><strong>Transporters</strong> are responsible for the vehicles and drivers they provide, including roadworthiness and lawful operation.</li>
        <li>You must hold and keep valid all licences, permits, franchises, accreditations (for example DOT, LTFRB, LGU permits) and insurance required for your services, and comply with consumer, tourism, transport, tax and data-privacy laws.</li>
        <li>Listings must be accurate and complete, with prices in pesos that include everything the traveler must pay for the listed inclusions.</li>
        <li>Use travelers’ personal data (name, email) only to deliver the booked tour, keep it secure, and do not use it for marketing without their consent.</li>
        <li>Do not ask travelers to pay outside Travi for bookings made through Travi.</li>
      </ul>

      <h2>3. Commission</h2>
      <p>
        For each paid tour booking, Travi keeps a platform commission of <strong>{fee}</strong> of the booking total. The
        rate in force when the booking is made applies to that booking. You receive the booking total minus the commission.
        Travi does not currently deduct payment-processing fees from your earnings; we will give notice before any change
        to the commission or fees.
      </p>
      <p>
        Transport is arranged directly between organizers and transporters at this stage: transport fees are agreed and paid
        between you outside Travi, and Travi charges no commission on them.
      </p>

      <h2>4. Escrow and payouts</h2>
      <ul>
        <li>Travelers pay Travi through PayMongo. Your earnings for a booking are held in your Travi wallet as <em>escrow</em> until the trip is over.</li>
        <li>Escrow becomes <em>available</em> {holding} after the trip’s end date, provided there is no open dispute on the booking.</li>
        <li>You can request a payout of your available balance (minimum <strong>{minPayout}</strong>) to a payout account you saved and verified. Payouts are reviewed and sent by our team; larger payouts may need approval by two team members. We tell you by email when a payout is sent or rejected (rejected amounts go back to your available balance).</li>
        <li>You are responsible for your own taxes on your earnings. Tax documents and any withholding will follow the rules confirmed by our tax advisers.</li>
      </ul>

      <h2>5. Cancellations</h2>
      <ul>
        <li>Travelers may cancel any time before the trip’s start date and receive a <strong>full refund</strong>. No earnings are paid to you for canceled bookings.</li>
        <li>If you cancel a scheduled date, every paid booking on it is refunded in full to the travelers and unpaid bookings are canceled. Cancel only when necessary (for example safety, weather or force majeure) and as early as possible. Repeated or late cancellations may lead to suspension.</li>
        <li>You cannot cancel a date once the trip has started while it has active bookings.</li>
      </ul>

      <h2>6. Disputes, refunds and chargebacks</h2>
      <ul>
        <li>A traveler can open a dispute from the trip’s start date until {holding} after it ends. While it is open, the booking’s escrow is not released. Please respond promptly to our questions.</li>
        <li>If we uphold the dispute, the traveler is refunded in full and the escrow for that booking is reversed. If we deny it, the escrow is released as normal.</li>
        <li>If a payment is reversed by the payment provider or e-wallet (a chargeback) or refunded after your earnings were released, we may deduct the amount from your future earnings or ask you to repay it.</li>
      </ul>

      <h2>7. Reviews and conduct</h2>
      <p>Travelers can review completed tours. Do not post or buy fake reviews, or pressure travelers about their reviews. We may hide reviews that break our rules.</p>

      <h2>8. Suspension and termination</h2>
      <p>
        You may stop offering services at any time, but you must honour or properly cancel existing bookings. We may suspend
        or end your partner account for breach of these terms, false information, safety concerns, fraud, or repeated
        complaints. Amounts owed to you for completed trips (after disputes and refunds) remain payable.
      </p>

      <h2>9. Liability</h2>
      <p>
        You are responsible for claims arising from the services you provide, including injury, loss or damage during a tour
        or trip, and you agree to cover Travi’s losses caused by your breach of these terms or of the law. Travi’s liability to
        you is limited to the commission it earned on the bookings concerned, to the extent the law allows.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update these Partner Terms. Each version has a version number and date at the top of this page, and we record
        the version you accepted. Commission or fee changes apply only to bookings made after the change.
      </p>
    </LegalPage>
  );
}
