/** Health and activity in the student app (see the API's health/routes.ts). */
import { request } from './http';
import type { DayIn, WorkoutIn } from './health-import';

const h = (u: string) => ({ 'x-dev-user': u, 'x-dev-user-id': u });
export type ProviderId = 'fitbit' | 'strava' | 'oura' | 'apple' | 'garmin' | 'huawei' | 'samsung' | 'polar' | 'coros' | 'google';
export interface Provider { id: ProviderId; name: string; how: 'oauth' | 'shortcut' | 'via-strava' | 'file'; metrics: string[]; files?: string[]; available: boolean; simulated: boolean; connected: boolean; lastSync: string | null; error: string | null; demo: boolean }
export interface HealthDay { date: string; steps: number | null; activeMinutes: number | null; sleepMinutes: number | null; sources: string[] }
export interface HealthWorkout { id: string; source: ProviderId; sport: string; title: string; start: string; date: string; minutes: number; distanceKm: number | null; calories: number | null }
export interface Health {
  today: string; days: HealthDay[]; goals: { activeMinutes: number; steps: number; sleepMinutes: number; sleepUpTo: number };
  summary: { steps: number | null; activeMinutes: number | null; sleepMinutes: number | null; activeDays: number; streak: number };
  workouts: HealthWorkout[]; providers: Provider[]; shortcut: { set: boolean; at: string | null; lastUsed: string | null };
}
export const getHealth = (u: string, days = 14) => request<Health>(`/me/health?days=${days}`, { headers: h(u) });
export const connectHealth = (u: string, id: ProviderId) => request<{ url?: string; connected?: boolean; simulated?: boolean }>(`/me/health/${id}/connect`, { method: 'POST', headers: h(u) });
export const syncHealth = (u: string, id: ProviderId) => request<{ synced: boolean; lastSync: string | null; error: string | null }>(`/me/health/${id}/sync`, { method: 'POST', headers: h(u), timeoutMs: 30_000 });
export const disconnectHealth = (u: string, id: ProviderId) => request<{ disconnected: true }>(`/me/health/${id}`, { method: 'DELETE', headers: h(u) });
export const importHealth = (u: string, source: ProviderId, days: DayIn[], workouts: WorkoutIn[]) => request<{ days: number; workouts: number }>('/me/health/import', { method: 'POST', body: { source, days, workouts }, headers: h(u), timeoutMs: 30_000 });
export const makeShortcut = (u: string) => request<{ url: string }>('/me/health/apple/shortcut', { method: 'POST', headers: h(u) });
export const deleteHealth = (u: string) => request<{ deleted: true }>('/me/health', { method: 'DELETE', headers: h(u) });
