import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { env } from '@/lib/env';
import { captureException } from '@/lib/logger';
import { getPayment, getPaymentIntent, verifyWebhookSignature } from '@/lib/paymongo';
import { applyPaidPayment } from '@/lib/services/payments';

// PayMongo webhook: a backstop for travelers who pay but never return to the success page.
// Security model (AGENTS.md §5.6): verify the HMAC over the RAW body, then trust nothing in the
// payload except ids, and re-fetch the payment from PayMongo's API before touching money.
export async function POST(req: Request) {
  if (!env.PAYMONGO_WEBHOOK_SECRET) {
    // Fail closed: without the secret we cannot tell real events from forged ones.
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  const livemode = event?.data?.attributes?.livemode === true;
  if (!verifyWebhookSignature(rawBody, req.headers.get('paymongo-signature'), env.PAYMONGO_WEBHOOK_SECRET, livemode)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventId: string | undefined = event?.data?.id;
  const eventType: string | undefined = event?.data?.attributes?.type;
  if (!eventId || !eventType) {
    return NextResponse.json({ received: true });
  }

  // Service role: webhook processing is verified by signature, not by a user session (AGENTS.md §5.3).
  const admin = createAdminClient({ admin: true });

  const { data: seen } = await admin.from('webhook_events').select('id').eq('id', eventId).maybeSingle();
  if (seen) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    let outcome = 'ignored';

    if (eventType === 'payment.paid') {
      const paymentId: string | undefined = event?.data?.attributes?.data?.id;
      if (!paymentId) throw new Error('payment.paid event without a payment id');

      // Re-fetch: amounts and status come from PayMongo's API, never from the event body.
      const payment = await getPayment(paymentId);
      if (payment.status !== 'paid' || !payment.paymentIntentId) {
        outcome = `payment_${payment.status}`;
      } else {
        const bookingId = await findBookingForIntent(admin, payment.paymentIntentId);
        if (!bookingId) {
          outcome = 'unmatched';
          captureException(new Error('PayMongo payment with no matching booking'), { action: 'paymongo webhook', paymentId });
        } else {
          const { data: booking } = await admin.from('bookings').select('total_amount').eq('id', bookingId).single();
          outcome = await applyPaidPayment(
            bookingId,
            payment.paymentIntentId,
            payment,
            Math.round(Number(booking?.total_amount ?? 0) * 100),
            'webhook'
          );
        }
      }
    }

    // Recorded only after the work is durable, so a failure above makes PayMongo retry.
    await admin.from('webhook_events').upsert({ id: eventId, type: eventType, outcome }, { onConflict: 'id', ignoreDuplicates: true });
    return NextResponse.json({ received: true, outcome });
  } catch (error: unknown) {
    captureException(error, { action: 'paymongo webhook', eventId, eventType });
    return NextResponse.json({ error: 'Processing failed' }, { status: 500 });
  }
}

async function findBookingForIntent(admin: ReturnType<typeof createAdminClient>, intentId: string) {
  const { data: byIntent } = await admin.from('bookings').select('id').eq('paymongo_session_id', intentId).maybeSingle();
  if (byIntent?.id) return byIntent.id as string;

  // The traveler may have started a newer intent; the intent's metadata names its booking.
  const intent = await getPaymentIntent(intentId);
  return intent.metadata?.booking_id ?? null;
}
