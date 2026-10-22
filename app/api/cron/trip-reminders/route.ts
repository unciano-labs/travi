import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { captureException, logger } from '@/lib/logger';
import { sendTripReminder, type TripReminderResult } from '@/lib/notifications';

// Scheduled by vercel.json (daily 01:00 UTC = 09:00 Manila). Vercel sends `Authorization: Bearer $CRON_SECRET`.
export const maxDuration = 60;

// Same check as app/api/cron/escrow-release: constant-time, and fails closed without a secret.
function isAuthorizedCron(authHeader: string | null) {
  if (!env.CRON_SECRET || !authHeader) return false;
  const expected = Buffer.from(`Bearer ${env.CRON_SECRET}`);
  const actual = Buffer.from(authHeader);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Trip reminder (BIZ-14): in-app + email to travelers with a confirmed booking whose trip starts in
 * 2 days (Manila dates; trips starting tomorrow are included so a missed run catches up).
 * Idempotent: each booking is reminded once (booking_notifications_sent), so repeated or
 * overlapping runs are safe.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Service role: system job reading bookings across users (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });
  const outcomes: Record<TripReminderResult, number> = { sent: 0, skipped: 0, failed: 0 };

  try {
    const { data: due, error } = await admin.rpc('bookings_due_for_trip_reminder');
    if (error) throw error;

    for (const bookingId of (due ?? []) as string[]) {
      outcomes[await sendTripReminder(bookingId)] += 1;
    }

    logger.info({ outcomes }, 'trip-reminders run');
    return NextResponse.json({ success: true, outcomes });
  } catch (error: unknown) {
    captureException(error, { action: 'trip-reminders' });
    return NextResponse.json({ success: false, error: 'Trip reminders failed' }, { status: 500 });
  }
}
