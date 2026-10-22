// Communications tests (Phase 3.6, BIZ-14): booking_notifications_sent and bookings_due_for_trip_reminder()
// from supabase/migrations/20261024110000_booking_notifications_sent.sql.
// Run: npm run test:rls. Every case runs in a rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, P, S, SEED, as, id, one, service } from './fixtures.mjs';

const B2 = id(201); // second booking on the same schedule, for "already reminded" cases

let db;
let migrationResult;
before(async () => {
  let results;
  ({ db, results } = await createDb());
  migrationResult = results.find((r) => r.file.startsWith('20261024110000'));
  await db.exec(SEED);
});

// Put schedule s1 `days` days from Manila today and confirm booking B1 (superuser-equivalent via service role).
const setup = async (d, { days = 2, status = 'confirmed', scheduleStatus = 'open' } = {}) => {
  await d.query(
    `UPDATE tour_schedules SET start_date = manila_today() + $2::int, end_date = manila_today() + $2::int + 1, status = $3 WHERE id = $1`,
    [S.s1, days, scheduleStatus]
  );
  await d.query(`UPDATE bookings SET status = $2 WHERE id = $1`, [B1, status]);
};
const due = async (d) => (await d.query(`SELECT bookings_due_for_trip_reminder() AS id`)).rows.map((r) => r.id);

describe('booking_notifications_sent migration', () => {
  test('applies cleanly', () => {
    assert.ok(migrationResult, 'migration file found');
    assert.equal(migrationResult.ok, true, migrationResult.error);
  });
});

describe('bookings_due_for_trip_reminder()', () => {
  test('returns a confirmed booking whose trip starts in 2 days (Manila)', async () => {
    const r = await attempt(db, service, async (d) => { await setup(d); return due(d); });
    assert.equal(r.error, null);
    assert.deepEqual(r.result, [B1]);
  });

  test('catches up a trip starting tomorrow (missed run)', async () => {
    const r = await attempt(db, service, async (d) => { await setup(d, { days: 1 }); return due(d); });
    assert.deepEqual(r.result, [B1]);
  });

  for (const [name, opts] of [
    ['3 days out', { days: 3 }],
    ['starting today', { days: 0 }],
    ['still pending', { status: 'pending' }],
    ['canceled', { status: 'canceled' }],
    ['on a cancelled schedule', { scheduleStatus: 'cancelled' }],
  ]) {
    test(`skips a booking ${name}`, async () => {
      const r = await attempt(db, service, async (d) => { await setup(d, opts); return due(d); });
      assert.equal(r.error, null);
      assert.deepEqual(r.result, []);
    });
  }

  test('skips a booking on a soft-deleted schedule', async () => {
    const r = await attempt(db, service, async (d) => {
      await setup(d);
      await d.query(`UPDATE tour_schedules SET deleted_at = now() WHERE id = $1`, [S.s1]);
      return due(d);
    });
    assert.deepEqual(r.result, []);
  });

  test('skips a booking that was already reminded, but not other bookings', async () => {
    const r = await attempt(db, service, async (d) => {
      await setup(d);
      await d.query(`INSERT INTO bookings (id, tour_schedule_id, traveler_id, seats, total_amount, status)
                     VALUES ($1, $2, $3, 1, 1000, 'confirmed')`, [B2, S.s1, P.T]);
      await d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'trip_reminder')`, [B1]);
      return due(d);
    });
    assert.equal(r.error, null);
    assert.deepEqual(r.result, [B2]);
  });

  for (const role of ['authenticated', 'anon']) {
    test(`${role} cannot call it`, async () => {
      const r = await attempt(db, role === 'anon' ? { role: 'anon' } : as('T'), (d) => due(d));
      assert.ok(r.error, 'expected permission error');
    });
  }
});

describe('booking_notifications_sent table', () => {
  test('one reminder per booking and kind (idempotent claim)', async () => {
    const r = await attempt(db, service, async (d) => {
      const first = await d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'trip_reminder')
                                   ON CONFLICT (booking_id, kind, dedupe_key) DO NOTHING RETURNING id`, [B1]);
      const second = await d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'trip_reminder')
                                    ON CONFLICT (booking_id, kind, dedupe_key) DO NOTHING RETURNING id`, [B1]);
      return [first.rows.length, second.rows.length];
    }, (d) => one(d, `SELECT count(*)::int AS n FROM booking_notifications_sent WHERE booking_id = $1`, [B1]));
    assert.equal(r.error, null);
    assert.deepEqual(r.result, [1, 0]);
    assert.equal(r.verified.n, 1);
  });

  test('payment_review is once per PayMongo payment, not once per booking', async () => {
    const claim = (d, key) => d.query(`INSERT INTO booking_notifications_sent (booking_id, kind, dedupe_key) VALUES ($1, 'payment_review', $2)
                                       ON CONFLICT (booking_id, kind, dedupe_key) DO NOTHING RETURNING id`, [B1, key]).then((x) => x.rows.length);
    const r = await attempt(db, service, async (d) => [await claim(d, 'pay_1'), await claim(d, 'pay_1'), await claim(d, 'pay_2')]);
    assert.equal(r.error, null);
    assert.deepEqual(r.result, [1, 0, 1]);
  });

  test('a payment_review row does not suppress the trip reminder', async () => {
    const r = await attempt(db, service, async (d) => {
      await setup(d);
      await d.query(`INSERT INTO booking_notifications_sent (booking_id, kind, dedupe_key) VALUES ($1, 'payment_review', 'pay_1')`, [B1]);
      return due(d);
    });
    assert.deepEqual(r.result, [B1]);
  });

  test('rejects an unknown kind', async () => {
    const r = await attempt(db, service, (d) => d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'spam')`, [B1]));
    assert.ok(r.error);
  });

  test('the service role can release a claim (retry after a failed send)', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'trip_reminder')`, [B1]);
      await d.query(`DELETE FROM booking_notifications_sent WHERE booking_id = $1 AND kind = 'trip_reminder'`, [B1]);
    }, (d) => one(d, `SELECT count(*)::int AS n FROM booking_notifications_sent`));
    assert.equal(r.error, null);
    assert.equal(r.verified.n, 0);
  });

  for (const [who, ctx] of [['a traveler', as('T')], ['an organizer', as('O')], ['anon', { role: 'anon' }]]) {
    test(`${who} cannot read the table`, async () => {
      const r = await attempt(db, ctx, (d) => d.query(`SELECT * FROM booking_notifications_sent`));
      assert.ok(r.error, 'expected permission error');
    });

    test(`${who} cannot insert a reminder (to suppress their own or others' reminders)`, async () => {
      const r = await attempt(db, ctx,
        (d) => d.query(`INSERT INTO booking_notifications_sent (booking_id, kind) VALUES ($1, 'trip_reminder')`, [B1]),
        (d) => one(d, `SELECT count(*)::int AS n FROM booking_notifications_sent`));
      assert.ok(r.error);
      assert.equal(r.verified.n, 0);
    });
  }

  test('reminders are removed with their booking (ON DELETE CASCADE)', async () => {
    const row = await one(db, `SELECT confdeltype FROM pg_constraint WHERE conrelid = 'public.booking_notifications_sent'::regclass AND contype = 'f'`);
    assert.equal(row.confdeltype, 'c');
  });
});
