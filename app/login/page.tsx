import type { Metadata } from 'next';
import AuthCard from '@/components/auth/AuthCard';
import LoginForm from '@/components/auth/LoginForm';
import { safeNextPath } from '@/lib/safe-next';

export const metadata: Metadata = {
  title: 'Sign in | Travi',
  robots: { index: false },
};

// Fixed messages only: never render free text from the query string.
const MESSAGES: Record<string, string> = {
  check_email: 'Check your email to confirm your account, then sign in.',
  link_invalid: 'That link is invalid or has expired. If you already confirmed your email, sign in below.',
  password_updated: 'Your password has been updated. Please sign in.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);
  const message = typeof params.message === 'string' ? MESSAGES[params.message] ?? null : null;

  return (
    <AuthCard title="Sign in to your account">
      <LoginForm next={next} notice={message} />
    </AuthCard>
  );
}
