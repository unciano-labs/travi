// Legal, privacy and support tables (Phase 4: LEG-01/02/05/06/10, OPS-05):
// legal_acceptances, data_requests, support_messages and the signup-acceptance trigger from
// supabase/migrations/20261026090000_legal_consent_privacy_support.sql.
// Run: npm run test:rls. Every case runs in a rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, P, R, SEED, W, as, id, one, service } from './fixtures.mjs';

const ADMIN_UID = id(950);
const ADMIN_PROFILE = id(951);
const NEW_UID = id(952);
const OTHER_BOOKING = id(953);
const anon = { role: 'anon' };
const admin = { role: 'authenticated', uid: ADMIN_UID };

let db;
let migrationResult;
before(async () => {
  let results;
  ({ db, results } = await createDb());
  migrationResult = results.find((r) => r.file.startsWith('20261026090000'));
  await db.exec(SEED);
  await db.exec(`
    ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;
    INSERT INTO auth.users (id, email) VALUES ('${ADMIN_UID}', 'admin@example.com');
    ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;
    INSERT INTO user_profiles (id, user_id, email, full_name) VALUES ('${ADMIN_PROFILE}', '${ADMIN_UID}', 'admin@example.com', 'Ada Admin');
    INSERT INTO user_roles (user_profile_id, website_role_id) VALUES ('${ADMIN_PROFILE}', '${R.admin}');
    -- A booking that belongs to another traveler (organizer O booking a tour as a traveler).
    INSERT INTO bookings (id, tour_schedule_id, traveler_id, seats, total_amount, status)
      SELECT '${OTHER_BOOKING}', tour_schedule_id, '${P.O}', 1, 1000, 'pending' FROM bookings WHERE id = '${B1}';
  `);
});

const count = (table, where = 'true', params = []) => (d) => one(d, `SELECT count(*)::int AS n FROM ${table} WHERE ${where}`, params);

describe('migration', () => {
  test('applies cleanly', () => {
    assert.ok(migrationResult, 'migration file found');
    assert.equal(migrationResult.ok, true, migrationResult.error);
  });
});

// ─── legal_acceptances ───

describe('legal_acceptances', () => {
  const insert = (d, cols) => {
    const keys = Object.keys(cols);
    return d.query(
      `INSERT INTO legal_acceptances (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`,
      Object.values(cols)
    );
  };

  test('a user records their own acceptance; owner, id and timestamp are forced by the server', async () => {
    const r = await attempt(db, as('T'),
      (d) => insert(d, { user_profile_id: P.O, document: 'terms', version: '0.1-draft', accepted_at: '2001-01-01T00:00:00Z', user_agent: 'Mozilla/5.0' }),
      (d) => one(d, `SELECT user_profile_id, document, version, accepted_at > now() - interval '1 minute' AS fresh FROM legal_acceptances`));
    assert.equal(r.error, null);
    assert.equal(r.verified.user_profile_id, P.T, 'owner comes from the session, not the client');
    assert.equal(r.verified.document, 'terms');
    assert.equal(r.verified.fresh, true, 'accepted_at is set by the server');
  });

  test('checkout acceptance may reference the traveler\'s own booking', async () => {
    const r = await attempt(db, as('T'),
      (d) => insert(d, { user_profile_id: P.T, document: 'checkout_terms', version: '0.1-draft', reference_id: B1 }),
      count('legal_acceptances', 'reference_id = $1', [B1]));
    assert.equal(r.error, null);
    assert.equal(r.verified.n, 1);
  });

  test('cannot reference another traveler\'s booking', async () => {
    const r = await attempt(db, as('T'),
      (d) => insert(d, { user_profile_id: P.T, document: 'checkout_terms', version: '0.1-draft', reference_id: OTHER_BOOKING }),
      count('legal_acceptances'));
    assert.ok(r.error);
    assert.equal(r.verified.n, 0);
  });

  test('only checkout_terms may carry a reference', async () => {
    const r = await attempt(db, as('T'), (d) => insert(d, { user_profile_id: P.T, document: 'terms', version: '0.1-draft', reference_id: B1 }));
    assert.ok(r.error);
  });

  for (const [name, cols] of [
    ['an unknown document', { document: 'cookies', version: '1' }],
    ['a malformed version', { document: 'terms', version: 'v1; drop table' }],
    ['a raw IP as ip_hash', { document: 'terms', version: '1', ip_hash: '203.0.113.7' }],
    ['an oversized user agent', { document: 'terms', version: '1', user_agent: 'x'.repeat(201) }],
  ]) {
    test(`rejects ${name}`, async () => {
      const r = await attempt(db, as('T'), (d) => insert(d, { user_profile_id: P.T, ...cols }));
      assert.ok(r.error, 'expected a CHECK violation');
    });
  }

  test('a signed-in user without a profile cannot record an acceptance', async () => {
    const r = await attempt(db, as('N'), (d) => insert(d, { user_profile_id: P.T, document: 'terms', version: '1' }), count('legal_acceptances'));
    assert.ok(r.error);
    assert.equal(r.verified.n, 0);
  });

  test('anon can neither insert nor read', async () => {
    const ins = await attempt(db, anon, (d) => insert(d, { user_profile_id: P.T, document: 'terms', version: '1' }));
    assert.ok(ins.error);
    const sel = await attempt(db, anon, (d) => d.query('SELECT * FROM legal_acceptances'));
    assert.ok(sel.error);
  });

  test('users read only their own records; admins read all', async () => {
    const seed = (d) => d.query(
      `INSERT INTO legal_acceptances (user_profile_id, document, version) VALUES ($1, 'terms', '1'), ($2, 'partner_terms', '1')`,
      [P.T, P.O]
    );
    const asTraveler = await attempt(db, as('T'), async (d) => {
      await d.exec('RESET ROLE');
      await seed(d);
      await d.exec('SET LOCAL ROLE authenticated');
      return (await d.query('SELECT user_profile_id FROM legal_acceptances')).rows;
    });
    assert.equal(asTraveler.error, null);
    assert.deepEqual(asTraveler.result.map((r) => r.user_profile_id), [P.T]);

    const asAdmin = await attempt(db, admin, async (d) => {
      await d.exec('RESET ROLE');
      await seed(d);
      await d.exec('SET LOCAL ROLE authenticated');
      return (await d.query('SELECT count(*)::int AS n FROM legal_acceptances')).rows[0].n;
    });
    assert.equal(asAdmin.result, 2);
  });

  test('records are append-only for end users (no update, no delete)', async () => {
    for (const sql of [
      `UPDATE legal_acceptances SET version = '9'`,
      `DELETE FROM legal_acceptances`,
    ]) {
      const r = await attempt(db, as('T'), async (d) => {
        await d.exec('RESET ROLE');
        await d.query(`INSERT INTO legal_acceptances (user_profile_id, document, version) VALUES ($1, 'terms', '1')`, [P.T]);
        await d.exec('SET LOCAL ROLE authenticated');
        await d.query(sql);
      });
      assert.match(r.error ?? '', /permission denied/, `${sql} must fail`);
    }
  });
});

// ─── Signup acceptance trigger ───

describe('signup acceptance (auth metadata → legal_acceptances)', () => {
  // Supabase's auth server inserts into auth.users as a privileged role; here the superuser does.
  const signUp = async (d, meta) => {
    await d.exec('RESET ROLE');
    return d.query(`INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, 'fresh@example.com', $2::jsonb)`, [NEW_UID, JSON.stringify(meta)]);
  };
  const recorded = (d) => d.query(
    `SELECT la.document, la.version, la.ip_hash, la.user_agent FROM legal_acceptances la
     JOIN user_profiles up ON up.id = la.user_profile_id WHERE up.user_id = $1 ORDER BY la.document`, [NEW_UID]
  ).then((r) => r.rows);

  test('the auth.users trigger path records terms + privacy with the accepted versions', async () => {
    const r = await attempt(db, service, (d) => signUp(d, {
      full_name: 'Fresh', signup_role: 'traveler', signup_website_id: W,
      legal_acceptance: { terms: '0.1-draft', privacy: '0.2-draft', ip_hash: 'a'.repeat(32), ua: 'Mozilla/5.0 test' },
    }), recorded);
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, [
      { document: 'privacy', version: '0.2-draft', ip_hash: 'a'.repeat(32), user_agent: 'Mozilla/5.0 test' },
      { document: 'terms', version: '0.1-draft', ip_hash: 'a'.repeat(32), user_agent: 'Mozilla/5.0 test' },
    ]);
  });

  test('the app fallback path (profile inserted by the user) records them too', async () => {
    const r = await attempt(db, { role: 'authenticated', uid: NEW_UID }, async (d) => {
      await d.exec('RESET ROLE');
      await d.exec('ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created');
      await signUp(d, { legal_acceptance: { terms: '0.1-draft', privacy: '0.1-draft' } });
      await d.exec('ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created');
      await d.exec('SET LOCAL ROLE authenticated');
      await d.query(`INSERT INTO user_profiles (user_id, email) VALUES ($1, 'fresh@example.com')`, [NEW_UID]);
    }, recorded);
    assert.equal(r.error, null);
    assert.deepEqual(r.verified.map((x) => x.document), ['privacy', 'terms']);
  });

  test('invalid values are dropped, never block the signup', async () => {
    const r = await attempt(db, service, (d) => signUp(d, {
      full_name: 'Fresh',
      legal_acceptance: { terms: 'not a version!', privacy: '0.1-draft', ip_hash: '203.0.113.7', ua: 'x'.repeat(500) },
    }), async (d) => ({ rows: await recorded(d), profile: await count('user_profiles', 'user_id = $1', [NEW_UID])(d) }));
    assert.equal(r.error, null);
    assert.equal(r.verified.profile.n, 1, 'profile still created');
    assert.equal(r.verified.rows.length, 1);
    assert.equal(r.verified.rows[0].document, 'privacy');
    assert.equal(r.verified.rows[0].ip_hash, null);
    assert.equal(r.verified.rows[0].user_agent.length, 200);
  });

  test('no metadata, no acceptance rows', async () => {
    const r = await attempt(db, service, (d) => signUp(d, { full_name: 'Fresh' }), recorded);
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, []);
  });

  test('metadata cannot record partner or checkout acceptances', async () => {
    const r = await attempt(db, service, (d) => signUp(d, { legal_acceptance: { partner_terms: '1', checkout_terms: '1' } }), recorded);
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, []);
  });
});

// ─── data_requests ───

describe('data_requests', () => {
  const file = (d, type = 'deletion', extra = {}) => {
    const cols = { user_profile_id: P.O, request_type: type, details: 'Please delete my account', ...extra };
    const keys = Object.keys(cols);
    return d.query(`INSERT INTO data_requests (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(cols));
  };

  test('a user files a request; owner, status and admin fields are forced', async () => {
    const r = await attempt(db, as('T'),
      (d) => file(d, 'deletion', { status: 'completed', admin_note: 'done', handled_by: P.O, resolved_at: new Date().toISOString() }),
      (d) => one(d, 'SELECT user_profile_id, status, admin_note, handled_by, resolved_at FROM data_requests'));
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, { user_profile_id: P.T, status: 'open', admin_note: null, handled_by: null, resolved_at: null });
  });

  test('one active request per type, but different types are fine', async () => {
    const dup = await attempt(db, as('T'), async (d) => { await file(d); await file(d); });
    assert.ok(dup.error, 'second active deletion request must fail');
    const mixed = await attempt(db, as('T'), async (d) => { await file(d, 'deletion'); await file(d, 'correction'); }, count('data_requests'));
    assert.equal(mixed.error, null);
    assert.equal(mixed.verified.n, 2);
  });

  test('a new request is allowed once the previous one is closed', async () => {
    const r = await attempt(db, as('T'), async (d) => {
      await file(d);
      await d.exec('RESET ROLE');
      await d.query(`UPDATE data_requests SET status = 'rejected', resolved_at = now()`);
      await d.exec('SET LOCAL ROLE authenticated');
      await file(d);
    }, count('data_requests'));
    assert.equal(r.error, null);
    assert.equal(r.verified.n, 2);
  });

  test('rejects an unknown type and oversized details', async () => {
    assert.ok((await attempt(db, as('T'), (d) => file(d, 'export'))).error);
    assert.ok((await attempt(db, as('T'), (d) => file(d, 'deletion', { details: 'x'.repeat(2001) }))).error);
  });

  test('users read only their own requests; admins read all; anon nothing', async () => {
    const seed = async (d) => {
      await d.exec('RESET ROLE');
      await d.query(`INSERT INTO data_requests (user_profile_id, request_type) VALUES ($1, 'deletion'), ($2, 'access')`, [P.T, P.O]);
      await d.exec('SET LOCAL ROLE authenticated');
    };
    const mine = await attempt(db, as('T'), async (d) => { await seed(d); return (await d.query('SELECT user_profile_id FROM data_requests')).rows; });
    assert.deepEqual(mine.result.map((r) => r.user_profile_id), [P.T]);
    const all = await attempt(db, admin, async (d) => { await seed(d); return (await d.query('SELECT count(*)::int AS n FROM data_requests')).rows[0].n; });
    assert.equal(all.result, 2);
    assert.ok((await attempt(db, anon, (d) => d.query('SELECT * FROM data_requests'))).error);
    assert.ok((await attempt(db, anon, (d) => file(d))).error);
  });

  test('users cannot update or withdraw a request (status is admin-only)', async () => {
    for (const sql of [`UPDATE data_requests SET status = 'completed', resolved_at = now()`, 'DELETE FROM data_requests']) {
      const r = await attempt(db, as('T'), async (d) => { await file(d); await d.query(sql); });
      assert.ok(r.error, `${sql} must fail`);
    }
  });

  test('the service role (admin console) moves a request through its states', async () => {
    const r = await attempt(db, as('T'), async (d) => {
      await file(d);
      await d.exec('RESET ROLE');
      await d.exec('SET LOCAL ROLE service_role');
      await d.query(`UPDATE data_requests SET status = 'in_progress', handled_by = $1`, [ADMIN_PROFILE]);
      await d.query(`UPDATE data_requests SET status = 'completed', resolved_at = now(), admin_note = 'Erased'`);
    }, (d) => one(d, 'SELECT status, admin_note FROM data_requests'));
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, { status: 'completed', admin_note: 'Erased' });
  });

  test('a completed request must have resolved_at', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`INSERT INTO data_requests (user_profile_id, request_type) VALUES ($1, 'deletion')`, [P.T]);
      await d.query(`UPDATE data_requests SET status = 'completed'`);
    });
    assert.ok(r.error);
  });
});

// ─── support_messages ───

describe('support_messages', () => {
  const send = (d, extra = {}) => {
    const cols = {
      name: 'Juan dela Cruz', email: 'juan@example.com', topic: 'complaint_organizer',
      booking_ref: 'BK-ABC123', message: 'The organizer did not show up at the meeting point.', ...extra,
    };
    const keys = Object.keys(cols);
    return d.query(`INSERT INTO support_messages (${keys.join(', ')}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})`, Object.values(cols));
  };

  test('anon can send a message; sender profile and status are forced', async () => {
    const r = await attempt(db, anon,
      (d) => send(d, { user_profile_id: P.O, status: 'resolved', resolved_at: new Date().toISOString(), admin_note: 'x' }),
      (d) => one(d, 'SELECT user_profile_id, status, admin_note, resolved_at FROM support_messages'));
    assert.equal(r.error, null);
    assert.deepEqual(r.verified, { user_profile_id: null, status: 'open', admin_note: null, resolved_at: null });
  });

  test('a signed-in sender is linked to their own profile', async () => {
    const r = await attempt(db, as('T'), (d) => send(d, { user_profile_id: P.O }), (d) => one(d, 'SELECT user_profile_id FROM support_messages'));
    assert.equal(r.error, null);
    assert.equal(r.verified.user_profile_id, P.T);
  });

  for (const [name, extra] of [
    ['an unknown topic', { topic: 'spam' }],
    ['an invalid email', { email: 'not-an-email' }],
    ['a too-short message', { message: 'hi' }],
    ['a too-long message', { message: 'x'.repeat(5001) }],
    ['a malformed booking ref', { booking_ref: 'bk-abc123' }],
    ['an empty name', { name: '   ' }],
  ]) {
    test(`rejects ${name}`, async () => {
      assert.ok((await attempt(db, anon, (d) => send(d, extra))).error);
    });
  }

  test('only admins can read messages', async () => {
    const read = (ctx, role) => attempt(db, ctx, async (d) => {
      await d.exec('RESET ROLE');
      await send(d);
      await d.exec(`SET LOCAL ROLE ${role}`);
      return (await d.query('SELECT count(*)::int AS n FROM support_messages')).rows[0].n;
    });
    assert.ok((await read(anon, 'anon')).error, 'anon has no SELECT');
    assert.equal((await read(as('T'), 'authenticated')).result, 0, 'a traveler sees nothing, not even their own');
    assert.equal((await read(admin, 'authenticated')).result, 1);
  });

  test('end users cannot update or delete messages', async () => {
    for (const sql of [`UPDATE support_messages SET status = 'closed', resolved_at = now()`, 'DELETE FROM support_messages']) {
      const r = await attempt(db, as('T'), async (d) => {
        await d.exec('RESET ROLE');
        await send(d);
        await d.exec('SET LOCAL ROLE authenticated');
        await d.query(sql);
      });
      // No UPDATE/DELETE grant: permission denied.
      assert.match(r.error ?? '', /permission denied/, `${sql} must fail`);
    }
  });

  test('a resolved message must have resolved_at (service role)', async () => {
    const r = await attempt(db, service, async (d) => { await send(d); await d.query(`UPDATE support_messages SET status = 'resolved'`); });
    assert.ok(r.error);
  });

  test('the service role resolves a message', async () => {
    const r = await attempt(db, service, async (d) => {
      await send(d);
      await d.query(`UPDATE support_messages SET status = 'resolved', resolved_at = now(), handled_by = $1, admin_note = 'Refunded'`, [ADMIN_PROFILE]);
    }, (d) => one(d, 'SELECT status FROM support_messages'));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'resolved');
  });
});

