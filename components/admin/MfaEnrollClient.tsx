'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { AlertCircle, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { startAdminMfaEnrollment, verifyAdminMfaEnrollment } from '@/actions/admin-mfa';
import MfaCodeForm from '@/components/admin/MfaCodeForm';

type Enrollment = { factorId: string; qrCode: string; secret: string };

// Step 1: create the factor (button, so a page refresh never silently creates factors).
// Step 2: scan the QR code (or type the secret), then confirm with the first code.
export default function MfaEnrollClient() {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const start = () => {
    setError(null);
    startTransition(async () => {
      const result = await startAdminMfaEnrollment();
      if (result.success) setEnrollment({ factorId: result.factorId, qrCode: result.qrCode, secret: result.secret });
      else setError(result.error);
    });
  };

  if (!enrollment) {
    return (
      <div className="space-y-4">
        {error && (
          <Alert variant="lighterror">
            <AlertCircle />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex gap-3 rounded-md bg-muted p-4 text-sm text-bodytext">
          <Smartphone className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>
            Admin accounts must use an authenticator app (Google Authenticator, Microsoft Authenticator, 1Password,
            Authy, …). You will enter a code from it every time you sign in.
          </p>
        </div>
        <Button type="button" onClick={start} disabled={pending} className="w-full">
          {pending && <Loader2 className="animate-spin" />}
          {pending ? 'Preparing...' : 'Set up authenticator'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <ol className="list-decimal space-y-1 pl-5 text-sm text-bodytext">
        <li>Open your authenticator app and add a new account.</li>
        <li>Scan the QR code, or enter the setup key by hand.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="flex justify-center">
        <Image
          src={enrollment.qrCode}
          alt="QR code to add Travi Admin to your authenticator app"
          width={192}
          height={192}
          unoptimized
          className="rounded-md border border-border bg-white p-2"
        />
      </div>
      <div className="space-y-1 text-center">
        <p className="text-xs text-muted-foreground">Setup key</p>
        <code className="block break-all rounded-md bg-muted px-3 py-2 font-mono text-sm text-foreground select-all">
          {enrollment.secret}
        </code>
      </div>
      <MfaCodeForm
        submitLabel="Verify and continue"
        onSubmit={(code) => verifyAdminMfaEnrollment({ factorId: enrollment.factorId, code })}
      />
    </div>
  );
}
