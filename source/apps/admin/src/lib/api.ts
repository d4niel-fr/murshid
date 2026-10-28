/** Admin API client: /admin/* on the Murshid API with dev auth (x-dev-role: admin). */
export const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_API) || 'http://localhost:8787';
const ADMIN_USER = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_ADMIN_USER) || 'dev-admin';

export class ApiError extends Error {
  constructor(message: string, public status: number, public details?: unknown) { super(message); }
}

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
/** Check a passcode against the API (true when accepted, or when the API has no passcode set). */
export async function checkAdminPasscode(code: string): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/admin/ai-status`, { headers: { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER, 'x-admin-passcode': code }, cache: 'no-store' });
    return res.ok;
  } catch { return false; }
}

export async function api<T = any>(path: string, init: { method?: string; body?: unknown; as?: 'admin' | 'staff' | 'public' } = {}): Promise<T> {
  let res: Response;
  const auth: Record<string, string> = init.as === 'public' ? {}
    : init.as === 'staff' ? (getSession()?.headers ?? { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER })
    : { 'x-dev-role': 'admin', 'x-dev-user-id': ADMIN_USER };
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: init.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...auth, ...(init.as !== 'public' && getAdminPasscode() ? { 'x-admin-passcode': getAdminPasscode()! } : {}) },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(`Can't reach the Murshid API at ${API_BASE}. Start it with: cd apps/api && pnpm start`, 0);
  }
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (res.status === 401 && body?.code === 'admin_passcode' && typeof window !== 'undefined') {
    setAdminPasscode(null);
    throw new ApiError('Admin passcode required: sign in again as school admin with the passcode.', 401);
  }
  if (!res.ok) throw new ApiError(body?.error ?? `HTTP ${res.status}`, res.status, body?.details);
  return body as T;
}

/** Student-side URL (what the student app reads) for "view as student" links. */
export const studentUrl = (path: string) => `${API_BASE}${path}`;
