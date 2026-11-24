'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/actions/auth';
import { AuthNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function ForgotPasswordForm({ notice }: { notice: string | null }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.success) setSent(true);
      else setError(result.error);
    });
  };

  if (sent) {
    return (
      <div className="space-y-4">
        <AuthNotice tone="success">
          If an account exists for that email, we've sent a link to reset your password. The link
          is valid for a limited time; open it in this browser.
        </AuthNotice>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/login" className="font-semibold text-primary hover:text-primaryemphasis hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <>
      {notice && !error && <AuthNotice tone="error">{notice}</AuthNotice>}
      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email Address</Label>
          <Input
            id="forgot-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Sending…</>
          ) : (
            <><Mail className="size-4" aria-hidden="true" /> Send reset link</>
          )}
        </Button>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <span>Remembered it?</span>
          <Link href="/login" className="font-semibold text-primary hover:text-primaryemphasis hover:underline">
            Back to sign in
          </Link>
        </div>
      </form>
    </>
  );
}
