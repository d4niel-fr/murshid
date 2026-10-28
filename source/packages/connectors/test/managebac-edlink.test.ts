import { describe, expect, it } from 'vitest';
import { ManageBacConnector } from '../src/providers/managebac';
import { EdlinkConnector } from '../src/providers/edlink';
import { InMemoryTokenVault } from '../src/core/vault';
import { mockFetch, STUDENT, TEST_ENV } from './helpers/mockFetch';

const MB = 'https://api.managebac.com/v2p2';

describe('ManageBac', () => {
  it('uses per-school token header, reads only the student memberships, paginates tasks', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch([
      { match: `${MB}/students/777/memberships`, fixture: 'managebac/memberships.json' },
      { match: `${MB}/classes/11001`, fixture: 'managebac/class-11001.json' },
      { match: (u) => u.pathname === '/v2p2/classes/11001/tasks' && u.searchParams.get('page') === '1', fixture: 'managebac/tasks-11001-p1.json' },
      { match: (u) => u.pathname === '/v2p2/classes/11001/tasks' && u.searchParams.get('page') === '2', fixture: 'managebac/tasks-11001-p2.json' },
    ]);
    const c = new ManageBacConnector({ vault, env: {}, http: { fetch: f } });
    await expect(c.authUrl()).rejects.toThrow(/per-school API token/);
    const grant = await c.handleCallback({ kind: 'api_token', token: 'school-token-fixture' });
    const r = await c.sync({ studentId: STUDENT, tokenRef: grant.token_ref, options: { managebacStudentId: '777' } });

    expect(f.calls.every((x) => x.headers['auth-token'] === 'school-token-fixture')).toBe(true);
    expect(f.calls.some((x) => x.url.includes('11002'))).toBe(false); // archived class skipped
    expect(r.courses).toEqual([{ student_id: STUDENT, name: 'Mathematics: Analysis & Approaches HL', teacher: 'Omar Test', source: 'managebac', external_id: '11001' }]);
    expect(r.materials.map((m) => [m.external_id, m.kind, m.due_at, m.body_text])).toEqual([
      ['task:501', 'assignment', '2026-10-20T04:00:00.000Z', 'Submit via Turnitin.'],
      ['task:502', 'exam', '2026-11-02T05:00:00.000Z', null],
    ]);
    // student disconnect keeps the shared school token
    await c.revoke(grant.token_ref);
    expect(vault.size()).toBe(1);
    await c.revokeSchoolToken(grant.token_ref);
    expect(vault.size()).toBe(0);
  });

  it('requires the ManageBac student id', async () => {
    const vault = new InMemoryTokenVault();
    const c = new ManageBacConnector({ vault, env: {} });
    const g = await c.handleCallback({ kind: 'api_token', token: 't' });
    await expect(c.sync({ studentId: STUDENT, tokenRef: g.token_ref })).rejects.toThrow(/managebacStudentId/);
  });
});

describe('Edlink (skeleton)', () => {
  it('unwraps $data token + pages, maps classes and assignments', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch([
      { method: 'POST', match: 'https://ed.link/api/authentication/token', fixture: 'edlink/token.json' },
      { match: 'https://ed.link/api/v2/my/classes', fixture: 'edlink/classes.json' },
      { match: /\/my\/classes\/c0000000-0000-0000-0000-000000000001\/assignments$/, fixture: 'edlink/assignments.json' },
    ]);
    const c = new EdlinkConnector({ vault, env: TEST_ENV, http: { fetch: f } });
    expect(new URL((await c.authUrl({ state: 's' })).url).origin + '/sso/login').toBe('https://ed.link/sso/login');
    const g = await c.handleCallback({ kind: 'oauth2', code: 'c', state: 's' });
    expect((await vault.get(g.token_ref)).access_token).toBe('edlink-fixture-access');
    const r = await c.sync({ studentId: STUDENT, tokenRef: g.token_ref });
    expect(r.courses[0]!.name).toBe('Grade 10 Biology');
    expect(r.materials[0]).toMatchObject({ title: 'Cell structure worksheet', body_text: 'Label the diagram', source: 'edlink', due_at: '2025-03-24T11:52:56.000Z' });
  });
});
