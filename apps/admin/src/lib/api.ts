/** Admin API client: /admin/* on the Murshid API with dev auth (x-dev-role: admin). */
/** The API, on the same domain: the "api" service at /api on Vercel, proxied to localhost:8787 by next.config in local dev. */
export const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_API) || '/api';
const ADMIN_USER = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_ADMIN_USER) || 'dev-admin';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown, public code?: string) { super(message); }
}

/** A fresh key for one logical write: retries of the same click reuse it, so the API never acts twice. */
export const newIdempotencyKey = (prefix = 'adm') => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;

/** Staff session from "Sign in with Microsoft" (dev headers in the demo; a real Murshid session in production). */
export interface StaffSession { role: 'teacher' | 'school_admin' | 'student'; name: string; email: string; orgId: string; orgName: string; headers: Record<string, string> }
const SESSION_KEY = 'murshid:staff-session';
export function getSession(): StaffSession | null {
  if (typeof window === 'undefined') return null;
  try { const raw = localStorage.getItem(SESSION_KEY); return raw ? (JSON.parse(raw) as StaffSession) : null; } catch { return null; }
}
export function setSession(s: StaffSession | null) {
  if (typeof window === 'undefined') return;
  if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new Event('murshid-session'));
}

/** Demo deployment: admin data needs the admin passcode (x-admin-passcode); kept in this browser only. */
const PASSCODE_KEY = 'murshid:admin-passcode';
export function getAdminPasscode(): string | null {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem(PASSCODE_KEY); } catch { return null; }
}
export function setAdminPasscode(code: string | null) {
  if (typeof window === 'undefined') return;
  if (code) localStorage.setItem(PASSCODE_KEY, code); else localStorage.removeItem(PASSCODE_KEY);
  window.dispatchEvent(new Event('murshid-passcode'));
}
/** Check a passcode against the API: 'ok' (accepted, or the API needs none), 'locked' (wrong or missing), 'offline'. */
export async function adminAccess(code: string): Promise<'ok' | 'locked' | 'offline'> {
  try {
    const res = await fetch(`${API_BASE}/admin/ai-status`, { headers: { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER, 'x-admin-passcode': code }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
    if (res.ok) return 'ok';
    return res.status === 401 || res.status === 403 ? 'locked' : 'offline';
  } catch { return 'offline'; }
}
/** true when the passcode is accepted (or the API has no passcode set). */
export async function checkAdminPasscode(code: string): Promise<boolean> {
  return (await adminAccess(code)) === 'ok';
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; as?: 'admin' | 'staff' | 'public'; headers?: Record<string, string>; timeoutMs?: number } = {}): Promise<T> {
  let res: Response;
  const auth: Record<string, string> = init.as === 'public' ? {}
    : init.as === 'staff' ? (getSession()?.headers ?? { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER })
    : { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), init.timeoutMs ?? 15_000);
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...auth, ...(init.as !== 'public' && getAdminPasscode() ? { 'x-admin-passcode': getAdminPasscode()! } : {}), ...init.headers },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
      signal: ctrl.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw new ApiError('The Murshid API took too long to answer. Please try again.', 0, undefined, 'timeout');
    throw new ApiError(`Can't reach the Murshid API at ${API_BASE}. Start it with: cd apps/api && pnpm start`, 0, undefined, 'offline');
  } finally { clearTimeout(timer); }
  const text = await res.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { error: text.slice(0, 200) }; }
  if (res.status === 429) {
    const wait = Number(res.headers.get('retry-after')) || body?.retryAfter || 30;
    throw new ApiError(`Too many requests. Wait ${wait} second${wait === 1 ? '' : 's'} and try again.`, 429, undefined, 'rate_limited');
  }
  if (res.status === 401 && body?.code === 'admin_passcode' && typeof window !== 'undefined') {
    setAdminPasscode(null);
    throw new ApiError('Admin passcode required: sign in again as school admin with the passcode.', 401);
  }
  if (!res.ok) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status, body?.details, body?.code);
  return body as T;
}

/** Student-side URL (what the student app reads) for "view as student" links. */
export const studentUrl = (path: string) => `${API_BASE}${path}`;
