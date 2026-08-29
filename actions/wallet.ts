'use strict';
'use server';

import { requireSession, assertRole } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';

export async function requestPayout(walletId: string, payload: { amount: number, method: string, accountDetails: string }) {
  try {
    const { user, profile } = await requireSession();
    
    // Organizers and Transporters can request payouts
    if (profile.role === 'traveler') {
      throw new Error('Unauthorized');
    }

    const admin = createAdminClient({ admin: true });

    // Validate Wallet
    const { data: wallet } = await admin
      .from('user_wallets')
      .select('id, available_balance, user_profile_id')
      .eq('id', walletId)
      .eq('user_profile_id', profile.id)
      .single();

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (payload.amount < 100) {
      throw new Error('Minimum withdrawal is ₱100');
    }

    if (payload.amount > wallet.available_balance) {
      throw new Error('Insufficient available balance');
    }

    // 1. Deduct from available balance
    const newBalance = wallet.available_balance - payload.amount;
    const { error: updateError } = await admin
      .from('user_wallets')
      .update({ available_balance: newBalance, updated_at: new Date().toISOString() })
      .eq('id', walletId);

    if (updateError) throw updateError;

    // 2. Create Ledger Transaction
    const { data: tx, error: txError } = await admin
      .from('wallet_transactions')
      .insert({
        wallet_id: walletId,
        amount: payload.amount,
        type: 'withdrawal_pending',
        balance_affected: 'available',
        reference_type: 'payout',
        reference_id: walletId, // will update once request is created
        description: `Requested withdrawal via ${payload.method.toUpperCase()}`
      })
      .select()
      .single();

    if (txError) throw txError;

    // 3. Create Payout Request
    const { data: req, error: reqError } = await admin
      .from('payout_requests')
      .insert({
        wallet_id: walletId,
        amount: payload.amount,
        status: 'pending',
        payout_method: { method: payload.method, account: payload.accountDetails }
      })
      .select()
      .single();

    if (reqError) throw reqError;

    // Update reference_id in ledger
    await admin.from('wallet_transactions').update({ reference_id: req.id }).eq('id', tx.id);

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'requestPayout', walletId });
    return { success: false, error: error.message };
  }
}
