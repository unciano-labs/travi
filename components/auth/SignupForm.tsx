'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Briefcase, Car, Compass, Loader2, UserPlus } from 'lucide-react';
import { signupUser } from '@/actions/auth';
import { AUTH_BUTTON_CLASS, AUTH_INPUT_CLASS, AuthNotice } from '@/components/auth/AuthCard';

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

  const handleSubmit = (formData: FormData) => {
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

      <form action={handleSubmit} className="space-y-5">
        {next && <input type="hidden" name="next" value={next} />}

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700 mb-2">I want to join as</legend>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ id, label, description, icon: Icon }) => {
              const selected = role === id;
              return (
                <label
                  key={id}
                  className={`relative flex flex-col items-center gap-1 rounded-xl border p-3 text-center cursor-pointer transition-colors has-focus-visible:ring-2 has-focus-visible:ring-coral/40 ${
                    selected ? 'border-coral bg-coral/5 text-coral' : 'border-slate-200 text-slate-600 hover:border-slate-300'
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
                  <Icon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm font-semibold">{label}</span>
                  <span className="text-[11px] leading-tight text-slate-500">{description}</span>
                </label>
              );
            })}
          </div>
          {role !== 'traveler' && (
            <p className="mt-2 text-xs text-slate-500">
              After confirming your email you will set up your {role} profile from your dashboard.
            </p>
          )}
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="signup-first-name" className="block text-sm font-medium text-slate-700 mb-1">First Name</label>
            <input id="signup-first-name" type="text" name="firstName" autoComplete="given-name" required maxLength={100} className={AUTH_INPUT_CLASS} />
          </div>
          <div>
            <label htmlFor="signup-last-name" className="block text-sm font-medium text-slate-700 mb-1">Last Name</label>
            <input id="signup-last-name" type="text" name="lastName" autoComplete="family-name" required maxLength={100} className={AUTH_INPUT_CLASS} />
          </div>
        </div>

        <div>
          <label htmlFor="signup-email" className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
          <input id="signup-email" type="email" name="email" autoComplete="email" required className={AUTH_INPUT_CLASS} />
        </div>

        <div>
          <label htmlFor="signup-password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            id="signup-password"
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={72}
            aria-describedby="signup-password-hint"
            className={AUTH_INPUT_CLASS}
          />
          <p id="signup-password-hint" className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>

        <button type="submit" disabled={pending} className={`${AUTH_BUTTON_CLASS} mt-4`}>
          {pending ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Creating account…</>
          ) : (
            <><UserPlus className="w-5 h-5" aria-hidden="true" /> Sign Up</>
          )}
        </button>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href={loginHref} className="font-medium text-coral hover:text-coral/80 transition-colors">
            Sign in
          </Link>
        </p>
      </form>
    </>
  );
}
