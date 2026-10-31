import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { stripPrefix } from '../src/lib/mount';
import { NOW } from './helpers';

describe('mounted under /api (Vercel service)', () => {
  it('strips the prefix and keeps the query, method, headers and body', async () => {
    const r = stripPrefix(new Request('https://m.test/api/billing/checkout?x=1', { method: 'POST', headers: { 'idempotency-key': 'k-12345678', 'content-type': 'application/json' }, body: '{"a":1}' }), '/api');
    expect(new URL(r.url).pathname).toBe('/billing/checkout');
    expect(new URL(r.url).search).toBe('?x=1');
    expect(r.method).toBe('POST');
    expect(r.headers.get('idempotency-key')).toBe('k-12345678');
    expect(await r.text()).toBe('{"a":1}');
  });
  it('maps /api to / and leaves other paths alone', () => {
    expect(new URL(stripPrefix(new Request('https://m.test/api'), '/api').url).pathname).toBe('/');
    expect(new URL(stripPrefix(new Request('https://m.test/api/'), '/api').url).pathname).toBe('/');
    const plain = new Request('https://m.test/health');
    expect(stripPrefix(plain, '/api')).toBe(plain);
    expect(new URL(stripPrefix(new Request('https://m.test/apiary'), '/api').url).pathname).toBe('/apiary');
  });
  it('serves the real API through the prefix', async () => {
    const { app } = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' } });
    const viaPrefix = await app.fetch(stripPrefix(new Request('http://m.test/api/plans'), '/api'));
    const direct = await app.fetch(new Request('http://m.test/plans'));
    expect(viaPrefix.status).toBe(200);
    expect(await viaPrefix.json()).toEqual(await direct.json());
    expect((await app.fetch(stripPrefix(new Request('http://m.test/api/nope'), '/api'))).status).toBe(404);
  });
});
