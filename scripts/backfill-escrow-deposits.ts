/**
 * Backfill organizer escrow deposits for bookings that were paid but never credited
 * (docs/MVP_LAUNCH_READINESS.md FIN-01: the old success page passed the wrong wallet id).
 *
 * For every confirmed booking without a deposit, the paid payment is fetched from PayMongo and
 * recorded with backfill_booking_deposit() (idempotent; skips amount mismatches).
 *
 * Dry run (default, read-only):   npx tsx scripts/backfill-escrow-deposits.ts
 * Apply:  CONFIRM_DB_WRITE=<project-ref> npx tsx scripts/backfill-escrow-deposits.ts --apply
 *
 * Requires PAYMONGO_SECRET_KEY (refuses to run in mock mode) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
import writeGuard from './lib/write-guard.cjs';

dotenv.config({ path: resolve(process.cwd(), '.env.local') });

const APPLY = process.argv.includes('--apply');
if (APPLY) writeGuard.assertWriteTarget('backfill-escrow-deposits.ts');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const paymongoKey = process.env.PAYMONGO_SECRET_KEY;
if (!url || !serviceKey) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
if (!paymongoKey) throw new Error('PAYMONGO_SECRET_KEY is required: payments must be verified with PayMongo, not mocked');

const supabase = createClient(url, serviceKey);
const auth = `Basic ${Buffer.from(`${paymongoKey}:`).toString('base64')}`;

async function paidPayment(intentId: string) {
  const res = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}`, {
    headers: { accept: 'application/json', authorization: auth },
  });
  if (!res.ok) throw new Error(`PayMongo intent ${intentId}: HTTP ${res.status}`);
  const json = await res.json();
  const payment = (json.data.attributes.payments ?? []).find((p: any) => p.attributes.status === 'paid');
  return payment ? { id: payment.id as string, amount: payment.attributes.amount as number, fee: (payment.attributes.fee ?? 0) as number } : null;
}

async function main() {
  const { data: missing, error } = await supabase.rpc('bookings_missing_deposit');
  if (error) throw error;

  const rows = (missing ?? []) as { booking_id: string; booking_ref: string; status: string; total_amount: number; paymongo_session_id: string | null }[];
  console.log(`${rows.length} paid booking(s) without an organizer deposit. Mode: ${APPLY ? 'APPLY' : 'dry run'}`);

  const summary: Record<string, number> = {};
  const count = (k: string) => (summary[k] = (summary[k] ?? 0) + 1);

  for (const b of rows) {
    if (b.status !== 'confirmed') {
      console.log(`  ${b.booking_ref}: status ${b.status}, needs manual review (completed without a deposit)`);
      count('manual_review');
      continue;
    }
    if (!b.paymongo_session_id?.startsWith('pi_')) {
      console.log(`  ${b.booking_ref}: no PaymentIntent id, needs manual review`);
      count('manual_review');
      continue;
    }

    const payment = await paidPayment(b.paymongo_session_id);
    if (!payment) {
      console.log(`  ${b.booking_ref}: no paid payment on ${b.paymongo_session_id}, needs manual review`);
      count('no_paid_payment');
      continue;
    }

    if (!APPLY) {
      console.log(`  ${b.booking_ref}: would record ${payment.id} (${payment.amount / 100} PHP)`);
      count('would_backfill');
      continue;
    }

    const { data: outcome, error: rpcError } = await supabase.rpc('backfill_booking_deposit', {
      p_booking_id: b.booking_id,
      p_payment_intent_id: b.paymongo_session_id,
      p_provider_payment_id: payment.id,
      p_amount_centavos: payment.amount,
      p_fee_centavos: payment.fee,
    });
    if (rpcError) throw rpcError;
    console.log(`  ${b.booking_ref}: ${outcome}`);
    count(String(outcome));
  }

  console.log('Summary:', summary);
  const { data: drift } = await supabase.rpc('wallet_ledger_drift');
  console.log(`Wallets whose balance != ledger sum: ${drift?.length ?? 0}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
