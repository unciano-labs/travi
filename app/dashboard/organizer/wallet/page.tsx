import { requireSession, assertRole } from '@/lib/auth-helpers';
import { WalletClient } from '@/components/dashboard/WalletClient';
import PageHeader from '@/components/ui/PageHeader';
import CardBox from '@/components/ui/CardBox';
import EmptyState from '@/components/ui/EmptyState';
import { Wallet } from 'lucide-react';

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
    
  // Payout minimum and escrow holding period (platform_settings is publicly readable)
  const { data: settings } = await supabase
    .from('platform_settings')
    .select('min_payout_amount, escrow_holding_days')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Fetch Pending Payouts
  const { data: payouts } = await supabase
    .from('payout_requests')
    .select('*')
    .eq('wallet_id', wallet?.id)
    .order('created_at', { ascending: false });

  if (!wallet) {
    return (
      <CardBox>
        <EmptyState icon={Wallet} title="Error loading wallet. Please contact support." />
      </CardBox>
    );
  }

  return (
    <div>
      <PageHeader
        title="Digital Wallet"
        description="Manage your earnings, view transaction history, and request payouts."
        breadcrumbs={[{ title: 'Dashboard', href: '/dashboard/organizer' }, { title: 'Wallet' }]}
      />

      <WalletClient 
        wallet={wallet} 
        transactions={transactions || []} 
        payouts={payouts || []} 
        minPayout={Number(settings?.min_payout_amount ?? 100)}
        holdingDays={Number(settings?.escrow_holding_days ?? 3)}
      />
    </div>
  );
}
