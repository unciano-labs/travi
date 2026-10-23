'use server';

import { redirect } from 'next/navigation';
import { ZodError } from 'zod';
import type { AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { env } from '@/lib/env';
import { requireSession } from '@/lib/auth-helpers';
import { assertRateLimit, getClientIp } from '@/lib/ratelimit';
import { captureException } from '@/lib/logger';
import { notifySuperAdmin } from '@/lib/notifications';
import {
  ensureAccountProvisioned,
  fetchUserRoles,
  getSiteOrigin,
  homePathForRoles,
} from '@/lib/accounts';
import { clearPasswordRecovery, hasPasswordRecovery } from '@/lib/password-recovery';
import { safeNextPath } from '@/lib/safe-next';
import { signupAcceptanceMetadata } from '@/lib/legal/consent';
import { acceptedCheckboxSchema } from '@/lib/schemas/legal';
import {
  addAccountTypeSchema,
  forgotPasswordSchema,
  loginSchema,
  resendConfirmationSchema,
  resetPasswordSchema,
  signupSchema,
} from '@/lib/schemas/auth';

type ActionFailure = { success: false; error: string; code?: string };

function failure(error: unknown, fallback: string): ActionFailure {
  if (error instanceof ZodError) return { success: false, error: error.issues[0]?.message ?? fallback };
  if (error instanceof Error && error.message) return { success: false, error: error.message };
  return { success: false, error: fallback };
}

const isEmailNotConfirmed = (error: AuthError) =>
  error.code === 'email_not_confirmed' || /email not confirmed/i.test(error.message);

// Callback URL for auth emails. `next` must already be a safe relative path.
async function authCallbackUrl(next: string) {
  return `${await getSiteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

// ─── Admin login ───
export async function loginAsAdmin(formData: FormData): Promise<ActionFailure | void> {
  let success = false;

  try {
    await assertRateLimit(await getClientIp(), 'auth');
    const validated = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
    });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error || !data.user) return { success: false, error: 'Invalid email or password.' };

    const roles = await fetchUserRoles(supabase, data.user.id);
    if (!roles.includes('admin')) {
      await supabase.auth.signOut();
      return { success: false, error: 'Unauthorized: You do not have admin privileges.' };
    }

    success = true;
  } catch (error: unknown) {
    captureException(error, { action: 'loginAsAdmin' });
    return failure(error, 'Login failed');
  }

  if (success) redirect('/admin');
}

export async function logoutAdmin() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

// ─── User login (honours a safe relative `next`) ───
export async function loginUser(formData: FormData): Promise<ActionFailure | void> {
  let destination: string | null = null;

  try {
    await assertRateLimit(await getClientIp(), 'auth');
    const validated = loginSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      next: formData.get('next') || undefined,
    });

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: validated.email,
      password: validated.password,
    });

    if (error) {
      if (isEmailNotConfirmed(error)) {
        return {
          success: false,
          code: 'email_not_confirmed',
          error: 'Please confirm your email address first. Check your inbox for the confirmation link.',
        };
      }
      return { success: false, error: 'Invalid email or password.' };
    }

    // Creates a missing profile / signup role (fallback for the auth.users trigger).
    const roles = await ensureAccountProvisioned(supabase, data.user);
    if (roles.length === 0) {
      await supabase.auth.signOut();
      return { success: false, error: 'Access denied: no role is assigned to this account.' };
    }

    destination = safeNextPath(validated.next) ?? homePathForRoles(roles);
  } catch (error: unknown) {
    captureException(error, { action: 'loginUser' });
    return failure(error, 'Login failed');
  }

  if (destination) redirect(destination);
}

export async function logoutUser() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

// ─── Signup (works with Supabase "Confirm email" ON or OFF) ───
export async function signupUser(formData: FormData): Promise<ActionFailure | void> {
  let destination: string | null = null;

  try {
    await assertRateLimit(await getClientIp(), 'auth');
    const validated = signupSchema.parse({
      email: formData.get('email'),
      password: formData.get('password'),
      role: formData.get('role') || 'traveler',
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      next: formData.get('next') || undefined,
    });
    // LEG-01/02: the Terms of Service + Privacy Notice checkbox is required.
    acceptedCheckboxSchema.parse(formData.get('acceptTerms'));

    const fullName = `${validated.firstName} ${validated.lastName}`.trim();
    const home = safeNextPath(validated.next) ?? `/dashboard/${validated.role}`;
    const supabase = await createClient();

    // The auth.users trigger (migration 20261024090000) creates the profile and the signup role
    // from this metadata, so nothing here depends on having a session.
    const { data, error } = await supabase.auth.signUp({
      email: validated.email,
      password: validated.password,
      options: {
        emailRedirectTo: await authCallbackUrl(home),
        data: {
          full_name: fullName,
          first_name: validated.firstName,
          last_name: validated.lastName,
          signup_role: validated.role,
          ...(env.WEBSITE_ID ? { signup_website_id: env.WEBSITE_ID } : {}),
          // LEG-01/02: copied into legal_acceptances when the profile is created
          // (trigger user_profiles_record_signup_acceptances, migration 20261026090000).
          legal_acceptance: await signupAcceptanceMetadata(),
        },
      },
    });

    if (error) return { success: false, error: error.message };

    // With "Confirm email" ON, an already-registered address comes back as a user with no
    // identities (Supabase hides account existence). Treat it like a new signup in the UI.
    const isNewAccount = !!data.user && (data.user.identities?.length ?? 0) > 0;

    if (data.session && data.user) {
      // "Confirm email" OFF: signed in already. Fallback in case the trigger is missing.
      await ensureAccountProvisioned(supabase, data.user);
      destination = home;
    } else {
      destination = '/login?message=check_email';
    }

    if (isNewAccount) {
      await notifySuperAdmin(
        'New Account Created',
        `${fullName} (${validated.email}) created a new ${validated.role} account.`,
        'account_created'
      );
    }
  } catch (error: unknown) {
    captureException(error, { action: 'signupUser' });
    return failure(error, 'Signup failed');
  }

  if (destination) redirect(destination);
}

// ─── Resend the signup confirmation email ───
export async function resendConfirmation(formData: FormData) {
  try {
    await assertRateLimit(await getClientIp(), 'auth');
    const { email } = resendConfirmationSchema.parse({ email: formData.get('email') });

    const supabase = await createClient();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: await authCallbackUrl('/dashboard') },
    });
    // Same answer either way: never reveal whether the address has an account.
    if (error) captureException(error, { action: 'resendConfirmation' });
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'resendConfirmation' });
    return failure(error, 'Could not resend the confirmation email');
  }
}

// ─── Forgot password: email a recovery link (BIZ-10) ───
export async function requestPasswordReset(formData: FormData) {
  try {
    await assertRateLimit(await getClientIp(), 'auth');
    const { email } = forgotPasswordSchema.parse({ email: formData.get('email') });

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: await authCallbackUrl('/auth/reset-password'),
    });
    // Same answer either way: never reveal whether the address has an account.
    if (error) captureException(error, { action: 'requestPasswordReset' });
    return { success: true as const };
  } catch (error: unknown) {
    captureException(error, { action: 'requestPasswordReset' });
    return failure(error, 'Could not send the reset email');
  }
}

// ─── Reset password: only right after following a recovery link (BIZ-10) ───
export async function resetPassword(formData: FormData): Promise<ActionFailure | void> {
  let destination: string | null = null;

  try {
    const validated = resetPasswordSchema.parse({
      password: formData.get('password'),
      confirmPassword: formData.get('confirmPassword'),
    });

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !(await hasPasswordRecovery(user.id))) {
      return {
        success: false,
        code: 'link_expired',
        error: 'This reset link has expired. Please request a new one.',
      };
    }
    await assertRateLimit(user.id, 'mutation');

    const { error } = await supabase.auth.updateUser({ password: validated.password });
    if (error) return { success: false, error: error.message };

    await clearPasswordRecovery();
    // Sign out every other device that may still hold the old credentials.
    const { error: signOutError } = await supabase.auth.signOut({ scope: 'others' });
    if (signOutError) captureException(signOutError, { action: 'resetPassword:signOutOthers' });

    const roles = await ensureAccountProvisioned(supabase, user);
    destination = homePathForRoles(roles);
  } catch (error: unknown) {
    captureException(error, { action: 'resetPassword' });
    return failure(error, 'Could not update your password');
  }

  if (destination) redirect(destination);
}

// ─── Roles of the signed-in user (RoleSwitcher) ───
export async function getUserRoles(): Promise<string[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    return await fetchUserRoles(supabase, user.id);
  } catch (error: unknown) {
    captureException(error, { action: 'getUserRoles' });
    return [];
  }
}

// ─── Add another account type (traveler / organizer / transporter) ───
export async function addAccountType(role: string): Promise<ActionFailure | void> {
  let destination: string | null = null;

  try {
    const validated = addAccountTypeSchema.parse({ role });
    const { profile, supabase } = await requireSession();
    await assertRateLimit(profile.id, 'mutation');

    const websiteId = env.WEBSITE_ID;
    if (!websiteId) return { success: false, error: 'Missing website ID configuration' };

    // Users cannot insert user_roles directly; the RPC never grants admin.
    const { error } = await supabase.rpc('assign_self_role', {
      p_role: validated.role,
      p_website_id: websiteId,
    });
    if (error) throw error;

    destination = `/dashboard/${validated.role}`;
  } catch (error: unknown) {
    captureException(error, { action: 'addAccountType', role });
    return failure(error, 'Could not add the account type');
  }

  if (destination) redirect(destination);
}
