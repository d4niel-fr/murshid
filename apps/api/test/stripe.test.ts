import { createHmac } from 'node:crypto';
import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { form, Stripe, verifyStripeSignature } from '../src/billing/stripe';
import { NOW } from './helpers';

const SECRET = 'jwt-secret'; const WH = 'whsec_test';
const token = (sub: string, email: string) => sign({ sub, email, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET, 'HS256');
const signed = (body: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', WH).update(`${t}.${body}`).digest('hex')}`;

async function setup() {
  const calls: { url: string; body: string }[] = [];
  const fake = async (url: string, init?: RequestInit) => { calls.push({ url, body: String(init?.body ?? '') }); return new Response(JSON.stringify(url.includes('checkout/sessions') ? { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' } : { id: 'sub_1', url: 'https://billing.stripe.com/p/session/x' }), { status: 200 }); };
  const stripe = new Stripe({ secretKey: 'sk_test_x', webhookSecret: WH, webUrl: 'https://murshid.example' }, fake);
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'jwt', jwtSecret: SECRET }, stripe, rateLimit: false });
  const req = async (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined && typeof body !== 'string' ? { 'content-type': 'application/json' } : {}) }, body: typeof body === 'string' ? body : body !== undefined ? JSON.stringify(body) : undefined });
    const t = await res.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; } return { status: res.status, body: j };
  };
  return { built, req, calls };
}

describe('real payments with Stripe', () => {
  it('checkout sends people to Stripe; the signed webhook starts the plan and turns the family licence on', async () => {
    const { req, calls, built } = await setup();
    const tok = await token('u-mum', 'mum@example.com');
    await req('POST', '/account/setup', { role: 'parent', name: 'Rania Ali' }, { authorization: `Bearer ${tok}` });
    const co = await req('POST', '/billing/checkout', { plan: 'single', billing: 'monthly', name: 'Rania Ali', email: 'mum@example.com', who: 'parent', studentName: 'Maya Ali', grade: 8 }, { authorization: `Bearer ${tok}` });
    expect(co.status).toBe(200);
    expect(co.body.checkoutUrl).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    const sent = decodeURIComponent(calls[0]!.body);
    expect(sent).toContain('mode=subscription');
    expect(sent).toContain('line_items[0][price_data][unit_amount]=2900');
    expect(sent).toContain('client_reference_id=u-mum');
    expect((await req('GET', '/billing/session/cs_test_1')).body.status).toBe('pending');

    const event = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', customer: 'cus_1', subscription: 'sub_1', client_reference_id: 'u-mum', customer_details: { email: 'mum@example.com' }, metadata: { billing: 'monthly', who: 'parent', name: 'Rania Ali', studentName: 'Maya Ali', grade: '8' } } } });
    expect((await req('POST', '/billing/stripe-webhook', event, { 'stripe-signature': 'bad' })).status).toBe(400);
    expect((await req('POST', '/billing/stripe-webhook', event, { 'stripe-signature': signed(event) })).status).toBe(200);
    expect((await req('POST', '/billing/stripe-webhook', event, { 'stripe-signature': signed(event) })).body.duplicate).toBe(true);
    const paid = await req('GET', '/billing/session/cs_test_1');
    expect(paid.body).toMatchObject({ status: 'paid', billing: 'monthly', amountAed: 29 });
    const acc = built.schools.accounts.find((a) => a.authUserId === 'u-mum')!;
    expect(built.schools.org(acc.orgId)!.licence!.status).toBe('active');

    // the plan ends: the licence goes back to the trial
    const ended = JSON.stringify({ id: 'evt_2', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', status: 'canceled' } } });
    await req('POST', '/billing/stripe-webhook', ended, { 'stripe-signature': signed(ended) });
    expect(built.schools.org(acc.orgId)!.licence!.status).toBe('trial');
  });

  it('refuses old or forged signatures', () => {
    const body = '{"id":"evt"}';
    expect(verifyStripeSignature(body, signed(body), WH)).toBe(true);
    expect(verifyStripeSignature(body, signed(body, Math.floor(Date.now() / 1000) - 3600), WH)).toBe(false);
    expect(verifyStripeSignature(body, signed(body), 'whsec_other')).toBe(false);
    expect(verifyStripeSignature(body, undefined, WH)).toBe(false);
  });

  it('encodes nested form fields the way Stripe reads them', () => {
    expect(form({ a: 1, b: { c: 'x y' }, d: [{ e: 2 }] })).toEqual(['a=1', 'b%5Bc%5D=x%20y', 'd%5B0%5D%5Be%5D=2']);
  });
});
