/**
 * Health and activity (see providers.ts):
 *
 *   GET    /me/health                     my numbers by day, workouts, and every source with its status
 *   POST   /me/health/:provider/connect   Fitbit, Strava, Oura: the page to approve Murshid (demo: connects simulated data)
 *   GET    /health/callback/:provider     the service sends the student back here; tokens are kept encrypted
 *   POST   /me/health/:provider/sync      pull the last fortnight again
 *   DELETE /me/health/:provider           disconnect (asks the service to forget Murshid) and remove that source's data
 *   POST   /me/health/import              numbers read from a file on the student's device (Apple Health export, GPX, TCX, CSV)
 *   POST   /me/health/apple/shortcut      a private link for the iPhone Shortcut (shown once); again = a new link
 *   POST   /health/ingest/:token          what the Shortcut sends each day
 *   DELETE /me/health                     delete all of it
 *
 * Students only: parents and teachers never see these numbers.
 */
import { randomBytes } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { addDays, dubaiDate } from '../lib/time';
import type { DemoView } from '../v1/store';
import { authorizeUrl, exchange, OAUTH_IDS, pkce, PROVIDER_IDS, PROVIDERS, pull, revoke, simulated, sportOf, type DayData, type HealthConfig, type OAuthId, type ProviderId, type Pulled, type Tokens } from './providers';
import { hashToken, seal, unseal, type HealthStore } from './store';

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), 'a date and time');
const Workout = z.object({
  id: z.string().trim().max(80).optional(), sport: z.string().trim().max(40).default('other'), title: z.string().trim().max(120).optional(),
  start: iso, minutes: z.number().min(1).max(1440), distanceKm: z.number().min(0).max(1000).nullable().optional(), calories: z.number().min(0).max(20_000).nullable().optional(),
});
const Day = z.object({ date, steps: z.number().int().min(0).max(200_000).optional(), activeMinutes: z.number().min(0).max(1440).optional(), sleepMinutes: z.number().min(0).max(1440).optional() });
export const HealthSchemas = {
  Query: z.object({ days: z.coerce.number().int().min(7).max(90).default(14) }),
  Provider: z.enum(PROVIDER_IDS),
  Import: z.object({ source: z.enum(PROVIDER_IDS), days: z.array(Day).max(400).default([]), workouts: z.array(Workout).max(1000).default([]) })
    .refine((b) => b.days.length + b.workouts.length > 0, 'nothing to import'),
  Ingest: z.object({
    date: date.optional(), steps: z.number().min(0).max(200_000).optional(), activeMinutes: z.number().min(0).max(1440).optional(), sleepMinutes: z.number().min(0).max(1440).optional(),
    workouts: z.array(Workout).max(50).default([]),
  }),
};

interface Helpers { view: (c: Ctx) => Promise<DemoView>; cfg: HealthConfig; fetch?: FetchLike }

export function registerHealth(api: Api, health: HealthStore, h: Helpers) {
  const { cfg } = h; const f = h.fetch ?? fetch;
  const dateOf = (s: string) => dubaiDate(new Date(s));
  const dev = (c: Ctx) => c.get('deps').config.authMode === 'dev';
  const ready = (id: OAuthId) => Boolean(cfg.oauth[id] && cfg.tokenKey);

  /** The signed-in student. Parents see their child's planner, but not this. */
  async function me(c: Ctx): Promise<{ who: string; v: DemoView }> {
    const whoami = c.get('deps').whoami;
    if (whoami && !(dev(c) && !c.req.header('authorization'))) {
      const m = await whoami(c);
      if (m.role === 'parent') throw new HTTPException(403, { message: 'health and activity data stays with your child', cause: { code: 'health_private' } });
    }
    const v = await h.view(c);
    return { who: v.profile.id, v };
  }
  const oauthOf = (c: Ctx): OAuthId => {
    const p = c.req.param('provider') as OAuthId;
    if (!OAUTH_IDS.includes(p)) throw new HTTPException(400, { message: 'this service connects with a file or through Strava, not a sign-in', cause: { code: 'not_oauth' } });
    return p;
  };
  /** A fresh access token (refreshed and re-sealed when it has expired). */
  async function access(who: string, id: OAuthId): Promise<string> {
    const conn = health.person(who).conns[id];
    if (!conn?.sealed || !cfg.tokenKey) throw new HTTPException(409, { message: 'connect first', cause: { code: 'not_connected' } });
    let t: Tokens = unseal(conn.sealed, cfg.tokenKey);
    if (t.expiresAt - 60_000 < Date.now() && t.refresh) {
      const fresh = await exchange(cfg, id, { refresh: t.refresh }, f);
      t = { ...fresh, refresh: fresh.refresh ?? t.refresh, account: fresh.account ?? t.account };
      conn.sealed = seal(t, cfg.tokenKey);
    }
    return t.access;
  }
  async function syncOne(who: string, id: ProviderId, now: Date, days = 21) {
    const p = health.person(who); const conn = p.conns[id]; if (!conn) return;
    try {
      const data: Pulled = conn.simulated ? simulated(id, who, now, days) : await pull(id as OAuthId, await access(who, id as OAuthId), days, now, f);
      health.merge(who, id, data, dateOf);
      conn.lastSync = now.toISOString(); conn.error = null;
    } catch (e) {
      if (e instanceof HTTPException) throw e;
      conn.error = (e as Error).message.slice(0, 200);
    }
  }

  api.route({ method: 'get', path: '/me/health', tag: 'health', auth: 'custom', query: HealthSchemas.Query, summary: 'My steps, active minutes, sleep and workouts by day, and each connected source' },
    async (c, { query }) => {
      const { who, v } = await me(c); const today = dubaiDate(v.now); const n = (query as { days: number }).days;
      const p = health.people[who];
      const days = Array.from({ length: n }, (_, i) => {
        const d = addDays(today, i - n + 1); const src = p?.days[d] ?? {};
        const pick = (k: keyof DayData) => { const xs = Object.values(src).map((x) => x?.[k]).filter((x): x is number => typeof x === 'number'); return xs.length ? Math.max(...xs) : null; };
        return { date: d, steps: pick('steps'), activeMinutes: pick('activeMinutes'), sleepMinutes: pick('sleepMinutes'), sources: Object.keys(src) };
      });
      const grade = v.profile.grade ?? 10;
      const goals = { activeMinutes: 60, steps: 10_000, sleepMinutes: grade <= 6 ? 9 * 60 : 8 * 60, sleepUpTo: grade <= 6 ? 12 * 60 : 10 * 60 };
      const week = days.slice(-7);
      const avg = (xs: (number | null)[]) => { const ys = xs.filter((x): x is number => x !== null); return ys.length ? Math.round(ys.reduce((t, x) => t + x, 0) / ys.length) : null; };
      let streak = 0;
      for (let i = days.length - 1; i >= 0; i--) { const a = days[i]!.activeMinutes; if (a !== null && a >= goals.activeMinutes) streak++; else if (i !== days.length - 1) break; }
      return c.json({
        today, days, goals,
        summary: { steps: avg(week.map((d) => d.steps)), activeMinutes: avg(week.map((d) => d.activeMinutes)), sleepMinutes: avg(week.map((d) => d.sleepMinutes)), activeDays: week.filter((d) => (d.activeMinutes ?? 0) >= goals.activeMinutes).length, streak },
        workouts: (p?.workouts ?? []).slice(-60).reverse(),
        providers: PROVIDERS.map((x) => {
          const conn = p?.conns[x.id];
          return { ...x, available: x.how !== 'oauth' || ready(x.id as OAuthId) || dev(c), simulated: x.how === 'oauth' && !ready(x.id as OAuthId), connected: Boolean(conn), lastSync: conn?.lastSync ?? null, error: conn?.error ?? null, demo: conn?.simulated ?? false };
        }),
        shortcut: p?.shortcut ? { set: true, at: p.shortcut.at, lastUsed: p.shortcut.lastUsed } : { set: false, at: null, lastUsed: null },
      });
    });

  api.route({ method: 'post', path: '/me/health/:provider/connect', tag: 'health', auth: 'custom', summary: 'Start connecting Fitbit, Strava or Oura (returns the page to approve Murshid); in the demo, connects sample data' },
    async (c) => {
      const { who, v } = await me(c); const id = oauthOf(c);
      if (!ready(id)) {
        if (!dev(c)) throw new HTTPException(503, { message: `${PROVIDERS.find((x) => x.id === id)!.name} is not set up on this Murshid yet`, cause: { code: 'provider_not_configured' } });
        health.person(who).conns[id] = { provider: id, connectedAt: v.now.toISOString(), lastSync: null, error: null, sealed: null, simulated: true, account: null };
        await syncOne(who, id, v.now);
        return c.json({ connected: true, simulated: true });
      }
      const { verifier, challenge } = pkce();
      const state = randomBytes(24).toString('base64url');
      const now = Date.now();
      for (const [k, x] of Object.entries(health.pending)) if (now - x.at > 15 * 60_000) delete health.pending[k];
      health.pending[state] = { who, provider: id, verifier, at: now };
      return c.json({ url: authorizeUrl(cfg, id, state, challenge) });
    });

  api.route({ method: 'get', path: '/health/callback/:provider', tag: 'health', auth: 'none', durable: 'late', summary: 'Where Fitbit, Strava and Oura send the student back after they approve (or decline) Murshid' },
    async (c) => {
      const back = (q: string) => c.redirect(`${cfg.webUrl}/app/health?${q}`, 302);
      const id = c.req.param('provider') as OAuthId;
      const state = c.req.query('state') ?? ''; const code = c.req.query('code') ?? '';
      const p = health.pending[state];
      if (!OAUTH_IDS.includes(id) || !p || p.provider !== id) return back('error=expired');
      delete health.pending[state];
      if (Date.now() - p.at > 15 * 60_000) return back('error=expired');
      if (c.req.query('error') || !code || code.length > 2000) return back(`error=declined&provider=${id}`);
      // Strava lets people untick activity access: without it there is nothing to read
      if (id === 'strava' && !/activity:read/.test(c.req.query('scope') ?? '')) return back('error=scope&provider=strava');
      try {
        const t = await exchange(cfg, id, { code, verifier: p.verifier }, f);
        health.person(p.who).conns[id] = { provider: id, connectedAt: new Date().toISOString(), lastSync: null, error: null, sealed: seal(t, cfg.tokenKey!), simulated: false, account: t.account };
        await syncOne(p.who, id, c.get('deps').now());
        return back(`connected=${id}`);
      } catch (e) {
        console.error('[health] connect failed', id, (e as Error).message);
        return back(`error=failed&provider=${id}`);
      }
    });

  api.route({ method: 'post', path: '/me/health/:provider/sync', tag: 'health', auth: 'custom', durable: 'late', summary: 'Pull the last three weeks from a connected service again' },
    async (c) => {
      const { who, v } = await me(c); const id = oauthOf(c);
      const conn = health.person(who).conns[id];
      if (!conn) throw new HTTPException(409, { message: 'connect first', cause: { code: 'not_connected' } });
      if (conn.lastSync && Date.now() - Date.parse(conn.lastSync) < 60_000) return c.json({ synced: false, lastSync: conn.lastSync, error: conn.error });
      await syncOne(who, id, v.now);
      return c.json({ synced: !conn.error, lastSync: conn.lastSync, error: conn.error });
    });

  api.route({ method: 'delete', path: '/me/health/:provider', tag: 'health', auth: 'custom', summary: 'Disconnect a source and delete what came from it' },
    async (c) => {
      const { who } = await me(c);
      const id = HealthSchemas.Provider.safeParse(c.req.param('provider'));
      if (!id.success) throw new HTTPException(404, { message: 'unknown service' });
      const p = health.person(who); const conn = p.conns[id.data];
      if (conn?.sealed && cfg.tokenKey && OAUTH_IDS.includes(id.data as OAuthId)) await revoke(cfg, id.data as OAuthId, unseal(conn.sealed, cfg.tokenKey), f).catch(() => undefined);
      if (id.data === 'apple' && p.shortcut) { delete health.shortcuts[p.shortcut.hash]; p.shortcut = null; }
      health.dropSource(who, id.data);
      return c.json({ disconnected: true });
    });

  api.route({ method: 'post', path: '/me/health/import', tag: 'health', auth: 'custom', body: HealthSchemas.Import, summary: 'Add numbers read from a file on my device (Apple Health export, GPX, TCX, CSV): only totals are sent' },
    async (c, { body }) => {
      const { who, v } = await me(c); const b = body as z.output<typeof HealthSchemas.Import>;
      const data: Pulled = {
        days: Object.fromEntries(b.days.map((d) => [d.date, { steps: d.steps, activeMinutes: d.activeMinutes, sleepMinutes: d.sleepMinutes }])),
        workouts: b.workouts.map((w) => ({ externalId: w.id || `${w.start}|${w.sport}`, sport: sportOf(w.sport), title: w.title || w.sport, start: new Date(w.start).toISOString(), minutes: Math.round(w.minutes), distanceKm: w.distanceKm ?? null, calories: w.calories ?? null })),
      };
      health.merge(who, b.source, data, dateOf);
      const p = health.person(who);
      const conn = (p.conns[b.source] ??= { provider: b.source, connectedAt: v.now.toISOString(), lastSync: null, error: null, sealed: null, simulated: false, account: null });
      conn.lastSync = v.now.toISOString();
      return c.json({ days: b.days.length, workouts: b.workouts.length });
    });

  api.route({ method: 'post', path: '/me/health/apple/shortcut', tag: 'health', auth: 'custom', summary: 'A private link for the iPhone Shortcut that sends Apple Health numbers (shown once; asking again replaces it)' },
    async (c) => {
      const { who, v } = await me(c); const p = health.person(who);
      if (p.shortcut) delete health.shortcuts[p.shortcut.hash];
      const token = randomBytes(24).toString('base64url');
      const hash = hashToken(token);
      p.shortcut = { hash, at: v.now.toISOString(), lastUsed: null };
      health.shortcuts[hash] = who;
      p.conns.apple ??= { provider: 'apple', connectedAt: v.now.toISOString(), lastSync: null, error: null, sealed: null, simulated: false, account: null };
      return c.json({ url: `${cfg.apiUrl}/health/ingest/${token}` }, 201);
    });

  api.route({ method: 'post', path: '/health/ingest/:token', tag: 'health', auth: 'none', body: HealthSchemas.Ingest, summary: 'From the iPhone Shortcut: today’s (or a given day’s) steps, active minutes, sleep and workouts' },
    async (c, { body }) => {
      const token = c.req.param('token') ?? '';
      // only the hash is stored, so a lookup by hash is as safe as comparing secrets
      const who = token.length >= 20 && token.length <= 80 ? health.shortcuts[hashToken(token)] : undefined;
      if (!who) throw new HTTPException(401, { message: 'this link is no longer valid: make a new one in Murshid', cause: { code: 'bad_link' } });
      const b = body as z.output<typeof HealthSchemas.Ingest>; const now = c.get('deps').now();
      const day = b.date ?? dubaiDate(now);
      if (day > addDays(dubaiDate(now), 1) || day < addDays(dubaiDate(now), -60)) throw new HTTPException(400, { message: 'the date must be within the last 60 days' });
      health.merge(who, 'apple', {
        days: { [day]: { steps: b.steps, activeMinutes: b.activeMinutes, sleepMinutes: b.sleepMinutes } },
        workouts: b.workouts.map((w) => ({ externalId: w.id || `${w.start}|${w.sport}`, sport: sportOf(w.sport), title: w.title || w.sport, start: new Date(w.start).toISOString(), minutes: Math.round(w.minutes), distanceKm: w.distanceKm ?? null, calories: w.calories ?? null })),
      }, dateOf);
      const p = health.person(who);
      if (p.shortcut) p.shortcut.lastUsed = now.toISOString();
      const conn = p.conns.apple; if (conn) conn.lastSync = now.toISOString();
      return c.json({ ok: true, date: day });
    });

  api.route({ method: 'delete', path: '/me/health', tag: 'health', auth: 'custom', summary: 'Delete all my health and activity data and disconnect every service' },
    async (c) => {
      const { who } = await me(c); const p = health.people[who];
      for (const id of OAUTH_IDS) { const conn = p?.conns[id]; if (conn?.sealed && cfg.tokenKey) await revoke(cfg, id, unseal(conn.sealed, cfg.tokenKey), f).catch(() => undefined); }
      health.forget(who);
      return c.json({ deleted: true });
    });
}
