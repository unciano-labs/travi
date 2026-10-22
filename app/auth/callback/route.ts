import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { ensureAccountProvisioned } from '@/lib/accounts';
import { markPasswordRecovery } from '@/lib/password-recovery';
import { safeNextPath } from '@/lib/safe-next';
import { captureException } from '@/lib/logger';

// Landing point for every Supabase auth email (signup confirmation, password recovery).
//
//  * PKCE (default with @supabase/ssr): ?code=…&next=…  → exchangeCodeForSession
//  * Token hash (custom email template, works across browsers):
//      ?token_hash=…&type=signup|recovery|email|email_change|invite|magiclink&next=…  → verifyOtp
//
// Redirects only to a safe relative `next` (never off-site). Failures land on a page with a fixed
// message code, never with Supabase's raw error text.
const RESET_PATH = '/auth/reset-password';
const OTP_TYPES: EmailOtpType[] = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const typeParam = searchParams.get('type');
  const type = OTP_TYPES.find((t) => t === typeParam);
  const isRecovery = type === 'recovery' || safeNextPath(searchParams.get('next')) === RESET_PATH;
  const next = type === 'recovery' ? RESET_PATH : safeNextPath(searchParams.get('next')) ?? '/dashboard';

  const fail = () =>
    NextResponse.redirect(
      new URL(isRecovery ? '/auth/forgot-password?error=link_invalid' : '/login?message=link_invalid', request.url)
    );

  if (searchParams.get('error') || (!code && !(tokenHash && type))) {
    return fail();
  }

  try {
    const supabase = await createClient();
    const { data, error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: type!, token_hash: tokenHash! });

    if (error || !data.user) {
      if (error) captureException(error, { action: 'authCallback', flow: code ? 'pkce' : 'token_hash' });
      return fail();
    }

    if (isRecovery) {
      // Only a verified recovery link unlocks /auth/reset-password (lib/password-recovery.ts).
      await markPasswordRecovery(data.user.id);
    } else {
      // Fallback for the auth.users trigger: make sure the profile and signup role exist.
      await ensureAccountProvisioned(supabase, data.user);
    }

    return NextResponse.redirect(new URL(next, request.url));
  } catch (error: unknown) {
    captureException(error, { action: 'authCallback' });
    return fail();
  }
}
