import Link from 'next/link';
import LegalPage, { BusinessIdentity, legalMetadata } from '@/components/legal/LegalPage';
import ContactForm from '@/components/legal/ContactForm';
import { COMPANY, DTI, NPC, legalValue } from '@/lib/legal/company';
import { formatDays, getPolicySettings } from '@/lib/legal/settings';
import { SUPPORT_TOPICS, type SupportTopic } from '@/lib/schemas/legal';

export const metadata = legalMetadata(
  'Contact & Support',
  'Contact Travi about a booking, a payment or refund, your personal data, or to file a complaint about an organizer or transporter.',
  '/contact'
);

// LEG-06 / OPS-05: support channel and complaints/redress process (RA 11967).
export default async function ContactPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const topicParam = typeof params.topic === 'string' ? params.topic : undefined;
  const defaultTopic = (SUPPORT_TOPICS as readonly string[]).includes(topicParam ?? '') ? (topicParam as SupportTopic) : undefined;
  const settings = await getPolicySettings();

  return (
    <LegalPage doc={null} eyebrow="Help" title="Contact & Support">
      <p>
        Questions about a booking, a refund, your account or becoming a partner? Send us a message below or email{' '}
        <strong>{legalValue(COMPANY.supportEmail)}</strong>. Support hours: {legalValue(COMPANY.supportHours)}.
      </p>

      <div className="not-prose my-8">
        <ContactForm defaultTopic={defaultTopic} />
      </div>

      <h2>Complaints</h2>
      <p>
        If you have a complaint about a tour, an organizer, a transporter or Travi itself, choose a “Complaint” topic above
        and include your booking reference (for example BK-1A2B3C). Here is what happens next:
      </p>
      <ol>
        <li>Our team reviews it and aims to reply within {legalValue(COMPANY.supportResponseTime)}.</li>
        <li>We review your booking and payment records and ask the organizer or transporter for their side.</li>
        <li>We tell you the outcome and what we will do, for example a refund, a warning to the partner, or removing their listings.</li>
      </ol>
      <p>
        For a paid tour that was not delivered as described, you can also open a <strong>dispute</strong> from your booking
        page until {formatDays(settings.escrowHoldingDays)} after the trip ends. The organizer is not paid while it is open.
        See our <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.
      </p>
      <p>
        If you are not satisfied with how we handled your complaint, you can contact the{' '}
        <a href={DTI.website} target="_blank" rel="noopener noreferrer">{DTI.name}</a>. For privacy concerns, you can
        contact our Data Protection Officer at {legalValue(COMPANY.dpoEmail)} or the{' '}
        <a href={NPC.website} target="_blank" rel="noopener noreferrer">{NPC.name}</a>.
      </p>

      <h2>Business details</h2>
      <BusinessIdentity />
    </LegalPage>
  );
}
