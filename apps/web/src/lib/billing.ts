'use client';

import { createLocalStore } from './local-store';
import { PRICES } from './site';

/** The student's plan in the demo. Only the Single plan can be bought online; schools are set up directly. */
export type Billing = 'monthly' | 'yearly';
export interface Subscription { plan: 'single'; billing: Billing; status: 'active' | 'canceled'; startedAt: number; renewsAt: number; email: string; name: string; orderId: string }

export const billingStore = createLocalStore<{ sub: Subscription | null }>('billing', () => ({ sub: null }));
export const useBilling = () => billingStore.use();

export const price = (b: Billing) => (b === 'monthly' ? PRICES.singleMonthly : PRICES.singleYearly);
export const yearlySaving = () => Math.round((1 - PRICES.singleYearly / (PRICES.singleMonthly * 12)) * 100);

export const billing = {
  activate(s: Omit<Subscription, 'status' | 'startedAt' | 'renewsAt'>) {
    const now = Date.now(); const renewsAt = new Date(now); renewsAt.setMonth(renewsAt.getMonth() + (s.billing === 'monthly' ? 1 : 12));
    billingStore.set({ sub: { ...s, status: 'active', startedAt: now, renewsAt: renewsAt.getTime() } });
  },
  cancel() { billingStore.set((st) => (st.sub ? { sub: { ...st.sub, status: 'canceled' } } : st)); },
  resume() { billingStore.set((st) => (st.sub ? { sub: { ...st.sub, status: 'active' } } : st)); },
  clear() { billingStore.set({ sub: null }); },
};
