// RLS test harness: real Postgres (PGlite, in-process) + minimal Supabase stubs + every migration in
// supabase/migrations. No Docker or remote project needed. Used by supabase/tests/rls/*.test.mjs.
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { readdirSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join } from 'path';

export const MIGRATIONS_DIR = fileURLToPath(new URL('../../migrations', import.meta.url));

const BOOTSTRAP = `
-- Supabase roles
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
GRANT anon, authenticated, service_role TO postgres;

-- auth schema
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('request.jwt.claim.role', true), '') $$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT jsonb_build_object('sub', auth.uid(), 'role', auth.role()) $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;

-- storage schema
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text, public boolean DEFAULT false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz DEFAULT now());
CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text REFERENCES storage.buckets(id),
  name text, owner uuid, metadata jsonb, created_at timestamptz DEFAULT now());
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS
  $$ SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA storage TO anon, authenticated, service_role;

-- pg_cron stub
CREATE SCHEMA cron;
CREATE FUNCTION cron.schedule(job_name text, schedule text, command text) RETURNS bigint LANGUAGE sql AS $$ SELECT 1::bigint $$;
CREATE FUNCTION cron.unschedule(job_name text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;

-- extensions schema (Supabase puts uuid-ossp etc. there)
CREATE SCHEMA extensions;

-- Supabase default privileges on public
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;

-- Tables the legacy chain assumes exist (created outside migrations in the real project)
CREATE TABLE public.websites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, created_at timestamptz DEFAULT now());
`;

export async function createDb({ only, extraSql = [], log = false } = {}) {
  const db = new PGlite({ extensions: { uuid_ossp } });
  await db.exec('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
  await db.exec(BOOTSTRAP);
  // Realtime publication used by the notifications migration
  try { await db.exec('CREATE PUBLICATION supabase_realtime;'); } catch { /* not supported: stubbed below */ }

  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  // Live order: legacy 017 was applied after the transport tables existed (it references them).
  const i017 = files.findIndex((f) => f.startsWith('20260801000017'));
  const iSoft = files.findIndex((f) => f.startsWith('20260826164500'));
  if (i017 >= 0 && iSoft > i017) files.splice(iSoft, 0, ...files.splice(i017, 1));
  const results = [];
  for (const file of files) {
    if (only && !only(file)) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8')
      .replace(/CREATE EXTENSION IF NOT EXISTS pg_cron;/gi, '-- pg_cron stubbed by harness');
    try {
      await db.exec(sql);
      results.push({ file, ok: true });
    } catch (e) {
      results.push({ file, ok: false, error: e.message });
      if (log) console.log('FAIL', file, '-', e.message);
    }
  }
  for (const sql of extraSql) await db.exec(sql);
  return { db, results };
}

// Run `action` as an end user (role + auth.uid()) the way PostgREST does, then `verify` as the
// superuser in the same transaction. Everything is rolled back, so tests never affect each other.
export async function attempt(db, { role = 'authenticated', uid = null }, action, verify) {
  await db.exec('BEGIN');
  try {
    await db.exec(`SET LOCAL ROLE ${role}`);
    await db.query(
      "SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)",
      [uid ?? '', role]
    );
    await db.exec('SAVEPOINT action');
    let error = null;
    let result = null;
    try {
      result = await action(db);
    } catch (e) {
      error = e.message;
      await db.exec('ROLLBACK TO SAVEPOINT action');
    }
    await db.exec('RESET ROLE');
    const verified = verify ? await verify(db, result) : undefined;
    return { error, result, verified };
  } finally {
    await db.exec('ROLLBACK');
  }
}
