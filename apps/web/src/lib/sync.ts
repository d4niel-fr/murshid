'use client';

/**
 * Keeps the app's own data (planner, notes, decks, notebooks, whiteboards, saved pages) the same on a student's
 * phone, iPad and laptop. Live product only (signed in).
 *
 * Each store is one document on the server with a version (API: /me/sync). This device remembers the version and the
 * copy it last agreed with the server (the "base"). When both sides changed, the two are merged against the base:
 * items are matched by id, so a note edited on the phone and a deck added on the iPad both survive; something deleted
 * on one device stays deleted unless the other device changed it meanwhile; when the same field changed on both, this
 * device's latest edit wins.
 */
import { ApiError, request } from './http';

export interface SyncDoc { name: string; get(): unknown; set(v: unknown): void; subscribe(fn: () => void): () => void }

/* ------------------------------------------------------------------ merging */

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const hasIds = (a: unknown): a is { id: string }[] => Array.isArray(a) && a.length > 0 && a.every((x) => isObj(x) && typeof x.id === 'string');

/** Deep equality that ignores key order. */
export function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((x, i) => same(x, b[i]));
  if (isObj(a)) {
    if (!isObj(b)) return false;
    const ka = Object.keys(a).filter((k) => a[k] !== undefined); const kb = Object.keys(b).filter((k) => b[k] !== undefined);
    return ka.length === kb.length && ka.every((k) => same(a[k], b[k]));
  }
  return false;
}

/**
 * Three-way merge: `base` is the last copy both sides agreed on (undefined when unknown, then nothing counts as
 * deleted). Returns what both devices should hold.
 */
export function merge3(base: unknown, local: unknown, remote: unknown): unknown {
  if (same(local, remote)) return local;
  if (base !== undefined && same(base, local)) return remote;
  if (base !== undefined && same(base, remote)) return local;
  if ((hasIds(local) || hasIds(remote) || hasIds(base)) && Array.isArray(local) && Array.isArray(remote)) {
    const b = new Map((Array.isArray(base) ? base : []).filter(isObj).map((x) => [x.id as string, x]));
    const l = new Map(local.filter(isObj).map((x) => [x.id as string, x]));
    const r = new Map(remote.filter(isObj).map((x) => [x.id as string, x]));
    const order = [...r.keys(), ...[...l.keys()].filter((k) => !r.has(k))];
    const out: unknown[] = [];
    for (const id of order) {
      const bi = b.get(id); const li = l.get(id); const ri = r.get(id);
      if (li && ri) out.push(merge3(bi, li, ri));
      else if (li) { if (!bi || !same(bi, li)) out.push(li); }      // new here, or changed here after the other side deleted it
      else if (ri) { if (!bi || !same(bi, ri)) out.push(ri); }      // new there, or changed there after this side deleted it
    }
    return out;
  }
  if (isObj(local) && isObj(remote)) {
    const bo = isObj(base) ? base : undefined;
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(remote), ...Object.keys(local)])) {
      const v = merge3(bo ? bo[k] : undefined, local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  // a value both changed, or arrays without ids: this device's latest edit wins
  return local === undefined ? remote : local;
}

/* ------------------------------------------------------------------ the engine */

const META = 'murshid:sync:v1';
/** documents bigger than this keep no base copy on the device (storage is limited); they merge without deletions */
const BASE_LIMIT = 1_500_000;
interface Meta { owner: string | null; docs: Record<string, { v: number; base?: string }> }

const docs = new Map<string, SyncDoc>();
let meta: Meta = { owner: null, docs: {} };
let running = false;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const busy = new Map<string, Promise<void>>();
let listeners: ((s: SyncStatus) => void)[] = [];
export type SyncStatus = 'idle' | 'syncing' | 'offline' | 'error' | 'too_large';
let status: SyncStatus = 'idle';
const setStatus = (s: SyncStatus) => { status = s; for (const l of listeners) l(s); };
export const onSyncStatus = (fn: (s: SyncStatus) => void) => { listeners.push(fn); fn(status); return () => { listeners = listeners.filter((x) => x !== fn); }; };

function loadMeta() { try { const raw = localStorage.getItem(META); if (raw) meta = { owner: null, docs: {}, ...JSON.parse(raw) }; } catch { /* storage blocked */ } }
function saveMeta() { try { localStorage.setItem(META, JSON.stringify(meta)); } catch { /* full: next sync merges without a base */ } }

/** A store that follows the account (call once per store, at start-up). */
export function registerDoc(d: SyncDoc): () => void {
  docs.set(d.name, d);
  const off = d.subscribe(() => { if (running) schedule(d.name); });
  return () => { off(); docs.delete(d.name); };
}

function schedule(name: string, ms = 1500) {
  clearTimeout(timers.get(name));
  timers.set(name, setTimeout(() => void push(name), ms));
}

/** One at a time per store. */
function serial(name: string, fn: () => Promise<void>) {
  const prev = busy.get(name) ?? Promise.resolve();
  const next = prev.then(fn, fn).catch(() => undefined);
  busy.set(name, next);
  return next;
}

function remember(name: string, version: number, data: unknown) {
  const json = JSON.stringify(data ?? null);
  meta.docs[name] = { v: version, ...(json.length <= BASE_LIMIT ? { base: json } : {}) };
  saveMeta();
}
const baseOf = (name: string): unknown => { const b = meta.docs[name]?.base; try { return b === undefined ? undefined : JSON.parse(b); } catch { return undefined; } };

/** Bring a server copy in: merge it with what this device has, keep the result. Returns true when the server needs ours. */
function adopt(name: string, version: number, remote: unknown): boolean {
  const d = docs.get(name); if (!d) return false;
  const local = d.get();
  const merged = meta.docs[name]?.v ? merge3(baseOf(name), local, remote) : merge3(undefined, local, remote);
  if (!same(merged, local)) d.set(merged);
  remember(name, version, remote);
  return !same(merged, remote);
}

async function push(name: string): Promise<void> {
  return serial(name, async () => {
    const d = docs.get(name); if (!d || !running) return;
    for (let attempt = 0; attempt < 4; attempt++) {
      const data = d.get();
      const m = meta.docs[name];
      if (m?.base !== undefined && same(JSON.parse(m.base), data)) return; // nothing new
      try {
        setStatus('syncing');
        const r = await request<{ version: number }>(`/me/sync/${name}`, { method: 'PUT', body: { base: m?.v ?? 0, data }, timeoutMs: 20_000 });
        remember(name, r.version, data);
        setStatus('idle');
        return;
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          // changed on another device: take theirs in, merged with ours, and try again
          const body = await request<{ docs: Record<string, { version: number; data: unknown }> }>(`/me/sync?names=${name}`);
          const cur = body.docs[name];
          if (cur && !adopt(name, cur.version, cur.data)) { setStatus('idle'); return; }
          continue;
        }
        setStatus(e instanceof ApiError && e.status === 413 ? 'too_large' : e instanceof ApiError && e.transient ? 'offline' : 'error');
        if (e instanceof ApiError && e.transient) schedule(name, 15_000);
        return;
      }
    }
  });
}

/** Pull what changed on other devices (all registered stores). */
export async function pull(): Promise<void> {
  const names = [...docs.keys()];
  if (!names.length || !running) return;
  try {
    const { versions } = await request<{ versions: Record<string, number> }>(`/me/sync/versions?names=${names.join(',')}`, { timeoutMs: 10_000 });
    const changed = names.filter((n) => (versions[n] ?? 0) > (meta.docs[n]?.v ?? 0));
    const fresh = names.filter((n) => !versions[n]);
    if (changed.length) {
      const { docs: got } = await request<{ docs: Record<string, { version: number; data: unknown }> }>(`/me/sync?names=${changed.join(',')}`, { timeoutMs: 20_000 });
      for (const n of changed) { const g = got[n]; if (g && adopt(n, g.version, g.data)) schedule(n, 200); }
    }
    for (const n of fresh) schedule(n, 200); // never saved from any device yet: save this one's
    setStatus('idle');
  } catch (e) { setStatus(e instanceof ApiError && e.transient ? 'offline' : 'error'); }
}

/**
 * Start following the signed-in account. A different person signing in on this device starts from a clean slate
 * (the previous person's local copy is removed first), so nobody sees someone else's notes.
 */
export function startSync(owner: string): () => void {
  loadMeta();
  if (meta.owner && meta.owner !== owner) {
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('murshid:') && k !== 'murshid:auth' && k !== 'murshid:cookie-consent') localStorage.removeItem(k); } catch { /* storage blocked */ }
    meta = { owner, docs: {} }; saveMeta();
    window.location.reload();
    return () => {};
  }
  meta.owner = owner; saveMeta();
  running = true;
  void pull();
  const onFocus = () => { if (document.visibilityState === 'visible') void pull(); };
  const every = setInterval(() => { if (document.visibilityState === 'visible') void pull(); }, 45_000);
  window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus);
  const online = () => { void pull(); for (const n of docs.keys()) schedule(n, 500); };
  window.addEventListener('online', online);
  return () => {
    running = false; clearInterval(every);
    window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); window.removeEventListener('online', online);
    for (const t of timers.values()) clearTimeout(t);
  };
}
