import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TravelerProfileForm from '@/components/dashboard/TravelerProfileForm';
import AccountSecurityManager from '@/components/dashboard/AccountSecurityManager';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';

export default async function TravelerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login?next=/dashboard/traveler/profile');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, phone, email_verified_at, phone_verified_at')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  return (
    <>
      <PageHeader
        title="Profile Settings"
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/traveler' }, { title: 'Profile Settings' }]}
      />
      <div className="flex max-w-3xl flex-col gap-6">
        <CardBox>
          <div>
            <h5 className="card-title">Personal Information</h5>
            <p className="text-sm text-muted-foreground">Your name as shown on bookings.</p>
          </div>
          <TravelerProfileForm profile={profile} />
        </CardBox>

        <AccountSecurityManager
          email={profile.email}
          phone={profile.phone}
          emailVerifiedAt={profile.email_verified_at ?? user.email_confirmed_at ?? null}
          phoneVerifiedAt={profile.phone_verified_at}
        />
      </div>
    </>
  );
}
