import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { captureException, logger } from '@/lib/logger';

// Scheduled by vercel.json (daily). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 60;

function isAuthorizedCron(authHeader: string | null) {
  if (!env.CRON_SECRET || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(authHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Release organizer escrow for trips that ended more than `escrow_holding_days` ago (Manila dates)
 * and have no open dispute. Each booking is released by release_booking_escrow(), which locks the
 * booking, moves escrow -> available with matching ledger rows in one transaction, and is idempotent,
 * so overlapping or repeated runs are safe.
 *
 * Transport payouts are not processed here: transport is coordination-only until quotes and
 * organizer-approved prices exist (docs/MVP_LAUNCH_READINESS.md decision D2, task 2.12).
 */
export async function GET(request: Request) {
  // Fail closed: with no secret configured, nobody can run the job.
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service role: escrow release is a system money operation (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const outcomes: Record<string, number> = {};
  const failures: string[] = [];

  try {
    const { data: due, error: dueError } = await admin.rpc('bookings_due_for_escrow_release');
    if (dueError) throw dueError;

    for (const bookingId of (due ?? []) as string[]) {
      const { data, error } = await admin.rpc('release_booking_escrow', { p_booking_id: bookingId });
      if (error) {
        failures.push(bookingId);
        captureException(error, { action: 'escrow-release booking', bookingId });
        continue;
      }
      const outcome = String(data);
      outcomes[outcome] = (outcomes[outcome] ?? 0) + 1;
      if (outcome === 'no_deposit') {
        // Paid booking with no organizer deposit: needs scripts/backfill-escrow-deposits.ts.
        captureException(new Error('Confirmed booking has no escrow deposit'), { action: 'escrow-release', bookingId });
      }
    }

    // Invariant: every wallet balance equals the sum of its ledger rows.
    const { data: drift, error: driftError } = await admin.rpc('wallet_ledger_drift');
    if (driftError) throw driftError;
    if (drift && drift.length > 0) {
      captureException(new Error(`Wallet ledger drift on ${drift.length} wallet(s)`), {
        action: 'escrow-release drift check',
        wallets: (drift as { wallet_id: string }[]).map((w) => w.wallet_id),
      });
    }

    logger.info({ outcomes, failures: failures.length, driftWallets: drift?.length ?? 0 }, 'escrow-release run');
    return NextResponse.json({ success: true, outcomes, failures: failures.length, driftWallets: drift?.length ?? 0 });
  } catch (error: unknown) {
    captureException(error, { action: 'escrow-release' });
    return NextResponse.json({ success: false, error: 'Escrow release failed' }, { status: 500 });
  }
}
