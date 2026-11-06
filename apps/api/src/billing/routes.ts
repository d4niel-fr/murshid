import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Api } from '../lib/router';
import type { Ctx } from '../lib/context';
import { verifyStripeSignature, type Stripe } from './stripe';

/**
 * The Single plan: the only plan sold online (schools are set up directly, so POST with plan "school" is refused).
 * Duplicate protection twice over: the Idempotency-Key middleware replays a retried request, and the store refuses a
 * second active plan for the same email (the database enforces the same with a partial unique index).
 */
export const PRICE_AED = { monthly: 29, yearly: 249 } as const;

export interface Subscription {
  orderId: string; email: string; name: string; who: 'parent' | 'student'; studentName: string | null; grade: number; plan: 'single'; billing: 'monthly' | 'yearly'; amountAed: number;
  status: 'active' | 'canceled' | 'past_due'; startedAt: string; renewsAt: string;
  /** real payments: Stripe ids, and who bought it (sign-in user id when signed in) */
  stripe?: { customer: string | null; subscription: string | null; session: string }; reference?: string; cancelAtPeriodEnd?: boolean;
}

export class BillingStore {
  private byOrder = new Map<string, Subscription>();
  /** index: lower-cased email -> active order id (O(1) duplicate check, like the DB's partial unique index) */
  private activeByEmail = new Map<string, string>();
  private seq = 1000;
  /** Stripe checkout session id -> order id (the success page asks by session) */
  private bySession = new Map<string, string>();
  /** Stripe event ids already handled (Stripe can send an event more than once) */
  private seen: string[] = [];
  bySessionId(id: string) { const o = this.bySession.get(id); return o ? this.byOrder.get(o) : undefined; }
  byStripeSubscription(id: string) { return [...this.byOrder.values()].find((s) => s.stripe?.subscription === id); }
  linkSession(session: string, orderId: string) { this.bySession.set(session, orderId); }
  firstTime(eventId: string) { if (this.seen.includes(eventId)) return false; this.seen = [...this.seen.slice(-499), eventId]; return true; }
  active(email: string) { const id = this.activeByEmail.get(email.toLowerCase()); return id ? this.byOrder.get(id) : undefined; }
  get(orderId: string) { return this.byOrder.get(orderId); }
  create(s: Omit<Subscription, 'orderId' | 'status'>): Subscription {
    const sub: Subscription = { ...s, orderId: `MS-${++this.seq}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`, status: 'active' };
    this.byOrder.set(sub.orderId, sub); this.activeByEmail.set(s.email.toLowerCase(), sub.orderId);
    return sub;
  }
  cancel(orderId: string) {
    const s = this.byOrder.get(orderId); if (!s) return undefined;
    s.status = 'canceled'; if (this.activeByEmail.get(s.email.toLowerCase()) === orderId) this.activeByEmail.delete(s.email.toLowerCase());
    return s;
  }
}

const Checkout = z.object({
  plan: z.enum(['single', 'school']),
  billing: z.enum(['monthly', 'yearly']).default('yearly'),
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(160),
  who: z.enum(['parent', 'student']).default('parent'),
  studentName: z.string().trim().min(2).max(80).optional(),
  grade: z.number().int().min(5).max(12),
}).refine((b) => b.who !== 'parent' || Boolean(b.studentName), { message: "studentName is required when a parent buys for their child", path: ['studentName'] });

const Cancel = z.object({ orderId: z.string().min(4).max(40), email: z.string().trim().toLowerCase().email() });

export interface BillingHooks {
  /** real payments: called when a plan starts or ends (turns the buyer's family licence on or off) */
  onChange?: (sub: Subscription) => void;
  /** the signed-in buyer, when there is one */
  who?: (c: Ctx) => Promise<{ authUserId: string; email: string | null } | null>;
}

export function registerBilling(api: Api, store: BillingStore, now: () => Date, stripe: Stripe | null = null, hooks: BillingHooks = {}) {
  api.route({ method: 'post', path: '/billing/checkout', tag: 'billing', auth: 'none', body: Checkout, summary: 'Buy the Single plan (demo: no card is charged). Send an Idempotency-Key so retries are safe.' },
    async (c, { body }) => {
      const b = body as z.output<typeof Checkout>;
      if (b.plan === 'school') throw new HTTPException(403, { message: 'School plans are set up with the school and can’t be bought online.', cause: { code: 'school_plan_offline' } });
      const existing = store.active(b.email);
      if (existing) return c.json({ error: 'An active Single plan already exists for this email.', code: 'already_subscribed', subscription: { orderId: existing.orderId, billing: existing.billing, renewsAt: existing.renewsAt } }, 409);
      if (stripe) {
        // real payment: Stripe hosts the card form; the plan starts when its webhook says the payment went through
        const me = hooks.who ? await hooks.who(c).catch(() => null) : null;
        const reference = me?.authUserId ?? `guest:${b.email}`;
        const session = await stripe.checkout({ billing: b.billing, email: b.email, name: b.name, reference,
          metadata: { who: b.who, name: b.name, studentName: b.studentName ?? '', grade: String(b.grade), billing: b.billing, reference } });
        return c.json({ checkoutUrl: session.url, sessionId: session.id, mode: 'stripe' }, 200);
      }
      const start = now(); const renews = new Date(start); renews.setMonth(renews.getMonth() + (b.billing === 'monthly' ? 1 : 12));
      const sub = store.create({ email: b.email, name: b.name, who: b.who, studentName: b.who === 'parent' ? b.studentName ?? null : null, grade: b.grade, plan: 'single', billing: b.billing, amountAed: PRICE_AED[b.billing], startedAt: start.toISOString(), renewsAt: renews.toISOString() });
      return c.json({ orderId: sub.orderId, plan: sub.plan, billing: sub.billing, amountAed: sub.amountAed, status: sub.status, renewsAt: sub.renewsAt }, 201);
    });
  api.route({ method: 'post', path: '/billing/cancel', tag: 'billing', auth: 'none', body: Cancel, summary: 'Cancel a Single plan (keeps access until the renewal date)' },
    async (c, { body }) => {
      const b = body as z.output<typeof Cancel>;
      const s = store.get(b.orderId);
      if (!s || s.email !== b.email) throw new HTTPException(404, { message: 'No plan found for that order and email.' });
      if (stripe && s.stripe?.subscription) {
        // real plan: Stripe stops renewal at the end of the paid period (access continues until then)
        await stripe.cancelAtPeriodEnd(s.stripe.subscription);
        s.cancelAtPeriodEnd = true;
        return c.json({ orderId: s.orderId, status: s.status, accessUntil: s.renewsAt, cancelAtPeriodEnd: true });
      }
      const done = store.cancel(b.orderId)!;
      return c.json({ orderId: done.orderId, status: done.status, accessUntil: done.renewsAt });
    });

  /* ---------- real payments (Stripe) ---------- */
  api.route({ method: 'get', path: '/billing/session/:id', tag: 'billing', auth: 'none', summary: 'After Stripe checkout: has this payment gone through yet? (the success page asks until it has)' },
    async (c) => {
      const s = store.bySessionId(c.req.param('id') ?? '');
      if (!s) return c.json({ status: 'pending' });
      return c.json({ status: s.status === 'active' ? 'paid' : s.status, orderId: s.orderId, billing: s.billing, amountAed: s.amountAed, renewsAt: s.renewsAt, email: s.email });
    });

  api.route({ method: 'post', path: '/billing/portal', tag: 'billing', auth: 'none', body: Cancel, summary: 'Stripe page to change the card, see invoices or cancel (order id + email)' },
    async (c, { body }) => {
      const b = body as z.output<typeof Cancel>;
      const s = store.get(b.orderId);
      if (!stripe || !s || s.email !== b.email || !s.stripe?.customer) throw new HTTPException(404, { message: 'No card payments found for that order and email.' });
      return c.json({ url: (await stripe.portal(s.stripe.customer)).url });
    });

  api.route({ method: 'post', path: '/billing/stripe-webhook', tag: 'billing', auth: 'custom', summary: 'Stripe events (signed): payment done, plan renewed, payment failed, plan ended' },
    async (c) => {
      if (!stripe) throw new HTTPException(404, { message: 'payments are not set up' });
      const raw = await c.req.text();
      if (!verifyStripeSignature(raw, c.req.header('stripe-signature'), stripe.cfg.webhookSecret)) throw new HTTPException(400, { message: 'bad signature' });
      const event = JSON.parse(raw) as { id: string; type: string; data: { object: Record<string, any> } }; // eslint-disable-line @typescript-eslint/no-explicit-any
      if (!store.firstTime(event.id)) return c.json({ ok: true, duplicate: true });
      const o = event.data.object;
      const iso = (sec: unknown) => (typeof sec === 'number' ? new Date(sec * 1000).toISOString() : null);
      if (event.type === 'checkout.session.completed') {
        if (store.bySessionId(o.id)) return c.json({ ok: true });
        const m = (o.metadata ?? {}) as Record<string, string>;
        const email = String(o.customer_details?.email ?? o.customer_email ?? '').toLowerCase();
        const billing = m.billing === 'monthly' ? 'monthly' : 'yearly';
        const start = now(); const renews = new Date(start); renews.setMonth(renews.getMonth() + (billing === 'monthly' ? 1 : 12));
        const existing = store.active(email);
        const sub = existing ?? store.create({ email, name: m.name || email, who: m.who === 'student' ? 'student' : 'parent', studentName: m.studentName || null, grade: Number(m.grade) || 10, plan: 'single', billing, amountAed: PRICE_AED[billing], startedAt: start.toISOString(), renewsAt: renews.toISOString() });
        sub.stripe = { customer: o.customer ?? null, subscription: o.subscription ?? null, session: o.id };
        sub.reference = o.client_reference_id ?? m.reference;
        store.linkSession(o.id, sub.orderId);
        hooks.onChange?.(sub);
      } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
        const sub = store.byStripeSubscription(o.id);
        if (sub) {
          const ended = event.type === 'customer.subscription.deleted' || o.status === 'canceled' || o.status === 'unpaid';
          if (ended) store.cancel(sub.orderId);
          else { sub.status = o.status === 'past_due' ? 'past_due' : 'active'; sub.cancelAtPeriodEnd = Boolean(o.cancel_at_period_end); }
          const end = iso(o.current_period_end ?? o.items?.data?.[0]?.current_period_end); if (end) sub.renewsAt = end;
          hooks.onChange?.(sub);
        }
      } else if (event.type === 'invoice.payment_failed' || event.type === 'invoice.paid') {
        const sub = typeof o.subscription === 'string' ? store.byStripeSubscription(o.subscription) : undefined;
        if (sub && sub.status !== 'canceled') { sub.status = event.type === 'invoice.paid' ? 'active' : 'past_due'; hooks.onChange?.(sub); }
      }
      return c.json({ ok: true });
    });
}
