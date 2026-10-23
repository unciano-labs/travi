import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import OrganizerProfileForm from '@/components/dashboard/OrganizerProfileForm';
import AccountSecurityManager from '@/components/dashboard/AccountSecurityManager';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import PartnerDocumentsManager from '@/components/dashboard/PartnerDocumentsManager';
import { listOwnPartnerDocuments } from '@/lib/services/partner-documents';

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
    .select('id, organizer_type, company_name, display_name, description, phone, address, provides_transport, status, legal_name, tin, business_registration_no, dot_accreditation_no, public_contact_email, user_profiles(email)')
    .eq('user_profile_id', userProfile.id)
    .is('deleted_at', null)
    .maybeSingle();

  if (!profile) {
    // Should be handled by layout onboarding form, but just in case
    redirect('/dashboard/organizer');
  }

  const documents = await listOwnPartnerDocuments(supabase, userProfile.id, 'organizer');

  return (
    <>
      <PageHeader
        title="Organizer Profile"
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/organizer' }, { title: 'Profile' }]}
      />
      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8">
          <CardBox>
            <OrganizerProfileForm profile={profile} />
          </CardBox>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <CardBox>
            <PartnerDocumentsManager partner="organizer" documents={documents} />
          </CardBox>
        </div>

        <div className="col-span-12 lg:col-span-8">
          <AccountSecurityManager
            email={userProfile.email}
            phone={userProfile.phone}
            emailVerifiedAt={userProfile.email_verified_at}
            phoneVerifiedAt={userProfile.phone_verified_at}
          />
        </div>
      </div>
    </>
  );
}
