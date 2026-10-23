// Page-level guard for /admin/mfa/* (AGENTS.md §3.4: never rely on middleware alone).
// Server-only: uses the cookie client through requireSession().
import { redirect, unstable_rethrow } from 'next/navigation';
import { requireSession, assertAdminRoleForMfa } from '@/lib/auth-helpers';

/** Signed-in admin (any assurance level), else → /admin/login. */
export async function requireAdminForMfaPage() {
  let ok = false;
  try {
    const { user } = await requireSession();
    await assertAdminRoleForMfa(user.id);
    ok = true;
  } catch (error: unknown) {
    unstable_rethrow(error);
  }
  if (!ok) redirect('/admin/login');
}
