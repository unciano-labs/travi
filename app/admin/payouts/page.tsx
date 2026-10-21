import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayoutsClient } from '@/components/admin/PayoutsClient';
import PageHeader from '@/components/ui/PageHeader';

export default async function AdminPayoutsPage() {
  const { user } = await requireSession();
  await assertRole(user.id, 'admin');

  const admin = createAdminClient({ admin: true });

  const { data: payouts } = await admin
    .from('payout_requests')
    .select(`
      *,
      user_wallets (
        user_profiles ( 
          full_name, 
          email,
          organizer_profiles ( company_name, display_name ),
          transporter_profiles ( company_name, display_name )
        )
      )
    `)
    .order('created_at', { ascending: false });

  return (
    <>
      <PageHeader
        title="Payout Requests"
        description="Manage and process partner withdrawals."
        breadcrumbs={[{ title: 'Admin', href: '/admin' }, { title: 'Payouts' }]}
      />

      <PayoutsClient initialPayouts={payouts || []} />
    </>
  );
}
