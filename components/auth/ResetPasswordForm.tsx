'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { resetPassword } from '@/actions/auth';
import { AuthNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    if (formData.get('password') !== formData.get('confirmPassword')) {
      setError('Passwords do not match');
      return;
    }
    startTransition(async () => {
      const result = await resetPassword(formData);
      if (result && !result.success) {
        setError(result.error);
        setExpired(result.code === 'link_expired');
      }
    });
  };

  return (
    <>
      {error && (
        <AuthNotice tone="error">
          {error}
          {expired && (
            <span className="block mt-2">
              <Link href="/auth/forgot-password" className="font-semibold text-primary underline hover:text-primaryemphasis">
                Request a new link
              </Link>
            </span>
          )}
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New Password</Label>
          <Input
            id="reset-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="reset-password-hint"
          />
          <p id="reset-password-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm-password">Confirm New Password</Label>
          <Input
            id="reset-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
          />
        </div>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Saving…</>
          ) : (
            <><KeyRound className="size-4" aria-hidden="true" /> Set new password</>
          )}
        </Button>
      </form>
    </>
  );
}
