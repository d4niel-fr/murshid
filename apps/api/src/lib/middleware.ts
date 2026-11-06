import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context';
import { clientIp, ipKey, type TrustProxy } from './security';

/**
 * Cross-cutting API protection: request ids, rate limits, lockouts, a cap on requests in flight, idempotency keys and
 * timeouts. Everything is in memory (per server copy); volumetric attacks are stopped at the edge (Vercel Firewall,
 * see docs/SECURITY.md). Errors use the API's usual shape: { error, code, requestId }.
 */

const rid = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Every response carries x-request-id (the caller's, if it sent a sane one), so a failure can be traced. */
export const requestId = (): MiddlewareHandler<AppEnv> => async (c, next) => {
  const incoming = c.req.header('x-request-id');
  const id = incoming && /^[\w.-]{6,80}$/.test(incoming) ? incoming : rid();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
};
export const requestIdOf = (c: { get: (k: 'requestId') => string }) => c.get('requestId') || undefined;

/* ---------------------------------------------------------------- rate limiting */

/**
 * Buckets: reads, writes, chat, sign-in, AI generation, code entry (school / class / parent / live quiz codes),
 * file uploads, billing, and live quiz traffic (players poll every second).
 */
export const BUCKETS = ['read', 'write', 'chat', 'auth', 'ai', 'code', 'upload', 'billing', 'live'] as const;
export type Bucket = (typeof BUCKETS)[number];
/** Endpoints where a wrong guess is a failure that counts towards a lockout. */
export type Family = 'code' | 'live' | 'passcode' | 'secret' | 'billing';

export interface Limits extends Record<Bucket, number> {
  windowMs: number;
  /** per signed-in person (verified token, or the demo user in dev mode), per window; a school shares one IP */
  user: Partial<Record<Bucket, number>>;
  /** failures (wrong codes, passcodes, secrets) allowed per window before a lockout, per IP and per person */
  failures: { windowMs: number; lockMs: number; maxLockMs: number; ip: Record<Family, number>; user: Partial<Record<Family, number>> };
  /** requests handled at once by one server copy; more get 503 + Retry-After */
  maxInFlight: number;
}

/** Per IP per minute (one school's students often share one IP), then per person. */
export const DEFAULT_LIMITS: Limits = {
  windowMs: 60_000,
  read: 3000, write: 600, chat: 120, auth: 30, ai: 120, code: 100, upload: 120, billing: 10, live: 6000,
  user: { read: 300, write: 120, chat: 20, auth: 20, ai: 20, code: 10, upload: 30, billing: 5, live: 600 },
  failures: {
    windowMs: 10 * 60_000, lockMs: 15 * 60_000, maxLockMs: 6 * 3_600_000,
    ip: { code: 30, live: 60, passcode: 15, secret: 10, billing: 10 },
    user: { code: 8 },
  },
  maxInFlight: 500,
};

/** Merge partial limits (tests, env) onto the defaults. */
export function limitsWith(over: Partial<Limits> = {}): Limits {
  return {
    ...DEFAULT_LIMITS, ...over,
    user: { ...DEFAULT_LIMITS.user, ...(over.user ?? {}) },
    failures: { ...DEFAULT_LIMITS.failures, ...(over.failures ?? {}), ip: { ...DEFAULT_LIMITS.failures.ip, ...(over.failures?.ip ?? {}) }, user: { ...DEFAULT_LIMITS.failures.user, ...(over.failures?.user ?? {}) } },
  };
}

const CODE_ROUTES = /^\/(student\/classes\/join|account\/link-child|account\/setup|onboarding)$/;
const AI_ROUTES = /^\/(study\/(generate|explain)|student\/cv\/linkedin|admin\/students\/[^/]+\/linkedin)$/;

export function bucketOf(method: string, path: string): Bucket {
  const write = method !== 'GET' && method !== 'HEAD';
  if (/\/chat(\/|$)/.test(path)) return 'chat';
  if (/^\/live\/rooms/.test(path)) return write && (path === '/live/rooms' || path.endsWith('/join')) ? 'code' : 'live';
  if (!write) return 'read';
  if (/^\/billing\//.test(path)) return 'billing';
  if (CODE_ROUTES.test(path)) return 'code';
  if (AI_ROUTES.test(path)) return 'ai';
  if (path === '/files') return 'upload';
  if (/^\/auth\//.test(path)) return 'auth';
  return 'write';
}

/** The lockout family of an endpoint where a caller could guess (codes, secrets, order ids). */
export function familyOf(method: string, path: string): Family | null {
  if (path === '/inbox/email') return 'secret';
  if (/^\/live\/rooms\/[^/]+/.test(path)) return 'live';
  if (method === 'POST' && path === '/billing/cancel') return 'billing';
  if (method === 'POST' && CODE_ROUTES.test(path)) return 'code';
  return null;
}

/** Whether an answer was a failed guess, and in which family (a wrong admin passcode counts anywhere). */
export function failureOf(method: string, path: string, status: number, code: string | undefined): Family | null {
  if (status === 401 && code === 'admin_passcode') return 'passcode';
  const f = familyOf(method, path);
  if (f === 'secret') return status === 401 ? f : null;
  if (f === 'live') return status === 403 || status === 404 ? f : null;
  if (f === 'billing') return status === 404 ? f : null;
  if (f === 'code') return status === 400 || status === 404 ? f : null;
  return null;
}

interface Window { count: number; reset: number }
interface Lock { fails: number[]; until: number; strikes: number; lastStrike: number }

/** Fixed windows and lockouts, in memory, swept as they expire and capped in size. */
export class Limiter {
  private hits = new Map<string, Window>();
  private locks = new Map<string, Lock>();
  private sweepAt: number;
  constructor(readonly limits: Limits, private now: () => number = Date.now, private maxKeys = 100_000) { this.sweepAt = now() + limits.windowMs; }

  private sweep(t: number) {
    if (t < this.sweepAt && this.hits.size < this.maxKeys) return;
    for (const [k, v] of this.hits) if (v.reset <= t) this.hits.delete(k);
    for (const [k, v] of this.locks) if (v.until <= t && t - (v.fails[v.fails.length - 1] ?? 0) > this.limits.failures.windowMs && t - v.lastStrike > 24 * 3_600_000) this.locks.delete(k);
    // still too many keys (a flood of distinct clients): drop the oldest windows first
    for (const k of this.hits.keys()) { if (this.hits.size <= this.maxKeys) break; this.hits.delete(k); }
    this.sweepAt = t + this.limits.windowMs;
  }

  /** Count one request; returns the limit, what is left and seconds to reset. */
  hit(key: string, limit: number): { ok: boolean; limit: number; remaining: number; resetS: number } {
    const t = this.now(); this.sweep(t);
    let w = this.hits.get(key);
    if (!w || w.reset <= t) { w = { count: 0, reset: t + this.limits.windowMs }; this.hits.set(key, w); }
    w.count += 1;
    return { ok: w.count <= limit, limit, remaining: Math.max(0, limit - w.count), resetS: Math.max(1, Math.ceil((w.reset - t) / 1000)) };
  }

  /** Seconds left on a lockout (0: not locked). */
  locked(key: string): number {
    const l = this.locks.get(key); const t = this.now();
    return l && l.until > t ? Math.ceil((l.until - t) / 1000) : 0;
  }

  /** Record a failed guess; locks the key once it reaches `max` in the window. Each new lockout lasts twice as long. */
  fail(key: string, max: number) {
    const t = this.now(); const f = this.limits.failures;
    const l = this.locks.get(key) ?? { fails: [], until: 0, strikes: 0, lastStrike: 0 };
    l.fails = [...l.fails.filter((x) => t - x < f.windowMs), t];
    if (l.fails.length >= max) {
      if (t - l.lastStrike > 24 * 3_600_000) l.strikes = 0;
      l.strikes += 1; l.lastStrike = t; l.fails = [];
      l.until = t + Math.min(f.maxLockMs, f.lockMs * 2 ** (l.strikes - 1));
    }
    this.locks.set(key, l);
  }
}

const tooMany = (c: Parameters<MiddlewareHandler<AppEnv>>[0], retryAfter: number, code = 'rate_limited', error = 'Too many requests. Please wait a moment and try again.') => {
  c.header('Retry-After', String(retryAfter));
  return c.json({ error, code, retryAfter, requestId: requestIdOf(c) }, 429);
};
const LOCKED = 'Too many wrong tries. Please wait before trying again.';
const BUSY = 'Too many requests. Please wait a moment and try again.';

/** What auth.ts calls once it knows who is asking: null, or why the person must wait. */
export type ChargeUser = (id: string) => { wait: number; code: 'rate_limited' | 'locked_out'; error: string } | null;

/**
 * Fixed-window limits per client IP and bucket, plus per signed-in person (charged once the token is verified, see
 * auth.ts; in dev mode the demo user header, per IP, since every demo visitor uses the same demo students). Wrong
 * guesses on code, passcode and secret endpoints lock the IP (and the person) out for a while, longer each time.
 * Over a limit: 429 with Retry-After. Every response says how much is left (RateLimit-* headers, IETF draft).
 */
export function rateLimit(limits: Limits = DEFAULT_LIMITS, opts: { trust?: TrustProxy; devHeaders?: boolean; now?: () => number } = {}): MiddlewareHandler<AppEnv> {
  const lim = new Limiter(limits, opts.now);
  const trust = opts.trust ?? 'auto';
  return async (c, next) => {
    if (c.req.method === 'OPTIONS' || c.req.path === '/health') return next();
    const path = c.req.path; const method = c.req.method;
    const ip = ipKey(clientIp(c, trust));
    const bucket = bucketOf(method, path);
    const fam = familyOf(method, path);
    // a locked-out IP waits: for the family it was guessing at, and for anything that sends an admin passcode
    const famWait = fam ? lim.locked(`lock:${fam}:ip:${ip}`) : 0;
    if (famWait) return tooMany(c, famWait, 'locked_out', LOCKED);
    const passWait = c.req.header('x-admin-passcode') !== undefined ? lim.locked(`lock:passcode:ip:${ip}`) : 0;
    if (passWait) return tooMany(c, passWait, 'locked_out', LOCKED);

    const r = lim.hit(`${bucket}:ip:${ip}`, limits[bucket]);
    c.header('RateLimit-Limit', String(r.limit));
    c.header('RateLimit-Remaining', String(r.remaining));
    c.header('RateLimit-Reset', String(r.resetS));
    if (!r.ok) return tooMany(c, r.resetS);

    let who: string | null = null;
    const charge: ChargeUser = (id) => {
      if (who) return null; // once per request (sign-in can be checked more than once)
      who = id.slice(0, 160);
      const fl = fam ? limits.failures.user[fam] : undefined;
      const wait = fam && fl ? lim.locked(`lock:${fam}:user:${who}`) : 0;
      if (wait) return { wait, code: 'locked_out', error: LOCKED };
      const max = limits.user[bucket];
      if (max === undefined) return null;
      const u = lim.hit(`${bucket}:user:${who}`, max);
      return u.ok ? null : { wait: u.resetS, code: 'rate_limited', error: BUSY };
    };
    c.set('chargeUser', charge);
    if (opts.devHeaders && !c.req.header('authorization')) {
      const dev = c.req.header('x-dev-user') ?? c.req.header('x-dev-user-id');
      const over = dev ? charge(`dev:${dev}@${ip}`) : null;
      if (over) return tooMany(c, over.wait, over.code, over.error);
    }

    await next();

    // count wrong guesses (read the error code from a copy, so the body still goes out)
    const status = c.res.status;
    if (status < 400 || status >= 500 || status === 429) return;
    let code: string | undefined;
    if (status === 401) { try { code = ((await c.res.clone().json()) as { code?: string }).code; } catch { /* not JSON */ } }
    const f = failureOf(method, path, status, code);
    if (!f) return;
    lim.fail(`lock:${f}:ip:${ip}`, limits.failures.ip[f]);
    const ul = limits.failures.user[f];
    if (who && ul) lim.fail(`lock:${f}:user:${who}`, ul);
  };
}

/** At most `max` requests in flight on this server copy; the rest get 503 with Retry-After (a busy server, not a client fault). */
export function concurrency(max: number): MiddlewareHandler<AppEnv> {
  let inFlight = 0;
  return async (c, next) => {
    if (inFlight >= max) {
      c.header('Retry-After', '2');
      return c.json({ error: 'The server is busy. Please try again in a moment.', code: 'busy', requestId: requestIdOf(c) }, 503);
    }
    inFlight += 1;
    try { await next(); } finally { inFlight -= 1; }
  };
}

/* ---------------------------------------------------------------- idempotency */
interface Stored { hash: string; status: number; body: string; type: string; at: number }

async function sha(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Idempotency-Key for writes: the first request runs; a retry with the same key and body gets the stored response
 * (Idempotent-Replayed: true) instead of running again. Same key, different body: 422. Still running: 409.
 * Keys are scoped per method, path and caller, and kept for 24 hours.
 */
export function idempotency(ttlMs = 24 * 3_600_000, max = 5000, now: () => number = Date.now, trust: TrustProxy = 'auto'): MiddlewareHandler<AppEnv> {
  const done = new Map<string, Stored>();
  const inFlight = new Set<string>();
  return async (c, next) => {
    const key = c.req.header('idempotency-key');
    if (!key || !['POST', 'PUT', 'PATCH'].includes(c.req.method)) return next();
    if (!/^[\w.:-]{8,200}$/.test(key)) return c.json({ error: 'Idempotency-Key must be 8 to 200 letters, digits or - _ . :', code: 'bad_idempotency_key', requestId: requestIdOf(c) }, 400);
    const who = c.req.header('authorization') ?? c.req.header('x-dev-user') ?? clientIp(c, trust);
    const scope = `${c.req.method} ${c.req.path} ${await sha(who)} ${key}`;
    const hash = await sha(await c.req.text());
    const t = now();
    const prev = done.get(scope);
    if (prev && t - prev.at < ttlMs) {
      if (prev.hash !== hash) return c.json({ error: 'This Idempotency-Key was already used for a different request.', code: 'idempotency_mismatch', requestId: requestIdOf(c) }, 422);
      return new Response(prev.body, { status: prev.status, headers: { 'content-type': prev.type, 'idempotent-replayed': 'true', 'x-request-id': requestIdOf(c) ?? '' } });
    }
    if (inFlight.has(scope)) return c.json({ error: 'The same request is still being processed.', code: 'idempotency_in_flight', requestId: requestIdOf(c) }, 409);
    inFlight.add(scope);
    try {
      await next();
      // store successes and client errors (a retry would fail the same way); not 5xx, which may be transient
      if (c.res.status < 500) {
        const body = await c.res.clone().text();
        if (done.size >= max) { const oldest = done.keys().next().value; if (oldest) done.delete(oldest); }
        done.set(scope, { hash, status: c.res.status, body, type: c.res.headers.get('content-type') ?? 'application/json', at: t });
      }
    } finally { inFlight.delete(scope); }
  };
}

/* ---------------------------------------------------------------- timeouts */
/** Answers 504 if a handler takes longer than `ms` (streams such as /chat are exempt: they report progress as they go). */
export function timeout(ms = 15_000): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (/\/chat(\/|$)/.test(c.req.path) || c.req.header('accept')?.includes('text/event-stream')) return next();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<'late'>((res) => { timer = setTimeout(() => res('late'), ms); });
    try {
      const r = await Promise.race([next().then(() => 'ok' as const), late]);
      if (r === 'late') return c.json({ error: 'The server took too long to answer. Please try again.', code: 'timeout', requestId: requestIdOf(c) }, 504);
    } finally { clearTimeout(timer); }
  };
}
