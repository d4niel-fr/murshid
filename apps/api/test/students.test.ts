import { describe, expect, it } from 'vitest';
import { SEED, setup } from './helpers';

const profile = { full_name: 'Sara Test', date_of_birth: '2011-01-20', grade: 10, curriculum: 'ib', interests: ['art'] };

describe('students & /me', () => {
  it('creates a profile for a new user and blocks duplicates', async () => {
    const { call } = await setup();
    const r = await call('POST', '/students', { as: 'new-user', body: profile });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ full_name: 'Sara Test', auth_user_id: 'new-user', languages: [] });
    expect((await call('POST', '/students', { as: 'new-user', body: profile })).status).toBe(409);
    const me = await call('GET', '/me', { as: 'new-user' });
    expect(me.body.consent).toMatchObject({ minor: true, guardian_consent: 'none', can_connect: false });
  });

  it('enforces the 13+ age gate', async () => {
    const { call } = await setup();
    const r = await call('POST', '/students', { as: 'kid', body: { ...profile, date_of_birth: '2015-01-01', grade: 6 } });
    expect(r.status).toBe(403);
  });

  it('validates bodies with zod', async () => {
    const { call } = await setup();
    const r = await call('POST', '/students', { as: 'x', body: { ...profile, grade: 20, curriculum: 'nope' } });
    expect(r.status).toBe(400);
    expect(r.body.details.map((d: any) => d.path)).toEqual(expect.arrayContaining(['grade', 'curriculum']));
  });

  it('reads and updates own profile; other students get 404', async () => {
    const { aisha, rohan } = await setup();
    expect((await aisha('GET', `/students/${SEED.aisha.studentId}`)).status).toBe(200);
    expect((await rohan('GET', `/students/${SEED.aisha.studentId}`)).status).toBe(404);
    const p = await aisha('PATCH', `/students/${SEED.aisha.studentId}`, { interests: ['astronomy'] });
    expect(p.body.interests).toEqual(['astronomy']);
    expect((await rohan('PATCH', `/students/${SEED.aisha.studentId}`, { grade: 9 })).status).toBe(404);
  });

  it('lets a counsellor of the same school read a consented student only', async () => {
    const { call } = await setup();
    const ok = await call('GET', `/students/${SEED.aisha.studentId}`, { as: 'c1', role: 'counsellor', school: SEED.schoolId });
    expect(ok.status).toBe(200);
    const other = await call('GET', `/students/${SEED.aisha.studentId}`, { as: 'c2', role: 'counsellor', school: 'other-school' });
    expect(other.status).toBe(404);
    const patch = await call('PATCH', `/students/${SEED.aisha.studentId}`, { as: 'c1', role: 'counsellor', school: SEED.schoolId, body: { grade: 9 } });
    expect(patch.status).toBe(403);
  });

  it('deletes a profile with its rows', async () => {
    const { aisha, deps } = await setup();
    expect((await aisha('DELETE', `/students/${SEED.aisha.studentId}`)).status).toBe(204);
    expect(await deps.repo.tasks.list({ student_id: SEED.aisha.studentId })).toHaveLength(0);
    expect((await aisha('GET', '/goals')).status).toBe(404);
  });
});
