// OTP challenge tests (Phase 5.7, SEC-09/SEC-11): otp_challenges + otp_issue/otp_attempt/otp_verified
// from supabase/migrations/20261026100000_otp_challenges.sql, and the payout_otps lockdown.
// Run: npm run test:rls. Every case runs in a rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { attempt, createDb } from './harness.mjs';
import { SEED, U, as, id, one, service } from './fixtures.mjs';

const SECRET = 'test-otp-secret-0123456789abcdef0123';
const C1 = id(901);
const C2 = id(902);
const hash = (challengeId, userId, action, code) =>
  createHmac('sha256', SECRET).update([challengeId, userId, action, code].join('|')).digest('hex');

let db;
let migrationResult;
before(async () => {
  let results;
  ({ db, results } = await createDb());
  migrationResult = results.find((r) => r.file.startsWith('20261026100000'));
  await db.exec(SEED);
});

const issue = (d, { cid = C1, uid = U.T, action = 'change_email', target = 'new@travi.test', code = '123456', ttl = 600 } = {}) =>
  d.query(`SELECT otp_issue($1, $2, $3, 'email', $4, $5, $6) AS id`, [cid, uid, action, target, hash(cid, uid, action, code), ttl]);
const tryCode = async (d, { cid = C1, uid = U.T, action = 'change_email', code = '123456', consume = false } = {}) =>
  (await d.query(`SELECT * FROM otp_attempt($1, $2, $3, $4, $5)`, [cid, uid, action, hash(cid, uid, action, code), consume])).rows[0];
const verified = async (d, { cid = C1, uid = U.T, action = 'change_email', consume = false } = {}) =>
  (await d.query(`SELECT * FROM otp_verified($1, $2, $3, $4)`, [cid, uid, action, consume])).rows[0];

describe('otp_challenges migration', () => {
  test('applies cleanly', () => {
    assert.ok(migrationResult, 'migration file found');
    assert.equal(migrationResult.ok, true, migrationResult.error);
  });
});

describe('otp_challenges access (service role only)', () => {
  for (const [who, ctx] of [['anon', { role: 'anon' }], ['authenticated owner', as('T')]]) {
    test(`${who} cannot read challenges`, async () => {
      const r = await attempt(db, ctx, (d) => d.query('SELECT * FROM otp_challenges'));
      assert.match(r.error ?? '', /permission denied/);
    });

    test(`${who} cannot insert a challenge (would mint their own code)`, async () => {
      const r = await attempt(db, ctx, (d) =>
        d.query(`INSERT INTO otp_challenges (user_id, action, channel, code_hash, expires_at)
                 VALUES ($1, 'verify_email', 'email', repeat('a', 64), now() + interval '5 minutes')`, [U.T]));
      assert.match(r.error ?? '', /permission denied/);
    });

    for (const fn of [
      `otp_issue('${C1}', '${U.T}', 'verify_email', 'email', NULL, repeat('a', 64))`,
      `otp_attempt('${C1}', '${U.T}', 'verify_email', repeat('a', 64))`,
      `otp_verified('${C1}', '${U.T}', 'verify_email', true)`,
    ]) {
      test(`${who} cannot execute ${fn.split('(')[0]}()`, async () => {
        const r = await attempt(db, ctx, (d) => d.query(`SELECT * FROM ${fn}`));
        assert.match(r.error ?? '', /permission denied/);
      });
    }
  }

  test('authenticated user cannot touch the legacy payout_otps table any more', async () => {
    const r = await attempt(db, as('T'), (d) =>
      d.query(`INSERT INTO payout_otps (user_id, code, expires_at) VALUES ($1, '123456', now() + interval '5 minutes')`, [U.T]));
    assert.match(r.error ?? '', /permission denied/);
    const sel = await attempt(db, as('T'), (d) => d.query('SELECT * FROM payout_otps'));
    assert.match(sel.error ?? '', /permission denied/);
  });
});

describe('otp_issue()', () => {
  test('stores only the hash, bound to user/action/target, 10-minute expiry', async () => {
    const r = await attempt(db, service, (d) => issue(d), (d) =>
      one(d, `SELECT user_id, action, target, code_hash, attempts, max_attempts,
                     expires_at - created_at AS ttl, verified_at, consumed_at FROM otp_challenges WHERE id = $1`, [C1]));
    assert.equal(r.error, null);
    assert.equal(r.verified.user_id, U.T);
    assert.equal(r.verified.action, 'change_email');
    assert.equal(r.verified.target, 'new@travi.test');
    assert.match(r.verified.code_hash, /^[0-9a-f]{64}$/);
    assert.notEqual(r.verified.code_hash, '123456');
    assert.equal(r.verified.attempts, 0);
    assert.equal(r.verified.max_attempts, 5);
    assert.equal(r.verified.verified_at, null);
  });

  test('rejects a code_hash that is not a hex HMAC (e.g. a plaintext code)', async () => {
    const r = await attempt(db, service, (d) =>
      d.query(`SELECT otp_issue($1, $2, 'verify_email', 'email', NULL, '123456')`, [C1, U.T]));
    assert.match(r.error ?? '', /check constraint/);
  });

  test('a new code supersedes the previous open one', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d, { cid: C1, code: '111111' });
      await issue(d, { cid: C2, code: '222222' });
      return { old: await tryCode(d, { cid: C1, code: '111111' }), cur: await tryCode(d, { cid: C2, code: '222222' }) };
    });
    assert.equal(r.error, null);
    assert.equal(r.result.old.status, 'used');
    assert.equal(r.result.cur.status, 'verified');
  });

  test('caps sends at 5 per user and action per hour', async () => {
    const r = await attempt(db, service, async (d) => {
      for (let i = 0; i < 5; i++) await issue(d, { cid: id(910 + i) });
      await issue(d, { cid: id(920) });
    });
    assert.match(r.error ?? '', /otp_send_limit/);
  });

  test('the cap is per action and per user', async () => {
    const r = await attempt(db, service, async (d) => {
      for (let i = 0; i < 5; i++) await issue(d, { cid: id(910 + i) });
      await issue(d, { cid: id(930), action: 'verify_email', target: null });
      await issue(d, { cid: id(931), uid: U.O });
    });
    assert.equal(r.error, null);
  });

  test('refuses an out-of-range TTL', async () => {
    const r = await attempt(db, service, (d) => issue(d, { ttl: 86400 }));
    assert.match(r.error ?? '', /otp_invalid_ttl/);
  });
});

describe('otp_attempt()', () => {
  test('correct code verifies and returns the bound target', async () => {
    const r = await attempt(db, service, async (d) => { await issue(d); return tryCode(d); });
    assert.equal(r.result.status, 'verified');
    assert.equal(r.result.target, 'new@travi.test');
  });

  test('wrong code counts an attempt and reports attempts left', async () => {
    const r = await attempt(db, service, async (d) => { await issue(d); return tryCode(d, { code: '000000' }); },
      (d) => one(d, 'SELECT attempts FROM otp_challenges WHERE id = $1', [C1]));
    assert.equal(r.result.status, 'invalid');
    assert.equal(r.result.attempts_left, 4);
    assert.equal(r.verified.attempts, 1);
  });

  test('locks after 5 wrong attempts; the right code no longer works', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      const statuses = [];
      for (let i = 0; i < 5; i++) statuses.push((await tryCode(d, { code: String(i).padStart(6, '0') })).status);
      statuses.push((await tryCode(d)).status);
      return statuses;
    });
    assert.deepEqual(r.result, ['invalid', 'invalid', 'invalid', 'invalid', 'locked', 'locked']);
  });

  test('expired code is refused', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      await d.query(`UPDATE otp_challenges SET created_at = now() - interval '20 minutes',
                     expires_at = now() - interval '10 minutes' WHERE id = $1`, [C1]);
      return tryCode(d);
    });
    assert.equal(r.result.status, 'expired');
  });

  test("another user's challenge id is treated as not found (no cross-user use)", async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      // Attacker U.O presents the victim's challenge id with a hash computed for themselves.
      return tryCode(d, { uid: U.O });
    });
    assert.equal(r.result.status, 'not_found');
  });

  test('a code for one action cannot be used for another', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d, { action: 'verify_email', target: null });
      return tryCode(d, { action: 'change_password_email' });
    });
    assert.equal(r.result.status, 'not_found');
  });

  test('single use: a verified code cannot be verified again', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      await tryCode(d, { consume: true });
      return tryCode(d);
    });
    assert.equal(r.result.status, 'used');
  });
});

describe('otp_verified()', () => {
  test('unverified challenge is not valid', async () => {
    const r = await attempt(db, service, async (d) => { await issue(d); return verified(d); });
    assert.equal(r.result.valid, false);
  });

  test('verified challenge is valid (with target) until consumed, then exactly once', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      await tryCode(d);
      return [await verified(d), await verified(d, { consume: true }), await verified(d, { consume: true }), await verified(d)];
    });
    assert.deepEqual(r.result.map((x) => x.valid), [true, true, false, false]);
    assert.equal(r.result[1].target, 'new@travi.test');
  });

  test('verification window is 15 minutes', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      await tryCode(d);
      await d.query(`UPDATE otp_challenges SET verified_at = now() - interval '16 minutes' WHERE id = $1`, [C1]);
      return verified(d, { consume: true });
    });
    assert.equal(r.result.valid, false);
  });

  test('bound to the user and action', async () => {
    const r = await attempt(db, service, async (d) => {
      await issue(d);
      await tryCode(d);
      return [await verified(d, { uid: U.O, consume: true }), await verified(d, { action: 'add_payout_method', consume: true })];
    });
    assert.deepEqual(r.result.map((x) => x.valid), [false, false]);
  });
});
