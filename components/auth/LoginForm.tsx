'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { LogIn, Loader2 } from 'lucide-react';
import { loginUser, resendConfirmation } from '@/actions/auth';
import { AuthNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function LoginForm({ next, notice }: { next: string | null; notice: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resent, setResent] = useState(false);
  const [pending, startTransition] = useTransition();
  const [resending, startResend] = useTransition();
  const emailRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
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
                <span className="text-successemphasis font-medium">If that address needs confirming, a new link is on its way.</span>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resending}
                  className="font-semibold text-primary underline hover:text-primaryemphasis disabled:opacity-70 cursor-pointer"
                >
                  {resending ? 'Sending…' : 'Resend confirmation email'}
                </button>
              )}
            </span>
          )}
        </AuthNotice>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email Address</Label>
          <Input
            ref={emailRef}
            id="login-email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary hover:text-primaryemphasis hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="login-password"
            type="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Signing in…</>
          ) : (
            <><LogIn className="size-4" aria-hidden="true" /> Sign In</>
          )}
        </Button>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <span>Don't have an account?</span>
          <Link
            href={signupHref}
            className="font-semibold text-primary hover:text-primaryemphasis transition-colors hover:underline"
          >
            Sign up
          </Link>
        </div>
      </form>
    </>
  );
}
