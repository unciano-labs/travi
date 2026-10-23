'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireSession, assertRole } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { escapeHtml } from '@/lib/email';
import { captureException } from '@/lib/logger';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email';
import { consumeVerifiedOtp } from '@/lib/otp';

import { createClient } from '@/lib/supabase/server';

const requestPayoutSchema = z.object({
  amount: z.number().positive().multipleOf(0.01),
  methodId: z.string().min(1),
  password: z.string().min(1, 'Password is required for verification'),
});

export async function requestPayout(payload: { amount: number; methodId: string; password: string }) {
  try {
    const data = requestPayoutSchema.parse(payload);
    const { user, profile } = await requireSession();
    // Password check is a brute-force oracle: limit it like a login.
    await assertRateLimit(profile.id, 'auth');

    // Re-authenticate before moving money.
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: data.password
    });
    if (signInError) {
      throw new Error('Incorrect password');
    }

    // request_payout() runs as the signed-in user: it checks partner approval and the minimum,
    // takes the destination from the caller's saved (OTP-verified) methods, and debits the balance,
    // writes the ledger row and creates the request in one locked transaction (no double-spend).
    const { data: payoutId, error } = await supabase.rpc('request_payout', {
      p_amount: data.amount,
      p_method_id: data.methodId,
    });
    if (error) throw new Error(error.message);

    const admin = createAdminClient({ admin: true });
    const { data: payout } = await admin.from('payout_requests').select('payout_method').eq('id', payoutId).single();
    const methodName = String(payout?.payout_method?.method ?? 'your saved method').toUpperCase();

    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: 'Payout Request Received',
        html: `
          <div style="font-family: sans-serif; color: #1e293b;">
            <h2>Payout Request Received</h2>
            <p>Hi ${escapeHtml(profile.full_name ?? '')},</p>
            <p>We have received your payout request for <strong>₱${Number(data.amount).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong> via ${escapeHtml(methodName)}.</p>
            <p>Your request is currently pending and will be processed within 24-48 hours.</p>
            <p>Thank you,<br/>Travi Support</p>
          </div>
        `
      });
    }

    revalidatePath('/dashboard/organizer/wallet');
    revalidatePath('/dashboard/transporter/wallet');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'requestPayout' });
    const message = error instanceof z.ZodError ? error.issues[0]?.message : error instanceof Error ? error.message : null;
    return { success: false, error: message || 'Failed to request payout.' };
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
    
    // Use up the verified OTP first (atomic, single use: one code adds one method).
    await consumeVerifiedOtp('add_payout_method');

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
