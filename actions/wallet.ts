'use strict';
'use server';

import { requireSession, assertRole } from '@/lib/auth-helpers';
import { captureException } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { requireVerifiedOtp, consumeVerifiedOtp } from '@/actions/otp';

import { createClient } from '@/lib/supabase/server';

export async function requestPayout(walletId: string, payload: { amount: number, method: string, accountDetails: string, password?: string }) {
  try {
    const { user, profile } = await requireSession();
    
    // Organizers and Transporters can request payouts
    if (profile.role === 'traveler') {
      throw new Error('Unauthorized');
    }

    if (!payload.password) {
      throw new Error('Password is required for verification');
    }

    // Verify Password
    const tempClient = await createClient();
    const { error: signInError } = await tempClient.auth.signInWithPassword({
      email: user.email!,
      password: payload.password
    });
    
    if (signInError) {
      throw new Error('Incorrect password');
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

    // 4. Send Email Notification
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: 'Payout Request Received',
        html: `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2>Payout Request Received</h2>
            <p>Hi ${profile.full_name},</p>
            <p>We have received your payout request for <strong>₱${Number(payload.amount).toLocaleString(undefined, {minimumFractionDigits: 2})}</strong> via ${payload.method.toUpperCase()}.</p>
            <p>Your request is currently pending and will be processed within 24-48 hours.</p>
            <p>Thank you,<br/>Travi Support</p>
          </div>
        `
      });
    }

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'requestPayout', walletId });
    return { success: false, error: error.message };
  }
}

export type SavedPayoutMethod = {
  id: string;
  type: 'bank' | 'gcash' | 'maya';
  isDefault: boolean;
  details: {
    accountName: string;
    accountNumber: string;
    bankName?: string;
  };
};

export async function savePayoutMethod(walletId: string, methodData: Omit<SavedPayoutMethod, 'id' | 'isDefault'>) {
  try {
    const { user, profile } = await requireSession();
    
    // Verify OTP first
    await requireVerifiedOtp('add_payout_method');

    const admin = createAdminClient({ admin: true });

    // Validate Wallet
    const { data: wallet } = await admin
      .from('user_wallets')
      .select('id, user_profile_id, saved_payout_methods')
      .eq('id', walletId)
      .eq('user_profile_id', profile.id)
      .single();

    if (!wallet) throw new Error('Wallet not found');

    const newMethod: SavedPayoutMethod = {
      id: crypto.randomUUID(),
      isDefault: false,
      ...methodData
    };

    const methods = (wallet.saved_payout_methods as SavedPayoutMethod[]) || [];
    
    if (methods.length === 0) {
      newMethod.isDefault = true;
    }

    methods.push(newMethod);

    const { error } = await admin
      .from('user_wallets')
      .update({ saved_payout_methods: methods })
      .eq('id', walletId);

    if (error) throw error;

    await consumeVerifiedOtp('add_payout_method');
    
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/organizer/wallet');
    revalidatePath('/dashboard/transporter/wallet');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'savePayoutMethod', walletId });
    return { success: false, error: error.message };
  }
}

export async function deletePayoutMethod(walletId: string, methodId: string) {
  try {
    const { profile } = await requireSession();
    const admin = createAdminClient({ admin: true });

    const { data: wallet } = await admin
      .from('user_wallets')
      .select('id, user_profile_id, saved_payout_methods')
      .eq('id', walletId)
      .eq('user_profile_id', profile.id)
      .single();

    if (!wallet) throw new Error('Wallet not found');

    let methods = (wallet.saved_payout_methods as SavedPayoutMethod[]) || [];
    const targetMethod = methods.find(m => m.id === methodId);
    methods = methods.filter(m => m.id !== methodId);
    
    // If the deleted one was default, make the first remaining one the default
    if (targetMethod?.isDefault && methods.length > 0) {
      methods[0].isDefault = true;
    }

    await admin.from('user_wallets').update({ saved_payout_methods: methods }).eq('id', walletId);

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/organizer/wallet');
    revalidatePath('/dashboard/transporter/wallet');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'deletePayoutMethod', walletId, methodId });
    return { success: false, error: error.message };
  }
}

export async function setDefaultPayoutMethod(walletId: string, methodId: string) {
  try {
    const { profile } = await requireSession();
    const admin = createAdminClient({ admin: true });

    const { data: wallet } = await admin
      .from('user_wallets')
      .select('id, user_profile_id, saved_payout_methods')
      .eq('id', walletId)
      .eq('user_profile_id', profile.id)
      .single();

    if (!wallet) throw new Error('Wallet not found');

    let methods = (wallet.saved_payout_methods as SavedPayoutMethod[]) || [];
    methods = methods.map(m => ({
      ...m,
      isDefault: m.id === methodId
    }));

    await admin.from('user_wallets').update({ saved_payout_methods: methods }).eq('id', walletId);

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard/organizer/wallet');
    revalidatePath('/dashboard/transporter/wallet');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'setDefaultPayoutMethod', walletId, methodId });
    return { success: false, error: error.message };
  }
}
