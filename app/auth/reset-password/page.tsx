import type { Metadata } from 'next';
import Link from 'next/link';
import AuthCard, { AuthNotice } from '@/components/auth/AuthCard';
import ResetPasswordForm from '@/components/auth/ResetPasswordForm';
import { createClient } from '@/lib/supabase/server';
import { hasPasswordRecovery } from '@/lib/password-recovery';

export const metadata: Metadata = {
  title: 'Choose a new password | Travi',
  robots: { index: false },
};

// Reached from /auth/callback after a verified recovery link (BIZ-10). Without that recovery
// marker (lib/password-recovery.ts) the page only offers to send a new link.
export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const allowed = !!user && (await hasPasswordRecovery(user.id));

  if (!allowed) {
    return (
      <AuthCard title="Reset link expired">
        <AuthNotice tone="error">
          This password reset link is invalid or has expired. Reset links work once, for 15 minutes
          after you open them, in the browser where you requested them.
        </AuthNotice>
        <p className="text-center text-sm text-slate-600">
          <Link href="/auth/forgot-password" className="font-medium text-coral hover:text-coral/80">
            Request a new reset link
          </Link>
        </p>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password" subtitle={user.email ? `For ${user.email}` : undefined}>
      <ResetPasswordForm />
    </AuthCard>
  );
}
