import { requireSession, assertRole } from '@/lib/auth-helpers';
import { WalletClient } from '@/components/dashboard/WalletClient';
import { AlertCircle } from 'lucide-react';
import PageHeader from '@/components/ui/PageHeader';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default async function WalletPage() {
  const { user, profile, supabase } = await requireSession();
  await assertRole(user.id, 'transporter');

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
    return (
      <Alert variant="lighterror">
        <AlertCircle />
        <AlertDescription>Error loading wallet. Please contact support.</AlertDescription>
      </Alert>
    );
  }

  return (
    <>
      <PageHeader
        title="Digital Wallet"
        description="Manage your earnings, view transaction history, and request payouts."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/transporter' }, { title: 'Wallet' }]}
      />

      <WalletClient 
        wallet={wallet} 
        transactions={transactions || []} 
        payouts={payouts || []} 
      />
    </>
  );
}
