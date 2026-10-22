// Public catalog search tests (supabase/migrations/20261024100000_public_tour_catalog.sql).
// Run: npm run test:rls. Every case runs in a rolled-back transaction, as the anon role unless noted.
//
// Seed recap (fixtures.mjs): t1 "Palawan" (organizer O, 1000/pax, 3 days) has an open schedule at
// +30 days (capacity 10, 2 seats held by pending booking B1), a cancelled one at +40. t2 "Cebu"
// (organizer O2, 2000/pax, 1 day) has an open schedule at +20 (capacity 8) and a past one.
// "Draft" is a draft tour with an open schedule.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { OP, P, S, SEED, TOUR, as, one } from './fixtures.mjs';

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
});

const anon = { role: 'anon' };

// Named-argument call, the way PostgREST invokes the RPC.
function search(args = {}) {
  const names = Object.keys(args);
  const sql = `SELECT * FROM search_public_tours(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')})`;
  return (d) => d.query(sql, Object.values(args)).then((r) => r.rows);
}

// setup + search inside one rolled-back transaction: setup runs as superuser, search as `who`.
async function runIn(args, { who = anon, setup } = {}) {
  const r = await attempt(db, who, async (d) => {
    if (setup) {
      await d.exec('RESET ROLE');
      await setup(d);
      await d.exec(`SET LOCAL ROLE ${who.role}`);
    }
    return search(args)(d);
  });
  assert.equal(r.error, null);
  return r.result;
}

const slugs = (rows) => rows.map((r) => r.slug);

describe('catalog visibility', () => {
  test('anon sees published tours with an open future schedule, soonest first', async () => {
    const rows = await runIn({});
    assert.deepEqual(slugs(rows), ['cebu', 'palawan']);
    assert.equal(Number(rows[0].total_count), 2);
  });

  test('a signed-in organizer does not see their own draft in the catalog', async () => {
    const rows = await runIn({}, { who: as('O') });
    assert.ok(!slugs(rows).includes('draft'));
  });

  test('past, cancelled and soft-deleted schedules do not count', async () => {
    const rows = await runIn({});
    const palawan = rows.find((r) => r.slug === 'palawan');
    const s1 = await one(db, `SELECT start_date FROM tour_schedules WHERE id = $1`, [S.s1]); // +30, not the +40 cancelled one
    assert.equal(palawan.next_start_date.getTime(), s1.start_date.getTime());

    const afterDelete = await runIn({}, {
      setup: (d) => d.query(`UPDATE tour_schedules SET deleted_at = now() WHERE id = $1`, [S.o2]),
    });
    assert.deepEqual(slugs(afterDelete), ['palawan']); // Cebu only had a past schedule left
  });

  test('soft-deleted tours and tours of unapproved organizers are hidden', async () => {
    const deleted = await runIn({}, {
      setup: (d) => d.query(`UPDATE tours SET deleted_at = now() WHERE id = $1`, [TOUR.t1]),
    });
    assert.deepEqual(slugs(deleted), ['cebu']);

    const pending = await runIn({}, {
      setup: (d) => d.query(`UPDATE organizer_profiles SET status = 'pending' WHERE id = $1`, [OP.O2]),
    });
    assert.deepEqual(slugs(pending), ['palawan']);
  });

  test('a full schedule does not list the tour', async () => {
    const rows = await runIn({}, {
      setup: (d) => d.query(`UPDATE tour_schedules SET capacity = 2 WHERE id = $1`, [S.s1]), // 2 of 2 held by B1
    });
    assert.deepEqual(slugs(rows), ['cebu']);
  });
});

describe('catalog filters', () => {
  test('free text matches title, location, city and province; LIKE wildcards are literal', async () => {
    assert.deepEqual(slugs(await runIn({ p_q: 'palaw' })), ['palawan']);
    const byProvince = await runIn({ p_q: 'visayas' }, {
      setup: (d) => d.query(`UPDATE tours SET province = 'Central Visayas' WHERE id = $1`, [TOUR.t2]),
    });
    assert.deepEqual(slugs(byProvince), ['cebu']);
    assert.deepEqual(slugs(await runIn({ p_q: '%' })), []);
    assert.deepEqual(slugs(await runIn({ p_q: '_' })), []);
  });

  test('destination filter', async () => {
    assert.deepEqual(slugs(await runIn({ p_destination: 'Cebu' })), ['cebu']);
  });

  test('date range applies to schedule start dates', async () => {
    const from = await one(db, `SELECT ((now() AT TIME ZONE 'Asia/Manila')::date + 25) AS d`);
    assert.deepEqual(slugs(await runIn({ p_from: from.d })), ['palawan']);
    assert.deepEqual(slugs(await runIn({ p_to: from.d })), ['cebu']);
  });

  test('guests needs that many seats left on one schedule', async () => {
    assert.deepEqual(slugs(await runIn({ p_guests: 8 })), ['cebu', 'palawan']); // 8 left on each
    assert.deepEqual(slugs(await runIn({ p_guests: 9 })), []);
  });

  test('price uses the schedule price, falling back to the tour price', async () => {
    const rows = await runIn({ p_max_price: 600 }, {
      setup: (d) => d.query(`UPDATE tour_schedules SET price_per_person = 500, original_price = 900 WHERE id = $1`, [S.s1]),
    });
    assert.deepEqual(slugs(rows), ['palawan']);
    assert.equal(Number(rows[0].lowest_price), 500);
    assert.equal(Number(rows[0].original_price), 900);
    assert.deepEqual(slugs(await runIn({ p_min_price: 1500 })), ['cebu']);
    assert.deepEqual(slugs(await runIn({ p_min_price: 1000, p_max_price: 1000 })), ['palawan']);
  });

  test('duration, format and theme', async () => {
    assert.deepEqual(slugs(await runIn({ p_min_days: 2 })), ['palawan']);
    assert.deepEqual(slugs(await runIn({ p_max_days: 1 })), ['cebu']);
    const fmt = await runIn({ p_format: 'private' }, {
      setup: (d) => d.query(`UPDATE tours SET format = 'private' WHERE id = $1`, [TOUR.t2]),
    });
    assert.deepEqual(slugs(fmt), ['cebu']);
    const theme = await runIn({ p_theme: 'island_hopping' }, {
      setup: (d) => d.query(`UPDATE tours SET themes = ARRAY['island_hopping'] WHERE id = $1`, [TOUR.t1]),
    });
    assert.deepEqual(slugs(theme), ['palawan']);
  });
});

describe('catalog sorting, paging and ratings', () => {
  test('sorts by price both ways', async () => {
    assert.deepEqual(slugs(await runIn({ p_sort: 'price_asc' })), ['palawan', 'cebu']);
    assert.deepEqual(slugs(await runIn({ p_sort: 'price_desc' })), ['cebu', 'palawan']);
  });

  test('paginates server-side and reports the full count', async () => {
    const rows = await runIn({ p_limit: 1, p_offset: 1 });
    assert.deepEqual(slugs(rows), ['palawan']);
    assert.equal(Number(rows[0].total_count), 2);
    const clamped = await runIn({ p_limit: 1000, p_offset: -5 });
    assert.equal(clamped.length, 2);
  });

  test('ratings count only published, non-deleted reviews', async () => {
    const rows = await runIn({ p_q: 'palawan' }, {
      setup: (d) => d.query(
        `INSERT INTO reviews (reviewer_profile_id, tour_id, rating, status, deleted_at) VALUES
           ($1, $2, 4, 'published', NULL), ($1, $2, 5, 'published', NULL),
           ($1, $2, 1, 'pending', NULL), ($1, $2, 1, 'published', now())`,
        [P.T, TOUR.t1]),
    });
    assert.equal(Number(rows[0].rating_avg), 4.5);
    assert.equal(rows[0].review_count, 2);
    const cebu = (await runIn({ p_q: 'cebu' }))[0];
    assert.equal(cebu.rating_avg, null);
    assert.equal(cebu.review_count, 0);
  });

  test('runs as the caller (SECURITY INVOKER) and anon can execute it', async () => {
    const fn = await one(db, `SELECT prosecdef, has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_exec
      FROM pg_proc p WHERE proname = 'search_public_tours'`);
    assert.equal(fn.prosecdef, false);
    assert.equal(fn.anon_exec, true);
  });
});
