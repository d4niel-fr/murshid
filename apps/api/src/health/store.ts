/**
 * Each student's health and activity data from the services they connected: daily steps, active minutes and sleep
 * (kept per source, so two services never count the same steps twice), workouts, and the encrypted tokens.
 * Saved as its own document (see lib/units.ts).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { DayData, OAuthId, ProviderId, Pulled, Tokens, WorkoutData } from './providers';

export interface Conn { provider: ProviderId; connectedAt: string; lastSync: string | null; error: string | null; sealed: string | null; simulated: boolean; account: string | null }
export interface Workout extends WorkoutData { id: string; source: ProviderId; date: string }
export interface Person {
  conns: Partial<Record<ProviderId, Conn>>;
  /** date -> source -> numbers */
  days: Record<string, Partial<Record<ProviderId, DayData>>>;
  workouts: Workout[];
  /** Apple Health shortcut link (only its hash is kept) */
  shortcut: { hash: string; at: string; lastUsed: string | null } | null;
}

export class HealthStore {
  people: Record<string, Person> = {};
  /** OAuth round trips in progress: random state -> who, which service, the PKCE verifier */
  pending: Record<string, { who: string; provider: OAuthId; verifier: string; at: number }> = {};
  /** shortcut link hash -> student */
  shortcuts: Record<string, string> = {};
  /** demo students who already got example data (so deleting it does not bring it back) */
  demoSeeded: Record<string, true> = {};

  person(who: string): Person { return (this.people[who] ??= { conns: {}, days: {}, workouts: [], shortcut: null }); }

  /** Fold a pull or an import into the student's record: that source's days are replaced, workouts added once. */
  merge(who: string, source: ProviderId, data: Pulled, dateOf: (iso: string) => string) {
    const p = this.person(who);
    for (const [date, d] of Object.entries(data.days)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const clean: DayData = {};
      if (d.steps !== undefined && d.steps >= 0 && d.steps < 200_000) clean.steps = Math.round(d.steps);
      if (d.activeMinutes !== undefined && d.activeMinutes >= 0) clean.activeMinutes = Math.min(1440, Math.round(d.activeMinutes));
      if (d.sleepMinutes !== undefined && d.sleepMinutes > 0) clean.sleepMinutes = Math.min(1440, Math.round(d.sleepMinutes));
      if (Object.keys(clean).length) (p.days[date] ??= {})[source] = clean;
    }
    const have = new Set(p.workouts.map((w) => w.id));
    for (const w of data.workouts) {
      const id = `${source}:${w.externalId}`.slice(0, 120);
      if (have.has(id)) continue;
      have.add(id);
      p.workouts.push({ ...w, title: w.title.slice(0, 120), sport: w.sport.slice(0, 40), id, source, date: dateOf(w.start) });
    }
    p.workouts.sort((a, b) => a.start.localeCompare(b.start));
    if (p.workouts.length > 600) p.workouts.splice(0, p.workouts.length - 600);
    const dates = Object.keys(p.days).sort();
    for (const d of dates.slice(0, Math.max(0, dates.length - 400))) delete p.days[d];
  }

  /** Remove one source's numbers and workouts (when it is disconnected). */
  dropSource(who: string, source: ProviderId) {
    const p = this.people[who]; if (!p) return;
    for (const d of Object.values(p.days)) delete d[source];
    p.workouts = p.workouts.filter((w) => w.source !== source);
    delete p.conns[source];
  }

  forget(who: string) {
    const p = this.people[who];
    if (p?.shortcut) delete this.shortcuts[p.shortcut.hash];
    delete this.people[who];
    for (const [k, v] of Object.entries(this.pending)) if (v.who === who) delete this.pending[k];
  }
}

/* ------------------------------------------------------------------ token sealing (AES-256-GCM) */

const keyOf = (secret: string) => createHash('sha256').update(`murshid-health:${secret}`).digest();
export function seal(t: Tokens, secret: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', keyOf(secret), iv);
  const body = Buffer.concat([c.update(JSON.stringify(t), 'utf8'), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]).toString('base64url');
}
export function unseal(s: string, secret: string): Tokens {
  const b = Buffer.from(s, 'base64url');
  const d = createDecipheriv('aes-256-gcm', keyOf(secret), b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28));
  return JSON.parse(Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8')) as Tokens;
}
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
