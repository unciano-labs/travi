import type { Metadata } from 'next';
import MfaCard from '@/components/admin/MfaCard';
import MfaEnrollClient from '@/components/admin/MfaEnrollClient';
import { requireAdminForMfaPage } from '@/lib/admin-mfa-page';

export const metadata: Metadata = {
  title: 'Set up two-factor authentication | Travi Admin',
  robots: { index: false, follow: false },
};

// SEC-12: first admin sign-in without an authenticator. Middleware sends admins here (and only
// here) until they have a verified TOTP factor.
export default async function AdminMfaEnrollPage() {
  await requireAdminForMfaPage();
  return (
    <MfaCard title="Set up two-factor authentication" description="Protect the admin console with an authenticator app.">
      <MfaEnrollClient />
    </MfaCard>
  );
}
