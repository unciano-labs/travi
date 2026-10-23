// Partner approval, KYC documents, publish rules and SEC-13 column access
// (supabase/migrations/20261025090000_partner_approval_kyc.sql). Run: npm run test:rls
//
// Seed recap (fixtures.mjs): organizers O and O2 and transporter X are approved. X owns vehicle V1
// (plate ABC1234, phone 09180000001). Organizer O has a pending transport request TB1 for V1 on
// schedule s1, and traveler T has a pending booking B1 on s1 (a tour of O). Every case runs in a
// rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, OP, P, R, S, SEED, TB1, TOUR, TP, U, V1, as, id, one, seedAuthUsers } from './fixtures.mjs';

const ADMIN_UID = id(15);
const ADMIN_PROFILE = id(25);

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
  await db.exec(`
    ${seedAuthUsers([[ADMIN_UID, 'admin@example.com']])}
    INSERT INTO user_profiles (id, user_id, email, full_name) VALUES ('${ADMIN_PROFILE}', '${ADMIN_UID}', 'admin@example.com', 'Ada Admin');
    INSERT INTO user_roles (user_profile_id, website_role_id) VALUES ('${ADMIN_PROFILE}', '${R.admin}');
  `);
});

const anon = { role: 'anon' };
const admin = { role: 'authenticated', uid: ADMIN_UID };

// Superuser `setup`, then `action` as `who`, then superuser `verify`; all rolled back.
async function run(who, { setup, action, verify }) {
  return attempt(db, who, async (d) => {
    if (setup) {
      await d.exec('RESET ROLE');
      await setup(d);
      await d.exec(`SET LOCAL ROLE ${who.role}`);
    }
    return action(d);
  }, verify);
}

const setStatus = (table, rowId, status) => (d) => d.query(`UPDATE ${table} SET status = $2 WHERE id = $1`, [rowId, status]);

describe('approval workflow (BIZ-06)', () => {
  test('new organizer and transporter profiles start pending, whatever the client sends', async () => {
    const r = await run(as('N'), {
      action: async (d) => {
        const p = await d.query(`INSERT INTO user_profiles (user_id, email, full_name) VALUES ($1, 'new@example.com', 'New') RETURNING id`, [U.N]);
        const o = await d.query(`INSERT INTO organizer_profiles (user_profile_id, organizer_type, display_name, phone, status, review_note)
                                 VALUES ($1, 'individual', 'New Tours', '0917', 'approved', 'forged') RETURNING id`, [p.rows[0].id]);
        const t = await d.query(`INSERT INTO transporter_profiles (user_profile_id, transporter_type, display_name, phone, status)
                                 VALUES ($1, 'individual', 'New Vans', '0918', 'approved') RETURNING id`, [p.rows[0].id]);
        return { o: o.rows[0].id, t: t.rows[0].id };
      },
      verify: async (d, res) => ({
        o: await one(d, `SELECT status, review_note FROM organizer_profiles WHERE id = $1`, [res.o]),
        t: await one(d, `SELECT status FROM transporter_profiles WHERE id = $1`, [res.t]),
      }),
    });
    assert.equal(r.error, null);
    assert.equal(r.verified.o.status, 'pending');
    assert.equal(r.verified.o.review_note, null);
    assert.equal(r.verified.t.status, 'pending');
  });

  test('a partner cannot write the review columns', async () => {
    const r = await run(as('O'), {
      action: (d) => d.query(`UPDATE organizer_profiles SET review_note = 'ok', reviewed_at = now() WHERE id = $1`, [OP.O]),
    });
    assert.match(r.error, /can only be changed by the server/);
  });

  test('a pending organizer can create and edit drafts but cannot publish', async () => {
    const draft = await run(as('O'), {
      setup: setStatus('organizer_profiles', OP.O, 'pending'),
      action: async (d) => {
        await d.query(`INSERT INTO tours (organizer_id, title, slug, description, location, price_per_person, duration_days, status)
                       VALUES ($1, 'New', 'new-1', 'd', 'Siargao', 900, 2, 'draft')`, [OP.O]);
        await d.query(`UPDATE tours SET title = 'Draft 2' WHERE id = $1`, [TOUR.draft]);
      },
    });
    assert.equal(draft.error, null);

    const publish = await run(as('O'), {
      setup: setStatus('organizer_profiles', OP.O, 'pending'),
      action: (d) => d.query(`UPDATE tours SET status = 'published' WHERE id = $1`, [TOUR.draft]),
      verify: (d) => one(d, `SELECT status FROM tours WHERE id = $1`, [TOUR.draft]),
    });
    assert.match(publish.error, /must be approved before you can publish/);
    assert.equal(publish.verified.status, 'draft');

    const insertPublished = await run(as('O'), {
      setup: setStatus('organizer_profiles', OP.O, 'rejected'),
      action: (d) => d.query(`INSERT INTO tours (organizer_id, title, slug, description, location, price_per_person, duration_days, status)
                              VALUES ($1, 'New', 'new-2', 'd', 'Siargao', 900, 2, 'published')`, [OP.O]),
    });
    assert.match(insertPublished.error, /must be approved/);
  });

  test('an approved organizer can publish; the server role is not blocked', async () => {
    const r = await run(as('O'), {
      action: (d) => d.query(`UPDATE tours SET status = 'published' WHERE id = $1`, [TOUR.draft]),
      verify: (d) => one(d, `SELECT status FROM tours WHERE id = $1`, [TOUR.draft]),
    });
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'published');

    const svc = await run({ role: 'service_role' }, {
      setup: setStatus('organizer_profiles', OP.O, 'pending'),
      action: (d) => d.query(`UPDATE tours SET status = 'published' WHERE id = $1`, [TOUR.draft]),
    });
    assert.equal(svc.error, null);
  });

  test('an already-published tour stays editable when the organizer is later suspended', async () => {
    const r = await run(as('O'), {
      setup: setStatus('organizer_profiles', OP.O, 'rejected'),
      action: (d) => d.query(`UPDATE tours SET title = 'Palawan 2' WHERE id = $1`, [TOUR.t1]),
    });
    assert.equal(r.error, null);
  });

  test("an unapproved transporter's vehicle cannot be requested; an approved one can", async () => {
    const request = (d) => d.query(
      `INSERT INTO transport_bookings (tour_schedule_id, organizer_id, transporter_id, vehicle_id,
         pickup_location, dropoff_location, pickup_datetime, seats_required)
       VALUES ($1, $2, $3, $4, 'a', 'b', now(), 5)`, [S.s1, OP.O, TP.X, V1]);
    const pending = await run(as('O'), { setup: setStatus('transporter_profiles', TP.X, 'pending'), action: request });
    assert.match(pending.error, /Invalid transport request/);
    const approved = await run(as('O'), { action: request });
    assert.equal(approved.error, null);
  });

  test('a pending transporter can still list vehicles', async () => {
    const r = await run(as('X'), {
      setup: setStatus('transporter_profiles', TP.X, 'pending'),
      action: (d) => d.query(`INSERT INTO vehicles (transporter_id, name, vehicle_type, seat_capacity, status)
                              VALUES ($1, 'Coaster', 'bus', 29, 'active')`, [TP.X]),
    });
    assert.equal(r.error, null);
  });
});

describe('vehicle discovery: available_vehicles()', () => {
  const discover = (min = 5) => (d) => d.query(`SELECT * FROM available_vehicles(current_date + 60, current_date + 62, $1)`, [min]).then((x) => x.rows);

  test('organizers see active vehicles of approved transporters, without phone or plate', async () => {
    const r = await run(as('O'), { action: discover() });
    assert.equal(r.error, null);
    assert.deepEqual(r.result.map((v) => v.id), [V1]);
    assert.equal(r.result[0].transporter_display_name, 'Xavier Vans');
    assert.ok(!('plate_number' in r.result[0]) && !('phone' in r.result[0]));
  });

  test('pending transporters, small vehicles and overlapping blocks are excluded', async () => {
    const pending = await run(as('O'), { setup: setStatus('transporter_profiles', TP.X, 'pending'), action: discover() });
    assert.deepEqual(pending.result, []);
    const small = await run(as('O'), { action: discover(13) });
    assert.deepEqual(small.result, []);
    const blocked = await run(as('O'), {
      setup: (d) => d.query(`INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status, notes)
                             VALUES ($1, current_date + 61, current_date + 61, 'blocked', 'Oil change')`, [V1]),
      action: discover(),
    });
    assert.deepEqual(blocked.result, []);
  });

  test('travelers get nothing and anon cannot call it', async () => {
    const traveler = await run(as('T'), { action: discover() });
    assert.deepEqual(traveler.result, []);
    const a = await run(anon, { action: discover() });
    assert.match(a.error, /permission denied/);
  });
});

describe('KYC identity fields', () => {
  test('an approved partner may fill a blank field but not change a verified one', async () => {
    const fill = await run(as('O'), {
      action: (d) => d.query(`UPDATE organizer_profiles SET tin = '123-456-789-000' WHERE id = $1`, [OP.O]),
      verify: (d) => one(d, `SELECT tin, status FROM organizer_profiles WHERE id = $1`, [OP.O]),
    });
    assert.equal(fill.error, null);
    assert.equal(fill.verified.tin, '123-456-789-000');
    assert.equal(fill.verified.status, 'approved');

    const change = await run(as('O'), {
      setup: (d) => d.query(`UPDATE organizer_profiles SET legal_name = 'Oscar Org' WHERE id = $1`, [OP.O]),
      action: (d) => d.query(`UPDATE organizer_profiles SET legal_name = 'Someone Else' WHERE id = $1`, [OP.O]),
    });
    assert.match(change.error, /can no longer be changed/);

    const type = await run(as('X'), {
      action: (d) => d.query(`UPDATE transporter_profiles SET transporter_type = 'company', company_name = 'X Corp' WHERE id = $1`, [TP.X]),
    });
    assert.match(type.error, /can no longer be changed/);
  });

  test('editing identity details after a rejection re-submits the application', async () => {
    const r = await run(as('X'), {
      setup: (d) => d.query(`UPDATE transporter_profiles SET status = 'rejected', review_note = 'Blurry ID', reviewed_at = now() WHERE id = $1`, [TP.X]),
      action: (d) => d.query(`UPDATE transporter_profiles SET tin = '123456789' WHERE id = $1`, [TP.X]),
      verify: (d) => one(d, `SELECT status, reviewed_at FROM transporter_profiles WHERE id = $1`, [TP.X]),
    });
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'pending');
    assert.equal(r.verified.reviewed_at, null);
  });

  test('display details stay editable after approval', async () => {
    const r = await run(as('O'), {
      action: (d) => d.query(`UPDATE organizer_profiles SET description = 'New', public_contact_email = 'hi@oscar.ph' WHERE id = $1`, [OP.O]),
    });
    assert.equal(r.error, null);
  });

  test('company partners need a company name (BIZ-08)', async () => {
    const insert = await run(as('N'), {
      action: async (d) => {
        const p = await d.query(`INSERT INTO user_profiles (user_id, email, full_name) VALUES ($1, 'new@example.com', 'New') RETURNING id`, [U.N]);
        return d.query(`INSERT INTO organizer_profiles (user_profile_id, organizer_type, company_name, display_name, phone)
                        VALUES ($1, 'company', '  ', 'New Co', '0917')`, [p.rows[0].id]);
      },
    });
    assert.match(insert.error, /organizer_profiles_company_name_required/);

    const update = await run({ role: 'service_role' }, {
      action: (d) => d.query(`UPDATE transporter_profiles SET transporter_type = 'company' WHERE id = $1`, [TP.X]),
    });
    assert.match(update.error, /transporter_profiles_company_name_required/);
  });
});

describe('partner_documents', () => {
  const insertDoc = (uid, extra = {}) => (d) => d.query(
    `INSERT INTO partner_documents (owner_profile_id, partner_type, doc_type, storage_path, mime_type, size_bytes, status, vehicle_id)
     VALUES ($1, $2, $3, $4, 'application/pdf', 1000, $5, $6) RETURNING id`,
    [extra.owner ?? P.X, extra.partnerType ?? 'transporter', extra.docType ?? 'government_id',
     extra.path ?? `${uid}/id.pdf`, extra.status ?? 'verified', extra.vehicleId ?? null]);

  test('owners add documents in their own folder; status is always submitted', async () => {
    const r = await run(as('X'), {
      action: insertDoc(U.X, { vehicleId: V1, docType: 'vehicle_orcr' }),
      verify: (d, res) => one(d, `SELECT status FROM partner_documents WHERE id = $1`, [res.rows[0].id]),
    });
    assert.equal(r.error, null);
    assert.equal(r.verified.status, 'submitted');
  });

  test('paths outside the owner folder, other owners and other vehicles are refused', async () => {
    assert.match((await run(as('X'), { action: insertDoc(U.X, { path: `${U.O}/id.pdf` }) })).error, /Invalid document path/);
    assert.match((await run(as('X'), { action: insertDoc(U.X, { path: `${U.X}/../${U.O}/id.pdf` }) })).error, /Invalid document path/);
    assert.ok((await run(as('X'), { action: insertDoc(U.X, { owner: P.O }) })).error);
    assert.match((await run(as('O'), { action: insertDoc(U.O, { owner: P.O, vehicleId: V1 }) })).error,
      /partner_documents_vehicle_is_transporter|Vehicle not found/);
  });

  test('owners cannot verify their own documents but can withdraw them', async () => {
    const setup = (d) => d.query(`INSERT INTO partner_documents (id, owner_profile_id, partner_type, doc_type, storage_path)
                                  VALUES ($1, $2, 'transporter', 'government_id', $3)`, [id(901), P.X, `${U.X}/a.pdf`]);
    const verify = await run(as('X'), {
      setup,
      action: (d) => d.query(`UPDATE partner_documents SET status = 'verified' WHERE id = $1`, [id(901)]),
    });
    assert.match(verify.error, /can only be changed by the server/);
    const withdraw = await run(as('X'), {
      setup,
      action: (d) => d.query(`UPDATE partner_documents SET deleted_at = now() WHERE id = $1`, [id(901)]),
      verify: (d) => one(d, `SELECT deleted_at FROM partner_documents WHERE id = $1`, [id(901)]),
    });
    assert.equal(withdraw.error, null);
    assert.ok(withdraw.verified.deleted_at);
  });

  test('only the owner and admins can read documents; anon cannot touch the table', async () => {
    const setup = (d) => d.query(`INSERT INTO partner_documents (owner_profile_id, partner_type, doc_type, storage_path)
                                  VALUES ($1, 'transporter', 'government_id', $2)`, [P.X, `${U.X}/b.pdf`]);
    const count = (d) => d.query(`SELECT count(*)::int AS n FROM partner_documents`).then((x) => x.rows[0].n);
    assert.equal((await run(as('X'), { setup, action: count })).result, 1);
    assert.equal((await run(as('O'), { setup, action: count })).result, 0);
    assert.equal((await run(admin, { setup, action: count })).result, 1);
    assert.match((await run(anon, { setup, action: count })).error, /permission denied/);
  });
});

describe('partner-documents storage bucket', () => {
  test('is private, documents-only and 10 MB', async () => {
    const b = await one(db, `SELECT public, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'partner-documents'`);
    assert.equal(b.public, false);
    assert.equal(Number(b.file_size_limit), 10485760);
    assert.deepEqual(b.allowed_mime_types, ['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
  });

  test('uploads only into the uploader’s folder; reads only their own files', async () => {
    const upload = (name) => (d) => d.query(`INSERT INTO storage.objects (bucket_id, name, owner) VALUES ('partner-documents', $1, $2)`, [name, U.X]);
    assert.equal((await run(as('X'), { action: upload(`${U.X}/id.pdf`) })).error, null);
    assert.ok((await run(as('X'), { action: upload(`${U.O}/id.pdf`) })).error);
    assert.ok((await run(anon, { action: upload(`${U.X}/id.pdf`) })).error);

    const setup = (d) => d.query(`INSERT INTO storage.objects (bucket_id, name) VALUES
      ('partner-documents', $1), ('partner-documents', $2)`, [`${U.X}/x.pdf`, `${U.O}/o.pdf`]);
    const names = (d) => d.query(`SELECT name FROM storage.objects WHERE bucket_id = 'partner-documents'`).then((x) => x.rows.map((o) => o.name));
    assert.deepEqual((await run(as('X'), { setup, action: names })).result, [`${U.X}/x.pdf`]);
    assert.deepEqual((await run(as('T'), { setup, action: names })).result, []);
    assert.deepEqual((await run(anon, { setup, action: names })).result, []);
  });
});

describe('SEC-13: signed-in PII', () => {
  test('signed-in users cannot read other partners’ rows, phones or plates from the base tables', async () => {
    const r = await run(as('T'), {
      action: async (d) => ({
        org: (await d.query(`SELECT phone FROM organizer_profiles`)).rows,
        trp: (await d.query(`SELECT phone FROM transporter_profiles`)).rows,
        veh: (await d.query(`SELECT plate_number FROM vehicles`)).rows,
      }),
    });
    assert.equal(r.error, null);
    assert.deepEqual(r.result, { org: [], trp: [], veh: [] });

    const other = await run(as('O2'), { action: (d) => d.query(`SELECT id FROM organizer_profiles WHERE id = $1`, [OP.O]) });
    assert.equal(other.result.rows.length, 0);
  });

  test('owners still read their full rows; admins read everything', async () => {
    const own = await run(as('X'), {
      action: async (d) => ({
        phone: (await one(d, `SELECT phone FROM transporter_profiles WHERE id = $1`, [TP.X]))?.phone,
        plate: (await one(d, `SELECT plate_number FROM vehicles WHERE id = $1`, [V1]))?.plate_number,
      }),
    });
    assert.deepEqual(own.result, { phone: '09180000001', plate: 'ABC1234' });
    const a = await run(admin, {
      action: (d) => d.query(`SELECT (SELECT count(*) FROM organizer_profiles)::int AS o, (SELECT count(*) FROM vehicles)::int AS v`),
    });
    assert.deepEqual(a.result.rows[0], { o: 2, v: 1 });
  });

  test('public views expose safe columns of approved partners to everyone', async () => {
    for (const who of [anon, as('T')]) {
      const r = await run(who, {
        action: async (d) => ({
          orgs: (await d.query(`SELECT id, phone, contact_email FROM public_organizer_profiles ORDER BY display_name`)).rows,
          trps: (await d.query(`SELECT id, phone FROM public_transporter_profiles`)).rows,
          vehs: (await d.query(`SELECT id, plate_number FROM public_vehicles`)).rows,
        }),
      });
      assert.equal(r.error, null);
      assert.deepEqual(r.result.orgs, [
        { id: OP.O2, phone: null, contact_email: null },
        { id: OP.O, phone: null, contact_email: null },
      ]);
      assert.deepEqual(r.result.trps, [{ id: TP.X, phone: null }]);
      assert.deepEqual(r.result.vehs, [{ id: V1, plate_number: null }]);
    }
  });

  test('pending partners are not in the public views', async () => {
    const r = await run(as('T'), {
      setup: async (d) => {
        await setStatus('organizer_profiles', OP.O2, 'pending')(d);
        await setStatus('transporter_profiles', TP.X, 'pending')(d);
      },
      action: async (d) => ({
        orgs: (await d.query(`SELECT id FROM public_organizer_profiles`)).rows.map((x) => x.id),
        trps: (await d.query(`SELECT id FROM public_transporter_profiles`)).rows.length,
        vehs: (await d.query(`SELECT id FROM public_vehicles`)).rows.length,
      }),
    });
    assert.deepEqual(r.result, { orgs: [OP.O], trps: 0, vehs: 0 });
  });

  test('transport counterparties see each other; contact details only once accepted', async () => {
    const look = async (d) => ({
      trp: await one(d, `SELECT phone, contact_email FROM public_transporter_profiles WHERE id = $1`, [TP.X]),
      veh: await one(d, `SELECT plate_number FROM public_vehicles WHERE id = $1`, [V1]),
    });
    const pending = await run(as('O'), { action: look });
    assert.deepEqual(pending.result, { trp: { phone: null, contact_email: null }, veh: { plate_number: null } });

    const accept = (d) => d.query(`UPDATE transport_bookings SET status = 'accepted' WHERE id = $1`, [TB1]);
    const accepted = await run(as('O'), { setup: accept, action: look });
    assert.deepEqual(accepted.result, {
      trp: { phone: '09180000001', contact_email: 'x@example.com' },
      veh: { plate_number: 'ABC1234' },
    });

    // The transporter sees the organizer's contact, even if the organizer is no longer listed publicly.
    const trp = await run(as('X'), {
      setup: async (d) => { await accept(d); await setStatus('organizer_profiles', OP.O, 'pending')(d); },
      action: (d) => one(d, `SELECT phone, contact_email FROM public_organizer_profiles WHERE id = $1`, [OP.O]),
    });
    assert.deepEqual(trp.result, { phone: '09170000001', contact_email: 'o@example.com' });

    // A third party sees none of it.
    const other = await run(as('O2'), { setup: accept, action: look });
    assert.deepEqual(other.result, { trp: { phone: null, contact_email: null }, veh: { plate_number: null } });
  });

  test('the views are read-only', async () => {
    for (const sql of [
      `UPDATE public_organizer_profiles SET display_name = 'x'`,
      `UPDATE public_vehicles SET name = 'x'`,
      `DELETE FROM public_transporter_profiles`,
    ]) {
      const r = await run(as('O'), { action: (d) => d.query(sql) });
      assert.match(r.error, /permission denied/);
    }
  });

  test('vehicle availability (and its notes) is private to the transporter', async () => {
    const setup = (d) => d.query(`INSERT INTO vehicle_availability (vehicle_id, start_date, end_date, status, notes)
                                  VALUES ($1, current_date + 5, current_date + 6, 'blocked', 'Family trip')`, [V1]);
    const read = (d) => d.query(`SELECT notes FROM vehicle_availability`).then((x) => x.rows);
    assert.deepEqual((await run(as('O'), { setup, action: read })).result, []);
    assert.deepEqual((await run(as('X'), { setup, action: read })).result, [{ notes: 'Family trip' }]);
  });

  test('organizers read traveler names, and emails only for confirmed bookings', async () => {
    const contacts = (d) => d.query(`SELECT traveler_id, full_name, email FROM organizer_traveler_contacts()`).then((x) => x.rows);
    const base = await run(as('O'), { action: (d) => d.query(`SELECT email FROM user_profiles WHERE id = $1`, [P.T]) });
    assert.equal(base.result.rows.length, 0);

    const pending = await run(as('O'), { action: contacts });
    assert.deepEqual(pending.result, [{ traveler_id: P.T, full_name: 'Tina Traveler', email: null }]);

    const confirmed = await run(as('O'), {
      setup: (d) => d.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [B1]),
      action: contacts,
    });
    assert.deepEqual(confirmed.result, [{ traveler_id: P.T, full_name: 'Tina Traveler', email: 't@example.com' }]);

    assert.deepEqual((await run(as('O2'), { action: contacts })).result, []);
    assert.deepEqual((await run(as('T'), { action: contacts })).result, []);
    assert.match((await run(anon, { action: contacts })).error, /permission denied/);
  });

  test('the catalog still lists every approved organizer for anon and signed-in users', async () => {
    for (const who of [anon, as('O'), as('T')]) {
      const r = await run(who, { action: (d) => d.query(`SELECT slug, organizer_name FROM search_public_tours()`) });
      assert.equal(r.error, null);
      assert.deepEqual(r.result.rows.map((x) => x.slug), ['cebu', 'palawan']);
      assert.equal(r.result.rows[1].organizer_name, 'Oscar Tours');
    }
  });

  test('anon tour detail can still embed the organizer (column-limited base table)', async () => {
    const r = await run(anon, {
      action: (d) => d.query(`SELECT t.slug, op.display_name, op.company_name FROM tours t
                              JOIN organizer_profiles op ON op.id = t.organizer_id WHERE t.slug = 'palawan'`),
    });
    assert.equal(r.error, null);
    assert.equal(r.result.rows[0].display_name, 'Oscar Tours');
    const phone = await run(anon, { action: (d) => d.query(`SELECT phone FROM organizer_profiles`) });
    assert.match(phone.error, /permission denied/);
  });
});
