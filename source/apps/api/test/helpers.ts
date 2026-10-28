import { createSeededApp } from '../src/app';
import { SEED } from '../src/repo/seed';

/** Monday 12 Oct 2026, 10:00 Asia/Dubai */
export const NOW = new Date('2026-10-12T06:00:00Z');

export async function setup(now = NOW) {
  const built = await createSeededApp({ now: () => now, config: { authMode: 'dev', inboxSecret: 'test-secret', jwtSecret: '' } });
  const { app } = built;
  const call = async (method: string, path: string, opts: { as?: string; role?: string; email?: string; school?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.as !== undefined) headers['x-dev-user-id'] = opts.as;
    if (opts.role) headers['x-dev-role'] = opts.role;
    if (opts.email) headers['x-dev-email'] = opts.email;
    if (opts.school) headers['x-dev-school-id'] = opts.school;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  const aisha = (method: string, path: string, body?: unknown) => call(method, path, { as: SEED.aisha.authUserId, body });
  const rohan = (method: string, path: string, body?: unknown) => call(method, path, { as: SEED.rohan.authUserId, body });
  return { ...built, call, aisha, rohan };
}

export { SEED };
