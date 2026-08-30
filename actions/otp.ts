'use server';

import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { requireSession } from '@/lib/auth-helpers';
import { sendEmail } from '@/lib/email';
import { sendSms } from '@/lib/sms';
import { captureException } from '@/lib/logger';

const getJwtSecret = () => new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET || 'fallback-secret-for-dev-only');

// ─── Supported OTP actions ───
export type OtpAction =
  | 'add_payout_method'
  | 'change_email'
  | 'change_password_email'
  | 'change_password_phone'
  | 'verify_email';

type OtpChannel = 'email' | 'phone';

function cookieName(action: OtpAction) {
  return `otp_pending_${action}`;
}

function verifiedCookieName(action: OtpAction) {
  return `otp_verified_${action}`;
}

// ─── Generic Send OTP ───
export async function sendOtp(
  action: OtpAction,
  channel: OtpChannel = 'email',
  extraPayload: Record<string, string> = {}
) {
  try {
    const { user, profile } = await requireSession();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (channel === 'email') {
      const email = user.email;
      if (!email) throw new Error('No email address on this account');

      try {
        await sendEmail({
          to: email,
          subject: `Your Travi Verification Code`,
          html: `
            <div style="font-family: sans-serif; color: #1e293b;">
              <h2>Security Verification</h2>
              <p>Hi ${profile.full_name || 'there'},</p>
              <p>Your one-time verification code is:</p>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0EA5E9;">${code}</p>
              <p>This code expires in 10 minutes. If you did not request this, please secure your account immediately.</p>
              <p>Thank you,<br/>Travi Support</p>
            </div>
          `
        });
      } catch {
        console.warn(`[OTP] Failed to send email for action "${action}". Code: ${code}`);
      }
    } else if (channel === 'phone') {
      // Resolve phone from profile or role-specific profiles
      const phone = profile.phone;
      if (!phone) throw new Error('No phone number on this account. Please add one in your profile first.');

      try {
        await sendSms({
          to: phone,
          body: `Your Travi verification code is: ${code}. It expires in 10 minutes.`
        });
      } catch {
        console.warn(`[OTP] Failed to send SMS for action "${action}". Code: ${code}`);
      }
    }

    // Create JWT with code + action + any extra payload
    const jwt = await new SignJWT({ code, action, ...extraPayload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(getJwtSecret());

    const cookieStore = await cookies();
    cookieStore.set(cookieName(action), jwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600
    });

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: `sendOtp:${action}` });
    return { success: false, error: error.message || 'Failed to send OTP' };
  }
}

// ─── Generic Verify OTP ───
export async function verifyOtp(action: OtpAction, code: string) {
  try {
    const { user } = await requireSession();
    const cookieStore = await cookies();
    const token = cookieStore.get(cookieName(action))?.value;

    if (!token) {
      throw new Error('Verification code expired or not requested');
    }

    const { payload } = await jwtVerify(token, getJwtSecret());

    if (payload.code !== code || payload.action !== action) {
      throw new Error('Invalid verification code');
    }

    // Clear pending OTP
    cookieStore.delete(cookieName(action));

    // Set a short-lived "verified" cookie
    const verifiedJwt = await new SignJWT({
      verified: true,
      userId: user.id,
      action,
      // Carry over any extra payload from the pending JWT
      ...(payload.newEmail ? { newEmail: payload.newEmail } : {}),
      ...(payload.newPasswordHash ? { newPasswordHash: payload.newPasswordHash } : {}),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(getJwtSecret());

    cookieStore.set(verifiedCookieName(action), verifiedJwt, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 900
    });

    return { success: true };
  } catch (error: any) {
    captureException(error, { action: `verifyOtp:${action}` });
    return { success: false, error: error.message || 'Verification failed' };
  }
}

// ─── Check if OTP is verified (for server actions) ───
export async function requireVerifiedOtp(action: OtpAction) {
  const cookieStore = await cookies();
  const token = cookieStore.get(verifiedCookieName(action))?.value;

  if (!token) {
    throw new Error('OTP verification is required.');
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (!payload.verified || payload.action !== action) {
    throw new Error('Invalid or expired OTP session.');
  }

  return payload;
}

// ─── Consume verified OTP cookie ───
export async function consumeVerifiedOtp(action: OtpAction) {
  const cookieStore = await cookies();
  cookieStore.delete(verifiedCookieName(action));
}

// ─── Legacy wrappers (backward compat for wallet) ───
export async function sendPayoutOtp() {
  return sendOtp('add_payout_method', 'email');
}

export async function verifyPayoutOtp(code: string) {
  return verifyOtp('add_payout_method', code);
}
