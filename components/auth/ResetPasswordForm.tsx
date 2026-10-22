'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { KeyRound, Loader2 } from 'lucide-react';
import { resetPassword } from '@/actions/auth';
import { AUTH_BUTTON_CLASS, AUTH_INPUT_CLASS, AuthNotice } from '@/components/auth/AuthCard';

export default function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
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
              <Link href="/auth/forgot-password" className="font-semibold text-coral underline">Request a new link</Link>
            </span>
          )}
        </AuthNotice>
      )}

      <form action={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
          <input
            id="reset-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="reset-password-hint"
            className={AUTH_INPUT_CLASS}
          />
          <p id="reset-password-hint" className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <div>
          <label htmlFor="reset-confirm-password" className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
          <input
            id="reset-confirm-password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={pending} className={AUTH_BUTTON_CLASS}>
          {pending ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Saving…</>
          ) : (
            <><KeyRound className="w-5 h-5" aria-hidden="true" /> Set new password</>
          )}
        </button>
      </form>
    </>
  );
}
