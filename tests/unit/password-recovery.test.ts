import { SignJWT } from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearPasswordRecovery, hasPasswordRecovery, markPasswordRecovery } from '@/lib/password-recovery';

const SECRET = 'unit-test-otp-secret-0123456789abcdef';
const COOKIE = 'travi_pw_recovery';
const USER_A = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const USER_B = '6fa459ea-ee8a-4ca4-894e-db77e160355e';

// In-memory stand-in for next/headers cookies().
const jar = vi.hoisted(() => {
  const store = new Map<string, { value: string; options?: Record<string, unknown> }>();
  return {
    store,
    api: {
      get: (name: string) => (store.has(name) ? { name, value: store.get(name)!.value } : undefined),
      set: (name: string, value: string, options?: Record<string, unknown>) => {
        store.set(name, { value, options });
      },
      delete: (name: string) => {
        store.delete(name);
      },
    },
  };
});

vi.mock('next/headers', () => ({ cookies: async () => jar.api }));
vi.mock('@/lib/env', () => ({ env: { OTP_SECRET: 'unit-test-otp-secret-0123456789abcdef' } }));

const key = (secret = SECRET) => new TextEncoder().encode(secret);

async function forge({
  purpose = 'password_recovery',
  sub = USER_A,
  secret = SECRET,
  exp = '15m',
}: { purpose?: string; sub?: string; secret?: string; exp?: string | number } = {}) {
  return new SignJWT({ purpose }).setProtectedHeader({ alg: 'HS256' }).setSubject(sub).setIssuedAt().setExpirationTime(exp).sign(key(secret));
}

describe('password recovery marker', () => {
  beforeEach(() => jar.store.clear());

  it('is absent until a recovery link was verified', async () => {
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('marks, then verifies, the same user', async () => {
    await markPasswordRecovery(USER_A);
    expect(await hasPasswordRecovery(USER_A)).toBe(true);
  });

  it('is bound to the user it was issued for', async () => {
    await markPasswordRecovery(USER_A);
    expect(await hasPasswordRecovery(USER_B)).toBe(false);
  });

  it('sets a short-lived, httpOnly, same-site cookie', async () => {
    await markPasswordRecovery(USER_A);
    const options = jar.store.get(COOKIE)?.options;
    expect(options).toMatchObject({ httpOnly: true, sameSite: 'lax', path: '/', maxAge: 15 * 60 });
  });

  it('is gone after clearPasswordRecovery()', async () => {
    await markPasswordRecovery(USER_A);
    await clearPasswordRecovery();
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('rejects a tampered token', async () => {
    await markPasswordRecovery(USER_A);
    const token = jar.store.get(COOKIE)!.value;
    const [header, payload, signature] = token.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ purpose: 'password_recovery', sub: USER_B, exp: 9999999999 })).toString('base64url');
    jar.api.set(COOKIE, `${header}.${forgedPayload}.${signature}`);
    expect(await hasPasswordRecovery(USER_B)).toBe(false);
    jar.api.set(COOKIE, `${header}.${payload}.${signature.slice(0, -2)}xx`);
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('rejects a token signed with another secret', async () => {
    jar.api.set(COOKIE, await forge({ secret: 'another-secret-0123456789abcdefghij' }));
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('rejects a token issued for another purpose (e.g. an OTP token)', async () => {
    jar.api.set(COOKIE, await forge({ purpose: 'otp_verified' }));
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('rejects an expired token', async () => {
    jar.api.set(COOKIE, await forge({ exp: Math.floor(Date.now() / 1000) - 60 }));
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('rejects garbage', async () => {
    jar.api.set(COOKIE, 'not-a-jwt');
    expect(await hasPasswordRecovery(USER_A)).toBe(false);
  });

  it('accepts a correctly forged token only with the right secret (sanity check of the fixture)', async () => {
    jar.api.set(COOKIE, await forge());
    expect(await hasPasswordRecovery(USER_A)).toBe(true);
  });
});
