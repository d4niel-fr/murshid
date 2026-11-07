/**
 * Sync for the app's own data (notes, decks, notebooks, whiteboards, planner, saved pages): one document per store
 * per person, so a student's phone, iPad and laptop show the same things. Each save names the version it started
 * from; a stale save gets 409 with the newer document, the app merges the two and saves again.
 */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import { MemoryBackend, type StateBackend } from '../lib/durable';
import type { Api } from '../lib/router';

const NAMES = /^[a-z][a-z0-9-]{1,30}$/;
/** a store may hold pictures (notebooks, boards): keep each under the hosts' request limit */
const MAX_BYTES = 4 * 1024 * 1024;
/** nesting and size limits for a synced document (deeply nested JSON is slow to handle and never needed) */
const MAX_DEPTH = 32; const MAX_NODES = 200_000;
const Put = z.object({ base: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), data: z.unknown() });
/** demo user ids (dev mode) become part of storage keys: letters, digits and - _ . @ only */
const DEV_ID = /^[\w.@-]{1,64}$/;

/** True when the value is plain JSON within the depth and size limits. */
export function jsonShapeOk(v: unknown, maxDepth = MAX_DEPTH, maxNodes = MAX_NODES): boolean {
  let nodes = 0;
  const walk = (x: unknown, depth: number): boolean => {
    if (++nodes > maxNodes) return false;
    if (x === null || typeof x !== 'object') return true;
    if (depth >= maxDepth) return false;
    const kids = Array.isArray(x) ? x : Object.values(x as Record<string, unknown>);
    for (const k of kids) if (!walk(k, depth + 1)) return false;
    return true;
  };
  return walk(v, 0);
}
const Names = z.object({ names: z.string().max(400).optional() });

export function registerSync(api: Api, backend: StateBackend | null) {
  const docs = backend ?? new MemoryBackend();
  /** whose documents: the signed-in person (or the demo student in dev mode) */
  const owner = async (c: Ctx): Promise<string> => {
    const { config, whoami } = c.get('deps');
    if (whoami && !(config.authMode === 'dev' && !c.req.header('authorization'))) return (await whoami(c)).authUserId;
    const dev = c.req.header('x-dev-user') ?? c.req.header('x-dev-user-id');
    if (!dev) throw new HTTPException(401, { message: 'sign in to sync' });
    if (!DEV_ID.test(dev)) throw new HTTPException(400, { message: 'bad demo user id' });
    return `dev:${dev}`;
  };
  const key = (who: string, name: string) => `user:${who}:${name}`;

  api.route({ method: 'get', path: '/me/sync', tag: 'sync', auth: 'custom', durable: 'none', query: Names, summary: 'My synced app data: every store (or ?names=a,b), with versions' },
    async (c, { query }) => {
      const who = await owner(c);
      const q = query as z.output<typeof Names>;
      let names = (q.names ?? '').split(',').map((s) => s.trim()).filter((n) => NAMES.test(n));
      if (!names.length && docs.list) names = (await docs.list(`user:${who}:`)).map((k) => k.slice(`user:${who}:`.length));
      const got = await docs.load(names.map((n) => key(who, n)));
      return c.json({ docs: Object.fromEntries(names.flatMap((n) => { const s = got[key(who, n)]; return s ? [[n, { version: s.version, ...(s.data as object) }]] : []; })) });
    });

  api.route({ method: 'get', path: '/me/sync/versions', tag: 'sync', auth: 'custom', durable: 'none', query: Names, summary: 'Versions only (cheap check before pulling)' },
    async (c, { query }) => {
      const who = await owner(c);
      const names = ((query as z.output<typeof Names>).names ?? '').split(',').map((s) => s.trim()).filter((n) => NAMES.test(n));
      const v = await docs.versions(names.map((n) => key(who, n)));
      return c.json({ versions: Object.fromEntries(names.map((n) => [n, v[key(who, n)] ?? 0])) });
    });

  api.route({ method: 'put', path: '/me/sync/:name', tag: 'sync', auth: 'custom', durable: 'none', body: Put, summary: 'Save one store. `base` is the version you started from; 409 returns the newer one to merge.' },
    async (c, { body }) => {
      const who = await owner(c);
      const name = c.req.param('name') ?? '';
      if (!NAMES.test(name)) throw new HTTPException(400, { message: 'bad store name' });
      const b = body as z.output<typeof Put>;
      const size = Buffer.byteLength(JSON.stringify(b.data ?? null));
      if (size > MAX_BYTES) throw new HTTPException(413, { message: 'this is too big to sync (over 4 MB): remove some pictures', cause: { code: 'too_large', size } });
      if (!jsonShapeOk(b.data)) throw new HTTPException(400, { message: 'this is nested too deeply to sync', cause: { code: 'too_deep' } });
      const k = key(who, name);
      const res = await docs.save(k, { data: b.data, updatedAt: new Date().toISOString() }, b.base);
      if (res.ok) return c.json({ version: res.version });
      const cur = (await docs.load([k]))[k];
      return c.json({ error: 'changed on another device', code: 'stale', version: cur?.version ?? 0, ...((cur?.data as object) ?? {}) }, 409);
    });
}
