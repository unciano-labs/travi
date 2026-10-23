import Link from 'next/link';
import LegalPage, { legalMetadata } from '@/components/legal/LegalPage';
import { COMPANY, legalValue } from '@/lib/legal/company';
import { formatDays, getPolicySettings } from '@/lib/legal/settings';

export const metadata = legalMetadata(
  'Refund & Cancellation Policy',
  'When you can cancel a Travi booking, how refunds work, what happens if an organizer cancels, and how to raise a dispute.',
  '/refund-policy'
);

// LEG-03 draft: matches the code (AGENTS.md §4.3): full refund before the start date (Manila),
// organizer-canceled schedules fully refunded, disputes until escrow_holding_days after the end date.
export default async function RefundPolicyPage() {
  const settings = await getPolicySettings();
  const holding = formatDays(settings.escrowHoldingDays);

  return (
    <LegalPage doc="refundPolicy" eyebrow="Legal" title="Refund & Cancellation Policy">
      <p>
        This policy applies to every tour booked and paid for on Travi. It is part of our{' '}
        <Link href="/terms">Terms of Service</Link>. All dates are in Philippine time.
      </p>

      <h2>At a glance</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full min-w-120 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-900">
              <th className="py-2 pr-4 font-semibold">Situation</th>
              <th className="py-2 font-semibold">What happens</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            <tr className="border-b border-slate-100 align-top">
              <td className="py-2 pr-4 font-medium text-slate-800">You cancel before the trip’s start date</td>
              <td className="py-2">Full refund of what you paid. Unpaid bookings are simply canceled.</td>
            </tr>
            <tr className="border-b border-slate-100 align-top">
              <td className="py-2 pr-4 font-medium text-slate-800">You want to cancel on or after the start date</td>
              <td className="py-2">Self-service cancellation is not available. If something went wrong, open a dispute (below).</td>
            </tr>
            <tr className="border-b border-slate-100 align-top">
              <td className="py-2 pr-4 font-medium text-slate-800">The organizer cancels the date</td>
              <td className="py-2">Full refund of every paid booking on that date; unpaid bookings are canceled. You are notified by email.</td>
            </tr>
            <tr className="border-b border-slate-100 align-top">
              <td className="py-2 pr-4 font-medium text-slate-800">You did not finish paying within 15 minutes</td>
              <td className="py-2">The booking is canceled automatically and the seats are released. Nothing is charged.</td>
            </tr>
            <tr className="align-top">
              <td className="py-2 pr-4 font-medium text-slate-800">The tour was not delivered as described</td>
              <td className="py-2">Open a dispute from the start of the trip until {holding} after it ends. If we uphold it, you get a full refund.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>1. Canceling a booking yourself</h2>
      <p>
        Go to <em>My bookings</em> in your account and choose <em>Cancel booking</em>. You can do this any time before the
        trip’s start date. If the booking was paid, we refund the <strong>full amount</strong> you paid to the same GCash or
        Maya account through our payment provider, PayMongo, and you receive a confirmation email.
      </p>

      <h2>2. If the organizer cancels</h2>
      <p>
        Organizers can cancel a scheduled date (for example because of weather or too few guests). When they do, every paid
        booking on that date is refunded in full and every unpaid booking is canceled. If a refund cannot be completed
        automatically, our team follows it up and contacts you.
      </p>

      <h2>3. Disputes: when the tour was not as described</h2>
      <p>
        If you paid for a tour and it did not happen, or was materially different from the listing, open a dispute from your
        booking page. You can do this from the day the trip starts until <strong>{holding} after it ends</strong>. Tell us
        what happened (at least 20 characters). While the dispute is open, the organizer is not paid for your booking.
        Our team reviews it with you and the organizer and then either refunds you in full or denies the dispute, and tells
        you the outcome by email.
      </p>

      <h2>4. How refunds are paid</h2>
      <ul>
        <li>Refunds go back to the original payment method through PayMongo. We cannot refund to a different account.</li>
        <li>The time for the money to appear depends on PayMongo and your e-wallet provider.</li>
        <li>Travi does not charge a cancellation fee. Refunds are for the amount you paid.</li>
      </ul>

      <h2>5. Payments that arrive late</h2>
      <p>
        If a payment reaches us after your booking was canceled (for example, after the 15-minute payment window), we
        reinstate the booking if the trip has not started and seats are still free. Otherwise our team refunds the payment
        and contacts you.
      </p>

      <h2>6. Need help?</h2>
      <p>
        <Link href="/contact">Contact us</Link> or email {legalValue(COMPANY.supportEmail)} with your booking reference
        (it looks like BK-1A2B3C). Your rights under the Consumer Act (RA 7394) and other Philippine laws are not affected by
        this policy.
      </p>
    </LegalPage>
  );
}
