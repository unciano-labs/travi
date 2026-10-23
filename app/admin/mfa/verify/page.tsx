import type { Metadata } from 'next';
import MfaCard from '@/components/admin/MfaCard';
import MfaVerifyClient from '@/components/admin/MfaVerifyClient';
import { requireAdminForMfaPage } from '@/lib/admin-mfa-page';

export const metadata: Metadata = {
  title: 'Two-factor verification | Travi Admin',
  robots: { index: false, follow: false },
};

// SEC-12: second sign-in step. Upgrades the session to aal2.
export default async function AdminMfaVerifyPage() {
  await requireAdminForMfaPage();
  return (
    <MfaCard title="Two-factor verification" description="Enter the 6-digit code from your authenticator app.">
      <MfaVerifyClient />
    </MfaCard>
  );
}
