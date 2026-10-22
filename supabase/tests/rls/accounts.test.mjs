// Accounts (Phase 3.4, BIZ-12): auth.users → user_profiles + signup role trigger.
// Run: npm run test:rls
//
// Supabase's auth server inserts into auth.users as a privileged role; here the superuser does.
// Every case runs in a transaction that is rolled back.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createDb } from './harness.mjs';
import { R, SEED, W, id, one } from './fixtures.mjs';

const NEW = id(901);
const OTHER_WEBSITE = id(902);

let db;
before(async () => {
  ({ db } = await createDb({
    // The real auth.users has email_confirmed_at; the harness table is minimal.
    extraSql: ['ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;'],
  }));
  await db.exec(SEED);
});

async function inTx(fn) {
  await db.exec('BEGIN');
  try {
    return await fn(db);
  } finally {
    await db.exec('ROLLBACK');
  }
}

const signUp = (d, meta, { email = 'fresh@example.com', confirmedAt = null } = {}) =>
  d.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data, email_confirmed_at) VALUES ($1, $2, $3::jsonb, $4)`,
    [NEW, email, JSON.stringify(meta), confirmedAt]
  );

const profileOf = (d) => one(d, `SELECT id, email, full_name, email_verified_at FROM user_profiles WHERE user_id = $1`, [NEW]);
const rolesOf = (d) => d.query(
  `SELECT wr.role::text AS role, wr.website_id FROM user_roles ur
   JOIN user_profiles up ON up.id = ur.user_profile_id
   JOIN website_roles wr ON wr.id = ur.website_role_id
   WHERE up.user_id = $1 ORDER BY 1`, [NEW]).then((r) => r.rows);

describe('auth.users insert trigger', () => {
  test('creates the profile and the chosen signup role', async () => {
    await inTx(async (d) => {
      await signUp(d, { full_name: 'Fresh Organizer', signup_role: 'organizer', signup_website_id: W });
      const p = await profileOf(d);
      assert.equal(p.email, 'fresh@example.com');
      assert.equal(p.full_name, 'Fresh Organizer');
      assert.equal(p.email_verified_at, null);
      assert.deepEqual((await rolesOf(d)).map((r) => r.role), ['organizer']);
    });
  });

  test('builds the name from first_name + last_name when full_name is absent', async () => {
    await inTx(async (d) => {
      await signUp(d, { first_name: 'Ana', last_name: 'Reyes', signup_role: 'traveler', signup_website_id: W });
      assert.equal((await profileOf(d)).full_name, 'Ana Reyes');
      assert.deepEqual((await rolesOf(d)).map((r) => r.role), ['traveler']);
    });
  });

  test('admin in signup metadata is ignored', async () => {
    await inTx(async (d) => {
      await signUp(d, { full_name: 'Sneaky', signup_role: 'admin', signup_website_id: W });
      assert.ok(await profileOf(d), 'profile is still created');
      assert.deepEqual(await rolesOf(d), []);
      const admins = await one(d, `SELECT count(*)::int AS n FROM user_roles WHERE website_role_id = $1`, [R.admin]);
      assert.equal(admins.n, 0);
    });
  });

  test('an unknown or malformed website id grants no role but never blocks signup', async () => {
    for (const website of [OTHER_WEBSITE, 'not-a-uuid', '']) {
      await inTx(async (d) => {
        await signUp(d, { full_name: 'X', signup_role: 'traveler', signup_website_id: website });
        assert.ok(await profileOf(d));
        assert.deepEqual(await rolesOf(d), []);
      });
    }
  });

  test('no metadata at all still creates a profile', async () => {
    await inTx(async (d) => {
      await d.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'bare@example.com')`, [NEW]);
      const p = await profileOf(d);
      assert.equal(p.email, 'bare@example.com');
      assert.equal(p.full_name, null);
      assert.deepEqual(await rolesOf(d), []);
    });
  });

  test('an already-confirmed account (Confirm email OFF) is stamped verified', async () => {
    await inTx(async (d) => {
      await signUp(d, { full_name: 'Auto' }, { confirmedAt: '2026-10-24T00:00:00Z' });
      assert.ok((await profileOf(d)).email_verified_at);
    });
  });

  test('the app-side fallback insert is a no-op after the trigger', async () => {
    await db.exec('BEGIN');
    try {
      await signUp(db, { full_name: 'Fresh', signup_role: 'traveler', signup_website_id: W });
      await db.exec('SET LOCAL ROLE authenticated');
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [NEW]);
      await db.query(
        `INSERT INTO user_profiles (user_id, email, full_name) VALUES ($1, 'fresh@example.com', 'Fresh')
         ON CONFLICT (user_id) DO NOTHING`, [NEW]);
      // assign_self_role is idempotent too (the signup action calls it when a session exists).
      await db.query(`SELECT assign_self_role('traveler', $1)`, [W]);
      await db.exec('RESET ROLE');
      const n = await one(db, `SELECT count(*)::int AS n FROM user_profiles WHERE user_id = $1`, [NEW]);
      assert.equal(n.n, 1);
      assert.deepEqual((await rolesOf(db)).map((r) => r.role), ['traveler']);
    } finally {
      await db.exec('ROLLBACK');
    }
  });
});

describe('email confirmation sync', () => {
  test('confirming the email stamps user_profiles.email_verified_at', async () => {
    await inTx(async (d) => {
      await signUp(d, { full_name: 'Later' });
      assert.equal((await profileOf(d)).email_verified_at, null);
      await d.query(`UPDATE auth.users SET email_confirmed_at = now() WHERE id = $1`, [NEW]);
      assert.ok((await profileOf(d)).email_verified_at);
    });
  });

  test('end users still cannot stamp their own email as verified', async () => {
    await inTx(async (d) => {
      await signUp(d, { full_name: 'Later' });
      await d.exec('SET LOCAL ROLE authenticated');
      await d.query("SELECT set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', 'authenticated', true)", [NEW]);
      await assert.rejects(
        d.query(`UPDATE user_profiles SET email_verified_at = now() WHERE user_id = $1`, [NEW]),
        /can only be changed by the server/);
    });
  });
});
