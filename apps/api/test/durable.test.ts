import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { decode, Durable, encode, FileBackend, MemoryBackend, MemoryBlobs, SupabaseBackend, type StateBackend } from '../src/lib/durable';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const AHAMED = { 'x-dev-user': 'demo-ideal' };
const CLASS = 'cls-eng-11ab';
const today = dubaiDate(NOW);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');

/** One "server": its own memory, sharing saved state (and file bytes) with the others. */
async function server(backend: StateBackend, blobs = new MemoryBlobs()) {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, stateBackend: backend, blobs, rateLimit: false });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
  return { req, built };
}
const postBody = (title: string) => ({ title, instructions: 'Read chapter 4 and write five key points.', dueDate: addDays(today, 3) });

describe('saved state shared by several servers', () => {
  it('what one server saves, another sees, and a restart keeps', async () => {
    const backend = new MemoryBackend();
    const a = await server(backend); const b = await server(backend);
    const posted = await a.req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, postBody('Chapter 4 notes'));
    expect(posted.status).toBe(201);
    const onB = await b.req('GET', '/student/school', AHAMED);
    expect(JSON.stringify(onB.body)).toContain('Chapter 4 notes');
    const restarted = await server(backend);
    const list = await restarted.req('GET', `/teacher/classes/${CLASS}/assignments`, THOMAS);
    expect(JSON.stringify(list.body)).toContain('Chapter 4 notes');
  });

  it('two servers writing at once both keep their change (the later one re-runs on fresh data)', async () => {
    const backend = new MemoryBackend();
    const a = await server(backend); const b = await server(backend);
    // both load the same version, then write in parallel
    await Promise.all([a.req('GET', `/teacher/classes/${CLASS}/assignments`, THOMAS), b.req('GET', `/teacher/classes/${CLASS}/assignments`, THOMAS)]);
    const [x, y] = await Promise.all([
      a.req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, postBody('Essay plan')),
      b.req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, postBody('Poetry quiz')),
    ]);
    expect([x.status, y.status]).toEqual([201, 201]);
    const c = await server(backend);
    const all = JSON.stringify((await c.req('GET', `/teacher/classes/${CLASS}/assignments`, THOMAS)).body);
    expect(all).toContain('Essay plan');
    expect(all).toContain('Poetry quiz');
    // and each exactly once
    expect(all.split('Essay plan').length - 1).toBe(1);
  });

  it('a request that fails half way leaves nothing half-saved', async () => {
    const backend = new MemoryBackend();
    const a = await server(backend);
    const bad = await a.req('POST', `/teacher/classes/${CLASS}/assignments`, THOMAS, { ...postBody('Bad'), studentIds: ['nobody'] });
    expect(bad.status).toBe(400);
    const saved = (await backend.load(['schools'])).schools;
    expect(JSON.stringify(saved ?? {})).not.toContain('"Bad"');
  });

  it('a file uploaded through one server downloads from another', async () => {
    const backend = new MemoryBackend(); const blobs = new MemoryBlobs();
    const a = await server(backend, blobs); const b = await server(backend, blobs);
    const up = await a.req('POST', '/files', AHAMED, { name: 'page.jpg', mime: 'image/jpeg', data: JPEG });
    expect(up.status).toBe(201);
    const res = await b.built.app.request(up.body.url);
    expect(res.status).toBe(200);
    expect(Buffer.from(await res.arrayBuffer()).length).toBe(22);
  });

  it('a live quiz works when the host and players reach different servers', async () => {
    const backend = new MemoryBackend();
    const a = await server(backend); const b = await server(backend);
    const made = await a.req('POST', '/live/rooms', {}, { title: 'Forces', questions: [{ prompt: 'p = ?', options: ['mv', 'ma'], answer: 0 }] });
    const { code, hostKey } = made.body;
    const p1 = await b.req('POST', `/live/rooms/${code}/join`, {}, { name: 'Aisha' });
    const p2 = await a.req('POST', `/live/rooms/${code}/join`, {}, { name: 'Krish' });
    expect([p1.status, p2.status]).toEqual([201, 201]);
    expect((await a.req('GET', `/live/rooms/${code}?host=${hostKey}`)).body.lobby).toEqual(['Aisha', 'Krish']);
    await b.req('POST', `/live/rooms/${code}/next`, {}, { hostKey });
    await Promise.all([a.req('POST', `/live/rooms/${code}/answer`, {}, { player: p1.body.player, choice: 0 }), b.req('POST', `/live/rooms/${code}/answer`, {}, { player: p2.body.player, choice: 1 })]);
    const st = await b.req('GET', `/live/rooms/${code}?host=${hostKey}`);
    expect(st.body.status).toBe('reveal');
    expect(st.body.question.counts).toEqual([1, 1]);
  });
});

describe('the pieces', () => {
  it('keeps Maps, Sets, Dates and bytes through JSON', () => {
    const v = { m: new Map([['a', { s: new Set([1, 2]) }]]), d: new Date('2026-11-06T10:00:00Z'), b: Buffer.from('hi') };
    const back = decode(JSON.parse(JSON.stringify(encode(v)))) as typeof v;
    expect(back.m.get('a')!.s.has(2)).toBe(true);
    expect(back.d.toISOString()).toBe('2026-11-06T10:00:00.000Z');
    expect(back.b.toString()).toBe('hi');
  });

  const dir = mkdtempSync(join(tmpdir(), 'murshid-state-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));
  it('a folder backend saves with compare-and-swap', async () => {
    const f = new FileBackend(dir);
    expect(await f.save('k', { n: 1 }, 0)).toEqual({ ok: true, version: 1 });
    expect(await f.save('k', { n: 2 }, 0)).toEqual({ ok: false });
    expect(await f.save('k', { n: 2 }, 1)).toEqual({ ok: true, version: 2 });
    expect(await f.versions(['k', 'missing'])).toEqual({ k: 2 });
    expect((await f.load(['k'])).k!.data).toEqual({ n: 2 });
  });

  it('talks to Supabase with the service key, a version filter and ignore-duplicates inserts', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (init?.method === 'PATCH') return new Response(JSON.stringify(url.includes('version=eq.3') ? [{ key: 'demo' }] : []), { status: 200 });
      if (init?.method === 'POST') return new Response('[]', { status: 201 });
      return new Response(JSON.stringify([{ key: 'demo', version: 3 }]), { status: 200 });
    };
    const s = new SupabaseBackend('https://x.supabase.co/', 'service-key', 'murshid_state', fake);
    expect(await s.versions(['demo', 'schools'])).toEqual({ demo: 3 });
    expect(calls[0]!.url).toBe('https://x.supabase.co/rest/v1/murshid_state?select=key,version&key=' + encodeURIComponent('in.("demo","schools")'));
    expect((calls[0]!.init!.headers as Record<string, string>).authorization).toBe('Bearer service-key');
    expect(await s.save('demo', { a: 1 }, 3)).toEqual({ ok: true, version: 4 });
    expect(await s.save('demo', { a: 1 }, 2)).toEqual({ ok: false });
    expect(await s.save('new', { a: 1 }, 0)).toEqual({ ok: false });
    expect((calls.at(-1)!.init!.headers as Record<string, string>).prefer).toContain('resolution=ignore-duplicates');
  });

  it('runs outside work only after the change is saved', async () => {
    const backend = new MemoryBackend(); const state = { n: 0 };
    const d = new Durable(backend, [{ key: 'n', dump: () => state, restore: (x) => Object.assign(state, x) }]);
    await d.init();
    const sent: number[] = [];
    await d.transaction(async () => { state.n = 5; d.afterCommit(() => { sent.push(state.n); }); });
    await new Promise((r) => setTimeout(r, 5));
    expect(sent).toEqual([5]);
    expect((await backend.load(['n'])).n!.data).toEqual({ n: 5 });
  });
});
