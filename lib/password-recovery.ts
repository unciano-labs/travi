// Password-recovery marker (BIZ-10). Server-only; NOT a Server Action.
//
// /auth/reset-password sets a new password without the current one, so it must only work right
// after the user followed a recovery link. /auth/callback sets this short-lived, signed, httpOnly
// cookie (bound to the user id) after it verified a recovery link; the reset page and the
// resetPassword action require it. A stolen session cookie alone therefore cannot reset the
// password — that still needs the current password + email OTP in Account Security.
import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { env } from '@/lib/env';

const COOKIE_NAME = 'travi_pw_recovery';
const TTL_SECONDS = 15 * 60;
const PURPOSE = 'password_recovery';

const secret = () => new TextEncoder().encode(env.OTP_SECRET);

export async function markPasswordRecovery(userId: string) {
  const token = await new SignJWT({ purpose: PURPOSE })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${TTL_SECONDS}s`)
    .sign(secret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: TTL_SECONDS,
  });
}

export async function hasPasswordRecovery(userId: string): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.purpose === PURPOSE && payload.sub === userId;
  } catch {
    return false;
  }
}

export async function clearPasswordRecovery() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
