// Transport coordination tests for supabase/migrations/20261025110000_transport_coordination.sql
// (BIZ-23 double booking, BIZ-24 lifecycle, ENG-08 Manila dates). Run: npm run test:rls
//
// Each case runs as an end user (PostgREST style) inside a rolled-back transaction. `switchUser`
// changes auth.uid() mid-transaction so one case can play transporter and organizer in turn.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { OP, S, SEED, TB1, TP, U, V1, id, one } from './fixtures.mjs';

// Extra fixtures (this file only).
const V2 = id(300);                       // second van of transporter X, blocked on a fixed range
const TB2 = id(301);                      // second pending request on V1, overlapping TB1
const TB_PAST = id(302);                  // accepted request on the past Cebu schedule (organizer O2)
const BLOCK_V2 = id(303);

const EXTRA = `
INSERT INTO vehicles (id, transporter_id, name, vehicle_type, seat_capacity, plate_number, status) VALUES
  ('${V2}', '${TP.X}', 'Coaster', 'bus', 20, 'XYZ9876', 'active');
INSERT INTO vehicle_availability (id, vehicle_id, start_date, end_date, status, notes) VALUES
  ('${BLOCK_V2}', '${V2}', current_date + 50, current_date + 52, 'blocked', 'PMS');
INSERT INTO transport_bookings (id, tour_schedule_id, organizer_id, transporter_id, vehicle_id,
  pickup_location, dropoff_location, pickup_datetime, return_datetime, seats_required, status) VALUES
  ('${TB2}', '${S.s1}', '${OP.O}', '${TP.X}', '${V1}', 'Port', 'Resort',
     now() + interval '30 days', now() + interval '32 days', 8, 'pending'),
  ('${TB_PAST}', '${S.past}', '${OP.O2}', '${TP.X}', '${V2}', 'Airport', 'Hotel',
     now() - interval '10 days', now() - interval '8 days', 6, 'accepted');
`;

const asUser = (uid) => ({ role: 'authenticated', uid });
const xavier = asUser(U.X);
const oscar = asUser(U.O);
const switchUser = (d, uid) => d.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [uid]);

const accept = (d, tb) => d.query(`UPDATE transport_bookings SET status = 'accepted' WHERE id = $1`, [tb]);
const statusOf = (d, tb) => one(d, `SELECT status FROM transport_bookings WHERE id = $1`, [tb]);
const bookedRows = (d, tb) =>
  d.query(
    `SELECT start_date::text, end_date::text, status, deleted_at FROM vehicle_availability
     WHERE transport_booking_id = $1 ORDER BY created_at`,
    [tb]
  ).then((r) => r.rows);
const liveRowsFor = (d, vehicle) =>
  one(d, `SELECT count(*)::int AS n FROM vehicle_availability WHERE vehicle_id = $1 AND deleted_at IS NULL`, [vehicle]);
const sendRequest = (d, { vehicle = V1, pickup = "now() + interval '30 days'", ret = 'NULL' } = {}) =>
  d.query(
    `INSERT INTO transport_bookings (tour_schedule_id, organizer_id, transporter_id, vehicle_id,
       pickup_location, dropoff_location, pickup_datetime, return_datetime, seats_required)
     VALUES ($1, $2, $3, $4, 'a', 'b', ${pickup}, ${ret}, 5) RETURNING id`,
    [S.s1, OP.O, TP.X, vehicle]
  );

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
  await db.exec(EXTRA);
});

describe('accepting a request books the vehicle atomically', () => {
  test('accept inserts one booked availability row on the Manila pickup date', async () => {
    const r = await attempt(db, xavier, (d) => accept(d, TB1), async (d) => ({
      status: await statusOf(d, TB1),
      rows: await bookedRows(d, TB1),
      expected: await one(d, `SELECT manila_date(pickup_datetime)::text AS day FROM transport_bookings WHERE id = $1`, [TB1]),
    }));
    assert.equal(r.error, null);
    assert.equal(r.verified.status.status, 'accepted');
    assert.equal(r.verified.rows.length, 1);
    assert.equal(r.verified.rows[0].status, 'booked');
    assert.equal(r.verified.rows[0].start_date, r.verified.expected.day);
    assert.equal(r.verified.rows[0].end_date, r.verified.expected.day);
  });

  test('a pickup late in the UTC day falls on the next Manila date', async () => {
    const r = await attempt(db, { role: 'service_role' }, async (d) => {
      await d.query(`UPDATE transport_bookings SET pickup_datetime = ((current_date + 30)::timestamp + time '17:30') AT TIME ZONE 'UTC',
                       return_datetime = NULL WHERE id = $1`, [TB1]);
      await accept(d, TB1);
    }, async (d) => ({
      rows: await bookedRows(d, TB1),
      expected: await one(d, `SELECT (current_date + 31)::text AS day`),
    }));
    assert.equal(r.error, null);
    assert.equal(r.verified.rows[0].start_date, r.verified.expected.day);
  });

  test('a second overlapping request for the same vehicle cannot be accepted (double booking)', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await accept(d, TB2);
    }, async (d) => ({ tb1: await statusOf(d, TB1), tb2: await statusOf(d, TB2), live: await liveRowsFor(d, V1) }));
    assert.match(r.error, /already booked or blocked/);
    assert.equal(r.verified.tb2.status, 'pending');
    assert.equal(r.verified.live.n, 0); // the whole failing statement sequence rolled back
  });

  test('the second accept fails on its own and leaves the first booking intact', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await d.query('SAVEPOINT second');
      try {
        await accept(d, TB2);
      } catch (e) {
        await d.query('ROLLBACK TO SAVEPOINT second');
        return e.message;
      }
      return null;
    }, async (d) => ({ tb1: await statusOf(d, TB1), tb2: await statusOf(d, TB2), live: await liveRowsFor(d, V1) }));
    assert.match(r.result, /already booked or blocked/);
    assert.equal(r.verified.tb1.status, 'accepted');
    assert.equal(r.verified.tb2.status, 'pending');
    assert.equal(r.verified.live.n, 1);
  });

  test('a request overlapping a maintenance block cannot be accepted', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await d.query(`INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
                     VALUES ($1, current_date + 29, current_date + 35, 'blocked')`, [V1]);
      await accept(d, TB1);
    }, async (d) => ({ tb1: await statusOf(d, TB1), rows: await bookedRows(d, TB1) }));
    assert.match(r.error, /already booked or blocked/);
    assert.equal(r.verified.tb1.status, 'pending');
    assert.equal(r.verified.rows.length, 0);
  });

  test('an inactive vehicle cannot be accepted', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await d.query(`UPDATE vehicles SET status = 'inactive' WHERE id = $1`, [V1]);
      await accept(d, TB1);
    }, (d) => statusOf(d, TB1));
    assert.match(r.error, /not active/);
    assert.equal(r.verified.status, 'pending');
  });
});

describe('sending a request', () => {
  test('is rejected for a vehicle blocked on those dates', async () => {
    const r = await attempt(db, oscar, (d) => sendRequest(d, {
      vehicle: V2, pickup: "now() + interval '49 days'", ret: "now() + interval '50 days'",
    }));
    assert.match(r.error, /already booked or blocked/);
  });

  test('is rejected for a vehicle already booked by an accepted request', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await switchUser(d, U.O);
      await sendRequest(d, { pickup: "now() + interval '30 days'" });
    });
    assert.match(r.error, /already booked or blocked/);
  });

  test('succeeds for the same vehicle on free dates', async () => {
    const r = await attempt(db, oscar, (d) => sendRequest(d, {
      vehicle: V2, pickup: "now() + interval '60 days'", ret: "now() + interval '61 days'",
    }), (d, res) => one(d, `SELECT status FROM transport_bookings WHERE id = $1`, [res?.rows[0]?.id]));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'pending');
  });

  test('pending requests do not reserve the vehicle (several organizers may ask)', async () => {
    const r = await attempt(db, oscar, (d) => sendRequest(d, { pickup: "now() + interval '30 days'" }));
    assert.equal(r.error, null);
  });

  test('rejects a return time before the pickup time', async () => {
    const r = await attempt(db, oscar, (d) => sendRequest(d, {
      vehicle: V2, pickup: "now() + interval '60 days'", ret: "now() + interval '59 days'",
    }));
    assert.match(r.error, /return time must be after/);
  });

  test('editing a pending request onto a blocked range is rejected', async () => {
    const r = await attempt(db, oscar, (d) => d.query(
      `UPDATE transport_bookings SET vehicle_id = $2, pickup_datetime = now() + interval '51 days', return_datetime = NULL
       WHERE id = $1`, [TB1, V2]), (d) => one(d, `SELECT vehicle_id FROM transport_bookings WHERE id = $1`, [TB1]));
    assert.match(r.error, /already booked or blocked/);
    assert.equal(r.verified.vehicle_id, V1);
  });
});

describe('cancel, decline and complete', () => {
  test('an organizer canceling an accepted request releases the booked dates', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await switchUser(d, U.O);
      await d.query(`UPDATE transport_bookings SET status = 'canceled' WHERE id = $1`, [TB1]);
    }, async (d) => ({ tb1: await statusOf(d, TB1), rows: await bookedRows(d, TB1), live: await liveRowsFor(d, V1) }));
    assert.equal(r.error, null);
    assert.equal(r.verified.tb1.status, 'canceled');
    assert.equal(r.verified.rows.length, 1);
    assert.notEqual(r.verified.rows[0].deleted_at, null);
    assert.equal(r.verified.live.n, 0);
  });

  test('after a cancel the vehicle can be booked again for the same dates', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await switchUser(d, U.O);
      await d.query(`UPDATE transport_bookings SET status = 'canceled' WHERE id = $1`, [TB1]);
      await switchUser(d, U.X);
      await accept(d, TB2);
    }, (d) => statusOf(d, TB2));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'accepted');
  });

  test('declining a request books nothing', async () => {
    const r = await attempt(db, xavier,
      (d) => d.query(`UPDATE transport_bookings SET status = 'declined' WHERE id = $1`, [TB1]),
      (d) => liveRowsFor(d, V1));
    assert.equal(r.error, null);
    assert.equal(r.verified.n, 0);
  });

  test('an accepted trip cannot be completed before its end date', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await d.query(`UPDATE transport_bookings SET status = 'completed' WHERE id = $1`, [TB1]);
    }, (d) => statusOf(d, TB1));
    assert.match(r.error, /can be marked complete from/);
  });

  test('the service role cannot complete early either', async () => {
    const r = await attempt(db, { role: 'service_role' }, async (d) => {
      await accept(d, TB1);
      await d.query(`UPDATE transport_bookings SET status = 'completed' WHERE id = $1`, [TB1]);
    });
    assert.match(r.error, /can be marked complete from/);
  });

  test('an accepted trip can be completed once its end date has passed', async () => {
    const r = await attempt(db, xavier,
      (d) => d.query(`UPDATE transport_bookings SET status = 'completed' WHERE id = $1`, [TB_PAST]),
      (d) => statusOf(d, TB_PAST));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'completed');
  });
});

describe('vehicle availability rows', () => {
  test('a transporter cannot create, edit or delete booked rows directly', async () => {
    const insert = await attempt(db, xavier, (d) => d.query(
      `INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status, transport_booking_id)
       VALUES ($1, current_date + 70, current_date + 71, 'booked', $2)`, [V1, TB1]));
    assert.match(insert.error, /created by accepting/);

    const del = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await d.query(`DELETE FROM vehicle_availability WHERE transport_booking_id = $1`, [TB1]);
    });
    assert.match(del.error, /released by canceling/);

    const soft = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await d.query(`UPDATE vehicle_availability SET deleted_at = now() WHERE transport_booking_id = $1`, [TB1]);
    });
    assert.match(soft.error, /released by canceling/);
  });

  test('a transporter can block free dates and soft-delete the block', async () => {
    const r = await attempt(db, xavier, async (d) => {
      const { rows } = await d.query(`INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
                                      VALUES ($1, current_date + 80, current_date + 81, 'blocked') RETURNING id`, [V1]);
      await d.query(`UPDATE vehicle_availability SET deleted_at = now() WHERE id = $1`, [rows[0].id]);
      return rows[0].id;
    }, (d, blockId) => one(d, `SELECT deleted_at FROM vehicle_availability WHERE id = $1`, [blockId]));
    assert.equal(r.error, null);
    assert.notEqual(r.verified.deleted_at, null);
  });

  test('overlapping blocks are rejected, adjacent ones are fine', async () => {
    const overlap = await attempt(db, xavier, (d) => d.query(
      `INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
       VALUES ($1, current_date + 52, current_date + 55, 'blocked')`, [V2]));
    assert.match(overlap.error, /already booked or blocked/);

    const adjacent = await attempt(db, xavier, (d) => d.query(
      `INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
       VALUES ($1, current_date + 53, current_date + 55, 'blocked')`, [V2]));
    assert.equal(adjacent.error, null);
  });

  test('the end date cannot be before the start date', async () => {
    const r = await attempt(db, xavier, (d) => d.query(
      `INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
       VALUES ($1, current_date + 90, current_date + 89, 'blocked')`, [V1]));
    assert.match(r.error, /cannot be before the start date/);
  });

  test("a transporter cannot block another transporter's vehicle", async () => {
    const r = await attempt(db, oscar, (d) => d.query(
      `INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status)
       VALUES ($1, current_date + 90, current_date + 91, 'blocked')`, [V1]));
    assert.match(r.error, /row-level security/);
  });
});

describe('schedule dates with confirmed transport', () => {
  const shift = (d) => d.query(`UPDATE tour_schedules SET start_date = start_date + 1, end_date = end_date + 1 WHERE id = $1`, [S.s1]);

  test('cannot change while a transport booking is accepted', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await switchUser(d, U.O);
      await shift(d);
    });
    assert.match(r.error, /confirmed transport booking/);
  });

  test('the service role is blocked too', async () => {
    const r = await attempt(db, { role: 'service_role' }, async (d) => {
      await accept(d, TB1);
      await shift(d);
    });
    assert.match(r.error, /confirmed transport booking/);
  });

  test('other schedule fields can still change', async () => {
    const r = await attempt(db, xavier, async (d) => {
      await accept(d, TB1);
      await switchUser(d, U.O);
      await d.query(`UPDATE tour_schedules SET capacity = 12, start_date = start_date WHERE id = $1`, [S.s1]);
    }, (d) => one(d, `SELECT capacity FROM tour_schedules WHERE id = $1`, [S.s1]));
    assert.equal(r.error, null);
    assert.equal(r.verified.capacity, 12);
  });

  test('can change while the request is only pending', async () => {
    const r = await attempt(db, oscar, (d) => shift(d));
    assert.equal(r.error, null);
  });
});
