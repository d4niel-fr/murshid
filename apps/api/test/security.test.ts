import { Hono } from 'hono';
import { sign } from 'hono/jwt';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSeededApp, type CreateAppOptions } from '../src/app';
import { checkClaims, resetJwksCache } from '../src/lib/auth';
import { DEFAULT_LIMITS, Limiter, bucketOf, concurrency, failureOf, limitsWith } from '../src/lib/middleware';
import { clientIpFrom, findBySecret, ipKey, safeEqual, trustFromEnv } from '../src/lib/security';
import { NOW } from './helpers';

const SECRET = 'security-test-secret-0123456789abcdef';
const exp = () => Math.floor(Date.now() / 1000) + 3600;
const tok = (claims: Record<string, unknown>, key = SECRET) => sign({ aud: 'authenticated', role: 'authenticated', exp: exp(), ...claims }, key, 'HS256');

async function app(opts: CreateAppOptions = {}) {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, ...opts });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, headers: res.headers, body: parsed };
  };
  return { ...built, req };
}
const jwtApp = (opts: CreateAppOptions = {}) => app({ ...opts, config: { authMode: 'jwt', jwtSecret: SECRET, ...(opts.config ?? {}) } });

describe('security headers on every API answer', () => {
  afterEach(() => { delete process.env.VERCEL_ENV; });

  it('JSON answers, errors and 404s are not sniffed, framed, cached or given a referrer', async () => {
    const { req } = await app();
    for (const r of [await req('GET', '/plans'), await req('GET', '/nope'), await req('GET', '/me'), await req('POST', '/billing/checkout', {}, { bad: true })]) {
      expect(r.headers.get('x-content-type-options')).toBe('nosniff');
      expect(r.headers.get('referrer-policy')).toBe('no-referrer');
      expect(r.headers.get('content-security-policy')).toContain("default-src 'none'");
      expect(r.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
      expect(r.headers.get('x-frame-options')).toBe('DENY');
      expect(r.headers.get('cross-origin-resource-policy')).toBe('same-origin');
      expect(r.headers.get('cache-control')).toBe('no-store');
      expect(r.headers.get('strict-transport-security')).toBeNull(); // not in development
    }
  });

  it('HSTS (with preload) in production', async () => {
    process.env.VERCEL_ENV = 'production';
    const { req } = await app();
    expect((await req('GET', '/health')).headers.get('strict-transport-security')).toBe('max-age=63072000; includeSubDomains; preload');
  });

  it('file downloads keep their own CSP and cache rules', async () => {
    const { req } = await app();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]).toString('base64');
    const up = await req('POST', '/files', { 'x-dev-user': 'demo-ideal' }, { name: 'a.png', mime: 'image/png', data: png });
    expect(up.status).toBe(201);
    const res = await req('GET', up.body.url);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(res.headers.get('cache-control')).toContain('immutable');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(res.headers.get('cross-origin-resource-policy')).toBe('same-site');
  });
});

describe('secrets are compared in constant time', () => {
  it('safeEqual matches exactly, never on empty or missing values', () => {
    expect(safeEqual('pass', 'pass')).toBe(true);
    expect(safeEqual('pass', 'pas')).toBe(false);
    expect(safeEqual('pass ', 'pass')).toBe(false);
    expect(safeEqual('', '')).toBe(false);
    expect(safeEqual(undefined, 'x')).toBe(false);
    expect(safeEqual('x', undefined)).toBe(false);
  });
  it('findBySecret returns the matching item', () => {
    const items = [{ c: 'AAA' }, { c: null }, { c: 'BBB' }];
    expect(findBySecret(items, (x) => x.c, 'BBB')).toBe(items[2]);
    expect(findBySecret(items, (x) => x.c, 'CCC')).toBeUndefined();
    expect(findBySecret(items, (x) => x.c, '')).toBeUndefined();
  });
});

describe('client IP behind the host', () => {
  const h = (o: Record<string, string>) => (n: string) => o[n];
  it('never trusts cf-connecting-ip unless told to (any client can send it)', () => {
    expect(clientIpFrom(h({ 'cf-connecting-ip': '1.2.3.4' }), null, 'auto')).toBe('unknown');
    expect(clientIpFrom(h({ 'cf-connecting-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }), null, 'vercel')).toBe('9.9.9.9');
    expect(clientIpFrom(h({ 'cf-connecting-ip': '1.2.3.4' }), '5.5.5.5', 'cloudflare')).toBe('1.2.3.4');
  });
  it('on Vercel uses the headers Vercel sets (and overwrites)', () => {
    expect(trustFromEnv({ VERCEL: '1' })).toBe('vercel');
    expect(clientIpFrom(h({ 'x-vercel-forwarded-for': '7.7.7.7', 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '9.9.9.9' }), null, 'vercel')).toBe('7.7.7.7');
    expect(clientIpFrom(h({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '9.9.9.9' }), null, 'vercel')).toBe('8.8.8.8');
  });
  it('prefers the socket address when there is one, and counts proxy hops from the right', () => {
    expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6' }), '::ffff:10.1.2.3', 'auto')).toBe('10.1.2.3');
    expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6' }), '10.1.2.3', 'none')).toBe('10.1.2.3');
    // a client sends a fake first entry; the one proxy we run appended the real address
    expect(clientIpFrom(h({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' }), '10.0.0.1', 1)).toBe('203.0.113.9');
    expect(trustFromEnv({ TRUST_PROXY: '2' })).toBe(2);
    expect(clientIpFrom(h({ 'x-forwarded-for': 'not-an-ip' }), null, 'auto')).toBe('unknown');
  });
  it('groups IPv6 by /64, so rotating addresses inside one network does not dodge limits', () => {
    expect(ipKey('2001:db8:1:2:aaaa::1')).toBe(ipKey('2001:db8:1:2:bbbb:cccc:dddd:eeee'));
    expect(ipKey('2001:db8:1:3::1')).not.toBe(ipKey('2001:db8:1:2::1'));
    expect(ipKey('1.2.3.4')).toBe('1.2.3.4');
  });
});

describe('rate limits', () => {
  it('maps brute-forceable endpoints to tight buckets', () => {
    expect(bucketOf('POST', '/student/classes/join')).toBe('code');
    expect(bucketOf('POST', '/account/link-child')).toBe('code');
    expect(bucketOf('POST', '/account/setup')).toBe('code');
    expect(bucketOf('POST', '/live/rooms/123456/join')).toBe('code');
    expect(bucketOf('POST', '/live/rooms')).toBe('code');
    expect(bucketOf('GET', '/live/rooms/123456')).toBe('live');
    expect(bucketOf('POST', '/live/rooms/123456/answer')).toBe('live');
    expect(bucketOf('POST', '/files')).toBe('upload');
    expect(bucketOf('POST', '/study/generate')).toBe('ai');
    expect(bucketOf('POST', '/study/explain')).toBe('ai');
    expect(bucketOf('POST', '/chat')).toBe('chat');
    expect(bucketOf('POST', '/billing/cancel')).toBe('billing');
    expect(bucketOf('GET', '/auth/microsoft/authorize')).toBe('read');
    expect(bucketOf('POST', '/auth/microsoft/callback')).toBe('auth');
    for (const b of ['code', 'ai', 'upload', 'billing', 'chat'] as const) expect(DEFAULT_LIMITS.user[b]).toBeLessThan(DEFAULT_LIMITS[b]);
  });

  it('a fake cf-connecting-ip per request does not dodge the limit', async () => {
    const { req } = await app({ rateLimit: { read: 2 } });
    expect((await req('GET', '/plans', { 'cf-connecting-ip': '1.1.1.1' })).status).toBe(200);
    expect((await req('GET', '/plans', { 'cf-connecting-ip': '2.2.2.2' })).status).toBe(200);
    expect((await req('GET', '/plans', { 'cf-connecting-ip': '3.3.3.3' })).status).toBe(429);
  });

  it('limits a signed-in person across IPs, after the token is verified', async () => {
    const { req } = await jwtApp({ rateLimit: { user: { read: 2 } } });
    const t = await tok({ sub: 'u-limit', email: 'l@example.com' });
    // forged tokens for the same person are refused and do not use up their allowance
    const forged = await tok({ sub: 'u-limit' }, 'not-the-secret-0123456789abcdefgh');
    for (let i = 0; i < 3; i++) expect((await req('GET', '/account', { authorization: `Bearer ${forged}`, 'x-forwarded-for': `10.9.0.${i}` })).status).toBe(401);
    expect((await req('GET', '/account', { authorization: `Bearer ${t}`, 'x-forwarded-for': '10.0.0.1' })).status).toBe(200);
    expect((await req('GET', '/account', { authorization: `Bearer ${t}`, 'x-forwarded-for': '10.0.0.2' })).status).toBe(200);
    const third = await req('GET', '/account', { authorization: `Bearer ${t}`, 'x-forwarded-for': '10.0.0.3' });
    expect(third.status).toBe(429);
    expect(third.body.code).toBe('rate_limited');
    expect(Number(third.headers.get('retry-after'))).toBeGreaterThan(0);
  });

  it('dev mode limits each demo visitor (demo user + IP), not every visitor of the same demo student together', async () => {
    const { req } = await app({ rateLimit: { user: { read: 2 } } });
    const as = (ip: string) => req('GET', '/dashboard', { 'x-dev-user': 'demo-g11', 'x-forwarded-for': ip });
    expect((await as('10.0.0.1')).status).toBe(200);
    expect((await as('10.0.0.1')).status).toBe(200);
    expect((await as('10.0.0.1')).status).toBe(429);
    expect((await as('10.0.0.2')).status).toBe(200);
  });

  it('locks out an IP after repeated wrong class codes, even for a right code, with Retry-After', async () => {
    const { req } = await app({ rateLimit: { failures: { ...DEFAULT_LIMITS.failures, ip: { ...DEFAULT_LIMITS.failures.ip, code: 3 } } } });
    const join = (code: string, ip = '10.0.0.7') => req('POST', '/student/classes/join', { 'x-dev-user': 'demo-g11', 'x-forwarded-for': ip }, { code });
    for (let i = 0; i < 3; i++) expect((await join(`WRONG${i}`)).status).toBe(404);
    const locked = await join('ANYCODE');
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('locked_out');
    expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(800);
    // another network is not affected
    expect((await join('WRONG9', '10.0.0.8')).status).toBe(404);
  });

  it('locks out a signed-in person guessing parent codes from many IPs', async () => {
    const { req } = await jwtApp({ rateLimit: { failures: { ...DEFAULT_LIMITS.failures, user: { code: 2 } } } });
    const t = await tok({ sub: 'u-parent', email: 'p@example.com' });
    const as = (ip: string, body: unknown) => req('POST', '/account/setup', { authorization: `Bearer ${t}`, 'x-forwarded-for': ip }, body);
    const kid = await tok({ sub: 'u-kid', email: 'k@example.com' });
    await req('POST', '/account/setup', { authorization: `Bearer ${kid}` }, { role: 'student', name: 'Kid', grade: 8 });
    expect((await as('10.1.0.1', { role: 'student', name: 'P', grade: 8, joinCode: 'NOPE-1234' })).status).toBe(400);
    expect((await as('10.1.0.2', { role: 'student', name: 'P', grade: 8, joinCode: 'NOPE-5678' })).status).toBe(400);
    const r = await as('10.1.0.3', { role: 'student', name: 'P', grade: 8 });
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('locked_out');
  });

  it('locks out wrong admin passcodes; students without a passcode are not affected', async () => {
    process.env.ADMIN_PASSCODE = 'right-passcode';
    try {
      const { req } = await app({ rateLimit: { failures: { ...DEFAULT_LIMITS.failures, ip: { ...DEFAULT_LIMITS.failures.ip, passcode: 3 } } } });
      const admin = (p: string) => req('GET', '/admin/overview', { 'x-dev-role': 'admin', 'x-admin-passcode': p, 'x-forwarded-for': '10.2.0.1' });
      for (let i = 0; i < 3; i++) expect((await admin('wrong')).status).toBe(401);
      expect((await admin('right-passcode')).status).toBe(429);
      expect((await req('GET', '/dashboard', { 'x-dev-user': 'demo-g11', 'x-forwarded-for': '10.2.0.1' })).status).toBe(200);
    } finally { delete process.env.ADMIN_PASSCODE; }
  });

  it('counts wrong live quiz host keys and unknown room codes', async () => {
    const { req } = await app({ rateLimit: { failures: { ...DEFAULT_LIMITS.failures, ip: { ...DEFAULT_LIMITS.failures.ip, live: 3 } } } });
    const ip = { 'x-forwarded-for': '10.3.0.1' };
    const room = await req('POST', '/live/rooms', ip, { title: 'Q', questions: [{ prompt: 'a?', options: ['x', 'y'], answer: 0 }] });
    expect(room.status).toBe(201);
    expect((await req('POST', `/live/rooms/${room.body.code}/next`, ip, { hostKey: 'guess-1' })).status).toBe(403);
    expect((await req('GET', '/live/rooms/000001', ip)).status).toBe(404);
    expect((await req('POST', '/live/rooms/000002/join', ip, { name: 'x' })).status).toBe(404);
    expect((await req('POST', `/live/rooms/${room.body.code}/next`, ip, { hostKey: room.body.hostKey })).status).toBe(429);
    // the host key also works in a header (so it does not have to sit in URLs and logs)
    const other = { 'x-forwarded-for': '10.3.0.2' };
    expect((await req('GET', `/live/rooms/${room.body.code}`, { ...other, 'x-live-host': room.body.hostKey })).body.lobby).toEqual([]);
  });

  it('lockouts get longer each time (backoff), up to a ceiling', () => {
    let t = 0;
    const lim = new Limiter(limitsWith({ failures: { windowMs: 60_000, lockMs: 1000, maxLockMs: 3000, ip: DEFAULT_LIMITS.failures.ip, user: {} } }), () => t);
    const strike = () => { lim.fail('k', 2); lim.fail('k', 2); };
    strike(); expect(lim.locked('k')).toBe(1);
    t += 1001; expect(lim.locked('k')).toBe(0);
    strike(); expect(lim.locked('k')).toBe(2);
    t += 2001; strike(); expect(lim.locked('k')).toBe(3);
    t += 3001; strike(); expect(lim.locked('k')).toBe(3); // capped
  });

  it('knows which answers are failed guesses', () => {
    expect(failureOf('POST', '/student/classes/join', 404, undefined)).toBe('code');
    expect(failureOf('POST', '/student/classes/join', 201, undefined)).toBeNull();
    expect(failureOf('GET', '/admin/overview', 401, 'admin_passcode')).toBe('passcode');
    expect(failureOf('POST', '/inbox/email', 401, 'unauthorized')).toBe('secret');
    expect(failureOf('POST', '/billing/cancel', 404, undefined)).toBe('billing');
    expect(failureOf('GET', '/teacher/me', 404, undefined)).toBeNull();
  });

  it('caps requests in flight with 503 + Retry-After', async () => {
    const h = new Hono();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    h.use('*', concurrency(1) as never);
    h.get('/slow', async (c) => { await gate; return c.text('ok'); });
    const first = h.request('/slow');
    const second = await h.request('/slow');
    expect(second.status).toBe(503);
    expect(second.headers.get('retry-after')).toBe('2');
    release();
    expect((await first).status).toBe(200);
    expect((await h.request('/slow')).status).toBe(200);
  });
});

describe('JWT checks', () => {
  afterEach(() => { vi.unstubAllGlobals(); resetJwksCache(); });
  const now = Math.floor(Date.now() / 1000);
  const cfg = { jwtAudience: 'authenticated', jwtIssuer: '' };

  it('requires an expiry and allows 30 s of clock skew, no more', () => {
    const base = { sub: 'u', aud: 'authenticated' };
    expect(checkClaims({ ...base }, cfg, now)).toBe('token has no expiry');
    expect(checkClaims({ ...base, exp: now - 10 }, cfg, now)).toBeNull();
    expect(checkClaims({ ...base, exp: now - 60 }, cfg, now)).toBe('invalid or expired token');
    expect(checkClaims({ ...base, exp: now + 60, nbf: now + 10 }, cfg, now)).toBeNull();
    expect(checkClaims({ ...base, exp: now + 600, nbf: now + 120 }, cfg, now)).toBe('token not valid yet');
    expect(checkClaims({ ...base, exp: now + 600, iat: now + 120 }, cfg, now)).toBe('token issued in the future');
  });

  it('accepts only end-user tokens with the right audience (and issuer when set)', () => {
    const ok = { sub: 'u', aud: 'authenticated', exp: now + 60 };
    expect(checkClaims({ ...ok, role: 'service_role' }, cfg, now)).toBe('not a user token');
    expect(checkClaims({ ...ok, role: 'anon' }, cfg, now)).toBe('not a user token');
    expect(checkClaims({ ...ok, is_anonymous: true }, cfg, now)).toBe('anonymous sign-ins are not accepted');
    expect(checkClaims({ ...ok, aud: ['other', 'authenticated'] }, cfg, now)).toBeNull();
    expect(checkClaims({ ...ok, aud: 'other' }, cfg, now)).toBe('invalid token audience');
    expect(checkClaims({ ...ok, iss: 'https://evil.example/auth/v1' }, { ...cfg, jwtIssuer: 'https://p.supabase.co/auth/v1' }, now)).toBe('invalid token issuer');
    expect(checkClaims({ ...ok, iss: 'https://p.supabase.co/auth/v1' }, { ...cfg, jwtIssuer: 'https://p.supabase.co/auth/v1' }, now)).toBeNull();
  });

  it('refuses tokens without exp, signed service keys, alg none and dev headers in jwt mode', async () => {
    const { req } = await jwtApp();
    const noExp = await sign({ sub: 'u', aud: 'authenticated' }, SECRET, 'HS256');
    expect((await req('GET', '/account', { authorization: `Bearer ${noExp}` })).status).toBe(401);
    const service = await tok({ sub: 'u', role: 'service_role' });
    expect((await req('GET', '/account', { authorization: `Bearer ${service}` })).status).toBe(401);
    const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u', aud: 'authenticated', exp: exp() })}.`;
    expect((await req('GET', '/account', { authorization: `Bearer ${none}` })).status).toBe(401);
    expect((await req('GET', '/account', { 'x-dev-user-id': 'dev-aisha', 'x-dev-role': 'admin' })).status).toBe(401);
    expect((await req('GET', '/admin/overview', { 'x-dev-role': 'admin' })).status).toBe(401);
    expect((await req('GET', '/teacher/me', { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' })).status).toBe(401);
    expect((await req('GET', '/dashboard', { 'x-dev-user': 'demo-g11' })).status).toBe(401);
    expect((await req('GET', '/me/sync?names=study', { 'x-dev-user': 'demo-g11' })).status).toBe(401);
    expect((await req('GET', '/account', { authorization: `Bearer ${await tok({ sub: 'u-ok', email: 'ok@example.com' })}` })).status).toBe(200);
  });

  it('with the project public keys: ES256 works, an HS256 token made with the public key does not (alg confusion)', async () => {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
    const pub = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid: 'k1', alg: 'ES256', use: 'sig' };
    const priv = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid: 'k1', alg: 'ES256' };
    const url = 'https://proj.supabase.co/auth/v1/.well-known/jwks.json';
    const calls: string[] = [];
    vi.stubGlobal('fetch', async (u: string) => { calls.push(String(u)); return new Response(JSON.stringify({ keys: [pub] }), { headers: { 'content-type': 'application/json' } }); });
    const { req } = await app({ config: { authMode: 'jwt', jwtSecret: '', jwksUrl: url } });
    const good = await sign({ sub: 'u-es', email: 'es@example.com', aud: 'authenticated', role: 'authenticated', exp: exp() }, priv as never);
    expect((await req('GET', '/account', { authorization: `Bearer ${good}` })).status).toBe(200);
    expect((await req('GET', '/account', { authorization: `Bearer ${good}` })).status).toBe(200);
    expect(calls.length).toBe(1); // keys are cached, not fetched per request
    const confused = await sign({ sub: 'u-es', aud: 'authenticated', exp: exp() }, JSON.stringify(pub), 'HS256');
    expect((await req('GET', '/account', { authorization: `Bearer ${confused}` })).status).toBe(401);
  });
});
