// One-time codes (SEC-09, SEC-11). Server-only, deliberately NOT Server Actions (AGENTS.md §3.2):
// callers authenticate first and pass only fixed, typed extra claims.
//
// Design (supabase/migrations/20261026100000_otp_challenges.sql):
//   * the 6-digit code comes from crypto.randomInt and is only ever emailed/texted, never stored;
//   * the DB keeps HMAC-SHA256(OTP_SECRET, challengeId|userId|action|code) in otp_challenges
//     (service role only), bound to the user, the action and the target address;
//   * 10-minute expiry, 5 attempts, single use, max 5 codes per action per hour, newest code wins;
//   * the browser holds only the opaque challenge id (httpOnly cookie `otp_challenge_<action>`).
import { createHmac, randomInt, randomUUID } from 'crypto';
import { cookies } from 'next/headers';
import { requireSession } from '@/lib/auth-helpers';
import { createAdminClient } from '@/lib/supabase/admin';
import { maskEmail, sendEmail } from '@/lib/email';
import { otpCodeEmail } from '@/lib/email-templates';
import { sendSms } from '@/lib/sms';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { env } from '@/lib/env';

// ─── Supported OTP actions ───
export type OtpAction =
  | 'add_payout_method'
  | 'change_email'
  | 'change_phone'
  | 'change_password_email'
  | 'change_password_phone'
  | 'verify_email';

type OtpChannel = 'email' | 'phone';

// The only extra data a challenge may carry. Never spread caller input into it.
export type OtpExtraClaims = { newPhone?: string; newEmail?: string };

const CODE_TTL_SECONDS = 600; // 10 minutes to enter the code
const VERIFIED_WINDOW_SECONDS = 900; // 15 minutes to use a verified code (two-step flows)
const CODE_TTL_MINUTES = CODE_TTL_SECONDS / 60;

const PURPOSE: Record<OtpAction, string> = {
  add_payout_method: 'add a payout method',
  change_email: 'confirm your new email address',
  change_phone: 'change your phone number',
  change_password_email: 'change your password',
  change_password_phone: 'change your password',
  verify_email: 'verify your email address',
};

const NOT_REQUESTED = 'Verification code expired or not requested. Please request a new code.';

function challengeCookie(action: OtpAction) {
  return `otp_challenge_${action}`;
}

function hashCode(challengeId: string, userId: string, action: OtpAction, code: string) {
  return createHmac('sha256', env.OTP_SECRET).update([challengeId, userId, action, code].join('|')).digest('hex');
}

/** Map the bound target back to the claim the caller expects. */
function claimsFor(action: OtpAction, target: string | null): OtpExtraClaims {
  if (!target) return {};
  if (action === 'change_email') return { newEmail: target };
  if (action === 'change_phone') return { newPhone: target };
  return {};
}

async function readChallengeId(action: OtpAction) {
  const cookieStore = await cookies();
  const value = cookieStore.get(challengeCookie(action))?.value;
  // Only a UUID is ever accepted from the cookie.
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

async function clearChallengeCookie(action: OtpAction) {
  const cookieStore = await cookies();
  cookieStore.delete(challengeCookie(action));
}

type Failure = { success: false; error: string };

/** Expected, user-facing outcomes (wrong code, expired, limits). Not reported to Sentry. */
export class OtpError extends Error {}

function failure(error: unknown, fallback: string): Failure {
  return { success: false, error: error instanceof Error && error.message ? error.message : fallback };
}

function report(error: unknown, action: string) {
  if (!(error instanceof OtpError)) captureException(error, { action });
}

// ─── Send a code ───
export async function sendOtp(
  action: OtpAction,
  channel: OtpChannel = 'email',
  extra: OtpExtraClaims = {}
): Promise<{ success: true } | Failure> {
  try {
    const { user, profile } = await requireSession();
    await assertRateLimit(`otp-send:${user.id}`, 'auth');

    // The target is part of the challenge: a code proves THIS address, not "some" address.
    let target: string | null = null;
    if (action === 'change_email') {
      if (!extra.newEmail) throw new OtpError('A new email address is required.');
      target = extra.newEmail.trim().toLowerCase();
    } else if (action === 'change_phone') {
      if (!extra.newPhone) throw new OtpError('A new phone number is required.');
      target = extra.newPhone.trim();
    }

    // SEC-11: an email change sends the code to the NEW address, proving the user controls it.
    let destination: string | null | undefined;
    if (channel === 'email') destination = action === 'change_email' ? target : user.email;
    else destination = action === 'change_phone' ? target : profile.phone;
    if (!destination) {
      throw new OtpError(channel === 'email' ? 'No email address on this account.' : 'No phone number available to send the code to.');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challengeId = randomUUID();

    // Service role: otp_challenges is server-only (no user access at all).
    const admin = createAdminClient({ admin: true });
    const { error: issueError } = await admin.rpc('otp_issue', {
      p_id: challengeId,
      p_user_id: user.id,
      p_action: action,
      p_channel: channel,
      p_target: target,
      p_code_hash: hashCode(challengeId, user.id, action, code),
      p_ttl_seconds: CODE_TTL_SECONDS,
    });
    if (issueError) {
      if (issueError.message?.includes('otp_send_limit')) {
        throw new OtpError('Too many codes requested. Please wait an hour and try again.');
      }
      captureException(new Error(issueError.message), { action: `sendOtp:${action}:otp_issue` });
      throw new OtpError('Could not create a verification code. Please try again.');
    }

    const delivery =
      channel === 'email'
        ? await (async () => {
            const mail = otpCodeEmail({ name: profile.full_name, code, purpose: PURPOSE[action], minutes: CODE_TTL_MINUTES });
            return sendEmail({ to: destination, ...mail });
          })()
        : await sendSms({ to: destination, body: `Your Travi verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes.` });

    if (!delivery.success) {
      // Retire the undeliverable challenge. Never log the code or the full address.
      await admin.from('otp_challenges').update({ consumed_at: new Date().toISOString() }).eq('id', challengeId);
      captureException(new Error('OTP delivery failed'), {
        action: `sendOtp:${action}`,
        channel,
        to: channel === 'email' ? maskEmail(destination) : undefined,
      });
      throw new OtpError(
        channel === 'email'
          ? 'We could not send the code right now. Please try again in a few minutes.'
          : 'We could not send a text message right now. Please verify by email instead.'
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(challengeCookie(action), challengeId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: CODE_TTL_SECONDS + VERIFIED_WINDOW_SECONDS,
    });

    return { success: true };
  } catch (error: unknown) {
    report(error, `sendOtp:${action}`);
    return failure(error, 'Failed to send the verification code');
  }
}

type AttemptRow = { status: string; target: string | null; attempts_left: number };

async function attemptCode(action: OtpAction, code: string, consume: boolean): Promise<OtpExtraClaims> {
  const { user } = await requireSession();
  await assertRateLimit(`otp-verify:${user.id}`, 'auth');
  if (!/^\d{6}$/.test(code)) throw new OtpError('Enter the 6-digit code.');

  const challengeId = await readChallengeId(action);
  if (!challengeId) throw new OtpError(NOT_REQUESTED);

  // Service role: the attempt counter and verification stamps are server-owned.
  const admin = createAdminClient({ admin: true });
  const { data, error } = await admin
    .rpc('otp_attempt', {
      p_id: challengeId,
      p_user_id: user.id,
      p_action: action,
      p_code_hash: hashCode(challengeId, user.id, action, code),
      p_consume: consume,
    })
    .single<AttemptRow>();
  if (error || !data) {
    captureException(new Error(error?.message ?? 'otp_attempt returned no row'), { action: `otp_attempt:${action}` });
    throw new OtpError('Verification failed. Please try again.');
  }

  switch (data.status) {
    case 'verified':
      if (consume) await clearChallengeCookie(action);
      return claimsFor(action, data.target);
    case 'invalid':
      throw new OtpError(`Invalid verification code. ${data.attempts_left} attempt${data.attempts_left === 1 ? '' : 's'} left.`);
    case 'locked':
      await clearChallengeCookie(action);
      throw new OtpError('Too many incorrect attempts. Please request a new code.');
    case 'expired':
      await clearChallengeCookie(action);
      throw new OtpError('This code has expired. Please request a new code.');
    default:
      throw new OtpError(NOT_REQUESTED);
  }
}

// ─── Verify a code now, use it later (two-step flows such as adding a payout method) ───
export async function verifyOtp(action: OtpAction, code: string): Promise<{ success: true } | Failure> {
  try {
    await attemptCode(action, code, false);
    return { success: true };
  } catch (error: unknown) {
    report(error, `verifyOtp:${action}`);
    return failure(error, 'Verification failed');
  }
}

/**
 * Verify AND consume a code in one atomic step (single-request flows: email/phone/password change,
 * email verification). Returns the bound target. Throws a user-safe Error on failure.
 */
export async function redeemOtp(action: OtpAction, code: string): Promise<OtpExtraClaims> {
  return attemptCode(action, code, true);
}

async function checkVerified(action: OtpAction, consume: boolean): Promise<OtpExtraClaims> {
  const { user } = await requireSession();
  const challengeId = await readChallengeId(action);
  if (!challengeId) throw new OtpError('OTP verification is required.');

  // Service role: otp_challenges is server-only.
  const admin = createAdminClient({ admin: true });
  const { data, error } = await admin
    .rpc('otp_verified', {
      p_id: challengeId,
      p_user_id: user.id,
      p_action: action,
      p_consume: consume,
      p_window_seconds: VERIFIED_WINDOW_SECONDS,
    })
    .single<{ valid: boolean; target: string | null }>();
  if (error || !data?.valid) throw new OtpError('OTP verification is required.');

  if (consume) await clearChallengeCookie(action);
  return claimsFor(action, data.target);
}

/** Throws unless the user verified a code for `action` in the last 15 minutes (does not consume it). */
export async function requireVerifiedOtp(action: OtpAction): Promise<OtpExtraClaims> {
  return checkVerified(action, false);
}

/**
 * Atomically use up a verified code (single use): exactly one concurrent caller succeeds; the
 * others get 'OTP verification is required.'. Call this BEFORE the protected mutation.
 */
export async function consumeVerifiedOtp(action: OtpAction): Promise<OtpExtraClaims> {
  return checkVerified(action, true);
}
