import { isoDateTime } from '../util.js';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { parseRobots, type RobotsPolicy } from './robots.js';

export type FetchImpl = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}>;

export interface CacheEntry {
  url: string;
  etag: string | null;
  lastModified: string | null;
  body: string;
  contentType: string | null;
  fetchedAt: string;
}

export interface HttpCache {
  get(url: string): Promise<CacheEntry | undefined>;
  set(entry: CacheEntry): Promise<void>;
}

export class MemoryCache implements HttpCache {
  private m = new Map<string, CacheEntry>();
  async get(url: string) {
    return this.m.get(url);
  }
  async set(e: CacheEntry) {
    this.m.set(e.url, e);
  }
}

/** File-backed cache (one JSON per URL) for local/dev runs. In prod, back this with the DB or KV. */
export class FileCache implements HttpCache {
  constructor(private dir: string) {}
  private path(url: string) {
    return join(this.dir, createHash('sha1').update(url).digest('hex') + '.json');
  }
  async get(url: string) {
    try {
      return JSON.parse(await readFile(this.path(url), 'utf8')) as CacheEntry;
    } catch {
      return undefined;
    }
  }
  async set(e: CacheEntry) {
    await mkdir(this.dir, { recursive: true });
    await writeFile(this.path(e.url), JSON.stringify(e));
  }
}

export interface FetchResult {
  url: string;
  status: number;
  body: string | null;
  contentType: string | null;
  fromCache: boolean; // true when a 304 let us reuse the cached body
  blockedByRobots: boolean;
  error?: string;
}

export interface FetcherOptions {
  userAgent?: string;
  /** Minimum ms between requests to the same host (robots Crawl-delay overrides if larger). */
  minIntervalMs?: number;
  timeoutMs?: number;
  respectRobots?: boolean;
  fetchImpl?: FetchImpl;
  cache?: HttpCache;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
}

export const DEFAULT_UA = 'MurshidBot/0.1 (+https://murshid.example/bot; student-opportunities crawler)';

/**
 * Polite fetcher: robots.txt respect, per-host rate limiting, conditional GET (ETag / Last-Modified).
 */
export class PoliteFetcher {
  private readonly ua: string;
  private readonly minInterval: number;
  private readonly timeout: number;
  private readonly respectRobots: boolean;
  private readonly fetchImpl: FetchImpl;
  readonly cache: HttpCache;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly clock: () => number;
  private robots = new Map<string, RobotsPolicy>();
  private nextSlot = new Map<string, number>();

  constructor(o: FetcherOptions = {}) {
    this.ua = o.userAgent ?? process.env.CRAWLER_USER_AGENT ?? DEFAULT_UA;
    this.minInterval = o.minIntervalMs ?? Number(process.env.CRAWLER_MIN_INTERVAL_MS ?? 2000);
    this.timeout = o.timeoutMs ?? 20000;
    this.respectRobots = o.respectRobots ?? true;
    this.fetchImpl = o.fetchImpl ?? (globalThis.fetch as unknown as FetchImpl);
    this.cache = o.cache ?? new MemoryCache();
    this.sleep = o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.clock = o.clock ?? (() => Date.now());
  }

  private async raw(url: string, headers: Record<string, string> = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.timeout);
    try {
      return await this.fetchImpl(url, { headers: { 'User-Agent': this.ua, Accept: 'text/html,application/xhtml+xml,application/xml,application/json;q=0.9,*/*;q=0.8', ...headers }, signal: ctrl.signal });
    } finally {
      clearTimeout(t);
    }
  }

  private async waitTurn(host: string, extraDelayMs: number) {
    const interval = Math.max(this.minInterval, extraDelayMs);
    const now = this.clock();
    const slot = Math.max(now, this.nextSlot.get(host) ?? 0);
    this.nextSlot.set(host, slot + interval);
    if (slot > now) await this.sleep(slot - now);
  }

  async robotsFor(u: URL): Promise<RobotsPolicy> {
    const key = u.origin;
    const cached = this.robots.get(key);
    if (cached) return cached;
    let policy: RobotsPolicy = parseRobots('', this.ua);
    try {
      await this.waitTurn(u.host, 0);
      const res = await this.raw(`${u.origin}/robots.txt`);
      if (res.status >= 200 && res.status < 300) policy = parseRobots(await res.text(), this.ua);
      // 4xx → allow all; 5xx → be conservative and disallow (RFC 9309 §2.3.1.4)
      else if (res.status >= 500) policy = { isAllowed: () => false, crawlDelaySeconds: null };
    } catch {
      // network error fetching robots: treat as unreachable → allow (site fetch will fail anyway)
    }
    this.robots.set(key, policy);
    return policy;
  }

  async fetch(url: string): Promise<FetchResult> {
    const u = new URL(url);
    let delayMs = 0;
    if (this.respectRobots) {
      const policy = await this.robotsFor(u);
      if (!policy.isAllowed(u.pathname + u.search)) {
        return { url, status: 0, body: null, contentType: null, fromCache: false, blockedByRobots: true };
      }
      delayMs = (policy.crawlDelaySeconds ?? 0) * 1000;
    }
    const prev = await this.cache.get(url);
    const cond: Record<string, string> = {};
    if (prev?.etag) cond['If-None-Match'] = prev.etag;
    if (prev?.lastModified) cond['If-Modified-Since'] = prev.lastModified;
    await this.waitTurn(u.host, delayMs);
    try {
      const res = await this.raw(url, cond);
      if (res.status === 304 && prev) {
        return { url, status: 304, body: prev.body, contentType: prev.contentType, fromCache: true, blockedByRobots: false };
      }
      const body = await res.text();
      const contentType = res.headers.get('content-type');
      if (res.status >= 200 && res.status < 300) {
        await this.cache.set({
          url,
          etag: res.headers.get('etag'),
          lastModified: res.headers.get('last-modified'),
          body,
          contentType,
          fetchedAt: isoDateTime(new Date(this.clock())),
        });
      }
      return { url, status: res.status, body, contentType, fromCache: false, blockedByRobots: false };
    } catch (e) {
      return { url, status: 0, body: null, contentType: null, fromCache: false, blockedByRobots: false, error: (e as Error).message };
    }
  }
}
