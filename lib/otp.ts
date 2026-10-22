// OTP issue/verify helpers. Server-only, deliberately NOT Server Actions (AGENTS.md §3.2):
// callers authenticate first and pass only fixed, typed extra claims.
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { requireSession } from '@/lib/auth-helpers';
import { escapeHtml, sendEmail } from '@/lib/email';
import { sendSms } from '@/lib/sms';
import { captureException } from '@/lib/logger';
import { env } from '@/lib/env';

// Dedicated OTP key; never the Supabase JWT secret, which can mint database tokens.
const getJwtSecret = () => new TextEncoder().encode(env.OTP_SECRET);

// ─── Supported OTP actions ───
export type OtpAction =
  | 'add_payout_method'
  | 'change_email'
  | 'change_phone'
  | 'change_password_email'
  | 'change_password_phone'
  | 'verify_email';

type OtpChannel = 'email' | 'phone';

// The only extra claims an OTP token may carry. Never spread caller input into the token.
export type OtpExtraClaims = { newPhone?: string; newEmail?: string };

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
  extraPayload: OtpExtraClaims = {}
) {
  try {
    const { user, profile } = await requireSession();
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    if (channel === 'email') {
      const email = user.email;
      if (!email) throw new Error('No email address on this account');

      let subject = 'Your Travi Verification Code';
      let warningText = 'This code expires in 10 minutes. If you did not request this, please secure your account immediately.';
      
      if (action === 'change_phone') {
        subject = 'Change Phone number OTP';
        warningText = 'This code expires in 10 minutes. If you did not request this, please contact support immediately.';
      }

      try {
        await sendEmail({
          to: email,
          subject,
          html: `
            <div style="font-family: sans-serif; color: #1e293b;">
              <h2>Security Verification</h2>
              <p>Hi ${escapeHtml(profile.full_name || 'there')},</p>
              <p>Your one-time verification code is:</p>
              <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #0EA5E9;">${code}</p>
              <p>${warningText}</p>
              <p>Thank you,<br/>Travi Support</p>
            </div>
          `
        });
      } catch {
        // Never log the code itself.
        captureException(new Error('OTP email delivery failed'), { action: `sendOtp:${action}` });
      }
    } else if (channel === 'phone') {
      // Resolve phone from payload (if changing number) or profile
      const phone = extraPayload.newPhone || profile.phone;
      if (!phone) throw new Error('No phone number available to send OTP to.');

      const sms = await sendSms({
        to: phone,
        body: `Your Travi verification code is: ${code}. It expires in 10 minutes.`
      });
      if (!sms.success) {
        throw new Error('We could not send a text message right now. Please verify by email instead.');
      }
    }

    // Create JWT with code + action + any extra payload
    const jwt = await new SignJWT({
      code,
      action,
      userId: user.id,
      ...(extraPayload.newPhone ? { newPhone: extraPayload.newPhone } : {}),
      ...(extraPayload.newEmail ? { newEmail: extraPayload.newEmail } : {}),
    })
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

    if (payload.code !== code || payload.action !== action || payload.userId !== user.id) {
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
      ...(payload.newPhone ? { newPhone: payload.newPhone } : {}),
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
  const { user } = await requireSession();
  const cookieStore = await cookies();
  const token = cookieStore.get(verifiedCookieName(action))?.value;

  if (!token) {
    throw new Error('OTP verification is required.');
  }

  const { payload } = await jwtVerify(token, getJwtSecret());

  if (!payload.verified || payload.action !== action || payload.userId !== user.id) {
    throw new Error('Invalid or expired OTP session.');
  }

  return payload;
}

// ─── Consume verified OTP cookie ───
export async function consumeVerifiedOtp(action: OtpAction) {
  const cookieStore = await cookies();
  cookieStore.delete(verifiedCookieName(action));
}
