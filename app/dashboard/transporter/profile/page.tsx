import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TransporterProfileForm from '@/components/dashboard/TransporterProfileForm';
import AccountSecurityManager from '@/components/dashboard/AccountSecurityManager';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';

export default async function TransporterProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile first
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id, email, phone, email_verified_at, phone_verified_at')
    .eq('user_id', user.id)
    .single();

  if (!userProfile) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('transporter_profiles')
    .select('id, transporter_type, company_name, display_name, description, phone, service_areas, status, average_rating, review_count, user_profiles(email)')
    .eq('user_profile_id', userProfile.id)
    .single();

  if (!profile) {
    // Should be handled by layout onboarding form, but just in case
    redirect('/dashboard/transporter');
  }

  return (
    <>
      <PageHeader
        title="Transporter Profile"
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Profile' }]}
      />

      <div className="max-w-2xl space-y-6">
        <CardBox>
          <TransporterProfileForm profile={profile} />
        </CardBox>

        <AccountSecurityManager
          email={userProfile.email}
          phone={userProfile.phone}
          emailVerifiedAt={userProfile.email_verified_at}
          phoneVerifiedAt={userProfile.phone_verified_at}
        />
      </div>
    </>
  );
}
