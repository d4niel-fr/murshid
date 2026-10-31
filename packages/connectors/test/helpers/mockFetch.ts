import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FetchLike } from '../../src/core/http';

export const FIXTURES = join(__dirname, '..', 'fixtures');
export const fixture = (p: string) => readFileSync(join(FIXTURES, p), 'utf8');
export const fixtureJson = <T = unknown>(p: string): T => JSON.parse(fixture(p)) as T;

export interface Route {
  method?: string;
  match: string | RegExp | ((url: URL) => boolean);
  /** fixture path (json/text) or inline body */
  fixture?: string;
  body?: unknown;
  status?: number;
  headers?: Record<string, string>;
}

export interface RecordedCall { method: string; url: string; headers: Record<string, string>; body: string | undefined }

/** Network-free fetch: every request must hit a route or the test fails. */
export function mockFetch(routes: Route[]): FetchLike & { calls: RecordedCall[] } {
  const calls: RecordedCall[] = [];
  const fn = (async (input: string, init: RequestInit = {}) => {
    const url = new URL(input);
    const method = (init.method ?? 'GET').toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((v, k) => (headers[k] = v));
    calls.push({ method, url: input, headers, body: typeof init.body === 'string' ? init.body : undefined });
    const r = routes.find((r) => {
      if (r.method && r.method.toUpperCase() !== method) return false;
      if (typeof r.match === 'string') return input === r.match || input.startsWith(r.match + '?') || url.origin + url.pathname === r.match;
      if (r.match instanceof RegExp) return r.match.test(input);
      return r.match(url);
    });
    if (!r) throw new Error(`mockFetch: no route for ${method} ${input}`);
    const raw = r.fixture ? fixture(r.fixture) : typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? {});
    return new Response(raw, { status: r.status ?? 200, headers: { 'content-type': r.fixture?.endsWith('.ics') ? 'text/calendar' : 'application/json', ...r.headers } });
  }) as FetchLike & { calls: RecordedCall[] };
  fn.calls = calls;
  return fn;
}

export const TEST_ENV = {
  GOOGLE_CLIENT_ID: 'test-google-client',
  GOOGLE_CLIENT_SECRET: 'test-google-secret',
  GOOGLE_REDIRECT_URI: 'https://murshid.test/oauth/google/callback',
  MS_CLIENT_ID: 'test-ms-client',
  MS_CLIENT_SECRET: 'test-ms-secret',
  MS_REDIRECT_URI: 'https://murshid.test/oauth/microsoft/callback',
  UAEPASS_CLIENT_ID: 'test-uaepass-client',
  UAEPASS_CLIENT_SECRET: 'test-uaepass-secret',
  UAEPASS_REDIRECT_URI: 'https://murshid.test/oauth/uaepass/callback',
  LINKEDIN_CLIENT_ID: 'test-li-client',
  LINKEDIN_CLIENT_SECRET: 'test-li-secret',
  LINKEDIN_REDIRECT_URI: 'https://murshid.test/oauth/linkedin/callback',
  EDLINK_CLIENT_ID: 'test-edlink-client',
  EDLINK_CLIENT_SECRET: 'test-edlink-secret',
  EDLINK_REDIRECT_URI: 'https://murshid.test/oauth/edlink/callback',
};

export const STUDENT = '00000000-0000-4000-8000-0000000a1544'; // "Aisha Test"
