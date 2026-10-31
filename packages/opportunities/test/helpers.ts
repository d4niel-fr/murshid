import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchImpl } from '../src/crawler/fetcher.js';
import type { Opportunity, Source } from '../src/types.js';
import { loadSources } from '../src/index.js';

export const FIX = join(__dirname, 'fixtures');
export const fixture = (name: string) => readFileSync(join(FIX, name), 'utf8');
export const SOURCES = loadSources();
export const source = (id: string): Source => {
  const s = SOURCES.find((x) => x.id === id);
  if (!s) throw new Error(`no source ${id}`);
  return s;
};

/** A fixed "now" for deterministic tests: 1 May 2026, 08:00 UTC (12:00 Dubai). */
export const NOW = new Date('2026-05-01T08:00:00Z');

export interface MockRoute {
  status?: number;
  body?: string;
  headers?: Record<string, string>;
}

/** Offline fetch mock: maps URL → response. Records every call (url + headers). */
export function mockFetch(routes: Record<string, MockRoute | ((h: Record<string, string>) => MockRoute)>) {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const impl: FetchImpl = async (url, init) => {
    const headers = init?.headers ?? {};
    calls.push({ url, headers });
    const r = routes[url];
    const route: MockRoute = typeof r === 'function' ? r(headers) : r ?? { status: 404, body: 'not found' };
    const hdrs = Object.fromEntries(Object.entries(route.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    return {
      status: route.status ?? 200,
      headers: { get: (n: string) => hdrs[n.toLowerCase()] ?? null },
      text: async () => route.body ?? '',
    };
  };
  return { impl, calls };
}

export function opp(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: over.id ?? Math.random().toString(36).slice(2),
    title: 'Test Opportunity',
    organizer: 'Test Org',
    type: 'competition',
    url: 'https://example.org/x',
    emirate: null,
    country: null,
    min_grade: 9,
    max_grade: 12,
    eligibility_text: null,
    nationality_restriction: null,
    cost_aed: null,
    deadline: null,
    tags: [],
    source_id: 'test',
    last_seen_at: NOW.toISOString(),
    status: 'unknown',
    ...over,
  };
}
