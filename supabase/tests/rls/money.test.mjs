// Money-flow tests for the Phase 2 database functions (supabase/migrations/20261023120000_money_integrity.sql):
// payment confirmation, escrow release, disputes, refunds, payouts and ledger invariants.
// Run: npm run test:rls. Every case runs in a rolled-back transaction.
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { attempt, createDb } from './harness.mjs';
import { B1, OP, P, S, SEED, U, as, one, service } from './fixtures.mjs';

let db;
before(async () => {
  ({ db } = await createDb());
  await db.exec(SEED);
});

// B1: pending, 2 seats x 1000 = 2000; organizer fee 10% -> 1800 net to organizer O.
const confirm = (d, payment = 'pay_1', amount = 200000, booking = B1) =>
  d.query(`SELECT confirm_booking_payment($1, 'pi_1', $2, $3, 5000, 'return') AS r`, [booking, payment, amount]).then((x) => x.rows[0].r);
const wallet = (d, profile = P.O) => one(d, `SELECT id, available_balance::numeric AS available, escrow_balance::numeric AS escrow FROM user_wallets WHERE user_profile_id = $1`, [profile]);
const drift = (d) => one(d, `SELECT count(*)::int AS n FROM wallet_ledger_drift()`);
const bookingRow = (d, bookingId = B1) => one(d, `SELECT status::text, dispute_status::text FROM bookings WHERE id = $1`, [bookingId]);
const makeDue = (d) => d.query(`UPDATE tour_schedules SET start_date = current_date - 12, end_date = current_date - 10 WHERE id = $1`, [S.s1]);

describe('payment confirmation', () => {
  test('confirms a pending booking and credits the organizer escrow net of the fee', async () => {
    const r = await attempt(db, service, (d) => confirm(d), async (d) => ({
      booking: await bookingRow(d),
      wallet: await wallet(d),
      ledger: await one(d, `SELECT amount::numeric, fee_amount::numeric AS fee, type::text FROM wallet_transactions WHERE reference_id = $1`, [B1]),
      payment: await one(d, `SELECT status FROM booking_payments WHERE provider_payment_id = 'pay_1'`),
      drift: await drift(d),
    }));
    assert.equal(r.error, null);
    assert.equal(r.result, 'confirmed');
    assert.equal(r.verified.booking.status, 'confirmed');
    assert.equal(Number(r.verified.wallet.escrow), 1800);
    assert.deepEqual([Number(r.verified.ledger.amount), Number(r.verified.ledger.fee), r.verified.ledger.type], [1800, 200, 'escrow_deposit']);
    assert.equal(r.verified.payment.status, 'applied');
    assert.equal(r.verified.drift.n, 0);
  });

  test('the same payment is applied only once (success page + webhook race)', async () => {
    const r = await attempt(db, service, async (d) => [await confirm(d), await confirm(d)], async (d) => ({
      wallet: await wallet(d),
      rows: await one(d, `SELECT count(*)::int AS n FROM wallet_transactions WHERE reference_id = $1`, [B1]),
    }));
    assert.deepEqual(r.result, ['confirmed', 'already_applied']);
    assert.equal(Number(r.verified.wallet.escrow), 1800);
    assert.equal(r.verified.rows.n, 1);
  });

  test('a second, different payment is flagged as a duplicate, not credited', async () => {
    const r = await attempt(db, service, async (d) => [await confirm(d), await confirm(d, 'pay_2')],
      (d) => wallet(d));
    assert.deepEqual(r.result, ['confirmed', 'duplicate_payment']);
    assert.equal(Number(r.verified.escrow), 1800);
  });

  test('a payment for the wrong amount does not confirm the booking', async () => {
    const r = await attempt(db, service, (d) => confirm(d, 'pay_3', 100), (d) => bookingRow(d));
    assert.equal(r.result, 'amount_mismatch');
    assert.equal(r.verified.status, 'pending');
  });

  test('a late payment revives an expired booking when seats remain', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE bookings SET status = 'canceled' WHERE id = $1`, [B1]);
      return confirm(d);
    }, (d) => bookingRow(d));
    assert.equal(r.result, 'confirmed');
    assert.equal(r.verified.status, 'confirmed');
  });

  test('a late payment with no seats left is flagged for refund', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE bookings SET status = 'canceled' WHERE id = $1`, [B1]);
      await d.query(`INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount, status) VALUES ($1, $2, 9, 9000, 'confirmed')`, [S.s1, P.T]);
      return confirm(d);
    }, async (d) => ({ booking: await bookingRow(d), payment: await one(d, `SELECT status, review_reason FROM booking_payments WHERE booking_id = $1`, [B1]) }));
    assert.equal(r.result, 'late_payment_needs_refund');
    assert.equal(r.verified.booking.status, 'canceled');
    assert.deepEqual([r.verified.payment.status, r.verified.payment.review_reason], ['needs_review', 'late_payment_needs_refund']);
  });

  test('end users cannot call the confirmation function', async () => {
    const r = await attempt(db, as('T'), (d) => confirm(d));
    assert.match(r.error, /permission denied/);
  });
});

describe('escrow release', () => {
  test('is not released before the holding period ends', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      return (await d.query(`SELECT release_booking_escrow($1) AS r`, [B1])).rows[0].r;
    });
    assert.equal(r.result, 'not_due');
  });

  test('moves escrow to available once, and completes the booking', async () => {
    const r = await attempt(db, service, async (d) => {
      await makeDue(d);
      await confirm(d);
      const first = (await d.query(`SELECT release_booking_escrow($1) AS r`, [B1])).rows[0].r;
      const second = (await d.query(`SELECT release_booking_escrow($1) AS r`, [B1])).rows[0].r;
      return [first, second];
    }, async (d) => ({ wallet: await wallet(d), booking: await bookingRow(d), drift: await drift(d) }));
    assert.equal(r.error, null);
    assert.deepEqual(r.result, ['released', 'not_confirmed']);
    assert.equal(Number(r.verified.wallet.escrow), 0);
    assert.equal(Number(r.verified.wallet.available), 1800);
    assert.equal(r.verified.booking.status, 'completed');
    assert.equal(r.verified.drift.n, 0);
  });

  test('an open dispute blocks release', async () => {
    const r = await attempt(db, service, async (d) => {
      await makeDue(d);
      await confirm(d);
      await d.query(`UPDATE bookings SET dispute_status = 'open' WHERE id = $1`, [B1]);
      return (await d.query(`SELECT release_booking_escrow($1) AS r`, [B1])).rows[0].r;
    });
    assert.equal(r.result, 'disputed');
  });

  test('the cron query lists only due, undisputed, confirmed bookings', async () => {
    const r = await attempt(db, service, async (d) => {
      const before = (await d.query(`SELECT * FROM bookings_due_for_escrow_release()`)).rows.length;
      await makeDue(d);
      await confirm(d);
      const after = (await d.query(`SELECT * FROM bookings_due_for_escrow_release()`)).rows.length;
      return [before, after];
    });
    assert.deepEqual(r.result, [0, 1]);
  });
});

describe('disputes', () => {
  test('only the traveler can open one, once, on a confirmed booking', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      const ok = (await d.query(`SELECT open_booking_dispute($1, $2) AS r`, [B1, P.T])).rows[0].r;
      let again = null;
      try { await d.query('SAVEPOINT s'); await d.query(`SELECT open_booking_dispute($1, $2)`, [B1, P.T]); } catch (e) { again = e.message; await d.query('ROLLBACK TO SAVEPOINT s'); }
      let stranger = null;
      try { await d.query('SAVEPOINT s2'); await d.query(`SELECT open_booking_dispute($1, $2)`, [B1, P.O]); } catch (e) { stranger = e.message; await d.query('ROLLBACK TO SAVEPOINT s2'); }
      return { ok, again, stranger };
    });
    assert.equal(r.result.ok, 'open');
    assert.match(r.result.again, /already open/);
    assert.match(r.result.stranger, /not found/);
  });
});

describe('refunds', () => {
  const begin = (d, amount = null) => d.query(`SELECT begin_booking_refund($1, $2, 'traveler_cancel', $3, 'traveler') AS id`, [B1, amount, P.T]).then((x) => x.rows[0].id);

  test('a full refund reverses the escrow and cancels the booking, exactly once', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      const refundId = await begin(d);
      let doubleBegin = null;
      try { await d.query('SAVEPOINT s'); await begin(d); } catch (e) { doubleBegin = e.message; await d.query('ROLLBACK TO SAVEPOINT s'); }
      const done = (await d.query(`SELECT complete_booking_refund($1, 'ref_1', 'canceled') AS r`, [refundId])).rows[0].r;
      const again = (await d.query(`SELECT complete_booking_refund($1, 'ref_1', 'canceled') AS r`, [refundId])).rows[0].r;
      return { doubleBegin, done, again };
    }, async (d) => ({ wallet: await wallet(d), booking: await bookingRow(d), drift: await drift(d) }));
    assert.equal(r.error, null);
    assert.match(r.result.doubleBegin, /already in progress/);
    assert.deepEqual([r.result.done, r.result.again], ['refunded', 'already_completed']);
    assert.equal(Number(r.verified.wallet.escrow), 0);
    assert.equal(r.verified.booking.status, 'canceled');
    assert.equal(r.verified.drift.n, 0);
  });

  test('a partial refund reverses escrow proportionally', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      const refundId = await begin(d, 500);
      await d.query(`SELECT complete_booking_refund($1, 'ref_2', 'canceled')`, [refundId]);
    }, (d) => wallet(d));
    assert.equal(r.error, null);
    assert.equal(Number(r.verified.escrow), 1350); // 1800 - 1800 * 500/2000
  });

  test('a failed refund can be retried', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      const first = await begin(d);
      await d.query(`SELECT fail_booking_refund($1, 'PayMongo timeout')`, [first]);
      return begin(d);
    });
    assert.equal(r.error, null);
    assert.ok(r.result);
  });

  test('an unpaid booking cannot be refunded', async () => {
    const r = await attempt(db, service, (d) => begin(d));
    assert.match(r.error, /Only confirmed/);
  });

  test('a dispute refund marks the booking refunded and the dispute resolved', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      await d.query(`SELECT open_booking_dispute($1, $2)`, [B1, P.T]);
      const refundId = await begin(d);
      await d.query(`SELECT complete_booking_refund($1, 'ref_3', 'refunded')`, [refundId]);
    }, (d) => bookingRow(d));
    assert.equal(r.error, null);
    assert.deepEqual([r.verified.status, r.verified.dispute_status], ['refunded', 'resolved_refunded']);
  });
});

describe('payouts', () => {
  const METHODS = JSON.stringify([{ id: 'm1', type: 'gcash', isDefault: true, details: { accountName: 'Oscar', accountNumber: '09170000001' } }]);
  // Fund as superuser, then act as the organizer.
  async function asOrganizer(action, verify) {
    await db.exec('BEGIN');
    try {
      await db.query(`SELECT ensure_user_wallet($1)`, [P.O]);
      await db.query(`UPDATE user_wallets SET available_balance = 1000, saved_payout_methods = $2::jsonb WHERE user_profile_id = $1`, [P.O, METHODS]);
      await db.exec(`SET LOCAL ROLE authenticated`);
      await db.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [U.O]);
      const out = [];
      for (const step of action) {
        await db.exec('SAVEPOINT s');
        try { out.push((await db.query(step.sql, step.params)).rows[0]); } catch (e) { out.push({ error: e.message }); await db.exec('ROLLBACK TO SAVEPOINT s'); }
      }
      await db.exec('RESET ROLE');
      return { out, verified: verify ? await verify(db, out) : undefined };
    } finally {
      await db.exec('ROLLBACK');
    }
  }

  test('a partner requests a payout to a saved method; the balance is debited atomically', async () => {
    const r = await asOrganizer([
      { sql: `SELECT request_payout(500, 'm1') AS id` },
      { sql: `SELECT request_payout(600, 'm1') AS id` },      // only 500 left
      { sql: `SELECT request_payout(50, 'm1') AS id` },       // below minimum
      { sql: `SELECT request_payout(100, 'nope') AS id` },    // unknown method
    ], async (d, out) => ({
      wallet: await wallet(d),
      payout: await one(d, `SELECT status::text, amount::numeric, payout_method FROM payout_requests WHERE id = $1`, [out[0].id]),
      drift: await one(d, `SELECT count(*)::int AS n FROM wallet_ledger_drift() WHERE wallet_id = (SELECT id FROM user_wallets WHERE user_profile_id = $1)`, [P.O]),
    }));
    assert.ok(r.out[0].id);
    assert.match(r.out[1].error, /Insufficient/);
    assert.match(r.out[2].error, /Minimum withdrawal/);
    assert.match(r.out[3].error, /saved payout methods/);
    assert.equal(Number(r.verified.wallet.available), 500);
    assert.equal(r.verified.payout.payout_method.account_number, '09170000001');
  });

  test('a traveler without a partner profile cannot request a payout', async () => {
    const r = await attempt(db, as('T'), (d) => d.query(`SELECT request_payout(100, 'm1')`));
    assert.match(r.error, /Only approved organizers and transporters/);
  });

  test('mark paid and reject cannot be replayed, and reject restores the balance', async () => {
    const r = await asOrganizer([{ sql: `SELECT request_payout(500, 'm1') AS id` }, { sql: `SELECT request_payout(300, 'm1') AS id` }],
      async (d, out) => {
        const [paidId, rejectId] = [out[0].id, out[1].id];
        const step = async (sql, params) => {
          await d.query('SAVEPOINT x');
          try { return (await d.query(sql, params)).rows[0]; } catch (e) { await d.query('ROLLBACK TO SAVEPOINT x'); return { error: e.message }; }
        };
        return {
          paid: await step(`SELECT mark_payout_paid($1, $2, 'INSTAPAY-1') AS w`, [paidId, P.O2]),
          paidAgain: await step(`SELECT mark_payout_paid($1, $2, 'INSTAPAY-1') AS w`, [paidId, P.O2]),
          rejectPaid: await step(`SELECT reject_payout($1, $2, 'oops') AS w`, [paidId, P.O2]),
          rejected: await step(`SELECT reject_payout($1, $2, 'Wrong account') AS w`, [rejectId, P.O2]),
          rejectedAgain: await step(`SELECT reject_payout($1, $2, 'Wrong account') AS w`, [rejectId, P.O2]),
          wallet: await wallet(d),
          drift: await one(d, `SELECT count(*)::int AS n FROM wallet_ledger_drift() WHERE wallet_id = (SELECT id FROM user_wallets WHERE user_profile_id = $1)`, [P.O]),
          audit: await one(d, `SELECT count(*)::int AS n FROM admin_audit_logs WHERE entity_type = 'payout'`),
        };
      });
    const v = r.verified;
    assert.ok(v.paid.w);
    assert.match(v.paidAgain.error, /not pending/);
    assert.match(v.rejectPaid.error, /not pending/);
    assert.ok(v.rejected.w);
    assert.match(v.rejectedAgain.error, /not pending/);
    assert.equal(Number(v.wallet.available), 500); // 1000 - 500 paid - 300 + 300 rejected
    assert.equal(v.audit.n, 2);
  });
});

describe('ledger and settings invariants', () => {
  test('ledger rows cannot be edited or deleted, even by the service role', async () => {
    const r = await attempt(db, service, async (d) => {
      await confirm(d);
      await d.query('SAVEPOINT s');
      let update = null;
      try { await d.query(`UPDATE wallet_transactions SET amount = 999999 WHERE reference_id = $1`, [B1]); } catch (e) { update = e.message; await d.query('ROLLBACK TO SAVEPOINT s'); }
      let del = null;
      await d.query('SAVEPOINT s2');
      try { await d.query(`DELETE FROM wallet_transactions WHERE reference_id = $1`, [B1]); } catch (e) { del = e.message; await d.query('ROLLBACK TO SAVEPOINT s2'); }
      return { update, del };
    });
    assert.match(r.result.update, /append-only/);
    assert.match(r.result.del, /append-only/);
  });

  test('fees are snapshotted when a booking is created; travelers cannot choose their own', async () => {
    const r = await attempt(db, as('T'),
      (d) => d.query(`INSERT INTO bookings (tour_schedule_id, traveler_id, seats, total_amount, organizer_fee_percent) VALUES ($1, $2, 1, 1000, 0) RETURNING id`, [S.s1, P.T]),
      (d, res) => one(d, `SELECT organizer_fee_percent::numeric AS fee FROM bookings WHERE id = $1`, [res.rows[0].id]));
    assert.equal(r.error, null);
    assert.equal(Number(r.verified.fee), 10);
  });

  test('settings are bounded and every change is recorded', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query('SAVEPOINT s');
      let bad = null;
      try { await d.query(`UPDATE platform_settings SET organizer_fee_percent = 150`); } catch (e) { bad = e.message; await d.query('ROLLBACK TO SAVEPOINT s'); }
      await d.query(`UPDATE platform_settings SET organizer_fee_percent = 12, updated_by = $1`, [P.O2]);
      return bad;
    }, (d) => one(d, `SELECT count(*)::int AS n, max((new_values ->> 'organizer_fee_percent')::numeric) AS fee FROM platform_settings_history`));
    assert.match(r.result, /platform_settings_bounds/);
    assert.deepEqual([r.verified.n, Number(r.verified.fee)], [1, 12]);
  });

  test('confirmed bookings missing a deposit can be backfilled once', async () => {
    const r = await attempt(db, service, async (d) => {
      await d.query(`UPDATE bookings SET status = 'confirmed' WHERE id = $1`, [B1]);
      const missing = (await d.query(`SELECT booking_id FROM bookings_missing_deposit()`)).rows.map((x) => x.booking_id);
      const first = (await d.query(`SELECT backfill_booking_deposit($1, 'pi_1', 'pay_bf', 200000, 5000) AS r`, [B1])).rows[0].r;
      const second = (await d.query(`SELECT backfill_booking_deposit($1, 'pi_1', 'pay_bf', 200000, 5000) AS r`, [B1])).rows[0].r;
      return { missing, first, second };
    }, (d) => wallet(d));
    assert.deepEqual(r.result.missing, [B1]);
    assert.deepEqual([r.result.first, r.result.second], ['backfilled', 'already_has_deposit']);
    assert.equal(Number(r.verified.escrow), 1800);
  });

  test('organizer O2 is untouched by O’s bookings', async () => {
    const r = await attempt(db, service, (d) => confirm(d), (d) => one(d, `SELECT count(*)::int AS n FROM user_wallets w JOIN organizer_profiles op ON op.user_profile_id = w.user_profile_id WHERE op.id = $1 AND w.escrow_balance <> 0`, [OP.O2]));
    assert.equal(r.verified.n, 0);
  });
});
