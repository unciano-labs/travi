import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TransporterOnboardingForm from '@/components/dashboard/TransporterOnboardingForm';

export default async function TransporterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!profile) {
    redirect('/login');
  }

  // Check transporter profile status
  const { data: transporterProfile } = await supabase
    .from('transporter_profiles')
    .select('status')
    .eq('user_profile_id', profile.id)
    .single();

  // No profile yet -> Show Onboarding Form
  if (!transporterProfile) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Set up your Transporter Profile</h2>
          <p className="text-slate-600 mb-8">Before you can list vehicles and accept transport requests, we need a few details about your service.</p>
          <TransporterOnboardingForm />
        </div>
      </div>
    );
  }

  // Profile exists -> Render the normal dashboard children
  return <>{children}</>;
}
