'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { LogIn, Loader2 } from 'lucide-react';
import { loginUser, resendConfirmation } from '@/actions/auth';
import { AUTH_BUTTON_CLASS, AUTH_INPUT_CLASS, AuthNotice } from '@/components/auth/AuthCard';

export default function LoginForm({ next, notice }: { next: string | null; notice: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    setNeedsConfirmation(false);
    setResent(false);
    startTransition(async () => {
      const result = await loginUser(formData);
      if (result && !result.success) {
        setError(result.error);
        setNeedsConfirmation(result.code === 'email_not_confirmed');
      }
    });
  };

  const handleResend = () => {
    const formData = new FormData();
    formData.set('email', emailRef.current?.value ?? '');
    startResend(async () => {
      const result = await resendConfirmation(formData);
      if (result.success) setResent(true);
      else setError(result.error);
    });
  };

  const signupHref = next ? `/signup?next=${encodeURIComponent(next)}` : '/signup';

  return (
    <>
      {notice && !error && <AuthNotice tone="info">{notice}</AuthNotice>}
      {error && (
        <AuthNotice tone="error">
          {error}
          {needsConfirmation && (
            <span className="block mt-2">
              {resent ? (
                <span className="text-emerald-700">If that address needs confirming, a new link is on its way.</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="font-semibold text-coral underline hover:text-coral/80 disabled:opacity-70"
                >
                  {resending ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
            </span>
          )}
        </AuthNotice>
      )}

      <form action={handleSubmit} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label htmlFor="login-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input
            ref={emailRef}
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="login-password" className="block text-sm font-medium text-slate-700">Password</label>
            <Link href="/auth/forgot-password" className="text-sm font-medium text-coral hover:text-coral/80">
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
            className={AUTH_INPUT_CLASS}
          />
        </div>

        <button type="submit" disabled={pending} className={`${AUTH_BUTTON_CLASS} mt-2`}>
          {pending ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Signing in…</>
          ) : (
            <><LogIn className="w-5 h-5" aria-hidden="true" /> Sign In</>
          )}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link href={signupHref} className="font-medium text-coral hover:text-coral/80 transition-colors">
            Sign up
          </Link>
        </p>
      </form>
    </>
  );
}
