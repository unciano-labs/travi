import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import OrganizerOnboardingForm from '@/components/dashboard/OrganizerOnboardingForm';
import CardBox from '@/components/ui/CardBox';
import PartnerStatusBanner from '@/components/dashboard/PartnerStatusBanner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { MailWarning } from 'lucide-react';

export default async function OrganizerLayout({
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

  // Check organizer profile status
  const { data: organizerProfile } = await supabase
    .from('organizer_profiles')
    .select('status, review_note, info_requested_at')
    .eq('user_profile_id', profile.id)
    .is('deleted_at', null)
    .maybeSingle();

  // No profile yet -> Show Onboarding Form
  if (!organizerProfile) {
    return (
      <div className="max-w-3xl mx-auto py-8">
        <CardBox className="p-8">
          <div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Set up your Organizer Profile</h2>
            <p className="text-bodytext">Before you can create tours, we need a few details about your business. An admin reviews every new organizer before tours can be published.</p>
          </div>
          {!user.email_confirmed_at && (
            <Alert variant="lightwarning">
              <MailWarning />
              <AlertDescription>Please confirm your email address first: open the link we emailed to {user.email}, then come back to finish this form.</AlertDescription>
            </Alert>
          )}
          <OrganizerOnboardingForm defaultContactEmail={user.email ?? ''} />
        </CardBox>
      </div>
    );
  }

  // Profile exists -> approval state (pending / more info needed / rejected), then the dashboard
  return (
    <>
      <PartnerStatusBanner
        partner="organizer"
        status={organizerProfile.status}
        reviewNote={organizerProfile.review_note}
        infoRequestedAt={organizerProfile.info_requested_at}
      />
      {children}
    </>
  );
}
