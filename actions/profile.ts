'use server';

import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { captureException } from '@/lib/logger';
import { sendOtp, verifyOtp, requireVerifiedOtp, consumeVerifiedOtp } from '@/actions/otp';

// ─── Update Profile Name ───
export async function updateProfileName(fullName: string) {
  try {
    const { profile } = await requireSession();
    const admin = createAdminClient({ admin: true });

    const { error } = await admin
      .from('user_profiles')
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) throw error;

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'updateProfileName' });
    return { success: false, error: error.message };
  }
}

// ─── Change Phone: Step 1 — Send OTP to new phone ───
export async function requestPhoneChange(newPhone: string) {
  try {
    const { user } = await requireSession();
    const admin = createAdminClient({ admin: true });

    // Basic PH phone validation
    const cleaned = newPhone.replace(/\s|-/g, '');
    if (!/^(\+63|0)9\d{9}$/.test(cleaned)) {
      throw new Error('Please enter a valid Philippine mobile number (e.g., 09123456789)');
    }

    // Check if new phone is already in use
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .eq('phone', cleaned)
      .neq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('This phone number is already associated with another account.');
    }

    // Send OTP to registered email, store newPhone in JWT payload
    return sendOtp('change_phone', 'email', { newPhone: cleaned });
  } catch (error: any) {
    captureException(error, { action: 'requestPhoneChange' });
    return { success: false, error: error.message };
  }
}

// ─── Change Phone: Step 2 — Confirm OTP & update ───
export async function confirmPhoneChange(code: string) {
  try {
    const verifyResult = await verifyOtp('change_phone', code);
    if (!verifyResult.success) return verifyResult;

    const { profile } = await requireSession();
    const payload = await requireVerifiedOtp('change_phone');
    const newPhone = payload.newPhone as string;

    if (!newPhone) throw new Error('New phone number not found in verification payload');

    const admin = createAdminClient({ admin: true });

    // Update profile phone
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({
        phone: newPhone,
        phone_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (profileError) throw profileError;

    await consumeVerifiedOtp('change_phone');

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'confirmPhoneChange' });
    return { success: false, error: error.message };
  }
}

// ─── Verify Email: Step 1 — Send OTP ───
export async function sendVerifyEmailOtp() {
  return sendOtp('verify_email', 'email');
}

// ─── Verify Email: Step 2 — Confirm OTP ───
export async function confirmVerifyEmail(code: string) {
  try {
    const verifyResult = await verifyOtp('verify_email', code);
    if (!verifyResult.success) return verifyResult;

    const { profile } = await requireSession();
    const admin = createAdminClient({ admin: true });

    const { error } = await admin
      .from('user_profiles')
      .update({ email_verified_at: new Date().toISOString() })
      .eq('id', profile.id);

    if (error) throw error;

    await consumeVerifiedOtp('verify_email');

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'confirmVerifyEmail' });
    return { success: false, error: error.message };
  }
}

// ─── Change Email: Step 1 — Send OTP to current email ───
export async function requestEmailChange(newEmail: string) {
  try {
    const { user } = await requireSession();
    const admin = createAdminClient({ admin: true });

    // Validate new email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      throw new Error('Invalid email format');
    }

    // Check if new email is already in use
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .eq('email', newEmail)
      .neq('user_id', user.id)
      .limit(1);

    if (existing && existing.length > 0) {
      throw new Error('This email address is already associated with another account.');
    }

    // Send OTP to current email, store newEmail in JWT payload
    return sendOtp('change_email', 'email', { newEmail });
  } catch (error: any) {
    captureException(error, { action: 'requestEmailChange' });
    return { success: false, error: error.message };
  }
}

// ─── Change Email: Step 2 — Confirm OTP & update ───
export async function confirmEmailChange(code: string) {
  try {
    const verifyResult = await verifyOtp('change_email', code);
    if (!verifyResult.success) return verifyResult;

    const { user, profile } = await requireSession();
    const payload = await requireVerifiedOtp('change_email');
    const newEmail = payload.newEmail as string;

    if (!newEmail) throw new Error('New email not found in verification payload');

    const admin = createAdminClient({ admin: true });

    // Update auth email
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, { email: newEmail });
    if (authError) throw authError;

    // Update profile email
    const { error: profileError } = await admin
      .from('user_profiles')
      .update({
        email: newEmail,
        email_verified_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (profileError) throw profileError;

    await consumeVerifiedOtp('change_email');

    const { revalidatePath } = await import('next/cache');
    revalidatePath('/dashboard');
    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'confirmEmailChange' });
    return { success: false, error: error.message };
  }
}

// ─── Change Password: Step 1 — Verify current password & send OTPs ───
export async function requestPasswordChange(currentPassword: string) {
  try {
    const { user, profile } = await requireSession();

    // 1. Verify current password
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email!,
      password: currentPassword
    });

    if (signInError) {
      throw new Error('Current password is incorrect');
    }

    // 2. Send email OTP
    const emailResult = await sendOtp('change_password_email', 'email');
    if (!emailResult.success) return emailResult;

    // 3. Send phone OTP if phone exists
    const hasPhone = !!profile.phone;
    if (hasPhone) {
      const phoneResult = await sendOtp('change_password_phone', 'phone');
      if (!phoneResult.success) {
        // Non-blocking: phone OTP failed but email was sent
        console.warn('[Password Change] Phone OTP failed, continuing with email-only');
      }
    }

    return { success: true, requiresPhoneOtp: hasPhone };
  } catch (error: any) {
    captureException(error, { action: 'requestPasswordChange' });
    return { success: false, error: error.message };
  }
}

// ─── Change Password: Step 2 — Verify OTPs & update ───
export async function confirmPasswordChange(
  newPassword: string,
  emailOtpCode: string,
  phoneOtpCode?: string
) {
  try {
    // Verify email OTP
    const emailResult = await verifyOtp('change_password_email', emailOtpCode);
    if (!emailResult.success) return { success: false, error: 'Invalid email verification code' };

    // Verify phone OTP if provided
    if (phoneOtpCode) {
      const phoneResult = await verifyOtp('change_password_phone', phoneOtpCode);
      if (!phoneResult.success) return { success: false, error: 'Invalid phone verification code' };
    }

    const { user } = await requireSession();
    const admin = createAdminClient({ admin: true });

    // Validate password strength
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Update password via admin API
    const { error: authError } = await admin.auth.admin.updateUserById(user.id, {
      password: newPassword
    });

    if (authError) throw authError;

    // Consume verified cookies
    await consumeVerifiedOtp('change_password_email');
    if (phoneOtpCode) {
      await consumeVerifiedOtp('change_password_phone');
    }

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: 'confirmPasswordChange' });
    return { success: false, error: error.message };
  }
}
