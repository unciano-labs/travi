import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OrganizerProfileForm from '@/components/dashboard/OrganizerProfileForm';
import AccountSecurityManager from '@/components/dashboard/AccountSecurityManager';

export default async function OrganizerProfilePage() {
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
    .from('organizer_profiles')
    .select('id, organizer_type, company_name, display_name, description, phone, address, provides_transport, status, user_profiles(email)')
    .eq('user_profile_id', userProfile.id)
    .single();

  if (!profile) {
    // Should be handled by layout onboarding form, but just in case
    redirect('/dashboard/organizer');
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Organizer Profile</h1>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <OrganizerProfileForm profile={profile} />
      </div>

      <AccountSecurityManager
        email={userProfile.email}
        phone={userProfile.phone}
        emailVerifiedAt={userProfile.email_verified_at}
        phoneVerifiedAt={userProfile.phone_verified_at}
      />
    </div>
  );
}
