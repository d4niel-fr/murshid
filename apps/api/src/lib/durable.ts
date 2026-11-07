/**
 * Durable state for the API's in-memory stores.
 *
 * The stores (students, the school, the classroom, plans) are plain objects in memory, which is fast and simple, but
 * a serverless host runs several short-lived copies of the API. This layer keeps each store as one JSON document in a
 * backend shared by every copy (Supabase Postgres in production, a folder on one server, or memory in tests):
 *
 * - before a request, any document another copy changed is reloaded (one small query for the versions);
 * - a request that changes data runs inside a transaction: the copy's writes are queued one at a time, and the
 *   changed documents are saved with compare-and-swap on their version. If another copy saved first, the documents are
 *   reloaded and the request runs again on the fresh state, so nothing is lost and nothing is applied twice;
 * - work with outside effects (email, push) is registered with `afterCommit` and only runs once the save succeeded.
 *
 * Fine for a school pilot (hundreds of students per document). Past that, split documents per school.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/* ------------------------------------------------------------------ encoding (Map, Set, Buffer, Date survive JSON) */

export function encode(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (v instanceof Map) return { $map: [...v.entries()].map(([k, x]) => [k, encode(x)]) };
  if (v instanceof Set) return { $set: [...v].map(encode) };
  if (v instanceof Date) return { $date: v.toISOString() };
  if (v instanceof Uint8Array) return { $b64: Buffer.from(v).toString('base64') };
  if (Array.isArray(v)) return v.map(encode);
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) if (x !== undefined && typeof x !== 'function') out[k] = encode(x);
  return out;
}

export function decode(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(decode);
  const o = v as Record<string, unknown>;
  if ('$map' in o && Array.isArray(o.$map)) return new Map((o.$map as [unknown, unknown][]).map(([k, x]) => [k, decode(x)]));
  if ('$set' in o && Array.isArray(o.$set)) return new Set((o.$set as unknown[]).map(decode));
  if ('$date' in o && typeof o.$date === 'string') return new Date(o.$date);
  if ('$b64' in o && typeof o.$b64 === 'string') return Buffer.from(o.$b64, 'base64');
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(o)) out[k] = decode(x);
  return out;
}

/* ------------------------------------------------------------------ backends */

export interface Stored { data: unknown; version: number }
export interface StateBackend {
  readonly name: 'memory' | 'file' | 'supabase';
  /** current version of each key that exists */
  versions(keys: string[]): Promise<Record<string, number>>;
  load(keys: string[]): Promise<Record<string, Stored>>;
  /** Save when the stored version is still `expect` (0: the key must not exist yet). */
  save(key: string, data: unknown, expect: number): Promise<{ ok: true; version: number } | { ok: false }>;
  /** keys starting with `prefix` (listing small per-user documents) */
  list?(prefix: string): Promise<string[]>;
}

/**
 * Keys name documents in every backend (a database row, a file name): letters, digits and : _ @ . - only, at most 200
 * characters. Anything else is refused before it reaches a query or the file system.
 */
const KEY = /^[A-Za-z0-9:_@.-]{1,200}$/;
export function assertKey(key: string): string {
  if (typeof key !== 'string' || !KEY.test(key)) throw new Error('bad state key');
  return key;
}
const keysOk = (keys: string[]) => keys.map(assertKey);

/** Shared memory: one per process by default. Tests pass the same instance to two apps to act as two servers. */
export class MemoryBackend implements StateBackend {
  readonly name = 'memory' as const;
  private rows = new Map<string, { json: string; version: number }>();
  async versions(keys: string[]) { return Object.fromEntries(keysOk(keys).flatMap((k) => (this.rows.has(k) ? [[k, this.rows.get(k)!.version]] : []))); }
  async load(keys: string[]) { return Object.fromEntries(keysOk(keys).flatMap((k) => { const r = this.rows.get(k); return r ? [[k, { data: JSON.parse(r.json), version: r.version }]] : []; })); }
  async save(key: string, data: unknown, expect: number) {
    assertKey(key);
    const cur = this.rows.get(key)?.version ?? 0;
    if (cur !== expect) return { ok: false as const };
    this.rows.set(key, { json: JSON.stringify(data), version: cur + 1 });
    return { ok: true as const, version: cur + 1 };
  }
  async list(prefix: string) { assertKey(prefix); return [...this.rows.keys()].filter((k) => k.startsWith(prefix)); }
}

/** One JSON file per key in a folder (a single long-running server, e.g. a VPS). Writes are atomic (temp + rename). */
export class FileBackend implements StateBackend {
  readonly name = 'file' as const;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private dir: string) {}
  /** one file per key inside the folder: the key is checked and encoded, so it can never name a path outside it */
  private path(key: string) {
    const safe = encodeURIComponent(assertKey(key));
    return join(this.dir, `${safe.length > 200 ? createHash('sha256').update(key).digest('hex') : safe}.json`);
  }
  private async read(key: string): Promise<Stored | null> {
    try { return JSON.parse(await readFile(this.path(key), 'utf8')) as Stored; } catch { return null; }
  }
  async versions(keys: string[]) { const out: Record<string, number> = {}; for (const k of keysOk(keys)) { const r = await this.read(k); if (r) out[k] = r.version; } return out; }
  async load(keys: string[]) { const out: Record<string, Stored> = {}; for (const k of keysOk(keys)) { const r = await this.read(k); if (r) out[k] = r; } return out; }
  save(key: string, data: unknown, expect: number) {
    const run = async () => {
      const cur = (await this.read(key))?.version ?? 0;
      if (cur !== expect) return { ok: false as const };
      await mkdir(this.dir, { recursive: true });
      const tmp = `${this.path(key)}.${process.pid}.tmp`;
      await writeFile(tmp, JSON.stringify({ data, version: cur + 1 }));
      await rename(tmp, this.path(key));
      return { ok: true as const, version: cur + 1 };
    };
    const p = this.queue.then(run, run);
    this.queue = p.catch(() => undefined);
    return p;
  }
}

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Supabase Postgres through PostgREST, with the service-role key (server only). Table (see
 * supabase/migrations/20261106000006_durable_state.sql):
 *   murshid_state(key text primary key, data jsonb, version bigint, updated_at timestamptz)
 */
export class SupabaseBackend implements StateBackend {
  readonly name = 'supabase' as const;
  private base: string;
  constructor(url: string, private serviceKey: string, private table = 'murshid_state', private f: FetchLike = fetch) {
    this.base = `${url.replace(/\/+$/, '')}/rest/v1/${table}`;
  }
  private headers(extra: Record<string, string> = {}) {
    return { apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}`, 'content-type': 'application/json', ...extra };
  }
  /** PostgREST in-list; keys are checked first, and quotes and backslashes are escaped anyway */
  private inList(keys: string[]) { return `in.(${keysOk(keys).map((k) => `"${k.replace(/["\\]/g, '\\$&')}"`).join(',')})`; }
  private async json<T>(res: Response, what: string): Promise<T> {
    if (!res.ok) throw new Error(`state ${what} failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }
  async versions(keys: string[]) {
    if (!keys.length) return {};
    const rows = await this.json<{ key: string; version: number }[]>(await this.f(`${this.base}?select=key,version&key=${encodeURIComponent(this.inList(keys))}`, { headers: this.headers() }), 'versions');
    return Object.fromEntries(rows.map((r) => [r.key, Number(r.version)]));
  }
  async load(keys: string[]) {
    if (!keys.length) return {};
    const rows = await this.json<{ key: string; data: unknown; version: number }[]>(await this.f(`${this.base}?select=key,data,version&key=${encodeURIComponent(this.inList(keys))}`, { headers: this.headers() }), 'load');
    return Object.fromEntries(rows.map((r) => [r.key, { data: r.data, version: Number(r.version) }]));
  }
  async save(key: string, data: unknown, expect: number) {
    assertKey(key);
    const now = new Date().toISOString();
    if (expect === 0) {
      // insert, or nothing when another server created it first (then it is a conflict)
      const res = await this.f(`${this.base}?on_conflict=key`, { method: 'POST', headers: this.headers({ prefer: 'resolution=ignore-duplicates,return=representation' }), body: JSON.stringify({ key, data, version: 1, updated_at: now }) });
      const rows = await this.json<unknown[]>(res, 'insert');
      return rows.length ? { ok: true as const, version: 1 } : { ok: false as const };
    }
    const res = await this.f(`${this.base}?key=eq.${encodeURIComponent(key)}&version=eq.${expect}`, { method: 'PATCH', headers: this.headers({ prefer: 'return=representation' }), body: JSON.stringify({ data, version: expect + 1, updated_at: now }) });
    const rows = await this.json<unknown[]>(res, 'update');
    return rows.length ? { ok: true as const, version: expect + 1 } : { ok: false as const };
  }
  async list(prefix: string) {
    assertKey(prefix);
    const rows = await this.json<{ key: string }[]>(await this.f(`${this.base}?select=key&key=like.${encodeURIComponent(`${prefix.replace(/[%_]/g, '\\$&')}*`)}`, { headers: this.headers() }), 'list');
    return rows.map((r) => r.key);
  }
}

export function backendFromEnv(env: Record<string, string | undefined>): StateBackend {
  const kind = (env.STATE_BACKEND ?? '').trim();
  const url = env.SUPABASE_URL?.trim(); const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if ((kind === 'supabase' || !kind) && url && key) return new SupabaseBackend(url, key, env.STATE_TABLE?.trim() || 'murshid_state');
  if (kind === 'supabase') throw new Error('STATE_BACKEND=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  if ((kind === 'file' || !kind) && env.STATE_DIR?.trim()) return new FileBackend(env.STATE_DIR.trim());
  return new MemoryBackend();
}

/* ------------------------------------------------------------------ units and the transaction */

/** One store saved as one document. */
export interface Unit { key: string; dump(): unknown; restore(data: unknown): void }

/** Copy an object's own fields (not the ones listed), for saving. */
export function fieldsOf(obj: object, skip: readonly string[] = []): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([k, v]) => !skip.includes(k) && typeof v !== 'function'));
}
/** Put saved fields back on an object (class instances keep their methods). */
export function assignFields(obj: object, data: unknown, skip: readonly string[] = []) {
  if (!data || typeof data !== 'object') return;
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) if (!skip.includes(k)) (obj as Record<string, unknown>)[k] = v;
}

export class ConflictError extends Error { constructor() { super('the data changed on another server; try again'); } }

export class Durable {
  private local = new Map<string, { version: number; hash: string }>();
  private chain: Promise<void> = Promise.resolve();
  private holding = false;
  private pending: (() => Promise<void> | void)[] = [];
  private lastCheck = 0;

  constructor(readonly backend: StateBackend, private units: Unit[], private opts: { maxAttempts?: number; checkEveryMs?: number } = {}) {}

  private hashOf(json: string) { return createHash('sha1').update(json).digest('base64url'); }
  private snapshot(u: Unit) { const json = JSON.stringify(encode(u.dump())); return { json, hash: this.hashOf(json) }; }

  /** Load what is saved (call once at start). Stores that were never saved keep their seed. */
  async init() {
    const saved = await this.backend.load(this.units.map((u) => u.key));
    for (const u of this.units) {
      const s = saved[u.key];
      if (s) { u.restore(decode(s.data)); this.local.set(u.key, { version: s.version, hash: this.snapshot(u).hash }); }
      else this.local.set(u.key, { version: 0, hash: this.snapshot(u).hash });
    }
    this.lastCheck = Date.now();
  }

  /** Reload the documents another server changed. Skipped while this server is in the middle of a change. */
  async sync(force = false) {
    if (this.holding && !force) return;
    if (!force && this.opts.checkEveryMs && Date.now() - this.lastCheck < this.opts.checkEveryMs) return;
    const keys = this.units.map((u) => u.key);
    const remote = await this.backend.versions(keys);
    this.lastCheck = Date.now();
    const stale = keys.filter((k) => (remote[k] ?? 0) > (this.local.get(k)?.version ?? 0));
    if (stale.length) await this.reload(stale);
  }

  private async reload(keys: string[]) {
    const saved = await this.backend.load(keys);
    for (const u of this.units) {
      const s = saved[u.key];
      if (!s) continue;
      u.restore(decode(s.data));
      this.local.set(u.key, { version: s.version, hash: this.snapshot(u).hash });
    }
  }

  /** Save every changed document. Returns the keys another server changed first. */
  async commit(): Promise<string[]> {
    const conflicts: string[] = [];
    for (const u of this.units) {
      const cur = this.local.get(u.key) ?? { version: 0, hash: '' };
      const snap = this.snapshot(u);
      if (snap.hash === cur.hash) continue;
      const r = await this.backend.save(u.key, JSON.parse(snap.json), cur.version);
      if (r.ok) this.local.set(u.key, { version: r.version, hash: snap.hash });
      else conflicts.push(u.key);
    }
    return conflicts;
  }

  /** Register outside work (email, push) to run only after this change is saved. */
  afterCommit(fn: () => Promise<void> | void) { if (this.holding) this.pending.push(fn); else void Promise.resolve().then(fn).catch((e) => console.error('[afterCommit]', e)); }

  private async lock(): Promise<() => void> {
    let release!: () => void;
    const prev = this.chain;
    this.chain = new Promise<void>((r) => { release = r; });
    await prev;
    this.holding = true;
    return () => { this.holding = false; release(); };
  }

  private flushPending() {
    const work = this.pending; this.pending = [];
    for (const w of work) void Promise.resolve().then(w).catch((e) => console.error('[afterCommit]', e));
  }

  /** Put back the saved version of documents a failed change left half-done. */
  private async rollback() {
    const changed = this.units.filter((u) => this.snapshot(u).hash !== this.local.get(u.key)?.hash).map((u) => u.key);
    if (changed.length) await this.reload(changed);
  }

  /** Save what changed now (after slow work that ran outside the queue). A clash keeps the other server's data. */
  async commitNow() {
    const release = await this.lock();
    try {
      const conflicts = await this.commit();
      if (conflicts.length) { console.warn(`[durable] ${conflicts.join(', ')} changed on another server during slow work; keeping theirs`); await this.reload(conflicts); }
      this.flushPending();
    } finally { release(); }
  }

  /**
   * Run a change: one at a time on this server, saved when it ends, re-run on fresh data if another server saved the
   * same documents first. `fn` must only change state (outside effects go through afterCommit).
   */
  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    const release = await this.lock();
    try {
      const max = this.opts.maxAttempts ?? 4;
      for (let attempt = 1; ; attempt++) {
        this.pending = [];
        await this.sync(true);
        let out: T;
        try { out = await fn(); } catch (e) { this.pending = []; await this.rollback(); throw e; }
        const conflicts = await this.commit();
        if (!conflicts.length) { this.flushPending(); return out; }
        await this.reload(conflicts);
        if (attempt >= max) throw new ConflictError();
      }
    } finally { release(); }
  }
}

/* ------------------------------------------------------------------ files (bytes kept out of the documents) */

export interface BlobStore {
  readonly name: 'memory' | 'supabase';
  put(id: string, data: Buffer, mime: string): Promise<void>;
  get(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<void>;
}

export class MemoryBlobs implements BlobStore {
  readonly name = 'memory' as const;
  private bytes = new Map<string, Buffer>();
  private total = 0;
  constructor(private maxTotal = 200 * 1024 * 1024) {}
  async put(id: string, data: Buffer) {
    this.bytes.set(id, data); this.total += data.length;
    // keep memory bounded: drop the oldest uploads first
    for (const [k, b] of this.bytes) { if (this.total <= this.maxTotal) break; this.bytes.delete(k); this.total -= b.length; }
  }
  async get(id: string) { return this.bytes.get(id) ?? null; }
  async delete(id: string) { const b = this.bytes.get(id); if (b) { this.total -= b.length; this.bytes.delete(id); } }
}

/** Supabase Storage (a private bucket; files are served through the API by unguessable id). */
export class SupabaseBlobs implements BlobStore {
  readonly name = 'supabase' as const;
  private base: string;
  constructor(url: string, private serviceKey: string, private bucket = 'murshid-files', private f: FetchLike = fetch) {
    this.base = `${url.replace(/\/+$/, '')}/storage/v1/object/${bucket}`;
  }
  private auth() { return { apikey: this.serviceKey, authorization: `Bearer ${this.serviceKey}` }; }
  async put(id: string, data: Buffer, mime: string) {
    const res = await this.f(`${this.base}/${encodeURIComponent(id)}`, { method: 'POST', headers: { ...this.auth(), 'content-type': mime, 'x-upsert': 'true' }, body: new Uint8Array(data) });
    if (!res.ok) throw new Error(`file upload failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  }
  async get(id: string) {
    const res = await this.f(`${this.base}/${encodeURIComponent(id)}`, { headers: this.auth() });
    if (res.status === 404 || res.status === 400) return null;
    if (!res.ok) throw new Error(`file download failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }
  async delete(id: string) { await this.f(`${this.base}/${encodeURIComponent(id)}`, { method: 'DELETE', headers: this.auth() }); }
}

export function blobsFromEnv(env: Record<string, string | undefined>): BlobStore {
  const url = env.SUPABASE_URL?.trim(); const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key && env.FILES_BACKEND !== 'memory') return new SupabaseBlobs(url, key, env.FILES_BUCKET?.trim() || 'murshid-files');
  return new MemoryBlobs();
}
