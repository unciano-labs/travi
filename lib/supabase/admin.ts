import { createClient } from '@supabase/supabase-js';
import { env } from '../env';

export function createAdminClient(options?: { admin: boolean }) {
  if (!options?.admin) {
    throw new Error('Admin client must be explicitly instantiated with { admin: true } to prevent accidental usage.');
  }

  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SERVICE_ROLE_KEY!
  );
}
