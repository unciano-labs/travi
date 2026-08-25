import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TravelerProfileForm from '@/components/dashboard/TravelerProfileForm';

export default async function TravelerProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id, full_name, email')
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
    </div>
  );
}
