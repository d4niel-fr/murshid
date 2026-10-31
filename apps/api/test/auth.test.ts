import { describe, expect, it } from 'vitest';
import { sign } from 'hono/jwt';
import { buildApi } from '../src/app';
import { createMemoryRepository } from '../src/repo/memory';
import { seedRepository } from '../src/repo/seed';
import { NOW, SEED, setup } from './helpers';

const SECRET = 'test-jwt-secret-at-least-32-characters-long';

async function jwtApp(authMode: 'jwt' | 'dev' = 'jwt') {
  const repo = createMemoryRepository();
  await seedRepository(repo, NOW);
  return buildApi({ repo, now: () => NOW, config: { authMode, jwtSecret: SECRET, jwtAudience: 'authenticated' } }).app;
}
const exp = Math.floor(Date.now() / 1000) + 3600;

describe('auth', () => {
  it('health and openapi are public', async () => {
    const { call } = await setup();
    expect((await call('GET', '/health')).status).toBe(200);
    const doc = await call('GET', '/openapi.json');
    expect(doc.status).toBe(200);
    expect(doc.body.openapi).toBe('3.1.0');
    expect(Object.keys(doc.body.paths)).toContain('/planner/week');
    expect(doc.body.paths['/goals/{id}'].patch.requestBody).toBeTruthy();
  });

  it('rejects requests without credentials', async () => {
    const { call } = await setup();
    expect((await call('GET', '/me')).status).toBe(401);
  });

  it('accepts the dev header in dev mode', async () => {
    const { aisha } = await setup();
    const r = await aisha('GET', '/me');
    expect(r.status).toBe(200);
    expect(r.body.student.full_name).toBe('Aisha Test');
    expect(r.body.user.auth_via).toBe('dev');
  });

  it('verifies a Supabase HS256 JWT and reads role from app_metadata', async () => {
    const app = await jwtApp();
    const token = await sign({ sub: SEED.aisha.authUserId, aud: 'authenticated', exp, email: 'a@example.test', role: 'authenticated' }, SECRET);
    const r = await app.request('/me', { headers: { authorization: `Bearer ${token}` } });
    expect(r.status).toBe(200);
    const body = await r.json() as any;
    expect(body.user).toMatchObject({ id: SEED.aisha.authUserId, role: 'student', auth_via: 'jwt' });

    const gTok = await sign({ sub: 'g1', aud: 'authenticated', exp, email: SEED.guardian.email, app_metadata: { murshid_role: 'guardian' } }, SECRET);
    const g = await app.request('/guardian/students', { headers: { authorization: `Bearer ${gTok}` } });
    expect(g.status).toBe(200);
  });

  it('rejects bad signature, wrong audience, expired token, and dev header in jwt mode', async () => {
    const app = await jwtApp();
    const bad = await sign({ sub: 'x', aud: 'authenticated', exp }, 'another-secret-that-is-long-enough-123');
    expect((await app.request('/me', { headers: { authorization: `Bearer ${bad}` } })).status).toBe(401);
    const aud = await sign({ sub: 'x', aud: 'other', exp }, SECRET);
    expect((await app.request('/me', { headers: { authorization: `Bearer ${aud}` } })).status).toBe(401);
    const expired = await sign({ sub: 'x', aud: 'authenticated', exp: 1000 }, SECRET);
    expect((await app.request('/me', { headers: { authorization: `Bearer ${expired}` } })).status).toBe(401);
    expect((await app.request('/me', { headers: { 'x-dev-user-id': 'dev-aisha' } })).status).toBe(401);
  });

  it('dev mode still verifies a bearer token when a secret is set', async () => {
    const app = await jwtApp('dev');
    const token = await sign({ sub: SEED.rohan.authUserId, aud: 'authenticated', exp }, SECRET);
    const r = await app.request('/me', { headers: { authorization: `Bearer ${token}` } });
    expect(((await r.json()) as any).student.full_name).toBe('Rohan Test');
  });
});
