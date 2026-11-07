/**
 * Small security helpers shared by the API: constant-time comparison of secrets, the real client IP behind the host's
 * proxy, and the security headers every response carries.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';

/* ------------------------------------------------------------------ secrets */

const digest = (s: string) => createHash('sha256').update(s, 'utf8').digest();

/**
 * Compare a secret (passcode, webhook secret, host key, code) in constant time. Both sides are hashed first, so the
 * time does not depend on where they differ or on their lengths. An empty expected value never matches.
 */
export function safeEqual(given: string | null | undefined, expected: string | null | undefined): boolean {
  if (typeof given !== 'string' || typeof expected !== 'string' || !expected) return false;
  return timingSafeEqual(digest(given), digest(expected));
}

/** Find the item whose secret matches, comparing every item in constant time (no early exit that leaks a match). */
export function findBySecret<T>(items: readonly T[], secretOf: (x: T) => string | null | undefined, given: string): T | undefined {
  let hit: T | undefined;
  for (const x of items) if (safeEqual(given, secretOf(x)) && hit === undefined) hit = x;
  return hit;
}

/* ------------------------------------------------------------------ client IP */

/**
 * Which proxy headers to trust for the client IP:
 *  - 'vercel': Vercel's edge overwrites x-forwarded-for, x-real-ip and x-vercel-forwarded-for, so a client cannot fake them.
 *  - 'cloudflare': cf-connecting-ip (only when the origin accepts traffic from Cloudflare alone).
 *  - a number N: N proxies you run (nginx...) each append to x-forwarded-for; the client is the Nth entry from the right.
 *  - 'none': the socket address only (a server reached directly).
 *  - 'auto' (default off Vercel): the socket address when there is one, else x-real-ip / the first x-forwarded-for entry.
 * Never trust cf-connecting-ip by default: any client can send it, and a new value per request would dodge the limits.
 */
export type TrustProxy = 'vercel' | 'cloudflare' | 'none' | 'auto' | number;

export function trustFromEnv(env: Record<string, string | undefined>): TrustProxy {
  const v = (env.TRUST_PROXY ?? '').trim().toLowerCase();
  if (v === 'vercel' || v === 'cloudflare' || v === 'none' || v === 'auto') return v;
  if (/^\d+$/.test(v) && Number(v) > 0) return Number(v);
  return env.VERCEL ? 'vercel' : 'auto';
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;
/** A plain IP (no port, no brackets), or null when the value is not an address. */
export function cleanIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = raw.trim();
  if (s.startsWith('[')) s = s.slice(1, s.indexOf(']') > 0 ? s.indexOf(']') : undefined);
  else if (/^\d{1,3}(\.\d{1,3}){3}:\d+$/.test(s)) s = s.slice(0, s.lastIndexOf(':'));
  if (s.toLowerCase().startsWith('::ffff:') && IPV4.test(s.slice(7))) s = s.slice(7);
  if (IPV4.test(s)) return s;
  if (/^[0-9a-f:]{2,45}$/i.test(s) && s.includes(':')) return s.toLowerCase();
  return null;
}

/** The rate-limit key for an address: IPv6 by /64 (one home or phone gets a whole /64, so single addresses are free to rotate). */
export function ipKey(ip: string): string {
  if (!ip.includes(':')) return ip;
  const [head, tail] = ip.split('::') as [string, string | undefined];
  const left = head ? head.split(':') : [];
  const right = tail !== undefined && tail ? tail.split(':') : [];
  const full = tail === undefined ? left : [...left, ...Array(Math.max(0, 8 - left.length - right.length)).fill('0'), ...right];
  return `${full.slice(0, 4).map((x) => x || '0').join(':')}::/64`;
}

type HeaderFn = (name: string) => string | undefined;
export function clientIpFrom(h: HeaderFn, socketIp: string | null | undefined, trust: TrustProxy): string {
  const xff = (h('x-forwarded-for') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  let ip: string | null = null;
  if (trust === 'vercel') ip = cleanIp(h('x-vercel-forwarded-for')?.split(',')[0]) ?? cleanIp(h('x-real-ip')) ?? cleanIp(xff[0]);
  else if (trust === 'cloudflare') ip = cleanIp(h('cf-connecting-ip')) ?? cleanIp(socketIp);
  else if (typeof trust === 'number') ip = cleanIp(xff[xff.length - trust]) ?? cleanIp(socketIp);
  else if (trust === 'none') ip = cleanIp(socketIp);
  else ip = cleanIp(socketIp) ?? cleanIp(h('x-real-ip')) ?? cleanIp(xff[0]);
  return ip ?? 'unknown';
}

/** The client's address for this request (see TrustProxy). */
export function clientIp(c: Context, trust: TrustProxy): string {
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined;
  return clientIpFrom((n) => c.req.header(n), env?.incoming?.socket?.remoteAddress, trust);
}

/* ------------------------------------------------------------------ headers */

/** JSON answers are data, never a page: nothing loads, nothing frames it. */
export const API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";

/**
 * Security headers on every API response. A route that set its own (file downloads set their CSP and cache rules)
 * keeps them; the rest get safe defaults. HSTS only in production, where the API is always behind HTTPS.
 */
export function securityHeaders(opts: { hsts?: boolean } = {}): MiddlewareHandler {
  return async (c, next) => {
    await next();
    const h = c.res.headers;
    const set = (k: string, v: string) => { if (!h.has(k)) h.set(k, v); };
    const file = (h.get('content-disposition') ?? '').length > 0 && !(h.get('content-type') ?? '').includes('json');
    try {
      set('x-content-type-options', 'nosniff');
      set('referrer-policy', 'no-referrer');
      set('content-security-policy', API_CSP);
      // files may be shown inside the apps (same site); everything else is never framed or embedded
      set('x-frame-options', file ? 'SAMEORIGIN' : 'DENY');
      set('cross-origin-resource-policy', file ? 'same-site' : 'same-origin');
      set('x-permitted-cross-domain-policies', 'none');
      // personal data: browsers and shared caches must not keep API answers
      set('cache-control', 'no-store');
      if (opts.hsts) set('strict-transport-security', 'max-age=63072000; includeSubDomains; preload');
    } catch {
      // a response with immutable headers (rare: a proxied fetch) keeps what it has
    }
  };
}
