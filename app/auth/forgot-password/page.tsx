import type { Metadata } from 'next';
import AuthCard from '@/components/auth/AuthCard';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Reset your password | Travi',
  robots: { index: false },
};

const ERRORS: Record<string, string> = {
  link_invalid: 'That reset link is invalid or has expired. Request a new one below.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const notice = typeof params.error === 'string' ? ERRORS[params.error] ?? null : null;

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we'll send you a link to choose a new one."
    >
      <ForgotPasswordForm notice={notice} />
    </AuthCard>
  );
}
