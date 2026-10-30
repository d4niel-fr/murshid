import { afterEach, describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';

describe('admin passcode (public demo deployments)', () => {
  afterEach(() => { delete process.env.ADMIN_PASSCODE; });

  it('protects admin data when ADMIN_PASSCODE is set; students and teachers stay one-click', async () => {
    process.env.ADMIN_PASSCODE = 'test-pass';
    const { app } = await createSeededApp();
    const admin = { 'x-dev-role': 'admin', 'x-dev-user-id': 'dev-admin' };
    expect((await app.request('/admin/overview', { headers: admin })).status).toBe(401);
    expect(await (await app.request('/admin/survey', { headers: admin })).json()).toMatchObject({ code: 'admin_passcode' });
    expect((await app.request('/admin/overview', { headers: { ...admin, 'x-admin-passcode': 'wrong' } })).status).toBe(401);
    expect((await app.request('/admin/overview', { headers: { ...admin, 'x-admin-passcode': 'test-pass' } })).status).toBe(200);
    expect((await app.request('/orgs/demo-school', { headers: { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' } })).status).toBe(401);
    expect((await app.request('/teacher/me', { headers: { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' } })).status).toBe(200);
    expect((await app.request('/dashboard', { headers: { 'x-dev-user-id': 'demo-ideal' } })).status).toBe(200);
    expect((await app.request('/health')).status).toBe(200);
  });

  it('gates the study buddy guardian and school switches when ADMIN_PASSCODE is set; reading the status stays open', async () => {
    process.env.ADMIN_PASSCODE = 'test-pass';
    const { app } = await createSeededApp();
    const put = (by: 'guardian' | 'school', role: string, passcode?: string) => app.request('/buddy/controls', {
      method: 'PUT', body: JSON.stringify({ by, enabled: false }),
      headers: { 'content-type': 'application/json', 'x-dev-user': 'demo-g9', 'x-dev-user-id': 'demo-g9', 'x-dev-role': role, ...(passcode ? { 'x-admin-passcode': passcode } : {}) },
    });
    const g = await put('guardian', 'guardian');
    expect(g.status).toBe(401);
    expect(await g.json()).toMatchObject({ code: 'admin_passcode' });
    expect((await put('guardian', 'guardian', 'wrong')).status).toBe(401);
    expect((await put('school', 'admin')).status).toBe(401);
    expect((await put('guardian', 'guardian', 'test-pass')).status).toBe(200);
    expect((await put('school', 'admin', 'test-pass')).status).toBe(200);
    expect((await app.request('/buddy', { headers: { 'x-dev-user': 'demo-g9', 'x-dev-user-id': 'demo-g9' } })).status).toBe(200);
  });

  it('is off when ADMIN_PASSCODE is not set (local development)', async () => {
    const { app } = await createSeededApp();
    expect((await app.request('/admin/overview', { headers: { 'x-dev-role': 'admin', 'x-dev-user-id': 'dev-admin' } })).status).toBe(200);
  });
});
