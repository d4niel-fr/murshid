/**
 * Real payments for the Single plan with Stripe (on when STRIPE_SECRET_KEY is set; otherwise the demo checkout
 * takes no money). Stripe hosts the card form, so card numbers never reach Murshid.
 *
 *   POST /billing/checkout        -> a Stripe Checkout link (subscription, AED, monthly or yearly)
 *   POST /billing/stripe-webhook  -> Stripe tells us a payment went through or a plan ended (signed, verified)
 *   POST /billing/portal          -> a link to Stripe's page to change card, see invoices or cancel
 *
 * Env: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_MONTHLY / STRIPE_PRICE_YEARLY (price ids; without them
 * the price is sent inline: AED 29 a month or AED 249 a year), PUBLIC_WEB_URL (where Stripe sends people back).
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface StripeConfig { secretKey: string; webhookSecret: string; priceMonthly?: string; priceYearly?: string; webUrl: string }

export function stripeFromEnv(env: Record<string, string | undefined>): StripeConfig | null {
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) return null;
  return {
    secretKey, webhookSecret: env.STRIPE_WEBHOOK_SECRET?.trim() ?? '', priceMonthly: env.STRIPE_PRICE_MONTHLY?.trim() || undefined, priceYearly: env.STRIPE_PRICE_YEARLY?.trim() || undefined,
    webUrl: (env.PUBLIC_WEB_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/+$/, ''),
  };
}

/** Stripe's API takes form-encoded bodies with bracketed keys (line_items[0][price]). */
export function form(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => { if (typeof x === 'object' && x) out.push(...form(x as Record<string, unknown>, `${key}[${i}]`)); else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`); });
    else if (typeof v === 'object') out.push(...form(v as Record<string, unknown>, key));
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out;
}

export class Stripe {
  constructor(readonly cfg: StripeConfig, private f: FetchLike = fetch) {}
  private async call<T>(path: string, body?: Record<string, unknown>, method = 'POST'): Promise<T> {
    const res = await this.f(`https://api.stripe.com/v1${path}`, {
      method, headers: { authorization: `Bearer ${this.cfg.secretKey}`, 'content-type': 'application/x-www-form-urlencoded', 'stripe-version': '2024-06-20' },
      body: body ? form(body).join('&') : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } } & T;
    if (!res.ok) throw new Error(`Stripe: ${json.error?.message ?? res.status}`);
    return json;
  }

  checkout(input: { billing: 'monthly' | 'yearly'; email: string; name: string; reference: string; metadata: Record<string, string> }) {
    const price = input.billing === 'monthly' ? this.cfg.priceMonthly : this.cfg.priceYearly;
    const line = price
      ? { price, quantity: 1 }
      : { quantity: 1, price_data: { currency: 'aed', unit_amount: input.billing === 'monthly' ? 2900 : 24900, recurring: { interval: input.billing === 'monthly' ? 'month' : 'year' }, product_data: { name: 'Murshid Single plan' } } };
    return this.call<{ id: string; url: string }>('/checkout/sessions', {
      mode: 'subscription', customer_email: input.email, client_reference_id: input.reference, line_items: [line],
      success_url: `${this.cfg.webUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${this.cfg.webUrl}/checkout?canceled=1`,
      allow_promotion_codes: 'true', billing_address_collection: 'auto', locale: 'auto',
      metadata: input.metadata, subscription_data: { metadata: input.metadata },
    });
  }

  portal(customer: string) {
    return this.call<{ url: string }>('/billing_portal/sessions', { customer, return_url: `${this.cfg.webUrl}/app/settings#plan` });
  }

  cancelAtPeriodEnd(subscription: string) {
    return this.call<{ id: string; current_period_end?: number }>(`/subscriptions/${encodeURIComponent(subscription)}`, { cancel_at_period_end: 'true' });
  }
}

/**
 * Check a webhook really came from Stripe: the Stripe-Signature header carries a timestamp and an HMAC of
 * "<timestamp>.<raw body>" with the webhook secret; old timestamps are refused so a captured call can't be replayed.
 */
export function verifyStripeSignature(raw: string, header: string | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]).filter(([k]) => k === 't'));
  const t = Number(parts.t);
  const sigs = header.split(',').filter((p) => p.startsWith('v1=')).map((p) => p.slice(3));
  if (!Number.isFinite(t) || !sigs.length || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const e = Buffer.from(expected, 'hex');
  return sigs.some((s) => { const b = Buffer.from(s, 'hex'); return b.length === e.length && timingSafeEqual(b, e); });
}
