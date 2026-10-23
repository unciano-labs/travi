import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

// Uptime probe (OPS-04). Public, unauthenticated, never cached. Reports only booleans, latency and
// the build id: no hostnames, error messages, keys or env values.
export const dynamic = 'force-dynamic';

const DB_TIMEOUT_MS = 3000;
// Uptime monitors poll every minute from several regions; memoise the DB probe briefly so the
// endpoint can't be used to hammer the database.
const MEMO_MS = 5000;

type DbCheck = { ok: boolean; latencyMs: number };
let memo: { at: number; result: DbCheck } | null = null;

async function checkDatabase(): Promise<DbCheck> {
  if (memo && Date.now() - memo.at < MEMO_MS) return memo.result;

  const started = Date.now();
  let ok = false;
  try {
    // Anon key + a one-row read that RLS allows for everyone (published tours): proves PostgREST and
    // Postgres are reachable without any privileged credentials.
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await supabase
      .from('tours')
      .select('id')
      .limit(1)
      .abortSignal(AbortSignal.timeout(DB_TIMEOUT_MS));
    ok = !error;
    if (error) logger.warn({ code: error.code }, 'health: database check failed');
  } catch {
    logger.warn('health: database check threw (timeout or network)');
  }

  const result = { ok, latencyMs: Date.now() - started };
  memo = { at: Date.now(), result };
  return result;
}

export async function GET() {
  const database = await checkDatabase();
  const status = database.ok ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status,
      checks: { database },
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
      environment: env.IS_PRODUCTION_DEPLOY ? 'production' : (process.env.VERCEL_ENV ?? 'development'),
      time: new Date().toISOString(),
    },
    {
      status: database.ok ? 200 : 503,
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    }
  );
}
