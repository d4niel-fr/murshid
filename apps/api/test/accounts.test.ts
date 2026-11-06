import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

const SECRET = 'test-secret-for-signing';
const today = dubaiDate(NOW);

/** A Supabase-style access token for a person. */
const token = (sub: string, email: string, name?: string) =>
  sign({ sub, email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, user_metadata: name ? { full_name: name } : {} }, SECRET, 'HS256');

async function setup() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'jwt', jwtSecret: SECRET, platformAdmins: ['boss@murshid.ae'] }, rateLimit: false });
  const as = (tok: string) => async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
    const res = await built.app.request(path, { method, headers: { authorization: `Bearer ${tok}`, ...extra, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
  return { built, as };
}

describe('real accounts (production sign-in)', () => {
  it('a new student sets up, sees an empty (not invented) app, and edits their own subjects', async () => {
    const { as } = await setup();
    const sara = as(await token('u-sara', 'sara@example.com', 'Sara Ali'));
    const first = await sara('GET', '/account');
    expect(first.status).toBe(200);
    expect(first.body.needsSetup).toBe(true);
    expect((await sara('GET', '/dashboard')).body.code).toBe('needs_setup');
    const made = await sara('POST', '/account/setup', { role: 'student', name: 'Sara Ali', grade: 10 });
    expect(made.status).toBe(201);
    expect(made.body.me).toMatchObject({ role: 'student', name: 'Sara Ali' });
    expect(made.body.licence).toMatchObject({ type: 'family', status: 'trial' });
    // every screen of the student app works for a brand-new account with nothing in it yet
    for (const path of ['/dashboard', '/academics', '/extracurriculars', '/progress?area=academics', '/progress?area=goals', '/progress/areas', '/student/tasks', '/student/goals', '/student/projects', '/student/achievements', '/student/applications', '/student/training', '/buddy', '/profile/links', '/student/cv/linkedin', '/opportunities', '/student/school']) {
      const r = await sara('GET', path);
      expect([200, 404], `${path} -> ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`).toContain(r.status);
    }
    const academics = await sara('GET', '/academics');
    expect(academics.status).toBe(200);
    expect(JSON.stringify(academics.body)).not.toMatch(/Mathematics|Physics/);
    const sub = await sara('POST', '/student/me/subjects', { name: 'Chemistry', teacher: 'Mr Khan', target: 85 });
    expect(sub.status).toBe(201);
    expect(JSON.stringify((await sara('GET', '/academics')).body)).toContain('Chemistry');
    // a mark, an activity with a session, a task and a goal: every screen still works and shows them
    expect((await sara('POST', '/student/me/assessments', { subjectId: sub.body.id, title: 'Moles quiz', kind: 'quiz', date: addDays(today, -2), maxScore: 20, score: 17 })).status).toBe(201);
    const act = await sara('POST', '/student/me/activities', { kind: 'football', detail: 'School team', days: [2, 4], minutes: 60 });
    expect(act.status).toBe(201);
    expect((await sara('POST', `/student/me/activities/${act.body.id}/sessions`, { date: addDays(today, -1), minutes: 75 })).status).toBe(201);
    expect((await sara('POST', '/student/me/tasks', { title: 'Revise moles', date: today })).status).toBe(201);
    expect((await sara('POST', '/student/me/goals', { title: 'Chemistry to 90%', category: 'academic', unit: '%', start: 80, target: 90, dueDate: addDays(today, 60), current: 85 })).status).toBe(201);
    for (const path of ['/dashboard', '/academics', '/extracurriculars', '/progress?area=academics', '/progress?area=goals', '/progress/areas', '/student/tasks', '/student/goals']) {
      const r = await sara('GET', path);
      expect(r.status, `${path} -> ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`).toBe(200);
    }
    expect(JSON.stringify((await sara('GET', '/academics')).body)).toContain('Moles quiz');
    // a second setup is refused
    expect((await sara('POST', '/account/setup', { role: 'parent', name: 'X' })).status).toBe(409);
  });

  it('Murshid adds a school; its admin invites a teacher, imports students and makes a class; everyone signs in by email', async () => {
    const { as } = await setup();
    const boss = as(await token('u-boss', 'boss@murshid.ae'));
    expect((await as(await token('u-x', 'x@example.com'))('GET', '/platform/schools')).status).toBe(403);
    const school = await boss('POST', '/platform/schools', { name: 'Al Noor Academy', shortName: 'ANA', adminName: 'Huda Saleh', adminEmail: 'huda@alnoor.ae', seats: 50 });
    expect(school.status).toBe(201);
    expect(school.body.joinCode).toMatch(/^ANA-/);

    const huda = as(await token('u-huda', 'huda@alnoor.ae'));
    expect((await huda('GET', '/account')).body.me.role).toBe('school_admin');
    const teacher = await huda('POST', '/school/teachers', { name: 'Omar Farouk', email: 'omar@alnoor.ae', subject: 'arabic' });
    expect(teacher.status).toBe(201);
    const roster = await huda('POST', '/school/roster', { students: [{ name: 'Lina Haddad', email: 'lina@alnoor.ae', grade: 9, section: '9A' }, { name: 'Yousef Ali', grade: 9, section: '9A' }] });
    expect(roster.body.added).toBe(2);
    const cls = await huda('POST', '/school/classes', { name: 'Grade 9 Arabic', subject: 'arabic', teacherId: teacher.body.id, sections: ['9A'] });
    expect(cls.status).toBe(201);
    expect(cls.body.students).toBe(2);
    expect(cls.body.joinCode).toMatch(/^[A-Z2-9]{6}$/);

    // the teacher signs in with the invited email and posts work; the student (roster email) sees it
    const omar = as(await token('u-omar', 'omar@alnoor.ae'));
    expect((await omar('GET', '/account')).body.me.role).toBe('teacher');
    const posted = await omar('POST', `/teacher/classes/${cls.body.id}/assignments`, { title: 'Read the poem and list three images', instructions: null, dueDate: addDays(today, 3) });
    expect(posted.status).toBe(201);
    // nothing invented: only what the teacher posted
    const list = await omar('GET', `/teacher/classes/${cls.body.id}/assignments`);
    expect(list.body.items.length).toBe(1);
    const lina = as(await token('u-lina', 'lina@alnoor.ae'));
    const me = await lina('GET', '/account');
    expect(me.body.me.role).toBe('student');
    const sch = await lina('GET', '/student/school');
    expect(sch.status).toBe(200);
    expect(JSON.stringify(sch.body)).toContain('Read the poem and list three images');
    // another school's admin cannot touch this class
    const stranger = as(await token('u-s', 'stranger@example.com'));
    expect((await stranger('GET', '/school/setup')).status).toBe(403);
  });

  it('a student joins a class with its code', async () => {
    const { as } = await setup();
    const boss = as(await token('u-boss', 'boss@murshid.ae'));
    await boss('POST', '/platform/schools', { name: 'Bright Future School', shortName: 'BFS', adminName: 'A', adminEmail: 'admin@bfs.ae' });
    const admin = as(await token('u-a', 'admin@bfs.ae'));
    const t = await admin('POST', '/school/teachers', { name: 'Ms Rao', email: 'rao@bfs.ae', subject: 'science' });
    const cls = await admin('POST', '/school/classes', { name: 'Grade 7 Science', subject: 'science', teacherId: t.body.id });
    expect(cls.status, JSON.stringify(cls.body)).toBe(201);
    const kid = as(await token('u-kid', 'kid@gmail.com'));
    await kid('POST', '/account/setup', { role: 'student', name: 'Adam Noor', grade: 7 });
    const joined = await kid('POST', '/student/classes/join', { code: cls.body.joinCode.toLowerCase() });
    expect(joined.status).toBe(201);
    expect(joined.body.students).toBe(1);
    expect((await kid('GET', '/student/school')).status).toBe(200);
  });

  it('a parent links to their child with a one-use code and can look but not change', async () => {
    const { as } = await setup();
    const kid = as(await token('u-kid', 'kid@example.com'));
    await kid('POST', '/account/setup', { role: 'student', name: 'Maya Ali', grade: 8 });
    const code = (await kid('POST', '/account/parent-code')).body.code;
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    const mum = as(await token('u-mum', 'mum@example.com'));
    const made = await mum('POST', '/account/setup', { role: 'parent', name: 'Rania Ali', childCode: code });
    expect(made.body.me.children).toEqual([expect.objectContaining({ name: 'Maya Ali' })]);
    expect((await mum('GET', '/dashboard')).status).toBe(200);
    expect((await mum('POST', '/student/tasks', { title: 'x', date: today })).body.code).toBe('parent_read_only');
    // the code was used up
    const dad = as(await token('u-dad', 'dad@example.com'));
    await dad('POST', '/account/setup', { role: 'parent', name: 'Karim Ali' });
    expect((await dad('POST', '/account/link-child', { code })).body.code).toBe('bad_child_code');
  });

  it('school life for a real school: a parent asks for leave, but never sees their child’s check-ins', async () => {
    const { as } = await setup();
    const boss = as(await token('u-boss', 'boss@murshid.ae'));
    await boss('POST', '/platform/schools', { name: 'Bright Future School', shortName: 'BFS', adminName: 'A', adminEmail: 'admin@bfs.ae' });
    const admin = as(await token('u-a', 'admin@bfs.ae'));
    const t = await admin('POST', '/school/teachers', { name: 'Ms Rao', email: 'rao@bfs.ae', subject: 'science' });
    expect(t.status, JSON.stringify(t.body)).toBe(201);
    const cls = await admin('POST', '/school/classes', { name: 'Grade 7 Science', subject: 'science', teacherId: t.body.id });
    expect(cls.status, JSON.stringify(cls.body)).toBe(201);
    const kid = as(await token('u-kid', 'kid@gmail.com'));
    await kid('POST', '/account/setup', { role: 'student', name: 'Adam Noor', grade: 7 });
    const joined = await kid('POST', '/student/classes/join', { code: cls.body.joinCode });
    expect(joined.status, JSON.stringify(joined.body)).toBe(201);
    // a real school starts empty: no invented check-ins, points, registers or dates
    const feel = await kid('GET', '/student/feelings');
    expect(feel.status, JSON.stringify(feel.body)).toBe(200);
    expect(feel.body.history).toEqual([]);
    expect((await kid('GET', '/student/points')).body.total).toBe(0);
    expect((await kid('GET', '/student/events')).body.upcoming).toEqual([]);
    expect((await kid('GET', '/student/timetable')).body.lessons).toEqual([]);
    expect((await kid('POST', '/student/feelings', { mood: 2, words: ['worried'], note: 'private thing', share: 'private' })).status).toBe(201);

    const code = (await kid('POST', '/account/parent-code')).body.code;
    const mum = as(await token('u-mum', 'mum@example.com'));
    await mum('POST', '/account/setup', { role: 'parent', name: 'Rania Noor', childCode: code });
    const mine = await mum('GET', '/student/feelings');
    expect(mine.status).toBe(403);
    expect(mine.body.code).toBe('feelings_private');
    const home = await mum('GET', '/student/today-at-school');
    expect(home.body).toMatchObject({ parent: true, mood: null, checkedIn: null });
    expect((await mum('POST', '/student/feelings', { mood: 5 })).body.code).toBe('parent_read_only');
    const leave = await mum('POST', '/student/leave', { from: addDays(today, 2), to: addDays(today, 2), reason: 'appointment', note: 'Dentist' });
    expect(leave.status).toBe(201);
    expect(leave.body).toMatchObject({ by: 'parent', byName: 'Rania Noor' });
    expect((await admin('GET', '/school/leave')).body.pending[0].name).toBe('Adam Noor');
    expect((await mum('GET', '/student/attendance')).body.leave).toHaveLength(1);
  });

  it('syncs app data across devices with versions, and deletes the account on request', async () => {
    const { as } = await setup();
    const sara = as(await token('u-sara', 'sara@example.com'));
    await sara('POST', '/account/setup', { role: 'student', name: 'Sara', grade: 11 });
    const a = await sara('PUT', '/me/sync/study', { base: 0, data: { decks: [{ id: 'd1', title: 'Forces' }] } });
    expect(a.body.version).toBe(1);
    const stale = await sara('PUT', '/me/sync/study', { base: 0, data: { decks: [] } });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ version: 1, data: { decks: [{ id: 'd1' }] } });
    expect((await sara('GET', '/me/sync?names=study')).body.docs.study.data.decks[0].title).toBe('Forces');
    expect((await sara('GET', '/me/sync/versions?names=study,boards')).body.versions).toEqual({ study: 1, boards: 0 });
    // someone else never sees it
    const other = as(await token('u-o', 'o@example.com'));
    expect((await other('GET', '/me/sync?names=study')).body.docs).toEqual({});
    const exp = await sara('GET', '/account/export');
    expect(exp.body.students[0].profile.name).toBe('Sara');
    expect((await sara('DELETE', '/account')).body.deleted).toBe(true);
    expect((await sara('GET', '/account')).body.needsSetup).toBe(true);
  });

  it('refuses a missing, forged or expired token', async () => {
    const { built } = await setup();
    expect((await built.app.request('/account')).status).toBe(401);
    const forged = await sign({ sub: 'u', email: 'boss@murshid.ae', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 60 }, 'wrong-secret', 'HS256');
    expect((await built.app.request('/platform/schools', { headers: { authorization: `Bearer ${forged}` } })).status).toBe(401);
    const old = await sign({ sub: 'u', email: 'x@y.z', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) - 60 }, SECRET, 'HS256');
    expect((await built.app.request('/account', { headers: { authorization: `Bearer ${old}` } })).status).toBe(401);
  });
});
