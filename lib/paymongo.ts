import { createHmac, timingSafeEqual } from 'crypto';
import { env } from './env';

// PayMongo REST client. Amounts here are CENTAVOS (integers); convert from pesos only at the caller
// boundary (AGENTS.md §4.4). Without PAYMONGO_SECRET_KEY (local dev only; production refuses to start
// without it, see lib/env.ts) calls are mocked as successful and flagged with `mock: true`.

const API = 'https://api.paymongo.com/v1';

function authHeader() {
  return `Basic ${Buffer.from(`${env.PAYMONGO_SECRET_KEY}:`).toString('base64')}`;
}

async function paymongo<T = any>(path: string, init: { method?: 'GET' | 'POST'; body?: unknown } = {}): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: authHeader(),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
  if (!response.ok) {
    // PayMongo error bodies can echo request data; keep only the error codes.
    let detail = '';
    try {
      const json = await response.json();
      detail = (json?.errors ?? []).map((e: { code?: string }) => e.code).filter(Boolean).join(', ');
    } catch {
      // non-JSON error body
    }
    throw new Error(`PayMongo ${init.method ?? 'GET'} ${path.split('/')[1]} failed (${response.status}${detail ? `: ${detail}` : ''})`);
  }
  return response.json() as Promise<T>;
}

export interface PaymongoPayment {
  id: string;
  status: string;            // 'paid' | 'failed' | 'pending' | ...
  amount: number | null;     // centavos; null only in mock mode
  fee: number;               // centavos (PayMongo MDR)
  paymentIntentId: string | null;
}

export interface PaymongoIntent {
  id: string;
  status: string;            // 'succeeded' | 'awaiting_payment_method' | 'awaiting_next_action' | 'processing'
  metadata: Record<string, string>;
  payments: PaymongoPayment[];
  mock?: boolean;
}

function toPayment(resource: any): PaymongoPayment {
  const a = resource?.attributes ?? {};
  return {
    id: resource.id,
    status: a.status,
    amount: typeof a.amount === 'number' ? a.amount : null,
    fee: typeof a.fee === 'number' ? a.fee : 0,
    paymentIntentId: a.payment_intent_id ?? null,
  };
}

export async function createPaymentIntent(amountCentavos: number, description: string, metadata: Record<string, string>) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: `pi_mock_${metadata.booking_id ?? Date.now()}`, client_key: 'client_mock', mock: true };
  }

  const json = await paymongo('/payment_intents', {
    method: 'POST',
    body: {
      data: {
        attributes: {
          amount: amountCentavos,
          payment_method_allowed: ['gcash', 'paymaya', 'card'],
          payment_method_options: { card: { request_three_d_secure: 'any' } },
          currency: 'PHP',
          description,
          // Lets the webhook find the booking even if the intent id was never stored.
          metadata,
        },
      },
    },
  });
  return { id: json.data.id as string, client_key: json.data.attributes.client_key as string };
}

export async function createPaymentMethod(type: 'gcash' | 'paymaya', billing?: { email?: string; name?: string }) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: 'pm_mock' };
  }

  const json = await paymongo('/payment_methods', {
    method: 'POST',
    body: { data: { attributes: { type, billing } } },
  });
  return { id: json.data.id as string };
}

export async function attachPaymentIntent(intentId: string, methodId: string, returnUrl: string) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { next_action: { type: 'redirect', redirect: { url: returnUrl } }, status: 'awaiting_next_action' };
  }

  const json = await paymongo(`/payment_intents/${intentId}/attach`, {
    method: 'POST',
    body: { data: { attributes: { payment_method: methodId, return_url: returnUrl } } },
  });
  return {
    next_action: json.data.attributes.next_action,
    status: json.data.attributes.status as string,
  };
}

export async function getPaymentIntent(intentId: string): Promise<PaymongoIntent> {
  if (!env.PAYMONGO_SECRET_KEY) {
    return {
      id: intentId,
      status: 'succeeded',
      metadata: {},
      payments: [{ id: `pay_mock_${intentId}`, status: 'paid', amount: null, fee: 0, paymentIntentId: intentId }],
      mock: true,
    };
  }

  const json = await paymongo(`/payment_intents/${intentId}`);
  const a = json.data.attributes;
  return {
    id: json.data.id,
    status: a.status,
    metadata: a.metadata ?? {},
    payments: (a.payments ?? []).map(toPayment),
  };
}

export async function getPayment(paymentId: string): Promise<PaymongoPayment> {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: paymentId, status: 'paid', amount: null, fee: 0, paymentIntentId: null };
  }
  const json = await paymongo(`/payments/${paymentId}`);
  return toPayment(json.data);
}

export async function createRefund(
  paymentId: string,
  amountCentavos: number,
  reason: 'requested_by_customer' | 'duplicate' | 'fraudulent' | 'others',
  metadata: Record<string, string>
) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: `ref_mock_${paymentId}`, status: 'succeeded', mock: true };
  }

  const json = await paymongo('/refunds', {
    method: 'POST',
    body: { data: { attributes: { amount: amountCentavos, payment_id: paymentId, reason, metadata } } },
  });
  return { id: json.data.id as string, status: json.data.attributes.status as string };
}

/**
 * Verify a PayMongo webhook signature. Header format: `t=<unix>,te=<test sig>,li=<live sig>`.
 * The signature is HMAC-SHA256(secret, `${t}.${rawBody}`) in hex. Must be given the RAW body.
 */
export function verifyWebhookSignature(rawBody: string, header: string | null, secret: string, livemode: boolean) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((part) => {
      const [key, ...rest] = part.split('=');
      return [key.trim(), rest.join('=').trim()];
    })
  );
  const timestamp = parts.t;
  const provided = livemode ? parts.li : parts.te;
  if (!timestamp || !provided) return false;

  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
