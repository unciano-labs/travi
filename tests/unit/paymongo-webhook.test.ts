import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { verifyWebhookSignature } from '@/lib/paymongo';

// lib/paymongo.ts imports ./env, which validates process.env at import time. Unit tests must not
// depend on real secrets (vi.mock is hoisted above the imports).
vi.mock('@/lib/env', () => ({
  env: { PAYMONGO_SECRET_KEY: undefined, PAYMONGO_WEBHOOK_SECRET: 'whsk_test_secret', IS_PRODUCTION_DEPLOY: false },
}));

const SECRET = 'whsk_test_secret';
const BODY = JSON.stringify({ data: { id: 'evt_1', attributes: { type: 'payment.paid', livemode: false } } });
const T = '1761200000';

const sign = (body: string, secret = SECRET, t = T) => createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');

describe('verifyWebhookSignature', () => {
  it('accepts a valid test-mode signature (te=)', () => {
    const header = `t=${T},te=${sign(BODY)},li=`;
    expect(verifyWebhookSignature(BODY, header, SECRET, false)).toBe(true);
  });

  it('accepts a valid live-mode signature (li=)', () => {
    const header = `t=${T},te=,li=${sign(BODY)}`;
    expect(verifyWebhookSignature(BODY, header, SECRET, true)).toBe(true);
  });

  it('tolerates spaces around the header parts', () => {
    const header = ` t=${T} , te=${sign(BODY)} , li=`;
    expect(verifyWebhookSignature(BODY, header, SECRET, false)).toBe(true);
  });

  it('checks the signature that matches the event mode', () => {
    // A valid test signature must not satisfy a live-mode check, and vice versa.
    expect(verifyWebhookSignature(BODY, `t=${T},te=${sign(BODY)},li=`, SECRET, true)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${T},te=,li=${sign(BODY)}`, SECRET, false)).toBe(false);
  });

  it('rejects a tampered body', () => {
    const header = `t=${T},te=${sign(BODY)},li=`;
    const tampered = BODY.replace('payment.paid', 'payment.failed');
    expect(verifyWebhookSignature(tampered, header, SECRET, false)).toBe(false);
    expect(verifyWebhookSignature(`${BODY} `, header, SECRET, false)).toBe(false);
  });

  it('rejects a tampered timestamp', () => {
    const header = `t=1761200001,te=${sign(BODY)},li=`;
    expect(verifyWebhookSignature(BODY, header, SECRET, false)).toBe(false);
  });

  it('rejects a signature made with another secret', () => {
    const header = `t=${T},te=${sign(BODY, 'whsk_other')},li=`;
    expect(verifyWebhookSignature(BODY, header, SECRET, false)).toBe(false);
  });

  it('rejects a signature of the wrong length or case without throwing', () => {
    const good = sign(BODY);
    expect(verifyWebhookSignature(BODY, `t=${T},te=${good.slice(0, -2)},li=`, SECRET, false)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${T},te=${good}00,li=`, SECRET, false)).toBe(false);
    expect(verifyWebhookSignature(BODY, `t=${T},te=${good.toUpperCase()},li=`, SECRET, false)).toBe(false);
  });

  it.each([
    ['missing header', null],
    ['empty header', ''],
    ['no timestamp', `te=${sign(BODY)},li=`],
    ['no signatures', `t=${T}`],
    ['empty test signature', `t=${T},te=,li=${sign(BODY)}`],
    ['garbage', 'not-a-signature'],
  ])('rejects %s', (_label, header) => {
    expect(verifyWebhookSignature(BODY, header, SECRET, false)).toBe(false);
  });

  it('rejects everything when the configured secret is empty and the signature was made with a real one', () => {
    const header = `t=${T},te=${sign(BODY)},li=`;
    expect(verifyWebhookSignature(BODY, header, '', false)).toBe(false);
  });
});
