import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TransporterOnboardingForm from '@/components/dashboard/TransporterOnboardingForm';
import CardBox from '@/components/ui/CardBox';

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
      <div className="mx-auto max-w-3xl py-8">
        <CardBox className="p-8">
          <div>
            <h2 className="mb-2 text-2xl font-semibold text-foreground">Set up your Transporter Profile</h2>
            <p className="text-bodytext">Before you can list vehicles and accept transport requests, we need a few details about your service.</p>
          </div>
          <TransporterOnboardingForm />
        </CardBox>
      </div>
    );
  }

  // Profile exists -> Render the normal dashboard children
  return <>{children}</>;
}
