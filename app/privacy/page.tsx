import Link from 'next/link';
import LegalPage, { BusinessIdentity, legalMetadata } from '@/components/legal/LegalPage';
import { COMPANY, NPC, RETENTION, legalValue } from '@/lib/legal/company';

export const metadata = legalMetadata(
  'Privacy Notice',
  'How Travi collects, uses, shares and protects personal data under the Philippine Data Privacy Act of 2012 (RA 10173), and how to exercise your rights.',
  '/privacy'
);

// LEG-02 draft. Processors and data flows reflect the code as of Phase 4 (AGENTS.md §1.2, §4, §5).
const PROCESSORS: [string, string, string][] = [
  ['Supabase', 'Database, sign-in (authentication) and file storage', 'All account, booking and partner data'],
  ['Vercel', 'Website hosting and cookieless, aggregated page-view analytics', 'Requests to the website (IP address, browser), page views'],
  ['PayMongo', 'Payment processing (GCash, Maya) and refunds', 'Name, email, booking reference and amount; your e-wallet details are entered on PayMongo’s or your e-wallet’s own pages'],
  ['Resend', 'Sending transactional emails', 'Your email address and the content of the email'],
  ['Upstash', 'Rate limiting to protect against abuse', 'IP address or account ID, kept briefly'],
  ['Sentry', 'Error monitoring', 'Technical error reports, which may include your account ID'],
];

export default function PrivacyPage() {
  return (
    <LegalPage doc="privacy" eyebrow="Legal" title="Privacy Notice">
      <p>
        This notice explains how Travi handles your personal data, in line with the Data Privacy Act of 2012 (Republic Act
        No. 10173), its Implementing Rules and Regulations, and issuances of the National Privacy Commission (NPC).
      </p>

      <h2>1. Who is responsible for your data</h2>
      <p>The personal information controller is:</p>
      <BusinessIdentity />
      <p>
        <strong>Data Protection Officer (DPO):</strong> {legalValue(COMPANY.dpoName)}, {legalValue(COMPANY.dpoEmail)}.
        {' '}NPC registration: {legalValue(COMPANY.npcRegistrationNumber)}.
      </p>

      <h2>2. What we collect</h2>
      <h3>Everyone with an account</h3>
      <ul>
        <li>Name, email address, password (stored only as a secure hash by our sign-in provider), and optionally a mobile number.</li>
        <li>Email and phone verification status, roles (traveler, organizer, transporter) and account settings.</li>
        <li>Records of which version of our terms and this notice you accepted, when, with a scrambled (hashed) form of your IP address and your browser type.</li>
        <li>Notifications we send you, messages you send through our contact page, and privacy requests you make.</li>
      </ul>
      <h3>Travelers</h3>
      <ul>
        <li>Bookings: tour, dates, number of guests, amounts, booking reference and status.</li>
        <li>Payment records: amounts, status, and payment and refund reference numbers from PayMongo. We do <strong>not</strong> receive your GCash or Maya PIN or password.</li>
        <li>Cancellations, disputes (including the reason you give) and reviews you write.</li>
      </ul>
      <h3>Organizers and transporters (partners)</h3>
      <ul>
        <li>Business identity for verification: legal name, business or company name, Taxpayer Identification Number (TIN), DTI/SEC registration number, DOT accreditation or LTFRB franchise number, address, phone and a public contact email.</li>
        <li>Verification documents you upload, such as a government-issued ID, registration certificates and vehicle OR/CR. These are stored privately and seen only by our review team.</li>
        <li>Tours, schedules and vehicles you list; earnings, wallet balance and transaction history; payout requests and the payout accounts you save (account name, number and bank or e-wallet).</li>
      </ul>
      <h3>Technical data</h3>
      <ul>
        <li>Sign-in session cookies (see our <Link href="/cookies">Cookie Policy</Link>), server and error logs, and IP addresses used for security and rate limiting.</li>
        <li>Aggregated, cookieless page-view statistics (Vercel Analytics). These do not identify you.</li>
      </ul>
      <p>
        Government ID numbers and TINs are <strong>sensitive personal information</strong> under the Data Privacy Act. We
        collect them only from partners, only to verify their identity and business, and to meet legal requirements.
      </p>

      <h2>3. Why we use it, and on what basis</h2>
      <ul>
        <li><strong>To provide the service you asked for</strong> (contract): create your account, take and confirm bookings, process payments, refunds and payouts, run disputes, and send booking emails and reminders.</li>
        <li><strong>To meet legal obligations</strong>: keep financial and tax records, verify partners under the Internet Transactions Act (RA 11967), respond to lawful requests from authorities.</li>
        <li><strong>For our legitimate interests</strong>, balanced against your rights: keep Travi secure, prevent fraud and abuse, fix errors, handle complaints, and understand overall site usage.</li>
        <li><strong>With your consent</strong> where the law requires it. You can withdraw consent at any time; this does not affect processing already done or processing we must do for the reasons above.</li>
      </ul>
      <p>We do not sell your personal data, and we do not use it for third-party advertising.</p>

      <h2>4. Who we share it with</h2>
      <ul>
        <li><strong>Organizers of your tours:</strong> your name for bookings on their tours, and your email address once a booking is confirmed, so they can run the tour and contact you.</li>
        <li><strong>Between organizers and transporters:</strong> contact details are shared with the other party for a transport request, as needed to arrange the trip.</li>
        <li><strong>The public:</strong> organizers’ public details shown on tour pages (display name, legal name, accreditation number and contact email), and published reviews with the reviewer’s name as shown on the review.</li>
        <li><strong>Service providers</strong> who process data for us under contract (below).</li>
        <li><strong>Authorities</strong> when required by law, court order or a lawful request.</li>
      </ul>

      <h3>Service providers (processors)</h3>
      <div className="not-prose overflow-x-auto">
        <table className="w-full min-w-130 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-900">
              <th className="py-2 pr-4 font-semibold">Provider</th>
              <th className="py-2 pr-4 font-semibold">What they do</th>
              <th className="py-2 font-semibold">Data involved</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {PROCESSORS.map(([name, role, data]) => (
              <tr key={name} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-4 font-medium text-slate-800">{name}</td>
                <td className="py-2 pr-4">{role}</td>
                <td className="py-2">{data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>5. Transfers outside the Philippines</h2>
      <p>
        Some of these providers store or process data on servers outside the Philippines. When that happens we remain
        responsible for your data, and we use providers that commit by contract to protect it at a level comparable to the
        Data Privacy Act.
      </p>

      <h2>6. How long we keep it</h2>
      <ul>
        <li>Account and profile data: while your account is open, then {legalValue(RETENTION.accountData)}.</li>
        <li>Bookings, payments, refunds, payouts and the wallet ledger: {legalValue(RETENTION.financialRecords)}, because tax and accounting rules require it, even if you delete your account.</li>
        <li>Support messages, complaints and privacy requests: {legalValue(RETENTION.supportRecords)}.</li>
        <li>Partner verification documents: {legalValue(RETENTION.partnerDocuments)}.</li>
        <li>Records needed for an open dispute, complaint or legal claim are kept until it is resolved.</li>
      </ul>

      <h2>7. How we protect it</h2>
      <p>
        Data is encrypted in transit; access is limited by role, and database rules ensure each user can only reach their
        own records. Partner documents are kept in private storage and opened by our team through short-lived links. Admin
        actions on accounts and money are logged. If a personal data breach is likely to cause you serious harm, we will
        notify the NPC and you as required by law (within 72 hours of knowing about it).
      </p>

      <h2>8. Your rights</h2>
      <p>Under the Data Privacy Act you have the right to:</p>
      <ul>
        <li>be informed about how your data is processed (this notice);</li>
        <li>access your data and get a copy in a portable format;</li>
        <li>correct inaccurate or incomplete data;</li>
        <li>object to processing, and to withdraw consent;</li>
        <li>have your data erased or blocked when it is no longer needed or was processed unlawfully;</li>
        <li>claim damages, and file a complaint with the NPC.</li>
      </ul>
      <p>
        <strong>How to exercise them:</strong> signed-in users can use the <em>Your data</em> section of their profile page
        to download a copy of their data or request a correction or account deletion. You can also write to our DPO at{' '}
        {legalValue(COMPANY.dpoEmail)} or use our <Link href="/contact">contact page</Link> (topic “Privacy or my personal
        data”). We may need to verify your identity first. When you ask us to delete your account, we delete or anonymise
        what we can and keep only the records the law requires (section 6).
      </p>
      <p>
        If you are not satisfied with our response, you can complain to the{' '}
        <a href={NPC.website} target="_blank" rel="noopener noreferrer">{NPC.name}</a>.
      </p>

      <h2>9. Children</h2>
      <p>Travi accounts are for adults (18 and over). A traveler who books for minors is responsible for the minors’ details they share with the organizer.</p>

      <h2>10. Changes</h2>
      <p>We will post any update to this notice here with a new version number and date, and tell account holders about important changes.</p>
    </LegalPage>
  );
}
