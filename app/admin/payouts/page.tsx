import { requireSession, assertRole } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { PayoutsClient } from '@/components/admin/PayoutsClient';

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
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Payout Requests</h1>
        <p className="text-slate-500 mt-2">Manage and process partner withdrawals.</p>
      </div>

      <PayoutsClient initialPayouts={payouts || []} />
    </div>
  );
}
