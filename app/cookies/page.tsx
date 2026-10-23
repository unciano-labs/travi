import Link from 'next/link';
import LegalPage, { legalMetadata } from '@/components/legal/LegalPage';

export const metadata = legalMetadata(
  'Cookie Policy',
  'The cookies Travi uses: only strictly necessary cookies for signing in and account security. No advertising or tracking cookies.',
  '/cookies'
);

// LEG-11 draft. Inventory from the code: Supabase auth (@supabase/ssr), lib/otp.ts, lib/password-recovery.ts.
// Vercel Analytics is cookieless. Reassess (and add a consent banner) before adding any marketing pixel.
const COOKIES: [string, string, string][] = [
  ['sb-…-auth-token', 'Keeps you signed in (your secure session with our sign-in provider, Supabase). May be split into several numbered parts.', 'Until you sign out or the session expires'],
  ['otp_pending_<action>', 'Holds a one-time verification step while you confirm a sensitive change (for example adding a payout account or changing your email).', '10 minutes'],
  ['otp_verified_<action>', 'Remembers that you just completed that verification step.', '15 minutes'],
  ['travi_pw_recovery', 'Lets you set a new password after you open a password-reset link.', '15 minutes'],
];

export default function CookiesPage() {
  return (
    <LegalPage doc="cookies" eyebrow="Legal" title="Cookie Policy">
      <p>
        Cookies are small files a website stores in your browser. Travi uses only <strong>strictly necessary</strong>{' '}
        cookies: without them you could not sign in or confirm sensitive account changes. We do not use advertising,
        social-media or cross-site tracking cookies.
      </p>

      <h2>Cookies we use</h2>
      <div className="not-prose overflow-x-auto">
        <table className="w-full min-w-130 text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-900">
              <th className="py-2 pr-4 font-semibold">Cookie</th>
              <th className="py-2 pr-4 font-semibold">Purpose</th>
              <th className="py-2 font-semibold">How long</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {COOKIES.map(([name, purpose, duration]) => (
              <tr key={name} className="border-b border-slate-100 align-top">
                <td className="py-2 pr-4 font-mono text-xs text-slate-800">{name}</td>
                <td className="py-2 pr-4">{purpose}</td>
                <td className="py-2">{duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        All of these are first-party cookies set by Travi. The verification and password-reset cookies are{' '}
        <em>httpOnly</em> (scripts in the page cannot read them) and are sent only over secure connections in production.
      </p>

      <h2>Analytics and error monitoring</h2>
      <p>
        We count page views with Vercel Analytics, which works <strong>without cookies</strong> and reports only aggregated
        statistics. Our error-monitoring service (Sentry) receives technical reports when something breaks; it does not set
        advertising cookies.
      </p>

      <h2>Payment pages</h2>
      <p>
        When you pay, you are redirected to PayMongo and to GCash or Maya. Those pages are run by those companies and may set
        their own cookies under their own policies.
      </p>

      <h2>Your choices</h2>
      <p>
        Because these cookies are strictly necessary, they do not need your consent and cannot be switched off in Travi.
        You can block or delete cookies in your browser settings, but you will then not be able to sign in. If we ever add
        optional cookies (for example for marketing), we will ask for your consent first and update this page.
      </p>
      <p>See our <Link href="/privacy">Privacy Notice</Link> for how we handle personal data.</p>
    </LegalPage>
  );
}
