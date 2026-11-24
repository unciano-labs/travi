'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Briefcase, Car, Compass, Loader2, UserPlus } from 'lucide-react';
import { signupUser } from '@/actions/auth';
import { AuthNotice } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export type SignupRole = 'traveler' | 'organizer' | 'transporter';

const ROLES: { id: SignupRole; label: string; description: string; icon: typeof Compass }[] = [
  { id: 'traveler', label: 'Traveler', description: 'Book tours', icon: Compass },
  { id: 'organizer', label: 'Organizer', description: 'Sell tours', icon: Briefcase },
  { id: 'transporter', label: 'Transporter', description: 'Offer vehicles', icon: Car },
];

export default function SignupForm({ initialRole, next }: { initialRole: SignupRole; next: string | null }) {
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const result = await signupUser(formData);
      if (result && !result.success) setError(result.error);
    });
  };

  const loginHref = next ? `/login?next=${encodeURIComponent(next)}` : '/login';

  return (
    <>
      {error && <AuthNotice tone="error">{error}</AuthNotice>}

      <form onSubmit={handleSubmit} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-foreground">I want to join as</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ id, label, description, icon: Icon }) => {
              const selected = role === id;
              return (
                <label
                  key={id}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-2.5 sm:p-3 text-center cursor-pointer transition-all has-focus-visible:ring-2 has-focus-visible:ring-primary/40 ${
                    selected
                      ? 'border-primary bg-lightprimary text-primary font-medium shadow-xs'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={id}
                    checked={selected}
                    onChange={() => setRole(id)}
                    className="sr-only"
                  />
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="text-xs sm:text-sm font-semibold">{label}</span>
                  <span className="text-[10px] sm:text-[11px] leading-tight opacity-80">{description}</span>
                </label>
              );
            })}
          </div>
          {role !== 'traveler' && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              After confirming your email you will set up your {role} profile from your dashboard.
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="signup-first-name">First Name</Label>
            <Input
              id="signup-first-name"
              type="text"
              name="firstName"
              autoComplete="given-name"
              required
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="signup-last-name">Last Name</Label>
            <Input
              id="signup-last-name"
              type="text"
              name="lastName"
              autoComplete="family-name"
              required
              maxLength={100}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-email">Email Address</Label>
          <Input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="signup-password">Password</Label>
          <Input
            id="signup-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="signup-password-hint"
          />
          <p id="signup-password-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
        </div>

        {/* LEG-01/02: required consent; the accepted versions are recorded with the account. */}
        <div className="flex items-start gap-2.5 pt-1">
          <input
            id="signup-accept-terms"
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 size-4 shrink-0 rounded border border-border text-primary accent-primary focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
          />
          <label htmlFor="signup-accept-terms" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
            I am at least 18 years old and I agree to the{' '}
            <Link
              href="/terms"
              target="_blank"
              className="font-medium text-primary hover:text-primaryemphasis underline-offset-2 hover:underline"
            >
              Terms of Service
            </Link>{' '}
            and the{' '}
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-primary hover:text-primaryemphasis underline-offset-2 hover:underline"
            >
              Privacy Notice
            </Link>
            , including how Travi processes my personal data.
            {role !== 'traveler' && (
              <>
                {' '}Partners also accept the{' '}
                <Link
                  href="/partner-terms"
                  target="_blank"
                  className="font-medium text-primary hover:text-primaryemphasis underline-offset-2 hover:underline"
                >
                  Partner Terms
                </Link>{' '}
                during onboarding.
              </>
            )}
          </label>
        </div>

        <Button type="submit" disabled={pending} className="mt-2 w-full">
          {pending ? (
            <><Loader2 className="size-4 animate-spin" aria-hidden="true" /> Creating account…</>
          ) : (
            <><UserPlus className="size-4" aria-hidden="true" /> Sign Up</>
          )}
        </Button>

        <div className="mt-6 flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
          <span>Already have an account?</span>
          <Link
            href={loginHref}
            className="font-semibold text-primary hover:text-primaryemphasis transition-colors hover:underline"
          >
            Sign in
          </Link>
        </div>
      </form>
    </>
  );
}
