// Cross-workstream invariants: flows that span several Phase 3 migrations.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { S, SEED, TB1, V1, one, service } from './fixtures.mjs';

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
});

describe('schedule cancellation cascade (lib/services/schedules.ts)', () => {
  test('the service role can cancel an accepted transport request on a cancelled schedule, releasing the vehicle', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE transport_bookings SET status = 'accepted' WHERE id = $1`, [TB1]);
      const booked = await one(d, `SELECT count(*)::int AS n FROM vehicle_availability WHERE vehicle_id = $1 AND status = 'booked' AND deleted_at IS NULL`, [V1]);
      await d.query(`UPDATE tour_schedules SET status = 'cancelled' WHERE id = $1`, [S.s1]);
      await d.query(`UPDATE transport_bookings SET status = 'canceled' WHERE id = $1 AND status IN ('pending', 'accepted')`, [TB1]);
      return booked.n;
    }, async (d) => ({
      request: await one(d, `SELECT status FROM transport_bookings WHERE id = $1`, [TB1]),
      stillBooked: await one(d, `SELECT count(*)::int AS n FROM vehicle_availability WHERE vehicle_id = $1 AND status = 'booked' AND deleted_at IS NULL`, [V1]),
    }));
    assert.equal(r.error, null);
    assert.equal(r.result, 1);
    assert.equal(r.verified.request.status, 'canceled');
    assert.equal(r.verified.stillBooked.n, 0);
  });
});
