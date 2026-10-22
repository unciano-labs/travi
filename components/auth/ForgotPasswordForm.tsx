'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { requestPasswordReset } from '@/actions/auth';
import { AUTH_BUTTON_CLASS, AUTH_INPUT_CLASS, AuthNotice } from '@/components/auth/AuthCard';

export default function ForgotPasswordForm({ notice }: { notice: string | null }) {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(formData);
      if (result.success) setSent(true);
      else setError(result.error);
    });
  };

  if (sent) {
    return (
      <>
        <AuthNotice tone="success">
          If an account exists for that email, we've sent a link to reset your password. The link
          is valid for a limited time; open it in this browser.
        </AuthNotice>
        <p className="text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-coral hover:text-coral/80">Back to sign in</Link>
        </p>
      </>
    );
  }

  return (
    <>
      {notice && !error && <AuthNotice tone="error">{notice}</AuthNotice>}
      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="forgot-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input
            id="forgot-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={pending} className={AUTH_BUTTON_CLASS}>
          {pending ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Sending…</>
          ) : (
            <><Mail className="w-5 h-5" aria-hidden="true" /> Send reset link</>
          )}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-coral hover:text-coral/80">Back to sign in</Link>
        </p>
      </form>
    </>
  );
}
