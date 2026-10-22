// Review tests for supabase/migrations/20261024120000_reviews_eligibility_and_ratings.sql (BIZ-20):
// eligibility (own completed booking of that tour), one review per booking, pending-only inserts,
// transporter rating aggregates and the public tour_rating_summary view. Run: npm run test:rls
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, P, R, S, SEED, TOUR, TP, U, id, one } from './fixtures.mjs';

// Extra fixtures (this file only).
const U2 = { T2: id(200), A: id(202) };          // auth.users: second traveler, admin
const P2 = { T2: id(201), A: id(203) };          // user_profiles
const BK = { done: id(210), confirmed: id(211), othersDone: id(212) };
const RV = { xPending: id(220), t1Published: id(221), t1Deleted: id(222) };

const EXTRA = `
INSERT INTO auth.users (id, email) VALUES ('${U2.T2}', 't2@example.com'), ('${U2.A}', 'admin@example.com');
INSERT INTO user_profiles (id, user_id, email, full_name) VALUES
  ('${P2.T2}', '${U2.T2}', 't2@example.com', 'Theo Traveler'), ('${P2.A}', '${U2.A}', 'admin@example.com', 'Ada Admin');
INSERT INTO user_roles (user_profile_id, website_role_id) VALUES ('${P2.T2}', '${R.traveler}'), ('${P2.A}', '${R.admin}');
-- Tina: a completed trip on the past Cebu schedule (tour t2) and a confirmed one on the upcoming Cebu schedule.
INSERT INTO bookings (id, tour_schedule_id, traveler_id, seats, total_amount, status) VALUES
  ('${BK.done}', '${S.past}', '${P.T}', 1, 2000, 'completed'),
  ('${BK.confirmed}', '${S.o2}', '${P.T}', 1, 2000, 'confirmed'),
  ('${BK.othersDone}', '${S.past}', '${P2.T2}', 1, 2000, 'completed');
INSERT INTO reviews (id, reviewer_profile_id, transporter_id, rating, comment, status) VALUES
  ('${RV.xPending}', '${P.O}', '${TP.X}', 4, 'On time', 'pending');
INSERT INTO reviews (id, reviewer_profile_id, tour_id, rating, comment, status, deleted_at) VALUES
  ('${RV.t1Published}', '${P.O2}', '${TOUR.t1}', 4, 'Lovely', 'published', NULL),
  ('${RV.t1Deleted}', '${P.O2}', '${TOUR.t1}', 1, 'Removed', 'published', now());
`;

const as = (uid) => ({ role: 'authenticated', uid });
const anon = { role: 'anon' };
const tina = as(U.T);
const insertReview = (d, { reviewer = P.T, booking = BK.done, tour = TOUR.t2, status = 'pending', transporter = null } = {}) =>
  d.query(
    `INSERT INTO reviews (reviewer_profile_id, booking_id, tour_id, transporter_id, rating, comment, status)
     VALUES ($1, $2, $3, $4, 5, 'Great trip', $5)`,
    [reviewer, booking, tour, transporter, status]
  );
const countFor = (d, booking) => one(d, `SELECT count(*)::int AS n FROM reviews WHERE booking_id = $1`, [booking]);
const transporter = (d) => one(d, `SELECT average_rating::numeric AS avg, review_count FROM transporter_profiles WHERE id = $1`, [TP.X]);

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
  await db.exec(EXTRA);
});

describe('review eligibility', () => {
  test('a traveler can review their own completed booking, as pending', async () => {
    const r = await attempt(db, tina, (d) => insertReview(d),
      (d) => one(d, `SELECT status::text, tour_id FROM reviews WHERE booking_id = $1`, [BK.done]));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'pending');
    assert.equal(r.verified.tour_id, TOUR.t2);
  });

  test('only one review per booking', async () => {
    const r = await attempt(db, tina,
      async (d) => { await insertReview(d); await insertReview(d); },
      (d) => countFor(d, BK.done));
    assert.match(r.error, /duplicate key|reviews_booking_id_key/);
    assert.equal(r.verified.n, 0); // the whole action was rolled back to the savepoint
  });

  test('cannot review a pending or confirmed booking', async () => {
    const pending = await attempt(db, tina,
      (d) => insertReview(d, { booking: B1, tour: TOUR.t1 }), (d) => countFor(d, B1));
    assert.match(pending.error, /row-level security/);
    assert.equal(pending.verified.n, 0);
    const confirmed = await attempt(db, tina,
      (d) => insertReview(d, { booking: BK.confirmed }), (d) => countFor(d, BK.confirmed));
    assert.match(confirmed.error, /row-level security/);
    assert.equal(confirmed.verified.n, 0);
  });

  test("cannot review someone else's booking", async () => {
    const asSelf = await attempt(db, tina,
      (d) => insertReview(d, { booking: BK.othersDone }), (d) => countFor(d, BK.othersDone));
    assert.match(asSelf.error, /row-level security/);
    const impersonate = await attempt(db, tina,
      (d) => insertReview(d, { reviewer: P2.T2, booking: BK.othersDone }), (d) => countFor(d, BK.othersDone));
    assert.match(impersonate.error, /row-level security/);
    assert.equal(impersonate.verified.n, 0);
  });

  test('cannot attach the review to a different tour or to a transporter', async () => {
    const wrongTour = await attempt(db, tina,
      (d) => insertReview(d, { tour: TOUR.t1 }), (d) => countFor(d, BK.done));
    assert.match(wrongTour.error, /row-level security/);
    const withTransporter = await attempt(db, tina,
      (d) => insertReview(d, { transporter: TP.X }), (d) => countFor(d, BK.done));
    assert.match(withTransporter.error, /row-level security/);
    assert.equal(withTransporter.verified.n, 0);
  });

  test('a review without a booking is rejected', async () => {
    const r = await attempt(db, tina,
      (d) => d.query(`INSERT INTO reviews (reviewer_profile_id, tour_id, rating, status) VALUES ($1, $2, 5, 'pending')`, [P.T, TOUR.t2]),
      (d) => one(d, `SELECT count(*)::int AS n FROM reviews WHERE reviewer_profile_id = $1`, [P.T]));
    assert.match(r.error, /row-level security/);
    assert.equal(r.verified.n, 0);
  });

  test('cannot insert a published review', async () => {
    const r = await attempt(db, tina,
      (d) => insertReview(d, { status: 'published' }), (d) => countFor(d, BK.done));
    assert.match(r.error, /row-level security/);
    assert.equal(r.verified.n, 0);
  });

  test('a traveler cannot publish their own pending review afterwards', async () => {
    const r = await attempt(db, tina,
      async (d) => { await insertReview(d); await d.query(`UPDATE reviews SET status = 'published' WHERE booking_id = $1`, [BK.done]); },
      (d) => one(d, `SELECT status::text FROM reviews WHERE booking_id = $1`, [BK.done]));
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'pending');
  });

  test('anon cannot call the eligibility helper or the rating refresher', async () => {
    const helper = await attempt(db, anon, (d) => d.query(`SELECT can_review_booking($1, $2)`, [BK.done, TOUR.t2]));
    assert.match(helper.error, /permission denied/);
    const refresh = await attempt(db, tina,
      (d) => d.query(`SELECT refresh_transporter_rating($1)`, [TP.X]));
    assert.match(refresh.error, /permission denied/);
  });
});

describe('rating aggregates', () => {
  test('publishing (as an admin end user) updates the transporter rating; hiding reverts it', async () => {
    const r = await attempt(db, as(U2.A), (d) => d.query(`UPDATE reviews SET status = 'published' WHERE id = $1`, [RV.xPending]), (d) => transporter(d));
    assert.equal(r.error, null);
    assert.deepEqual([Number(r.verified.avg), r.verified.review_count], [4, 1]);

    const hidden = await attempt(db, { role: 'service_role' }, async (d) => {
      await d.query(`UPDATE reviews SET status = 'published' WHERE id = $1`, [RV.xPending]);
      await d.query(`UPDATE reviews SET status = 'hidden' WHERE id = $1`, [RV.xPending]);
    }, (d) => transporter(d));
    assert.equal(hidden.error, null);
    assert.deepEqual([Number(hidden.verified.avg), hidden.verified.review_count], [0, 0]);
  });

  test('averages published reviews only and drops soft-deleted ones', async () => {
    const r = await attempt(db, { role: 'service_role' }, async (d) => {
      await d.query(`UPDATE reviews SET status = 'published' WHERE id = $1`, [RV.xPending]);
      await d.query(`INSERT INTO reviews (reviewer_profile_id, transporter_id, rating, status) VALUES ($1, $2, 1, 'published')`, [P.O2, TP.X]);
      await d.query(`INSERT INTO reviews (reviewer_profile_id, transporter_id, rating, status) VALUES ($1, $2, 1, 'pending')`, [P.O2, TP.X]);
      const mid = await transporter(d);
      await d.query(`UPDATE reviews SET deleted_at = now() WHERE id = $1`, [RV.xPending]);
      return mid;
    }, (d) => transporter(d));
    assert.equal(r.error, null);
    assert.deepEqual([Number(r.result.avg), r.result.review_count], [2.5, 2]);
    assert.deepEqual([Number(r.verified.avg), r.verified.review_count], [1, 1]);
  });

  test('end users still cannot write the rating columns directly', async () => {
    const r = await attempt(db, as(U2.A),
      (d) => d.query(`UPDATE transporter_profiles SET average_rating = 5, review_count = 99 WHERE id = $1`, [TP.X]),
      (d) => transporter(d));
    assert.equal(r.verified.review_count, 0);
  });
});

describe('tour_rating_summary', () => {
  test('anon reads the average and count of published, non-deleted reviews', async () => {
    const r = await attempt(db, anon,
      (d) => d.query(`SELECT tour_id, average_rating::numeric AS avg, review_count FROM tour_rating_summary ORDER BY tour_id`).then((x) => x.rows));
    assert.equal(r.error, null);
    assert.deepEqual(r.result.map((x) => [x.tour_id, Number(x.avg), x.review_count]), [[TOUR.t1, 4, 1]]);
  });

  test('a pending review does not count until it is published', async () => {
    const r = await attempt(db, tina, async (d) => {
      await insertReview(d);
      return (await d.query(`SELECT count(*)::int AS n FROM tour_rating_summary WHERE tour_id = $1`, [TOUR.t2])).rows[0].n;
    }, async (d) => {
      await d.query(`UPDATE reviews SET status = 'published' WHERE booking_id = $1`, [BK.done]);
      return one(d, `SELECT average_rating::numeric AS avg, review_count FROM tour_rating_summary WHERE tour_id = $1`, [TOUR.t2]);
    });
    assert.equal(r.error, null);
    assert.equal(r.result, 0);
    assert.deepEqual([Number(r.verified.avg), r.verified.review_count], [5, 1]);
  });
});
