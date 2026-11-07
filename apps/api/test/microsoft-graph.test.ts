import { describe, expect, it } from 'vitest';
import { GraphConnector, subjectFromName } from '../src/schools/microsoft-graph';
import { SchoolStore } from '../src/schools/store';

const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status });

describe('Microsoft 365 for real schools (Graph)', () => {
  it('reads Teams classes, teachers, students and assignments into the school, once', async () => {
    const calls: string[] = [];
    const fake = async (url: string) => {
      calls.push(url);
      if (url.includes('/oauth2/v2.0/token')) return json({ access_token: 'tok' });
      if (url.includes('page=2')) return json({ value: [] });
      if (url.includes('/education/classes?')) return json({ value: [{ id: 'k1', displayName: 'Grade 9 Physics 9A' }], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/education/classes?page=2' });
      if (url.includes('/teachers')) return json({ value: [{ id: 't1', displayName: 'Mr Ahmed Salem', mail: 'ahmed@school.ae' }] });
      if (url.includes('/members')) return json({ value: [{ id: 't1', displayName: 'Mr Ahmed Salem', mail: 'ahmed@school.ae' }, { id: 's1', displayName: 'Rana Ali', userPrincipalName: 'Rana@school.ae' }] });
      if (url.includes('/assignments')) return json({ value: [{ id: 'a1', displayName: 'Forces worksheet', status: 'assigned', dueDateTime: '2026-11-20T08:00:00Z', instructions: { content: '<p>Do <b>all</b> questions</p>' } }, { id: 'a2', displayName: 'Draft', status: 'draft', dueDateTime: '2026-11-20T08:00:00Z' }] });
      return json({}, 404);
    };
    const schools = new SchoolStore();
    schools.orgs.push({ id: 'sch-x', real: true, name: 'X School', shortName: 'X', kind: 'school', parentOrgId: null, emirate: 'dubai', licence: null, joinCode: 'X-1', microsoft: { connected: true, tenantId: '11111111-2222-3333-4444-555555555555', domain: 'school.ae', connectedAt: null, connectedBy: null, lastSyncAt: null, synced: null } });
    const g = new GraphConnector({ clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://api/cb', stateSecret: 'state-secret' }, fake);
    const r = await g.sync(schools, schools.org('sch-x')!, '2026-11-06');
    expect(r).toEqual({ classes: 1, teachers: 1, students: 1, assignments: 1 });
    const st = schools.streams.find((x) => x.teamsClassId === 'k1')!;
    expect(st).toMatchObject({ subject: 'physics', name: 'Grade 9 Physics 9A' });
    expect(schools.roster.find((x) => x.email === 'rana@school.ae')).toMatchObject({ grade: 9, real: true });
    expect(schools.posted.find((p) => p.title === 'Forces worksheet')).toMatchObject({ instructions: 'Do all questions', source: 'teams', dueDate: '2026-11-20' });
    expect(calls[0]).toContain('/11111111-2222-3333-4444-555555555555/oauth2/v2.0/token');
    // a second sync adds nothing twice
    expect(await g.sync(schools, schools.org('sch-x')!, '2026-11-06')).toEqual({ classes: 1, teachers: 0, students: 0, assignments: 0 });
  });

  it('signs the consent round trip so another school cannot be connected by editing the link', () => {
    const g = new GraphConnector({ clientId: 'cid', clientSecret: 'sec', redirectUri: 'https://api/cb', stateSecret: 'state-secret' });
    const state = g.state('sch-x');
    expect(g.readState(state)).toBe('sch-x');
    expect(g.readState(state.replace('sch-x', 'sch-y'))).toBeNull();
    expect(g.readState(g.state('sch-x', Date.now() - 3_600_000))).toBeNull();
    expect(g.consentUrl('sch-x')).toMatch(/^https:\/\/login\.microsoftonline\.com\/organizations\/adminconsent\?client_id=cid/);
  });

  it('guesses class subjects from their names', () => {
    expect(subjectFromName('G11 Mathematics HL')).toBe('maths');
    expect(subjectFromName('Arabic B 10C')).toBe('arabic');
    expect(subjectFromName('Homeroom 7A')).toBe('other');
  });
});
