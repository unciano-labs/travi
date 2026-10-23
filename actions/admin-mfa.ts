'use server';

// Admin TOTP MFA (SEC-12): enrol an authenticator app, or verify a code to upgrade the session to
// aal2. These are the only admin actions callable at aal1, so they use assertAdminRoleForMfa().
import { redirect } from 'next/navigation';
import { z, ZodError } from 'zod';
import { requireSession, assertAdminRoleForMfa } from '@/lib/auth-helpers';
import { assertRateLimit } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { logMutation } from '@/lib/audit';

type Failure = { success: false; error: string };

const totpCode = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app.');
const verifyEnrollmentSchema = z.object({ factorId: z.string().uuid(), code: totpCode });
const verifySchema = z.object({ code: totpCode });

// Expected outcomes (wrong code, bad input) are not incidents.
class MfaError extends Error {}

function failure(error: unknown, fallback: string): Failure {
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && error.message) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

function report(error: unknown, action: string) {
  if (!(error instanceof MfaError) && !(error instanceof ZodError)) captureException(error, { action });
}

const INVALID_CODE = 'That code is not valid. Check the time on your phone and try the newest code.';

// ─── Enrol: create a TOTP factor and return its QR code + secret ───
export async function startAdminMfaEnrollment(): Promise<
  { success: true; factorId: string; qrCode: string; secret: string } | Failure
> {
  try {
    const { user, supabase } = await requireSession();
    await assertAdminRoleForMfa(user.id);
    await assertRateLimit(`admin-mfa:${user.id}`, 'auth');

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    if (factors.totp.some((f) => f.status === 'verified')) {
      throw new MfaError('An authenticator is already set up for this account. Enter a code from it instead.');
    }

    // Remove abandoned, never-verified enrolments so a fresh QR code can be issued.
    for (const factor of factors.all) {
      if (factor.factor_type === 'totp' && factor.status === 'unverified') {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: `Travi admin ${Date.now()}`,
      issuer: 'Travi Admin',
    });
    if (error || !data) throw error ?? new Error('MFA enrolment returned no factor');

    return { success: true, factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  } catch (error: unknown) {
    report(error, 'startAdminMfaEnrollment');
    return failure(error, 'Could not start authenticator setup.');
  }
}

// ─── Enrol: confirm the first code (verifies the factor and upgrades the session to aal2) ───
export async function verifyAdminMfaEnrollment(input: { factorId: string; code: string }): Promise<Failure | void> {
  let success = false;
  try {
    const data = verifyEnrollmentSchema.parse(input);
    const { user, profile, supabase } = await requireSession();
    await assertAdminRoleForMfa(user.id);
    await assertRateLimit(`admin-mfa:${user.id}`, 'auth');

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: data.factorId, code: data.code });
    if (error) throw new MfaError(INVALID_CODE);

    await logMutation({
      adminProfileId: profile.id,
      entityType: 'user_profile',
      entityId: profile.id,
      action: 'mfa_enrolled',
      notes: 'Admin TOTP authenticator enrolled',
    });
    success = true;
  } catch (error: unknown) {
    report(error, 'verifyAdminMfaEnrollment');
    return failure(error, 'Verification failed.');
  }
  if (success) redirect('/admin');
}

// ─── Sign-in step 2: verify a code from the enrolled authenticator ───
export async function verifyAdminMfa(input: { code: string }): Promise<Failure | void> {
  let success = false;
  try {
    const data = verifySchema.parse(input);
    const { user, supabase } = await requireSession();
    await assertAdminRoleForMfa(user.id);
    await assertRateLimit(`admin-mfa:${user.id}`, 'auth');

    const { data: factors, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) throw listError;
    const factor = factors.totp.find((f) => f.status === 'verified');
    if (!factor) throw new MfaError('No authenticator is set up for this account yet.');

    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code: data.code });
    if (error) throw new MfaError(INVALID_CODE);
    success = true;
  } catch (error: unknown) {
    report(error, 'verifyAdminMfa');
    return failure(error, 'Verification failed.');
  }
  if (success) redirect('/admin');
}
