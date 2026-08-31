import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TravelerProfileForm from '@/components/dashboard/TravelerProfileForm';
import AccountSecurityManager from '@/components/dashboard/AccountSecurityManager';

export default async function TravelerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
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
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Profile Settings</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <TravelerProfileForm profile={profile} />
      </div>

      <AccountSecurityManager
        email={profile.email}
        phone={profile.phone}
        emailVerifiedAt={profile.email_verified_at}
        phoneVerifiedAt={profile.phone_verified_at}
      />
    </div>
  );
}
