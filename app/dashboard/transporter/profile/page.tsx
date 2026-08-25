import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import TransporterProfileForm from '@/components/dashboard/TransporterProfileForm';

export default async function TransporterProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile first
  const { data: userProfile } = await supabase
    .from('user_profiles')
    .select('id')
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
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-900">Transporter Profile</h1>
      
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <TransporterProfileForm profile={profile} />
      </div>
    </div>
  );
}
