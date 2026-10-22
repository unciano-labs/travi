// RLS / privilege tests: every attack from docs/MVP_LAUNCH_READINESS.md §4.2 that Phase 1 closes,
// plus the legitimate flows the app relies on. Run: npm run test:rls
//
// Each case runs as an end user (anon/authenticated + auth.uid()), exactly like PostgREST, inside a
// transaction that is rolled back afterwards.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, N1, OP, P, R, S, SEED, TB1, TOUR, TP, U, V1, W, WALLET, as, one } from './fixtures.mjs';

// Set RLS_BASELINE=1 to run against the migrations *before* the Phase 1/2 hardening and watch the attacks succeed.
const BASELINE = process.env.RLS_BASELINE === '1';

let db;
before(async () => {
  ({ db } = await createDb({ only: BASELINE ? (f) => f < '20261023090000' : undefined }));
  await db.exec(SEED);
});

describe('roles', () => {
  test('a traveler cannot grant themselves admin', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`INSERT INTO user_roles (user_profile_id, website_role_id) VALUES ($1, $2)`, [P.T, R.admin]),
      (d) => one(d, `SELECT count(*)::int AS n FROM user_roles WHERE user_profile_id = $1 AND website_role_id = $2`, [P.T, R.admin]));
    assert.equal(r.verified.n, 0);
  });

  test('assign_self_role refuses admin and grants partner roles', { skip: BASELINE }, async () => {
    const bad = await attempt(db, as('T'), (d) => d.query(`SELECT assign_self_role('admin', $1)`, [W]));
    assert.match(bad.error, /cannot be self-assigned/);
    const ok = await attempt(db, as('T'),
      (d) => d.query(`SELECT assign_self_role('organizer', $1)`, [W]),
      (d) => one(d, `SELECT count(*)::int AS n FROM user_roles WHERE user_profile_id = $1 AND website_role_id = $2`, [P.T, R.organizer]));
    assert.equal(ok.error, null);
    assert.equal(ok.verified.n, 1);
  });
});

describe('bookings', () => {
  const booking = (d) => one(d, `SELECT status::text, total_amount::numeric AS total FROM bookings WHERE id = $1`, [B1]);

  test('a traveler cannot confirm their own booking', async () => {
    const r = await attempt(db, as('T'), (d) => d.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [B1]), booking);
    assert.equal(r.verified.status, 'pending');
  });

  test('a traveler cannot change the price of their booking', async () => {
    const r = await attempt(db, as('T'), (d) => d.query(`UPDATE bookings SET total_amount = 1 WHERE id = $1`, [B1]), booking);
    assert.equal(Number(r.verified.total), 2000);
  });

  test('new bookings are server-priced, pending, and counted against capacity', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount, status)
                      VALUES ($1, $2, 3, 1, 'confirmed') RETURNING id`, [S.s1, P.T]),
      async (d, res) => ({
        row: await one(d, `SELECT status::text, total_amount::numeric AS total FROM bookings WHERE id = $1`, [res?.rows[0]?.id]),
        schedule: await one(d, `SELECT booked_count FROM tour_schedules WHERE id = $1`, [S.s1]),
      }));
    assert.equal(r.error, null);
    assert.equal(r.verified.row.status, 'pending');
    assert.equal(Number(r.verified.row.total), 3000);
    assert.equal(r.verified.schedule.booked_count, 5); // 2 seeded + 3 new
  });

  for (const [name, schedule] of [['past', S.past], ['cancelled', S.closed], ['unpublished-tour', S.draft]]) {
    test(`a traveler cannot book a ${name} schedule`, async () => {
      const r = await attempt(db, as('T'), (d) => d.query(
        `INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount) VALUES ($1, $2, 1, 1000)`, [schedule, P.T]));
      assert.ok(r.error, 'insert should fail');
    });
  }

  test('a traveler cannot book on behalf of someone else', async () => {
    const r = await attempt(db, as('T'), (d) => d.query(
      `INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount) VALUES ($1, $2, 1, 1000)`, [S.s1, P.O]));
    assert.ok(r.error);
  });
});

describe('transport bookings', () => {
  const tb = (d) => one(d, `SELECT status, estimated_price, pickup_location FROM transport_bookings WHERE id = $1`, [TB1]);

  test('a transporter cannot forge an accepted, priced booking against another organizer', async () => {
    const r = await attempt(db, as('X'),
      (d) => d.query(`INSERT INTO transport_bookings (tour_schedule_id, organizer_id, transporter_id, vehicle_id,
                        pickup_location, dropoff_location, pickup_datetime, seats_required, status, estimated_price)
                      VALUES ($1, $2, $3, $4, 'a', 'b', now(), 5, 'accepted', 1000000)`, [S.o2, OP.O2, TP.X, V1]),
      (d) => one(d, `SELECT count(*)::int AS n FROM transport_bookings WHERE organizer_id = $1`, [OP.O2]));
    assert.equal(r.verified.n, 0);
  });

  test('a transporter cannot set the price', async () => {
    const r = await attempt(db, as('X'), (d) => d.query(`UPDATE transport_bookings SET estimated_price = 1000000 WHERE id = $1`, [TB1]), tb);
    assert.equal(r.verified.estimated_price, null);
  });

  test('a transporter can accept and then complete a request', async () => {
    const r = await attempt(db, as('X'), async (d) => {
      await d.query(`UPDATE transport_bookings SET status = 'accepted' WHERE id = $1`, [TB1]);
      await d.query(`UPDATE transport_bookings SET status = 'completed' WHERE id = $1`, [TB1]);
    }, tb);
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'completed');
  });

  test('a transporter cannot skip from pending to completed', { skip: BASELINE }, async () => {
    const r = await attempt(db, as('X'), (d) => d.query(`UPDATE transport_bookings SET status = 'completed' WHERE id = $1`, [TB1]), tb);
    assert.ok(r.error);
    assert.equal(r.verified.status, 'pending');
  });

  test("an organizer cannot accept on the transporter's behalf", async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`UPDATE transport_bookings SET status = 'accepted' WHERE id = $1`, [TB1]), tb);
    assert.equal(r.verified.status, 'pending');
  });

  test('organizer requests are always pending and unpriced', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`INSERT INTO transport_bookings (tour_schedule_id, organizer_id, transporter_id, vehicle_id,
                        pickup_location, dropoff_location, pickup_datetime, seats_required, status, estimated_price)
                      VALUES ($1, $2, $3, $4, 'a', 'b', now(), 5, 'accepted', 99) RETURNING id`, [S.s1, OP.O, TP.X, V1]),
      (d, res) => one(d, `SELECT status, estimated_price FROM transport_bookings WHERE id = $1`, [res?.rows[0]?.id]));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'pending');
    assert.equal(r.verified.estimated_price, null);
  });

  test("an organizer cannot request transport for another organizer's schedule", async () => {
    const r = await attempt(db, as('O'), (d) => d.query(
      `INSERT INTO transport_bookings (tour_schedule_id, organizer_id, transporter_id, vehicle_id,
         pickup_location, dropoff_location, pickup_datetime, seats_required)
       VALUES ($1, $2, $3, $4, 'a', 'b', now(), 5)`, [S.o2, OP.O, TP.X, V1]));
    assert.ok(r.error);
  });

  test('an organizer can edit a pending request and cancel it', async () => {
    const r = await attempt(db, as('O'), async (d) => {
      await d.query(`UPDATE transport_bookings SET pickup_location = 'Pier' WHERE id = $1`, [TB1]);
      await d.query(`UPDATE transport_bookings SET status = 'canceled' WHERE id = $1`, [TB1]);
    }, tb);
    assert.equal(r.error, null);
    assert.equal(r.verified.pickup_location, 'Pier');
    assert.equal(r.verified.status, 'canceled');
  });
});

describe('money', () => {
  test('a user cannot create a payout request directly', async () => {
    const r = await attempt(db, as('X'),
      (d) => d.query(`INSERT INTO payout_requests (wallet_id, amount, payout_method) VALUES ($1, 1000000, '{}'::jsonb)`, [WALLET.X]),
      (d) => one(d, `SELECT count(*)::int AS n FROM payout_requests`));
    assert.equal(r.verified.n, 0);
  });

  test('a user cannot call the balance functions', async () => {
    const r = await attempt(db, as('X'),
      (d) => d.query(`SELECT increment_available_balance($1, 1000000)`, [WALLET.X]),
      (d) => one(d, `SELECT available_balance::numeric AS bal FROM user_wallets WHERE id = $1`, [WALLET.X]));
    assert.equal(Number(r.verified.bal), 0);
  });

  test('balances can never go negative, even for the service role', { skip: BASELINE }, async () => {
    const r = await attempt(db, { role: 'service_role' },
      (d) => d.query(`UPDATE user_wallets SET available_balance = -1 WHERE id = $1`, [WALLET.O2]));
    assert.match(r.error, /user_wallets_balances_non_negative/);
  });
});

describe('profiles', () => {
  test('an organizer cannot change their own approval status', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`UPDATE organizer_profiles SET status = 'pending' WHERE id = $1`, [OP.O]),
      (d) => one(d, `SELECT status FROM organizer_profiles WHERE id = $1`, [OP.O]));
    assert.equal(r.verified.status, 'approved');
    assert.ok(r.error);
  });

  test('an organizer can edit their display name', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`UPDATE organizer_profiles SET display_name = 'Oscar Adventures' WHERE id = $1`, [OP.O]),
      (d) => one(d, `SELECT display_name FROM organizer_profiles WHERE id = $1`, [OP.O]));
    assert.equal(r.error, null);
    assert.equal(r.verified.display_name, 'Oscar Adventures');
  });

  test('a transporter cannot inflate their rating', async () => {
    const r = await attempt(db, as('X'),
      (d) => d.query(`UPDATE transporter_profiles SET average_rating = 5, review_count = 999 WHERE id = $1`, [TP.X]),
      (d) => one(d, `SELECT review_count FROM transporter_profiles WHERE id = $1`, [TP.X]));
    assert.equal(r.verified.review_count, 0);
  });

  test('a user cannot mark their own email or phone as verified', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`UPDATE user_profiles SET email_verified_at = now(), phone = '09990000000' WHERE id = $1`, [P.T]),
      (d) => one(d, `SELECT email_verified_at, phone FROM user_profiles WHERE id = $1`, [P.T]));
    assert.equal(r.verified.email_verified_at, null);
    assert.equal(r.verified.phone, null);
  });

  test('a user can change their own name', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`UPDATE user_profiles SET full_name = 'Tina T.' WHERE id = $1`, [P.T]),
      (d) => one(d, `SELECT full_name FROM user_profiles WHERE id = $1`, [P.T]));
    assert.equal(r.error, null);
    assert.equal(r.verified.full_name, 'Tina T.');
  });

  test('a new profile takes its email from the auth account, not the client', { skip: BASELINE }, async () => {
    const r = await attempt(db, as('N'),
      (d) => d.query(`INSERT INTO user_profiles (user_id, email, full_name) VALUES ($1, 'admin@travi.ph', 'New') RETURNING id`, [U.N]),
      (d, res) => one(d, `SELECT email FROM user_profiles WHERE id = $1`, [res?.rows[0]?.id]));
    assert.equal(r.error, null);
    assert.equal(r.verified.email, 'new@example.com');
  });

  test('partner onboarding status is decided by the server', { skip: BASELINE }, async () => {
    const r = await attempt(db, as('N'), async (d) => {
      const p = await d.query(`INSERT INTO user_profiles (user_id, email, full_name) VALUES ($1, 'new@example.com', 'New') RETURNING id`, [U.N]);
      return d.query(`INSERT INTO organizer_profiles (user_profile_id, organizer_type, display_name, phone, status)
                      VALUES ($1, 'individual', 'New Tours', '0917', 'rejected') RETURNING id`, [p.rows[0].id]);
    }, (d, res) => one(d, `SELECT status FROM organizer_profiles WHERE id = $1`, [res?.rows[0]?.id]));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'approved');
  });
});

describe('reviews and notifications', () => {
  test('a user cannot publish their own review', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`INSERT INTO reviews (reviewer_profile_id, tour_id, rating, comment, status) VALUES ($1, $2, 5, 'Best', 'published')`, [P.T, TOUR.t1]),
      (d) => one(d, `SELECT count(*)::int AS n FROM reviews WHERE status = 'published'`));
    assert.equal(r.verified.n, 0);
  });

  test('a user cannot create notifications for others', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, 'info', 'Payout', 'Click', 'https://evil.example')`, [U.O]),
      (d) => one(d, `SELECT count(*)::int AS n FROM notifications WHERE user_id = $1`, [U.O]));
    assert.equal(r.verified.n, 0);
  });

  test('a user can mark a notification read but not rewrite it', async () => {
    const read = await attempt(db, as('T'),
      (d) => d.query(`UPDATE notifications SET is_read = true WHERE id = $1`, [N1]),
      (d) => one(d, `SELECT is_read FROM notifications WHERE id = $1`, [N1]));
    assert.equal(read.error, null);
    assert.equal(read.verified.is_read, true);
    const rewrite = await attempt(db, as('T'),
      (d) => d.query(`UPDATE notifications SET link = 'https://evil.example' WHERE id = $1`, [N1]),
      (d) => one(d, `SELECT link FROM notifications WHERE id = $1`, [N1]));
    assert.equal(rewrite.verified.link, null);
  });
});

describe('tours and schedules', () => {
  test('an organizer cannot hard-delete a schedule', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`DELETE FROM tour_schedules WHERE id = $1`, [S.closed]),
      (d) => one(d, `SELECT count(*)::int AS n FROM tour_schedules WHERE id = $1`, [S.closed]));
    assert.equal(r.verified.n, 1);
  });

  test('an organizer cannot hard-delete a tour', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`DELETE FROM tours WHERE id = $1`, [TOUR.draft]),
      (d) => one(d, `SELECT count(*)::int AS n FROM tours WHERE id = $1`, [TOUR.draft]));
    assert.equal(r.verified.n, 1);
  });

  test('an organizer cannot reset the seat count', async () => {
    const r = await attempt(db, as('O'),
      (d) => d.query(`UPDATE tour_schedules SET booked_count = 0 WHERE id = $1`, [S.s1]),
      (d) => one(d, `SELECT booked_count FROM tour_schedules WHERE id = $1`, [S.s1]));
    assert.equal(r.verified.booked_count, 2);
  });

  test('an organizer can change capacity and see their draft tours', async () => {
    const r = await attempt(db, as('O'), async (d) => {
      await d.query(`UPDATE tour_schedules SET capacity = 12 WHERE id = $1`, [S.s1]);
      return d.query(`SELECT id FROM tours WHERE id = $1`, [TOUR.draft]);
    }, (d) => one(d, `SELECT capacity FROM tour_schedules WHERE id = $1`, [S.s1]));
    assert.equal(r.error, null);
    assert.equal(r.verified.capacity, 12);
    assert.equal(r.result.rows.length, 1);
  });

  test('an organizer can read the names of travelers who booked them', async () => {
    const r = await attempt(db, as('O'), (d) => d.query(`SELECT full_name FROM user_profiles WHERE id = $1`, [P.T]));
    assert.equal(r.result.rows[0]?.full_name, 'Tina Traveler');
  });
});

describe('public (anon) access', () => {
  test('anon cannot read partner phone numbers', async () => {
    const r = await attempt(db, { role: 'anon' }, (d) => d.query(`SELECT phone FROM transporter_profiles`));
    assert.ok(r.error || r.result.rows.length === 0, 'phone numbers must not be readable');
  });

  test('anon can read published tours with organizer names', async () => {
    const r = await attempt(db, { role: 'anon' }, (d) => d.query(
      `SELECT t.title, op.display_name FROM tours t JOIN organizer_profiles op ON op.id = t.organizer_id
       WHERE t.status = 'published' AND op.status = 'approved' AND op.deleted_at IS NULL`));
    assert.equal(r.error, null);
    assert.equal(r.result.rows.length, 2);
  });
});

describe('storage', () => {
  test('uploads only go into the uploader’s own folder', async () => {
    const other = await attempt(db, as('O'), (d) => d.query(
      `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('tour-images', 'someone-else/x.png', $1)`, [U.O]));
    assert.ok(other.error, 'upload outside own folder must fail');
    const own = await attempt(db, as('O'), (d) => d.query(
      `INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('tour-images', $1, $2)`, [`${U.O}/x.png`, U.O]));
    assert.equal(own.error, null);
  });
});
