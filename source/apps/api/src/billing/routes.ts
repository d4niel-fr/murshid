import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Api } from '../lib/router';

/**
 * The Single plan: the only plan sold online (schools are set up directly, so POST with plan "school" is refused).
 * Duplicate protection twice over: the Idempotency-Key middleware replays a retried request, and the store refuses a
 * second active plan for the same email (the database enforces the same with a partial unique index).
 */
export const PRICE_AED = { monthly: 29, yearly: 249 } as const;

export interface Subscription { orderId: string; email: string; name: string; who: 'parent' | 'student'; studentName: string | null; grade: number; plan: 'single'; billing: 'monthly' | 'yearly'; amountAed: number; status: 'active' | 'canceled'; startedAt: string; renewsAt: string }

export class BillingStore {
  private byOrder = new Map<string, Subscription>();
  /** index: lower-cased email -> active order id (O(1) duplicate check, like the DB's partial unique index) */
  private activeByEmail = new Map<string, string>();
  private seq = 1000;
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

export function registerBilling(api: Api, store: BillingStore, now: () => Date) {
  api.route({ method: 'post', path: '/billing/checkout', tag: 'billing', auth: 'none', body: Checkout, summary: 'Buy the Single plan (demo: no card is charged). Send an Idempotency-Key so retries are safe.' },
    async (c, { body }) => {
      const b = body as z.output<typeof Checkout>;
      if (b.plan === 'school') throw new HTTPException(403, { message: 'School plans are set up with the school and can’t be bought online.', cause: { code: 'school_plan_offline' } });
      const existing = store.active(b.email);
      if (existing) return c.json({ error: 'An active Single plan already exists for this email.', code: 'already_subscribed', subscription: { orderId: existing.orderId, billing: existing.billing, renewsAt: existing.renewsAt } }, 409);
      const start = now(); const renews = new Date(start); renews.setMonth(renews.getMonth() + (b.billing === 'monthly' ? 1 : 12));
      const sub = store.create({ email: b.email, name: b.name, who: b.who, studentName: b.who === 'parent' ? b.studentName ?? null : null, grade: b.grade, plan: 'single', billing: b.billing, amountAed: PRICE_AED[b.billing], startedAt: start.toISOString(), renewsAt: renews.toISOString() });
      return c.json({ orderId: sub.orderId, plan: sub.plan, billing: sub.billing, amountAed: sub.amountAed, status: sub.status, renewsAt: sub.renewsAt }, 201);
    });
  api.route({ method: 'post', path: '/billing/cancel', tag: 'billing', auth: 'none', body: Cancel, summary: 'Cancel a Single plan (keeps access until the renewal date)' },
    async (c, { body }) => {
      const b = body as z.output<typeof Cancel>;
      const s = store.get(b.orderId);
      if (!s || s.email !== b.email) throw new HTTPException(404, { message: 'No plan found for that order and email.' });
      const done = store.cancel(b.orderId)!;
      return c.json({ orderId: done.orderId, status: done.status, accessUntil: done.renewsAt });
    });
}
