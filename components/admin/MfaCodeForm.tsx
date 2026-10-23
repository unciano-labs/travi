'use client';

import { useState, useTransition } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';

// 6-digit TOTP entry shared by the enrol and verify steps. `onSubmit` is a Server Action that
// redirects on success and returns { error } otherwise.
export default function MfaCodeForm({ onSubmit, submitLabel }: {
  onSubmit: (code: string) => Promise<{ error?: string } | void>;
  submitLabel: string;
}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from your authenticator app.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await onSubmit(code);
      if (result?.error) {
        setError(result.error);
        setCode('');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <Alert variant="lighterror">
          <AlertCircle />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="admin-mfa-code">Authentication code</Label>
        <Input
          id="admin-mfa-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          maxLength={6}
          placeholder="123456"
          className="text-center text-lg tracking-[0.5em]"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          autoFocus
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending && <Loader2 className="animate-spin" />}
        {pending ? 'Verifying...' : submitLabel}
      </Button>
    </form>
  );
}
