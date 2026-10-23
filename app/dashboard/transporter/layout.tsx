import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import TransporterOnboardingForm from '@/components/dashboard/TransporterOnboardingForm';
import CardBox from '@/components/ui/CardBox';
import PartnerStatusBanner from '@/components/dashboard/PartnerStatusBanner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailWarning } from 'lucide-react';

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
    .select('status, review_note, info_requested_at')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .maybeSingle();

  // No profile yet -> Show Onboarding Form
  if (!transporterProfile) {
    return (
      <div className="mx-auto max-w-3xl py-8">
        <CardBox className="p-8">
          <div>
            <h2 className="mb-2 text-2xl font-semibold text-foreground">Set up your Transporter Profile</h2>
            <p className="text-bodytext">Before organizers can request your vehicles, we need a few details about your service. An admin reviews every new transporter.</p>
          </div>
          {!user.email_confirmed_at && (
            <Alert variant="lightwarning">
              <MailWarning />
              <AlertDescription>Please confirm your email address first: open the link we emailed to {user.email}, then come back to finish this form.</AlertDescription>
            </Alert>
          )}
          <TransporterOnboardingForm />
        </CardBox>
      </div>
    );
  }

  // Profile exists -> approval state (pending / more info needed / rejected), then the dashboard
  return (
    <>
      <PartnerStatusBanner
        partner="transporter"
        status={transporterProfile.status}
        reviewNote={transporterProfile.review_note}
        infoRequestedAt={transporterProfile.info_requested_at}
      />
      {children}
    </>
  );
}
