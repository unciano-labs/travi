// Booking guard tests for supabase/migrations/20261025100000_booking_guards_private_disputes.sql:
// private tours book the whole group (D3, BIZ-05), seats_consumed keeps booked_count right across
// capacity edits (BIZ-19), seat pre-checks (BIZ-01), schedule cancellation guard + cancelled-schedule
// payments (BIZ-04), and dispute reasons (BIZ-17). Run: npm run test:rls
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, OP, P, S, SEED, as, id, one, service } from './fixtures.mjs';

// Extra fixtures (this file only): a published private tour of organizer O with a 6-person date.
const PRIV = { tour: id(300), s: id(301), s2: id(302) };
const BK = { privConfirmed: id(310) };
const REASON = 'The guide never showed up at the meeting point.';

const EXTRA = `
INSERT INTO tours (id, organizer_id, title, slug, description, location, price_per_person, duration_days, status, format) VALUES
  ('${PRIV.tour}', '${OP.O}', 'Private Siargao', 'private-siargao', 'd', 'Siargao', 1500, 2, 'published', 'private');
INSERT INTO tour_schedules (id, tour_id, start_date, end_date, capacity, status) VALUES
  ('${PRIV.s}', '${PRIV.tour}', current_date + 15, current_date + 16, 6, 'open'),
  ('${PRIV.s2}', '${PRIV.tour}', current_date + 25, current_date + 26, 4, 'open');
-- A confirmed private booking inserted by the server with too few seats: the DB books the whole group.
INSERT INTO bookings (id, tour_schedule_id, traveler_id, seats, total_amount, status) VALUES
  ('${BK.privConfirmed}', '${PRIV.s2}', '${P.T}', 1, 6000, 'confirmed');
`;

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
  await db.exec(EXTRA);
});

const schedule = (d, scheduleId) => one(d, `SELECT booked_count, capacity, status::text FROM tour_schedules WHERE id = $1`, [scheduleId]);
const travelerInsert = (d, scheduleId, seats, extra = '') => d.query(
  `INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount, status${extra ? ', seats_consumed, dispute_reason' : ''})
   VALUES ($1, $2, $3, 1, 'confirmed'${extra}) RETURNING id`, [scheduleId, P.T, seats]);
const bookingRow = (d, bookingId) => one(d,
  `SELECT seats, seats_consumed, total_amount::numeric AS total, status::text, dispute_status::text,
          dispute_reason, dispute_opened_at FROM bookings WHERE id = $1`, [bookingId]);

describe('private tours (D3)', () => {
  test('a private booking books the whole group at per-person price x capacity', async () => {
    const r = await attempt(db, as('T'), (d) => travelerInsert(d, PRIV.s, 1), async (d, res) => ({
      row: await bookingRow(d, res?.rows[0]?.id),
      schedule: await schedule(d, PRIV.s),
    }));
    assert.equal(r.error, null);
    assert.equal(r.verified.row.seats, 6);
    assert.equal(r.verified.row.seats_consumed, 6);
    assert.equal(Number(r.verified.row.total), 9000);
    assert.equal(r.verified.row.status, 'pending');
    assert.equal(r.verified.schedule.booked_count, 6);
  });

  test('a second booking on a taken private date is refused', async () => {
    const r = await attempt(db, as('T'), async (d) => {
      await travelerInsert(d, PRIV.s, 2);
      await travelerInsert(d, PRIV.s, 1);
    });
    assert.match(r.error, /already booked/);
  });

  test('server inserts are forced to the full group too', async () => {
    const r = await attempt(db, service, () => null, async (d) => ({
      row: await bookingRow(d, BK.privConfirmed),
      schedule: await schedule(d, PRIV.s2),
    }));
    assert.equal(r.verified.row.seats, 4);
    assert.equal(r.verified.schedule.booked_count, 4);
  });

  test('booking_quote prices a private date for the whole group whatever the seat count', async () => {
    const r = await attempt(db, as('T'), (d) => one(d, `SELECT booking_quote($1, 1)::numeric AS q`, [PRIV.s]));
    assert.equal(r.error, null);
    assert.equal(Number(r.result.q), 9000);
  });
});

describe('seat guards (BIZ-01)', () => {
  test('asking for more seats than are left gets a friendly error', async () => {
    const r = await attempt(db, as('T'), (d) => travelerInsert(d, S.s1, 9)); // 10 seats, 2 held by B1
    assert.match(r.error, /Not enough seats available/);
  });

  test('travelers cannot forge seats_consumed or a dispute reason on insert', async () => {
    const r = await attempt(db, as('T'),
      (d) => travelerInsert(d, S.s1, 3, `, 1, 'forged'`),
      async (d, res) => ({ row: await bookingRow(d, res?.rows[0]?.id), schedule: await schedule(d, S.s1) }));
    assert.equal(r.error, null);
    assert.equal(r.verified.row.seats_consumed, 3);
    assert.equal(r.verified.row.dispute_reason, null);
    assert.equal(r.verified.schedule.booked_count, 5);
  });
});

describe('capacity edits (BIZ-19)', () => {
  test('raising capacity after a private booking does not corrupt booked_count on cancel', async () => {
    const r = await attempt(db, as('O'), async (d) => {
      await d.query(`UPDATE tour_schedules SET capacity = 8 WHERE id = $1`, [PRIV.s2]);
    }, async (d) => {
      const afterEdit = await schedule(d, PRIV.s2);
      await d.query(`UPDATE bookings SET status = 'canceled' WHERE id = $1`, [BK.privConfirmed]);
      return { afterEdit, afterCancel: await schedule(d, PRIV.s2) };
    });
    assert.equal(r.error, null);
    assert.deepEqual([r.verified.afterEdit.capacity, r.verified.afterEdit.booked_count], [8, 4]);
    assert.equal(r.verified.afterCancel.booked_count, 0);
  });

  test('capacity cannot drop below the seats already booked', async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`UPDATE tour_schedules SET capacity = 1 WHERE id = $1`, [S.s1]),
      (d) => schedule(d, S.s1));
    assert.match(r.error, /check_capacity_not_exceeded/);
    assert.equal(r.verified.capacity, 10);
  });

  test('a revived (late-paid) booking takes back exactly the seats it consumed', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE bookings SET status = 'canceled' WHERE id = $1`, [B1]);
      await d.query(`UPDATE bookings SET status = 'pending' WHERE id = $1`, [B1]);
    }, (d) => schedule(d, S.s1));
    assert.equal(r.verified.booked_count, 2);
  });
});

describe('schedule cancellation (BIZ-04)', () => {
  test('an organizer cannot cancel a schedule with active bookings directly', async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1`, [S.s1]),
      (d) => schedule(d, S.s1));
    assert.match(r.error, /active bookings/);
    assert.equal(r.verified.status, 'open');
  });

  test('nor soft-delete it', async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`UPDATE tour_schedules SET deleted_at = now() WHERE id = $1`, [S.s1]));
    assert.match(r.error, /active bookings/);
  });

  test('an organizer can cancel an empty schedule', async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1`, [PRIV.s]),
      (d) => schedule(d, PRIV.s));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'cancelled');
  });

  test('the server (cancel cascade) can cancel a schedule with bookings', async () => {
    const r = await attempt(db, service, (d) => d.query(`UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1`, [S.s1]),
      (d) => schedule(d, S.s1));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'cancelled');
  });

  test('a payment for a booking on a cancelled schedule is flagged for refund, not applied', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1`, [S.s1]);
      return (await d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_1', 200000, 0, 'webhook') AS r`, [B1])).rows[0].r;
    }, async (d) => ({
      booking: await bookingRow(d, B1),
      escrow: await one(d, `SELECT count(*)::int AS n FROM wallet_transactions WHERE reference_id = $1`, [B1]),
      payment: await one(d, `SELECT status, review_reason FROM booking_payments WHERE booking_id = $1`, [B1]),
    }));
    assert.equal(r.result, 'booking_closed_needs_refund');
    assert.equal(r.verified.booking.status, 'pending');
    assert.equal(r.verified.escrow.n, 0);
    assert.deepEqual([r.verified.payment.status, r.verified.payment.review_reason], ['needs_review', 'booking_closed_needs_refund']);
  });

  test('payments on open schedules still confirm', async () => {
    const r = await attempt(db, service,
      (d) => d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_1', 200000, 0, 'return') AS r`, [B1]).then((x) => x.rows[0].r));
    assert.equal(r.result, 'confirmed');
  });
});

describe('disputes (BIZ-17)', () => {
  const confirmAndOpen = async (d, reason, traveler = P.T) => {
    await d.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [B1]);
    return (await d.query(`SELECT open_booking_dispute($1, $2, $3) AS r`, [B1, traveler, reason])).rows[0].r;
  };

  test('opening a dispute stores the trimmed reason and when it was opened', async () => {
    const r = await attempt(db, service, (d) => confirmAndOpen(d, `  ${REASON}  `), (d) => bookingRow(d, B1));
    assert.equal(r.error, null);
    assert.equal(r.result, 'open');
    assert.equal(r.verified.dispute_status, 'open');
    assert.equal(r.verified.dispute_reason, REASON);
    assert.ok(r.verified.dispute_opened_at);
  });

  for (const [name, reason] of [['missing', null], ['too short', 'Bad trip'], ['too long', 'x'.repeat(2001)]]) {
    test(`a ${name} reason is refused`, async () => {
      const r = await attempt(db, service, (d) => confirmAndOpen(d, reason), (d) => bookingRow(d, B1));
      assert.match(r.error, /20 to 2000 characters/);
      assert.equal(r.verified.dispute_status, 'none');
    });
  }

  test('end users cannot call the dispute function directly', async () => {
    const r = await attempt(db, as('T'), (d) => d.query(`SELECT open_booking_dispute($1, $2, $3)`, [B1, P.T, REASON]));
    assert.match(r.error, /permission denied/);
  });

  test('the old two-argument function is gone', async () => {
    const r = await attempt(db, service, (d) => d.query(`SELECT open_booking_dispute($1, $2)`, [B1, P.T]));
    assert.match(r.error, /does not exist/);
  });
});
