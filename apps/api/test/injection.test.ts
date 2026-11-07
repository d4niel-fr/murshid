import { mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { assertKey, FileBackend, MemoryBackend, SupabaseBackend } from '../src/lib/durable';
import { toCsv } from '../src/schools/classroom';
import { jsonShapeOk } from '../src/v1/sync';

describe('saved-state keys cannot reach a query or a path they should not', () => {
  it('only plain keys are accepted', () => {
    for (const k of ['demo', 'live:123456', 'user:3f1c-uuid:study', 'user:dev:demo-g11@1.2.3.4:notes']) expect(assertKey(k)).toBe(k);
    for (const k of ['', '../etc/passwd', 'a/b', 'a\\b', 'x"),key.neq.(', 'a*', 'a%', 'a b', 'x'.repeat(201)]) expect(() => assertKey(k), k).toThrow();
  });

  it('the file backend keeps every document inside its folder', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'murshid-state-'));
    const fb = new FileBackend(dir);
    await expect(fb.save('../escape', { x: 1 }, 0)).rejects.toThrow();
    await expect(fb.load(['..%2Fescape'])).rejects.toThrow();
    expect((await fb.save('user:abc:study', { x: 1 }, 0)).ok).toBe(true);
    expect(await readdir(dir)).toEqual(['user%3Aabc%3Astudy.json']);
  });

  it('PostgREST filters are built from checked keys only', async () => {
    const urls: string[] = [];
    const sb = new SupabaseBackend('https://p.supabase.co', 'service-key', 'murshid_state', async (u) => { urls.push(String(u)); return new Response('[]', { status: 200 }); });
    await sb.versions(['demo', 'live:123456']);
    expect(decodeURIComponent(urls[0]!)).toContain('key=in.("demo","live:123456")');
    await expect(sb.load(['a"),or=(key.neq.x'])).rejects.toThrow('bad state key');
    await expect(sb.list('user:x*')).rejects.toThrow('bad state key');
    expect(urls.length).toBe(1);
    await expect(new MemoryBackend().save('a/b', {}, 0)).rejects.toThrow();
  });
});

describe('device sync input', () => {
  it('refuses odd demo user ids and deeply nested documents', async () => {
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const put = (who: string, data: unknown) => app.request('/me/sync/study', { method: 'PUT', headers: { 'content-type': 'application/json', 'x-dev-user': who }, body: JSON.stringify({ base: 0, data }) });
    expect((await put('demo-g11', { notes: [] })).status).toBe(200);
    expect((await put('x*', {})).status).toBe(400);
    expect((await put('a:b/c', {})).status).toBe(400);
    let deep: unknown = 1; for (let i = 0; i < 60; i++) deep = [deep];
    const r = await put('demo-g9', deep);
    expect(r.status).toBe(400);
    expect(((await r.json()) as { code: string }).code).toBe('too_deep');
    expect(jsonShapeOk({ a: [{ b: 1 }] })).toBe(true);
    expect(jsonShapeOk(Array.from({ length: 50 }, () => 1), 32, 10)).toBe(false);
  });
});

describe('CSV exports', () => {
  it('cells that look like formulas are shown as text', () => {
    const csv = toCsv([['=HYPERLINK("http://x")', '+1', '-2', '@SUM(A1)', '\t=1+1', '\r=1', 'plain', 42]]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(csv).toContain(`"'+1"`);
    expect(csv).toContain(`"'@SUM(A1)"`);
    expect(csv).toContain(`"'\t=1+1"`);
    expect(csv).toContain(',plain,42');
  });
});
