import { API_BASE } from './api';
import { authHeaders } from './auth';

/**
 * One fetch wrapper for the web app: timeouts, retries with backoff for failures that are safe to retry, and errors
 * with a plain-language message. POSTs are only retried when they carry an Idempotency-Key, so a retry can never
 * create a second subscription or a second assignment.
 */
export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly retryAfter?: number) { super(message); this.name = 'ApiError'; }
  /** true when the server or the network was the problem, not the request */
  get transient() { return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500; }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown; headers?: Record<string, string>;
  timeoutMs?: number; retries?: number; idempotencyKey?: string; signal?: AbortSignal; baseUrl?: string;
  /** send no sign-in token (public endpoints such as live quiz rooms) */
  anonymous?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const newIdempotencyKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);

export async function request<T>(path: string, o: RequestOptions = {}): Promise<T> {
  const method = o.method ?? 'GET';
  const canRetry = method === 'GET' || Boolean(o.idempotencyKey);
  const retries = canRetry ? o.retries ?? 2 : 0;
  let last: ApiError | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(new DOMException('timeout', 'TimeoutError')), o.timeoutMs ?? 8000);
    const onAbort = () => ctrl.abort(o.signal?.reason);
    o.signal?.addEventListener('abort', onAbort);
    try {
      const res = await fetch(`${o.baseUrl ?? API_BASE}${path}`, {
        method, cache: 'no-store', signal: ctrl.signal,
        // the sign-in token when there is one (the caller's demo headers still apply in the demo)
        headers: { accept: 'application/json', ...(o.body !== undefined ? { 'content-type': 'application/json' } : {}), ...(o.idempotencyKey ? { 'idempotency-key': o.idempotencyKey } : {}), ...o.headers, ...(o.anonymous ? {} : await authHeaders()) },
        body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
      });
      const text = await res.text();
      let json: unknown = null;
      try { json = text ? JSON.parse(text) : null; } catch { json = null; }
      if (res.ok) return json as T;
      const j = (json ?? {}) as { error?: string | { message?: string; code?: string }; code?: string };
      const message = typeof j.error === 'string' ? j.error : j.error?.message ?? `Request failed (${res.status})`;
      const code = typeof j.error === 'object' ? j.error?.code : j.code;
      const ra = Number(res.headers.get('retry-after'));
      last = new ApiError(message, res.status, code, Number.isFinite(ra) ? ra : undefined);
      if (!last.transient) throw last;
    } catch (e) {
      if (e instanceof ApiError && !e.transient) throw e;
      if (o.signal?.aborted) throw new ApiError('Cancelled', 0, 'cancelled');
      if (!(e instanceof ApiError)) {
        const timedOut = (e as Error)?.name === 'TimeoutError' || ctrl.signal.reason?.name === 'TimeoutError';
        last = new ApiError(timedOut ? 'The server took too long to answer.' : 'Could not reach the server. Check your connection.', 0, timedOut ? 'timeout' : 'network');
      } else last = e;
    } finally {
      clearTimeout(timer); o.signal?.removeEventListener('abort', onAbort);
    }
    if (attempt < retries) await sleep(Math.min(4000, (last?.retryAfter ? last.retryAfter * 1000 : 300 * 3 ** attempt) + Math.random() * 120));
  }
  throw last ?? new ApiError('Request failed', 0);
}
