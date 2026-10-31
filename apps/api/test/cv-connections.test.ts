import { describe, expect, it } from 'vitest';
import { setup } from './helpers';

describe('cv', () => {
  it('builds a JSON Resume version from profile + achievements', async () => {
    const { aisha, rohan } = await setup();
    const r = await aisha('POST', '/cv', { target: 'university', basics: { email: 'aisha@example.test' } });
    expect(r.status).toBe(201);
    const j = r.body.json;
    expect(j.basics).toMatchObject({ name: 'Aisha Test', label: 'Grade 11 Student', email: 'aisha@example.test' });
    expect(j.education[0]).toMatchObject({ institution: 'Test Academy Dubai', studyType: 'British curriculum (IGCSE / A-Level)' });
    expect(j.awards[0].title).toBe('School Science Fair – 1st place');
    expect(j.certificates[0].url).toBe('https://example.test/cert');
    expect(j.projects[0]).toMatchObject({ name: 'Robotics club captain', roles: ['Leader'] });
    expect(j.languages).toEqual([{ language: 'English' }, { language: 'Arabic' }]);
    expect(Object.keys(j).indexOf('awards')).toBeLessThan(Object.keys(j).indexOf('volunteer'));
    expect(r.body.pdf_url).toBeNull();

    const intern = await aisha('POST', '/cv', { target: 'internship' });
    expect(Object.keys(intern.body.json).indexOf('projects')).toBeLessThan(Object.keys(intern.body.json).indexOf('awards'));
    expect((await aisha('GET', '/cv')).body.items).toHaveLength(2);
    expect((await aisha('GET', '/cv?target=internship')).body.items).toHaveLength(1);
    expect((await rohan('GET', `/cv/${r.body.id}`)).status).toBe(404);
    expect((await aisha('DELETE', `/cv/${r.body.id}`)).status).toBe(204);
  });
});

describe('connections', () => {
  it('start → callback → connected, with a vault reference (no raw tokens)', async () => {
    const { aisha, call } = await setup();
    const s = await aisha('POST', '/connections/google_classroom/start');
    expect(s.status).toBe(201);
    expect(s.body.authorize_url).toContain('state=' + s.body.state);
    const cb = await call('GET', `/connections/google_classroom/callback?state=${s.body.state}&code=abc`);
    expect(cb.status).toBe(200);
    expect(cb.body).toMatchObject({ status: 'connected', token_ref: `vault://connections/${s.body.connection_id}` });
    const list = (await aisha('GET', '/connections')).body;
    expect(list.items).toHaveLength(1);
    expect(list.providers).toContain('microsoft_teams');
    expect((await call('GET', `/connections/google_classroom/callback?state=${s.body.state}&code=abc`)).status).toBe(404);
    expect((await aisha('DELETE', `/connections/${s.body.connection_id}`)).status).toBe(204);
  });

  it('records callback errors and rejects unknown providers', async () => {
    const { aisha, call } = await setup();
    const s = await aisha('POST', '/connections/microsoft_teams/start');
    const cb = await call('GET', `/connections/microsoft_teams/callback?state=${s.body.state}&error=access_denied`);
    expect(cb.status).toBe(400);
    expect(cb.body.status).toBe('error');
    expect((await aisha('POST', '/connections/myspace/start')).status).toBe(404);
  });

  it('blocks under-18s without guardian consent', async () => {
    const { call } = await setup();
    await call('POST', '/students', { as: 'minor', body: { full_name: 'Omar Test', date_of_birth: '2011-05-05', grade: 10, curriculum: 'american' } });
    const r = await call('POST', '/connections/google_classroom/start', { as: 'minor' });
    expect(r.status).toBe(403);
    // an adult (Rohan, 18) can connect even with a pending guardian
    expect((await call('POST', '/connections/google_classroom/start', { as: 'dev-rohan' })).status).toBe(201);
  });
});
