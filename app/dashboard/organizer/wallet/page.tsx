import { requireSession, assertRole } from '@/lib/auth-helpers';
import { WalletClient } from '@/components/dashboard/WalletClient';
import { Card } from '@/components/ui/card'; // Check if we have standard tailwind components, otherwise we will just build the raw UI.

export default async function WalletPage() {
  const { user, profile, supabase } = await requireSession();
  await assertRole(user.id, 'organizer');

  // Ensure Wallet Exists (use admin client to bypass RLS for inserts)
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const admin = createAdminClient({ admin: true });
  const { data: walletId, error: rpcError } = await admin.rpc('ensure_user_wallet', { profile_id: profile.id });
  
  if (rpcError) {
    console.error('ensure_user_wallet error:', rpcError);
  }

  // Fetch Wallet Data
  const { data: wallet } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_profile_id', profile.id)
    .single();

  // Fetch Transactions
  const { data: transactions } = await supabase
    .from('wallet_transactions')
    .select('*')
    .eq('wallet_id', wallet?.id)
    .order('created_at', { ascending: false })
    .limit(20);
    
  // Fetch Pending Payouts
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('wallet_id', wallet?.id)
    .order('created_at', { ascending: false });

  if (!wallet) {
    return <div>Error loading wallet. Please contact support.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Digital Wallet</h1>
        <p className="text-slate-500 mt-2">Manage your earnings, view transaction history, and request payouts.</p>
      </div>

      <WalletClient 
        wallet={wallet} 
        transactions={transactions || []} 
        payouts={payouts || []} 
      />
    </div>
  );
}
