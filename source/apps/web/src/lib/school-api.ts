/** Murshid for Schools / licensing endpoints used by the web app (onboarding, plans, School page). */
import { API_BASE } from './api';

/* eslint-disable @typescript-eslint/no-explicit-any */
async function req<T>(path: string, init: { method?: string; body?: unknown; devUser?: string } = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.devUser ? { 'x-dev-user': init.devUser, 'x-dev-user-id': init.devUser } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(json?.error ?? `HTTP ${res.status}`);
  return json as T;
}

export interface Plan { id: string; audience: 'families' | 'schools'; name: string; priceAed: number; per: 'month' | 'student-year'; yearlyAed?: number; rangeAed?: [number, number]; featured: boolean; blurb: string; features: string[] }
export const getPlans = () => req<{ families: Plan[]; schools: Plan[] }>('/plans');
export const getMsAccounts = (org = 'demo-school') => req<{ org: { name: string; domain: string } | null; items: { id: string; name: string; email: string; role: string; code: string }[] }>(`/auth/microsoft/accounts?org=${org}&role=student`);
export const startMs = (org = 'demo-school') => req<{ url: string; state: string }>(`/auth/microsoft/authorize?org=${org}&role=student`);
export const onboard = (body: Record<string, unknown>) => req<any>('/onboarding', { method: 'POST', body });
export const getSchool = (devUser: string) => req<any>('/student/school', { devUser });

/** Fallback plans so the pricing page still renders with the API down (same numbers as the API). */
export const FALLBACK_PLANS: { families: Plan[]; schools: Plan[] } = {
  families: [
    { id: 'family-plus', audience: 'families', name: 'Plus', priceAed: 29, per: 'month', yearlyAed: 249, featured: false, blurb: 'For a parent buying for their child, or a student buying for themselves.', features: ['Weekly plan around classes, sport and exams', 'All homework and tests in one list', 'Progress charts for every subject', 'Opportunities matched to the student', 'Parent summary every week'] },
    { id: 'family-pro', audience: 'families', name: 'Pro', priceAed: 79, per: 'month', yearlyAed: 699, featured: false, blurb: 'Application season: CV, portfolio and university applications.', features: ['Everything in Plus', 'LinkedIn-ready CV and portfolio (PDF)', 'Application tracker with deadlines', 'One human review per term'] },
  ],
  schools: [
    { id: 'school', audience: 'schools', name: 'Murshid for Schools', priceAed: 150, per: 'student-year', rangeAed: [120, 180], featured: true, blurb: 'Your school licenses Murshid for its students. Teachers post work directly or connect Microsoft 365.', features: ['Every student gets Murshid, linked to their school', 'Sign in with Microsoft (Entra ID); Teams classes and assignments sync', 'Teachers post assignments that land in every student\u2019s plan', 'Class progress report with at-risk flags', 'Best day to set homework, with on-time likelihood', 'Automatic weekly report from every student', 'Separate school tenant: school data never mixes with family accounts'] },
  ],
};
