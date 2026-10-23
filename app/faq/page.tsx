import Link from 'next/link';
import LegalPage, { legalMetadata } from '@/components/legal/LegalPage';
import { formatDays, formatPercent, formatPesoAmount, getPolicySettings } from '@/lib/legal/settings';

export const metadata = legalMetadata(
  'Frequently Asked Questions',
  'Answers about booking, paying with GCash or Maya, cancellations and refunds, disputes, and selling tours on Travi.',
  '/faq'
);

interface Faq {
  q: string;
  a: React.ReactNode;
}

export default async function FaqPage() {
  const s = await getPolicySettings();
  const holding = formatDays(s.escrowHoldingDays);

  const travelers: Faq[] = [
    { q: 'How do I book a tour?', a: <>Choose a tour and a date, enter the number of guests and continue to payment. You need an account with a confirmed email address.</> },
    { q: 'How do I pay?', a: <>With GCash or Maya, through our payment provider PayMongo. Card payments are not available yet. Your booking is held for 15 minutes while you pay.</> },
    { q: 'When is my booking confirmed?', a: <>As soon as your payment is verified. You receive a confirmation email with your booking reference (it looks like BK-1A2B3C) and a reminder before the trip.</> },
    { q: 'Are there extra fees?', a: <>No. The price you see (per person × guests) is what you pay. Private tours are priced for the whole group.</> },
    { q: 'Can I cancel?', a: <>Yes, from <em>My bookings</em>, any time before the trip’s start date. Paid bookings are refunded in full to your GCash or Maya account. See the <Link href="/refund-policy">Refund &amp; Cancellation Policy</Link>.</> },
    { q: 'What if the organizer cancels?', a: <>Every paid booking on that date is refunded in full, and you are notified by email.</> },
    { q: 'The tour was not as described. What can I do?', a: <>Open a dispute from your booking page, from the start of the trip until {holding} after it ends. The organizer is not paid while it is open, and our team reviews it. You can also <Link href="/contact?topic=complaint_organizer">file a complaint</Link>.</> },
    { q: 'How do I get a copy of my data or delete my account?', a: <>Use the <em>Your data</em> section on your profile page, or see our <Link href="/privacy">Privacy Notice</Link>.</> },
  ];

  const partners: Faq[] = [
    { q: 'How do I become an organizer or transporter?', a: <>Sign up as a partner, confirm your email, then complete your business details and upload a government-issued ID. Our team reviews your application before you can publish tours or receive requests.</> },
    { q: 'How much does Travi charge?', a: <>A commission of {formatPercent(s.organizerFeePercent)} of each paid tour booking. There is no listing fee.</> },
    { q: 'When do I get paid?', a: <>Earnings are held until the trip is over and become available {holding} after the end date, unless a dispute is open. You can then request a payout (minimum {formatPesoAmount(s.minPayoutAmount)}) to your verified bank, GCash or Maya account.</> },
    { q: 'Where are the full partner rules?', a: <>In our <Link href="/partner-terms">Partner Terms</Link>.</> },
  ];

  const section = (title: string, items: Faq[]) => (
    <>
      <h2>{title}</h2>
      <div className="not-prose divide-y divide-slate-200 rounded-xl border border-slate-200">
        {items.map((item) => (
          <details key={item.q} className="group px-5 py-4">
            <summary className="cursor-pointer list-none font-semibold text-slate-900 marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 rounded">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span aria-hidden="true" className="text-brand transition-transform group-open:rotate-45">+</span>
              </span>
            </summary>
            <div className="mt-3 text-sm leading-relaxed text-slate-600 [&_a]:text-brand-dark [&_a]:underline-offset-2 hover:[&_a]:underline">{item.a}</div>
          </details>
        ))}
      </div>
    </>
  );

  return (
    <LegalPage doc={null} eyebrow="Help" title="Frequently Asked Questions">
      {section('For travelers', travelers)}
      {section('For organizers and transporters', partners)}
      <p className="mt-8">Still have a question? <Link href="/contact">Contact us</Link>.</p>
    </LegalPage>
  );
}
