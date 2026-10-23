// Admin tooling tests for supabase/migrations/20261025120000_admin_tooling.sql (OPS-06, OPS-07, FIN-11, FIN-15,
// AGENTS.md §6 #6): payment-review resolution, maker-checker payouts, tour moderation hold, admin aggregates.
// Run: npm run test:rls. Every case runs in a rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, OP, P, R, SEED, TOUR, U, WALLET, id, one, seedAuthUsers, service } from './fixtures.mjs';

// Extra fixtures (this file only): two admins, a payout request.
const UA = { A1: id(300), A2: id(301) };     // auth.users
const PA = { A1: id(302), A2: id(303) };     // user_profiles
const PAYOUT = { big: id(310), small: id(311) };

const EXTRA = `
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS banned_until timestamptz;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS last_sign_in_at timestamptz;
UPDATE auth.users SET banned_until = now() + interval '100 years' WHERE id = '${U.T}';
${seedAuthUsers([[UA.A1, 'a1@example.com'], [UA.A2, 'a2@example.com']])}
INSERT INTO user_profiles (id, user_id, email, full_name) VALUES
  ('${PA.A1}', '${UA.A1}', 'a1@example.com', 'Ada Admin'), ('${PA.A2}', '${UA.A2}', 'a2@example.com', 'Ben Admin');
INSERT INTO user_roles (user_profile_id, website_role_id) VALUES ('${PA.A1}', '${R.admin}'), ('${PA.A2}', '${R.admin}');
-- O2 requested two payouts (balance already debited at request time: 50000 - 6000 - 500).
UPDATE user_wallets SET available_balance = 43500 WHERE id = '${WALLET.O2}';
INSERT INTO payout_requests (id, wallet_id, amount, status, payout_method) VALUES
  ('${PAYOUT.big}', '${WALLET.O2}', 6000, 'pending', '{"method":"gcash","account_number":"09170000002"}'),
  ('${PAYOUT.small}', '${WALLET.O2}', 500, 'pending', '{"method":"gcash","account_number":"09170000002"}');
INSERT INTO wallet_transactions (wallet_id, amount, type, balance_affected, reference_type, reference_id, description) VALUES
  ('${WALLET.O2}', -6000, 'withdrawal_pending', 'available', 'payout', '${PAYOUT.big}', 'Withdrawal'),
  ('${WALLET.O2}', -500, 'withdrawal_pending', 'available', 'payout', '${PAYOUT.small}', 'Withdrawal');
`;

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
  await db.exec(EXTRA);
});

const as = (uid) => ({ role: 'authenticated', uid });
// Run a statement inside the current transaction; return its first row or { error }.
const step = async (d, sql, params) => {
  await d.query('SAVEPOINT step');
  try {
    const row = (await d.query(sql, params)).rows[0];
    await d.query('RELEASE SAVEPOINT step');
    return row;
  } catch (e) {
    await d.query('ROLLBACK TO SAVEPOINT step');
    return { error: e.message };
  }
};
// A payment PayMongo collected that could not be applied (wrong amount) -> needs_review.
const needsReviewPayment = async (d, payment = 'pay_review') => {
  await d.query(`SELECT confirm_booking_payment($1, 'pi_1', $2, 150000, 4000, 'webhook')`, [B1, payment]);
  return (await d.query(`SELECT id FROM booking_payments WHERE provider_payment_id = $1`, [payment])).rows[0].id;
};
const setThreshold = (d, value) => d.query(`UPDATE platform_settings SET payout_dual_approval_threshold = $1`, [value]);

describe('payments needing review', () => {
  test('refund: claim once, resolve once (idempotent), audited, no ledger change', async () => {
    const r = await attempt(db, service, async (d) => {
      const pid = await needsReviewPayment(d);
      const claim = await step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, PA.A1]);
      const claimAgain = await step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, PA.A2]);
      const closeWhileRefunding = await step(d, `SELECT resolve_payment_review($1, $2, 'no_refund', NULL, 'dup') AS r`, [pid, PA.A2]);
      const done = await step(d, `SELECT resolve_payment_review($1, $2, 'refunded', 'ref_rv1') AS r`, [pid, PA.A1]);
      const again = await step(d, `SELECT resolve_payment_review($1, $2, 'refunded', 'ref_rv1') AS r`, [pid, PA.A1]);
      const other = await step(d, `SELECT resolve_payment_review($1, $2, 'no_refund', NULL, 'changed my mind') AS r`, [pid, PA.A1]);
      return { pid, claim, claimAgain, closeWhileRefunding, done, again, other };
    }, async (d, res) => ({
      payment: await one(d, `SELECT resolution, provider_refund_id, resolved_by FROM booking_payments WHERE id = $1`, [res.pid]),
      audit: await one(d, `SELECT count(*)::int AS n, max(action) AS action FROM admin_audit_logs WHERE entity_id = $1`, [res.pid]),
      ledger: await one(d, `SELECT count(*)::int AS n FROM wallet_transactions WHERE reference_id = $1`, [B1]),
      booking: await one(d, `SELECT status::text FROM bookings WHERE id = $1`, [B1]),
    }));
    assert.equal(r.error, null);
    assert.deepEqual([r.result.claim.provider_payment_id, Number(r.result.claim.amount_centavos)], ['pay_review', 150000]);
    assert.match(r.result.claimAgain.error, /already in progress/);
    assert.match(r.result.closeWhileRefunding.error, /in progress/);
    assert.equal(r.result.done.r, 'resolved');
    assert.equal(r.result.again.r, 'already_resolved');
    assert.match(r.result.other.error, /already been resolved/);
    assert.deepEqual([r.verified.payment.resolution, r.verified.payment.provider_refund_id, r.verified.payment.resolved_by],
      ['refunded', 'ref_rv1', PA.A1]);
    assert.deepEqual([r.verified.audit.n, r.verified.audit.action], [1, 'payment_review_refunded']);
    assert.equal(r.verified.ledger.n, 0);
    assert.equal(r.verified.booking.status, 'pending');
  });

  test('a failed PayMongo refund releases the claim for a retry', async () => {
    const r = await attempt(db, service, async (d) => {
      const pid = await needsReviewPayment(d);
      await d.query(`SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, PA.A1]);
      await d.query(`SELECT fail_payment_review_refund($1)`, [pid]);
      return step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, PA.A2]);
    });
    assert.equal(r.error, null);
    assert.equal(r.result.provider_payment_id, 'pay_review');
  });

  test('closing without a refund needs a note, then blocks refunds', async () => {
    const r = await attempt(db, service, async (d) => {
      const pid = await needsReviewPayment(d);
      const noNote = await step(d, `SELECT resolve_payment_review($1, $2, 'no_refund') AS r`, [pid, PA.A1]);
      const closed = await step(d, `SELECT resolve_payment_review($1, $2, 'no_refund', NULL, 'Refunded in the PayMongo dashboard') AS r`, [pid, PA.A1]);
      const refundAfter = await step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, PA.A1]);
      const refundNoId = await step(d, `SELECT resolve_payment_review($1, $2, 'refunded') AS r`, [pid, PA.A1]);
      return { noNote, closed, refundAfter, refundNoId };
    });
    assert.match(r.result.noNote.error, /Add a note/);
    assert.equal(r.result.closed.r, 'resolved');
    assert.match(r.result.refundAfter.error, /already been resolved/);
    assert.match(r.result.refundNoId.error, /refund id is required/);
  });

  test('applied payments are not handled here, and only admins may resolve', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_ok', 200000, 5000, 'return')`, [B1]);
      const applied = (await d.query(`SELECT id FROM booking_payments WHERE provider_payment_id = 'pay_ok'`)).rows[0].id;
      const pid = await needsReviewPayment(d, 'pay_dup');
      return {
        applied: await step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [applied, PA.A1]),
        notAdmin: await step(d, `SELECT * FROM begin_payment_review_refund($1, $2)`, [pid, P.O]),
        notAdminResolve: await step(d, `SELECT resolve_payment_review($1, $2, 'no_refund', NULL, 'x') AS r`, [pid, P.O]),
      };
    });
    assert.match(r.result.applied.error, /refund the booking instead/);
    assert.match(r.result.notAdmin.error, /Only admins/);
    assert.match(r.result.notAdminResolve.error, /Only admins/);
  });

  test('end users (even admins) cannot call the review functions directly', async () => {
    const r = await attempt(db, as(UA.A1), (d) => d.query(`SELECT resolve_payment_review($1, $2, 'no_refund', NULL, 'x')`, [id(999), PA.A1]));
    assert.match(r.error, /permission denied/);
  });
});

describe('maker-checker payouts', () => {
  test('above the threshold: approve by one admin, mark paid by another', async () => {
    const r = await attempt(db, service, async (d) => {
      await setThreshold(d, 5000);
      return {
        directPay: await step(d, `SELECT mark_payout_paid($1, $2, 'IP-1') AS w`, [PAYOUT.big, PA.A1]),
        approve: await step(d, `SELECT approve_payout($1, $2) AS w`, [PAYOUT.big, PA.A1]),
        approveAgain: await step(d, `SELECT approve_payout($1, $2) AS w`, [PAYOUT.big, PA.A2]),
        selfPay: await step(d, `SELECT mark_payout_paid($1, $2, 'IP-1') AS w`, [PAYOUT.big, PA.A1]),
        checkerPay: await step(d, `SELECT mark_payout_paid($1, $2, 'IP-1') AS w`, [PAYOUT.big, PA.A2]),
      };
    }, async (d) => ({
      payout: await one(d, `SELECT status::text, approved_by FROM payout_requests WHERE id = $1`, [PAYOUT.big]),
      audit: await d.query(`SELECT admin_profile_id, action FROM admin_audit_logs WHERE entity_id = $1 ORDER BY created_at, action`, [PAYOUT.big]).then((x) => x.rows),
      drift: await one(d, `SELECT count(*)::int AS n FROM wallet_ledger_drift() WHERE wallet_id = $1`, [WALLET.O2]),
    }));
    assert.equal(r.error, null);
    assert.match(r.result.directPay.error, /needs approval by another admin/);
    assert.equal(r.result.approve.w, WALLET.O2);
    assert.match(r.result.approveAgain.error, /not pending/);
    assert.match(r.result.selfPay.error, /different admin/);
    assert.equal(r.result.checkerPay.w, WALLET.O2);
    assert.deepEqual([r.verified.payout.status, r.verified.payout.approved_by], ['paid', PA.A1]);
    assert.deepEqual(r.verified.audit.map((a) => a.action).sort(), ['approve', 'mark_paid']);
    assert.equal(r.verified.drift.n, 0);
  });

  test('below the threshold (or with the threshold off) one admin can pay', async () => {
    const r = await attempt(db, service, async (d) => {
      await setThreshold(d, 5000);
      const small = await step(d, `SELECT mark_payout_paid($1, $2, 'IP-2') AS w`, [PAYOUT.small, PA.A1]);
      await setThreshold(d, null);
      const bigOff = await step(d, `SELECT mark_payout_paid($1, $2, 'IP-3') AS w`, [PAYOUT.big, PA.A1]);
      return { small, bigOff };
    });
    assert.equal(r.result.small.w, WALLET.O2);
    assert.equal(r.result.bigOff.w, WALLET.O2);
  });

  test('an approved payout can still be rejected, which restores the balance', async () => {
    const r = await attempt(db, service, async (d) => {
      await setThreshold(d, 5000);
      await d.query(`SELECT approve_payout($1, $2)`, [PAYOUT.big, PA.A1]);
      return step(d, `SELECT reject_payout($1, $2, 'Account name mismatch') AS w`, [PAYOUT.big, PA.A2]);
    }, (d) => one(d, `SELECT available_balance::numeric AS available FROM user_wallets WHERE id = $1`, [WALLET.O2]));
    assert.equal(r.result.w, WALLET.O2);
    assert.equal(Number(r.verified.available), 49500);
  });

  test('only admins can approve; the threshold must be positive', async () => {
    const r = await attempt(db, service, async (d) => ({
      notAdmin: await step(d, `SELECT approve_payout($1, $2) AS w`, [PAYOUT.big, P.O]),
      zero: await step(d, `UPDATE platform_settings SET payout_dual_approval_threshold = 0 RETURNING id`),
    }));
    assert.match(r.result.notAdmin.error, /Only admins/);
    assert.match(r.result.zero.error, /platform_settings_payout_threshold_positive/);
  });

  test('admin sessions can read payouts but no longer write them directly', async () => {
    const r = await attempt(db, as(UA.A1), async (d) => ({
      read: (await d.query(`SELECT count(*)::int AS n FROM payout_requests`)).rows[0].n,
      write: (await d.query(`UPDATE payout_requests SET status = 'paid' WHERE id = $1`, [PAYOUT.big])).affectedRows ?? 0,
    }), (d) => one(d, `SELECT status::text FROM payout_requests WHERE id = $1`, [PAYOUT.big]));
    assert.equal(r.error, null);
    assert.equal(r.result.read, 2);
    assert.equal(r.verified.status, 'pending');
  });

  test('end users cannot call approve_payout', async () => {
    const r = await attempt(db, as(UA.A1), (d) => d.query(`SELECT approve_payout($1, $2)`, [PAYOUT.big, PA.A1]));
    assert.match(r.error, /permission denied/);
  });
});

describe('tour moderation hold', () => {
  const unpublish = (d, reason = 'Misleading photos') =>
    step(d, `SELECT admin_unpublish_tour($1, $2, $3) AS o`, [TOUR.t1, PA.A1, reason]);

  test('admin unpublish: draft + hold, organizer cannot re-publish or clear it, but can edit', async () => {
    await db.exec('BEGIN');
    try {
      const res = await unpublish(db);
      await db.exec('SET LOCAL ROLE authenticated');
      await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [U.O]);
      const publish = await step(db, `UPDATE tours SET status = 'published' WHERE id = $1 RETURNING id`, [TOUR.t1]);
      const clear = await step(db, `UPDATE tours SET admin_hold_reason = NULL WHERE id = $1 RETURNING id`, [TOUR.t1]);
      const edit = await step(db, `UPDATE tours SET title = 'Palawan (fixed)' WHERE id = $1 RETURNING id`, [TOUR.t1]);
      await db.exec('RESET ROLE');
      const tour = await one(db, `SELECT status, admin_hold_reason, admin_hold_by, title FROM tours WHERE id = $1`, [TOUR.t1]);
      const audit = await one(db, `SELECT action, notes FROM admin_audit_logs WHERE entity_id = $1`, [TOUR.t1]);
      assert.equal(res.o, OP.O);
      assert.match(publish.error, /unpublished by the Travi team/);
      assert.match(clear.error, /admin_hold/);
      assert.equal(edit.id, TOUR.t1);
      assert.deepEqual([tour.status, tour.admin_hold_reason, tour.admin_hold_by, tour.title],
        ['draft', 'Misleading photos', PA.A1, 'Palawan (fixed)']);
      assert.deepEqual([audit.action, audit.notes], ['unpublish', 'Reason: Misleading photos']);
    } finally {
      await db.exec('ROLLBACK');
    }
  });

  test('admin re-publish lifts the hold; only held tours can be re-published', async () => {
    const r = await attempt(db, service, async (d) => {
      await unpublish(d);
      return {
        republish: await step(d, `SELECT admin_republish_tour($1, $2) AS o`, [TOUR.t1, PA.A2]),
        notHeld: await step(d, `SELECT admin_republish_tour($1, $2) AS o`, [TOUR.draft, PA.A2]),
        again: await unpublish(d, ''),
      };
    }, (d) => one(d, `SELECT status, admin_hold_at FROM tours WHERE id = $1`, [TOUR.t1]));
    assert.equal(r.result.republish.o, OP.O);
    assert.match(r.result.notHeld.error, /Only tours unpublished by an admin/);
    assert.match(r.result.again.error, /reason is required/);
    assert.deepEqual([r.verified.status, r.verified.admin_hold_at], ['published', null]);
  });

  test('organizers still publish their own drafts, and cannot create a tour with a hold', async () => {
    const r = await attempt(db, as(U.O), async (d) => ({
      publish: (await d.query(`UPDATE tours SET status = 'published' WHERE id = $1 RETURNING id`, [TOUR.draft])).rows[0],
      created: (await d.query(
        `INSERT INTO tours (organizer_id, title, slug, description, location, price_per_person, duration_days, admin_hold_reason, admin_hold_at)
         VALUES ($1, 'New', 'new-1', 'd', 'Iloilo', 900, 1, 'self-set', now()) RETURNING id`, [OP.O])).rows[0],
    }), (d, res) => one(d, `SELECT admin_hold_reason, admin_hold_at FROM tours WHERE id = $1`, [res.created.id]));
    assert.equal(r.error, null);
    assert.equal(r.result.publish.id, TOUR.draft);
    assert.deepEqual([r.verified.admin_hold_reason, r.verified.admin_hold_at], [null, null]);
  });

  test('only admins can unpublish', async () => {
    const r = await attempt(db, service, (d) => step(d, `SELECT admin_unpublish_tour($1, $2, 'x') AS o`, [TOUR.t1, P.O]));
    assert.match(r.result.error, /Only admins/);
  });
});

describe('admin aggregates', () => {
  test('admin_booking_stats buckets bookings per Manila month with confirmed revenue', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_s', 200000, 5000, 'return')`, [B1]);
      return (await d.query(`SELECT month, bookings::int, revenue::numeric, confirmed::int FROM admin_booking_stats(6)`)).rows;
    });
    assert.equal(r.error, null);
    assert.equal(r.result.length, 6);
    const current = r.result[5];
    assert.equal(current.bookings, 1);
    assert.equal(current.confirmed, 1);
    assert.equal(Number(current.revenue), 2000);
    assert.equal(r.result.slice(0, 5).reduce((n, m) => n + m.bookings, 0), 0);
  });

  test('admin_finance_summary reports GMV, fees, MDR, refunds, liabilities and reviews', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_f', 200000, 5000, 'return')`, [B1]);
      await d.query(`SELECT confirm_booking_payment($1, 'pi_1', 'pay_f2', 200000, 5000, 'webhook')`, [B1]); // duplicate -> needs_review
      return one(d, `SELECT * FROM admin_finance_summary(current_date - 30, current_date + 1)`);
    });
    assert.equal(r.error, null);
    const s = r.result;
    assert.deepEqual(
      [Number(s.gmv), Number(s.payments_count), Number(s.platform_fees), Number(s.mdr), Number(s.refunds)],
      [2000, 1, 200, 100, 0]
    );
    assert.deepEqual([Number(s.escrow_liability), Number(s.available_liability)], [1800, 43500]);
    assert.deepEqual([Number(s.pending_payouts), Number(s.pending_payouts_count)], [6500, 2]);
    assert.deepEqual([Number(s.needs_review_amount), Number(s.needs_review_count)], [2000, 1]);
    assert.equal(Number(s.ledger_drift_count), 0);
  });

  test('admin_auth_user_status returns ban state for the requested users only', async () => {
    const r = await attempt(db, service, async (d) => {
      return (await d.query(`SELECT user_id, banned_until IS NOT NULL AS banned FROM admin_auth_user_status($1::uuid[]) ORDER BY user_id`, [[U.T, U.O]])).rows;
    });
    assert.equal(r.error, null);
    assert.deepEqual(r.result.map((x) => [x.user_id, x.banned]), [[U.T, true], [U.O, false]]);
  });

  test('end users cannot read the aggregates', async () => {
    const r = await attempt(db, as(UA.A1), (d) => d.query(`SELECT * FROM admin_finance_summary(NULL, NULL)`));
    assert.match(r.error, /permission denied/);
  });
});
