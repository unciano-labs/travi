'use server';

import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureException } from '@/lib/logger';
import { assertRateLimit } from '@/lib/ratelimit';
import { PHONE_OTP_ENABLED } from '@/lib/features';
import { OtpError, consumeVerifiedOtp, redeemOtp, sendOtp, verifyOtp } from '@/lib/otp';
import { maskEmail, sendEmail } from '@/lib/email';
import { emailChangedNoticeEmail } from '@/lib/email-templates';
import {
  changeEmailSchema,
  confirmPasswordChangeSchema,
  otpCodeSchema,
  phPhoneSchema,
  requestPasswordChangeSchema,
  updateProfileNameSchema,
} from '@/lib/schemas/auth';

type Result = { success: true } | { success: false; error: string };

function failure(error: unknown, fallback: string): { success: false; error: string } {
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && error.message) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

// Wrong/expired codes are expected user outcomes, not incidents: keep them out of Sentry.
function report(error: unknown, action: string) {
  if (!(error instanceof OtpError) && !(error instanceof ZodError)) captureException(error, { action });
}

// Case-insensitive exact match: escape LIKE wildcards in user input.
const likeLiteral = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

const PHONE_DISABLED = 'Phone verification is not available yet. Your email address is used for verification.';

// OTP sends/verifies get the strict 'auth' limiter, keyed per account (AGENTS.md §5.6).
const otpLimit = (profileId: string) => assertRateLimit(`otp:${profileId}`, 'auth');

// ─── Update Profile Name (BIZ-11) ───
export async function updateProfileName(fullName: string): Promise<Result> {
  try {
    const data = updateProfileNameSchema.parse({ fullName });
    const { profile, supabase } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    // RLS client: users may update their own profile; identity columns are guarded by trigger.
    const { error } = await supabase
      .from('user_profiles')
      .update({ full_name: data.fullName, updated_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) throw new Error('Could not save your profile.');

    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error: unknown) {
    captureException(error, { action: 'updateProfileName' });
    return failure(error, 'Could not save your profile.');
  }
}

// ─── Change Phone: Step 1 — Send OTP (hidden at launch, D5) ───
export async function requestPhoneChange(newPhone: string): Promise<Result> {
  if (!PHONE_OTP_ENABLED) return { success: false, error: PHONE_DISABLED };
  try {
    const phone = phPhoneSchema.parse(newPhone);
    const { user, profile } = await requireSession();
    await otpLimit(profile.id);

    // Service role: the uniqueness check must see other users' rows.
    const admin = createAdminClient({ admin: true });
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .eq('phone', phone)
      .neq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('This phone number is already associated with another account.');
    }

    const result = await sendOtp('change_phone', 'email', { newPhone: phone });
    return result.success ? { success: true } : { success: false, error: result.error ?? 'Failed to send code' };
  } catch (error: unknown) {
    captureException(error, { action: 'requestPhoneChange' });
    return failure(error, 'Failed to send verification code');
  }
}

// ─── Change Phone: Step 2 — Confirm OTP & update (hidden at launch, D5) ───
export async function confirmPhoneChange(code: string): Promise<Result> {
  if (!PHONE_OTP_ENABLED) return { success: false, error: PHONE_DISABLED };
  try {
    const otp = otpCodeSchema.parse(code);
    const { profile } = await requireSession();
    await otpLimit(profile.id);

    // Verifies and uses up the code in one step; the number comes from the challenge, not the client.
    const { newPhone } = await redeemOtp('change_phone', otp);
    if (!newPhone) throw new Error('New phone number not found for this code.');

    // Service role: phone and phone_verified_at are server-owned columns.
    const admin = createAdminClient({ admin: true });
    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({ phone: newPhone, phone_verified_at: now, updated_at: now })
      .eq('id', profile.id);
    if (profileError) throw new Error('Could not update your phone number.');

    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error: unknown) {
    report(error, 'confirmPhoneChange');
    return failure(error, 'Verification failed');
  }
}

// ─── Verify Email: Step 1 — Send OTP ───
export async function sendVerifyEmailOtp(): Promise<Result> {
  try {
    const { profile } = await requireSession();
    await otpLimit(profile.id);
    const result = await sendOtp('verify_email', 'email');
    return result.success ? { success: true } : { success: false, error: result.error ?? 'Failed to send code' };
  } catch (error: unknown) {
    captureException(error, { action: 'sendVerifyEmailOtp' });
    return failure(error, 'Failed to send code');
  }
}

// ─── Verify Email: Step 2 — Confirm OTP ───
export async function confirmVerifyEmail(code: string): Promise<Result> {
  try {
    const otp = otpCodeSchema.parse(code);
    const { user, profile } = await requireSession();
    await otpLimit(profile.id);

    await redeemOtp('verify_email', otp);

    // Service role: email_verified_at is server-owned, and the code proves control of the inbox,
    // so Supabase Auth's own confirmation (used by assertEmailVerified) is stamped too.
    const admin = createAdminClient({ admin: true });
    if (!user.email_confirmed_at) {
      const { error: authError } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
      if (authError) throw new Error('Could not verify your email address.');
    }
    const { error } = await admin
      .from('user_profiles')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', profile.id);
    if (error) throw new Error('Could not verify your email address.');

    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error: unknown) {
    report(error, 'confirmVerifyEmail');
    return failure(error, 'Verification failed');
  }
}

// ─── Change Email: Step 1 — Send OTP to the NEW email (proves the user controls it; SEC-11) ───
export async function requestEmailChange(newEmail: string): Promise<Result> {
  try {
    const data = changeEmailSchema.parse({ newEmail });
    const { user, profile } = await requireSession();
    await otpLimit(profile.id);
    if (data.newEmail.trim().toLowerCase() === (user.email ?? '').toLowerCase()) {
      throw new Error('Enter a different email address.');
    }

    // Service role: the uniqueness check must see other users' rows.
    const admin = createAdminClient({ admin: true });
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .ilike('email', likeLiteral(data.newEmail.trim()))
      .neq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('This email address is already associated with another account.');
    }

    const result = await sendOtp('change_email', 'email', { newEmail: data.newEmail });
    return result.success ? { success: true } : { success: false, error: result.error ?? 'Failed to send code' };
  } catch (error: unknown) {
    captureException(error, { action: 'requestEmailChange' });
    return failure(error, 'Failed to send verification code');
  }
}

// ─── Change Email: Step 2 — Confirm the code from the new inbox & update ───
export async function confirmEmailChange(code: string): Promise<Result> {
  try {
    const otp = otpCodeSchema.parse(code);
    const { user, profile } = await requireSession();
    await otpLimit(profile.id);

    // Verifies and uses up the code; the new address is the one bound to the challenge.
    const { newEmail } = await redeemOtp('change_email', otp);
    if (!newEmail) throw new Error('New email not found for this code.');
    const oldEmail = user.email;

    // Service role: auth.admin and the server-owned email columns.
    const admin = createAdminClient({ admin: true });

    // Re-check uniqueness: another account may have taken the address since the code was sent.
    const { data: taken } = await admin
      .from('user_profiles')
      .select('id')
      .ilike('email', likeLiteral(newEmail))
      .neq('user_id', user.id)
      .limit(1);
    if (taken && taken.length > 0) throw new Error('This email address is already associated with another account.');

    // The code was delivered to the new inbox, so the address is confirmed.
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, { email: newEmail, email_confirm: true });
    if (authError) throw new Error('Could not update your email address.');

    const now = new Date().toISOString();
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({ email: newEmail, email_verified_at: now, updated_at: now })
      .eq('id', profile.id);
    if (profileError) throw new Error('Could not update your email address.');

    // Tell the previous address, so a hijacked session cannot silently take over the account.
    if (oldEmail) {
      const notice = emailChangedNoticeEmail({ name: profile.full_name, newEmailMasked: maskEmail(newEmail) });
      const sent = await sendEmail({ to: oldEmail, ...notice });
      if (!sent.success) captureException(new Error('Email-change notice failed'), { action: 'confirmEmailChange:notice' });
    }

    revalidatePath('/dashboard', 'layout');
    return { success: true };
  } catch (error: unknown) {
    report(error, 'confirmEmailChange');
    return failure(error, 'Verification failed');
  }
}

// ─── Change Password: Step 1 — Verify current password & send OTP(s) ───
export async function requestPasswordChange(
  currentPassword: string
): Promise<{ success: true; requiresPhoneOtp: boolean } | { success: false; error: string }> {
  try {
    const data = requestPasswordChangeSchema.parse({ currentPassword });
    const { user, profile, supabase } = await requireSession();
    await otpLimit(profile.id);
    if (!user.email) throw new Error('No email address on this account');

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: data.currentPassword,
    });
    if (signInError) throw new Error('Current password is incorrect');

    const emailResult = await sendOtp('change_password_email', 'email');
    if (!emailResult.success) return { success: false, error: emailResult.error ?? 'Failed to send code' };

    // D5: phone OTP only when an SMS provider is live and the user has a phone.
    const requiresPhoneOtp = PHONE_OTP_ENABLED && !!profile.phone;
    if (requiresPhoneOtp) {
      const phoneResult = await sendOtp('change_password_phone', 'phone');
      if (!phoneResult.success) return { success: false, error: phoneResult.error ?? 'Failed to send phone code' };
    }

    return { success: true, requiresPhoneOtp };
  } catch (error: unknown) {
    captureException(error, { action: 'requestPasswordChange' });
    return failure(error, 'Failed to verify current password');
  }
}

// ─── Change Password: Step 2 — Verify OTP(s) & update ───
export async function confirmPasswordChange(
  newPassword: string,
  emailOtpCode: string,
  phoneOtpCode?: string
): Promise<Result> {
  try {
    const data = confirmPasswordChangeSchema.parse({ newPassword, emailOtpCode, phoneOtpCode });
    const { profile, supabase } = await requireSession();
    await otpLimit(profile.id);

    const requiresPhoneOtp = PHONE_OTP_ENABLED && !!profile.phone;
    if (data.phoneOtpCode && !PHONE_OTP_ENABLED) return { success: false, error: PHONE_DISABLED };
    if (requiresPhoneOtp && !data.phoneOtpCode) return { success: false, error: 'Enter the code sent to your phone' };

    if (requiresPhoneOtp && data.phoneOtpCode) {
      // Two codes: check both first (counts attempts), then use both up atomically.
      const emailResult = await verifyOtp('change_password_email', data.emailOtpCode);
      if (!emailResult.success) return { success: false, error: `Email code: ${emailResult.error}` };
      const phoneResult = await verifyOtp('change_password_phone', data.phoneOtpCode);
      if (!phoneResult.success) return { success: false, error: `Phone code: ${phoneResult.error}` };
      await consumeVerifiedOtp('change_password_email');
      await consumeVerifiedOtp('change_password_phone');
    } else {
      await redeemOtp('change_password_email', data.emailOtpCode);
    }

    // The user's own session (just re-authenticated in step 1); no service role needed.
    const { error: authError } = await supabase.auth.updateUser({ password: data.newPassword });
    if (authError) throw new Error(authError.message);

    // Sign out every other device that may still hold the old password.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) captureException(signOutError, { action: 'confirmPasswordChange:signOutOthers' });

    return { success: true };
  } catch (error: unknown) {
    report(error, 'confirmPasswordChange');
    return failure(error, 'Password change failed');
  }
}
