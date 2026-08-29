import { requireSession, assertRole } from '@/lib/auth-helpers';
import { PayoutsClient } from '@/components/admin/PayoutsClient';

export default async function AdminPayoutsPage() {
  const { user, supabase } = await requireSession();
  await assertRole(user.id, 'admin');

  // Fetch all payout requests, join with user_profiles to get the user's name
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select(`
      *,
      user_wallets (
        user_profiles ( full_name, email )
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
