import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context';

/**
 * Cross-cutting API protection: request ids, rate limits, idempotency keys and timeouts.
 * Everything is in memory (one process); behind several instances, put the same limits in the gateway
 * or back these maps with Redis. Errors use the API's usual shape: { error, code, requestId }.
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
export interface Limits { chat: number; write: number; read: number; auth: number; windowMs: number }
export const DEFAULT_LIMITS: Limits = { chat: 30, write: 120, read: 600, auth: 20, windowMs: 60_000 };

const clientIp = (h: (n: string) => string | undefined) =>
  (h('cf-connecting-ip') ?? h('x-real-ip') ?? h('x-forwarded-for')?.split(',')[0] ?? 'local').trim().slice(0, 64);

export function bucketOf(method: string, path: string): keyof Omit<Limits, 'windowMs'> {
  if (/\/chat(\/|$)/.test(path)) return 'chat';
  if (/^\/auth\/|\/onboarding$|\/billing\//.test(path) && method !== 'GET') return 'auth';
  return method === 'GET' || method === 'HEAD' ? 'read' : 'write';
}

/**
 * Fixed-window limits per client IP and bucket (chat, writes, reads, sign-in and checkout). Over the limit: 429 with
 * Retry-After. Every response says how much is left (RateLimit-* headers, IETF draft).
 */
export function rateLimit(limits: Limits = DEFAULT_LIMITS, now: () => number = Date.now): MiddlewareHandler<AppEnv> {
  const hits = new Map<string, { count: number; reset: number }>();
  let sweep = now() + limits.windowMs;
  return async (c, next) => {
    if (c.req.method === 'OPTIONS' || c.req.path === '/health') return next();
    const t = now();
    if (t > sweep) { for (const [k, v] of hits) if (v.reset <= t) hits.delete(k); sweep = t + limits.windowMs; }
    const bucket = bucketOf(c.req.method, c.req.path);
    const key = `${bucket}:${clientIp((n) => c.req.header(n))}`;
    let w = hits.get(key);
    if (!w || w.reset <= t) { w = { count: 0, reset: t + limits.windowMs }; hits.set(key, w); }
    w.count += 1;
    const limit = limits[bucket];
    const resetS = Math.max(1, Math.ceil((w.reset - t) / 1000));
    c.header('RateLimit-Limit', String(limit));
    c.header('RateLimit-Remaining', String(Math.max(0, limit - w.count)));
    c.header('RateLimit-Reset', String(resetS));
    if (w.count > limit) {
      c.header('Retry-After', String(resetS));
      return c.json({ error: 'Too many requests. Please wait a moment and try again.', code: 'rate_limited', retryAfter: resetS, requestId: requestIdOf(c) }, 429);
    }
    await next();
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
export function idempotency(ttlMs = 24 * 3_600_000, max = 5000, now: () => number = Date.now): MiddlewareHandler<AppEnv> {
  const done = new Map<string, Stored>();
  const inFlight = new Set<string>();
  return async (c, next) => {
    const key = c.req.header('idempotency-key');
    if (!key || !['POST', 'PUT', 'PATCH'].includes(c.req.method)) return next();
    if (!/^[\w.:-]{8,200}$/.test(key)) return c.json({ error: 'Idempotency-Key must be 8 to 200 letters, digits or - _ . :', code: 'bad_idempotency_key', requestId: requestIdOf(c) }, 400);
    const who = c.req.header('authorization') ?? c.req.header('x-dev-user') ?? clientIp((n) => c.req.header(n));
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
