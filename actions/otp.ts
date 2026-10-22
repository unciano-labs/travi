'use server';

import { sendOtp, verifyOtp } from '@/lib/otp';

// ─── Payout-method OTP (called from PayoutMethodsManager) ───
export async function sendPayoutOtp() {
  return sendOtp('add_payout_method', 'email');
}

export async function verifyPayoutOtp(code: string) {
  return verifyOtp('add_payout_method', code);
}
