import { ConnectorHttpError } from './errors';

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface HttpOptions {
  fetch?: FetchLike;
  /** max retries on 429/503 (default 2) */
  retries?: number;
  /** injectable sleep for tests */
  sleep?: (ms: number) => Promise<void>;
  /** injectable DNS lookup for the SSRF guard (tests); default: the system resolver */
  lookup?: (host: string) => Promise<{ address: string }[]>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function httpRequest(url: string, init: RequestInit, opts: HttpOptions = {}): Promise<Response> {
  const f = opts.fetch ?? (globalThis.fetch as FetchLike);
  const retries = opts.retries ?? 2;
  const sleep = opts.sleep ?? defaultSleep;
  for (let attempt = 0; ; attempt++) {
    const res = await f(url, init);
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      const ra = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(ra) && ra > 0 ? Math.min(ra, 30) * 1000 : 500 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ConnectorHttpError(`${init.method ?? 'GET'} ${redact(url)} -> ${res.status}`, res.status, redact(url), body.slice(0, 2000));
    }
    return res;
  }
}

export async function getJson<T>(url: string, headers: Record<string, string>, opts: HttpOptions = {}): Promise<T> {
  const res = await httpRequest(url, { method: 'GET', headers: { accept: 'application/json', ...headers } }, opts);
  return (await res.json()) as T;
}

export async function sendJson<T>(
  method: 'POST' | 'PATCH' | 'PUT',
  url: string,
  body: unknown,
  headers: Record<string, string>,
  opts: HttpOptions = {},
): Promise<{ data: T; response: Response }> {
  const res = await httpRequest(
    url,
    { method, headers: { accept: 'application/json', 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) },
    opts,
  );
  const text = await res.text();
  return { data: (text ? JSON.parse(text) : {}) as T, response: res };
}

/** Strip secrets from URLs before they reach logs / errors. */
export function redact(url: string): string {
  return url.replace(/([?&](?:access_token|token|auth_token|client_secret|code)=)[^&]*/gi, '$1REDACTED');
}

export function withQuery(base: string, params: Record<string, string | number | boolean | undefined | null>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
  return u.toString();
}
