import type { Metadata } from 'next';
import AuthCard from '@/components/auth/AuthCard';
import SignupForm, { type SignupRole } from '@/components/auth/SignupForm';
import { safeNextPath } from '@/lib/safe-next';

export const metadata: Metadata = {
  title: 'Create an account | Travi',
};

const ROLES: SignupRole[] = ['traveler', 'organizer', 'transporter'];

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const requestedRole = typeof params.role === 'string' ? params.role : '';
  const initialRole = ROLES.find((r) => r === requestedRole) ?? 'traveler';
  const next = safeNextPath(typeof params.next === 'string' ? params.next : null);

  return (
    <AuthCard
      title="Create a new account"
      subtitle={initialRole === 'traveler' ? undefined : `Join Travi as a ${initialRole}.`}
    >
      <SignupForm initialRole={initialRole} next={next} />
    </AuthCard>
  );
}
