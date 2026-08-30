import { env } from './env';

export interface PaymongoCheckoutPayload {
  amount: number; // in cents (e.g. 10000 for PHP 100)
  description: string;
  reference_number: string;
  success_url: string;
  cancel_url: string;
  customer_email?: string;
  customer_name?: string;
}

export async function createCheckoutSession(payload: PaymongoCheckoutPayload) {
  if (!env.PAYMONGO_SECRET_KEY) {
    console.warn('PAYMONGO_SECRET_KEY is missing. Simulating successful checkout creation.');
    return {
      checkout_url: payload.success_url, // For local dev, just redirect to success
      reference_number: payload.reference_number
    };
  }

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          line_items: [
            {
              currency: 'PHP',
              amount: payload.amount,
              description: payload.description,
              name: payload.description,
              quantity: 1
            }
          ],
          payment_method_types: ['gcash', 'paymaya', 'card'],
          reference_number: payload.reference_number,
          success_url: payload.success_url,
          cancel_url: payload.cancel_url,
          ...(payload.customer_email || payload.customer_name ? {
            billing: {
              email: payload.customer_email,
              name: payload.customer_name
            }
          } : {})
        }
      }
    })
  };

  const response = await fetch('https://api.paymongo.com/v1/checkout_sessions', options);
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Paymongo API Error:', errorText);
    throw new Error('Failed to create Paymongo checkout session');
  }

  const json = await response.json();
  return {
    checkout_url: json.data.attributes.checkout_url,
    reference_number: payload.reference_number,
    session_id: json.data.id
  };
}

export async function verifyCheckoutSession(sessionId: string) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { status: 'paid' };
  }

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    }
  };

  const response = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, options);
  
  if (!response.ok) {
    throw new Error('Failed to retrieve Paymongo checkout session');
  }

  const json = await response.json();
  const payments = json.data.attributes.payments;
  
  if (payments && payments.length > 0) {
    // Check if any payment is paid
    const isPaid = payments.some((p: any) => p.attributes.status === 'paid');
    if (isPaid) return { status: 'paid' };
  }

  return { status: 'pending' };
}

export async function createPaymentIntent(amount: number, description: string) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: 'pi_test_123', client_key: 'client_123' };
  }

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          amount,
          payment_method_allowed: ['gcash', 'paymaya', 'card'],
          payment_method_options: { card: { request_three_d_secure: 'any' } },
          currency: 'PHP',
          description
        }
      }
    })
  };

  const response = await fetch('https://api.paymongo.com/v1/payment_intents', options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Paymongo API Error (Intent):', errorText);
    throw new Error('Failed to create Payment Intent');
  }

  const json = await response.json();
  return {
    id: json.data.id,
    client_key: json.data.attributes.client_key
  };
}

export async function createPaymentMethod(type: 'gcash' | 'paymaya', billing?: any) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { id: 'pm_test_123' };
  }

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          type,
          billing
        }
      }
    })
  };

  const response = await fetch('https://api.paymongo.com/v1/payment_methods', options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Paymongo API Error (Method):', errorText);
    throw new Error('Failed to create Payment Method');
  }

  const json = await response.json();
  return { id: json.data.id };
}

export async function attachPaymentIntent(intentId: string, methodId: string, returnUrl: string) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { next_action: { type: 'redirect', redirect: { url: returnUrl } } };
  }

  const options = {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    },
    body: JSON.stringify({
      data: {
        attributes: {
          payment_method: methodId,
          return_url: returnUrl
        }
      }
    })
  };

  const response = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}/attach`, options);
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Paymongo API Error (Attach):', errorText);
    throw new Error('Failed to attach Payment Method');
  }

  const json = await response.json();
  return {
    next_action: json.data.attributes.next_action,
    status: json.data.attributes.status
  };
}

export async function verifyPaymentIntent(intentId: string) {
  if (!env.PAYMONGO_SECRET_KEY) {
    return { status: 'succeeded' };
  }

  const options = {
    method: 'GET',
    headers: {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    }
  };

  const response = await fetch(`https://api.paymongo.com/v1/payment_intents/${intentId}`, options);
  if (!response.ok) throw new Error('Failed to retrieve Payment Intent');

  const json = await response.json();
  return { status: json.data.attributes.status }; // 'succeeded', 'awaiting_payment_method', 'processing'
}

export async function refundPayment(sessionId: string, amount: number, reason: 'requested_by_customer' | 'fraudulent' | 'duplicate' | 'others' = 'requested_by_customer') {
  if (!env.PAYMONGO_SECRET_KEY) {
    console.warn('PAYMONGO_SECRET_KEY missing. Mocking refund success.');
    return { success: true, refund_id: 'ref_test_123' };
  }

  try {
    let paymentId = '';
    
    const headers = {
      accept: 'application/json',
      authorization: `Basic ${Buffer.from(env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
    };

    if (sessionId.startsWith('pi_')) {
      const intentRes = await fetch(`https://api.paymongo.com/v1/payment_intents/${sessionId}`, { headers });
      const intentJson = await intentRes.json();
      const payments = intentJson.data?.attributes?.payments || [];
      const paidPayment = payments.find((p: any) => p.attributes.status === 'paid');
      if (!paidPayment) throw new Error('No paid payment found on intent.');
      paymentId = paidPayment.id;
    } else {
      const checkoutRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions/${sessionId}`, { headers });
      const checkoutJson = await checkoutRes.json();
      const payments = checkoutJson.data?.attributes?.payments || [];
      const paidPayment = payments.find((p: any) => p.attributes.status === 'paid');
      if (!paidPayment) throw new Error('No paid payment found on checkout session.');
      paymentId = paidPayment.id;
    }

    const refundOptions = {
      method: 'POST',
      headers: {
        ...headers,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: Math.round(amount * 100),
            payment_id: paymentId,
            reason
          }
        }
      })
    };

    const response = await fetch('https://api.paymongo.com/v1/refunds', refundOptions);
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Paymongo Refund Error:', errorText);
      throw new Error('Failed to process Paymongo refund');
    }

    const refundJson = await response.json();
    return { success: true, refund_id: refundJson.data.id };
  } catch (error: any) {
    console.error('refundPayment exception:', error);
    throw new Error('Refund failed: ' + error.message);
  }
}
