'use client';

import { verifyAdminMfa } from '@/actions/admin-mfa';
import MfaCodeForm from '@/components/admin/MfaCodeForm';

export default function MfaVerifyClient() {
  return (
    <div className="space-y-4">
      <MfaCodeForm submitLabel="Verify" onSubmit={(code) => verifyAdminMfa({ code })} />
      <p className="text-center text-xs text-muted-foreground">
        Lost access to your authenticator? Contact the platform owner to reset your second factor.
      </p>
    </div>
  );
}
