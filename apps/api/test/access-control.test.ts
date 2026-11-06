import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

/**
 * Broken access control: every route that takes an id checks that the caller may see it. Two schools, their admins,
 * teachers and students, a parent and a stranger, all with real (jwt) sign-in.
 */
const SECRET = 'access-control-test-secret-0123456789';
const today = dubaiDate(NOW);
const token = (sub: string, email: string) =>
  sign({ sub, email, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET, 'HS256');
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]).toString('base64');

async function world() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'jwt', jwtSecret: SECRET, platformAdmins: ['boss@murshid.ae'] }, rateLimit: false });
  const as = async (sub: string, email: string) => {
    const t = await token(sub, email);
    return async (method: string, path: string, body?: unknown, extra: Record<string, string> = {}) => {
      const res = await built.app.request(path, { method, headers: { authorization: `Bearer ${t}`, ...extra, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
      const text = await res.text();
      let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
      return { status: res.status, body: parsed };
    };
  };
  const boss = await as('u-boss', 'boss@murshid.ae');
  const school = async (tag: 'a' | 'b') => {
    const made = await boss('POST', '/platform/schools', { name: `School ${tag.toUpperCase()}`, shortName: `SC${tag.toUpperCase()}`, adminName: `Admin ${tag}`, adminEmail: `admin@${tag}.ae`, seats: 20 });
    expect(made.status).toBe(201);
    const admin = await as(`u-admin-${tag}`, `admin@${tag}.ae`);
    const t1 = await admin('POST', '/school/teachers', { name: `Teacher ${tag}1`, email: `t1@${tag}.ae`, subject: 'science' });
    expect(t1.status, tag + JSON.stringify(t1.body)).toBe(201);
    const t2 = await admin('POST', '/school/teachers', { name: `Teacher ${tag}2`, email: `t2@${tag}.ae`, subject: 'english' });
    await admin('POST', '/school/roster', { students: [{ name: `Student ${tag}1`, email: `s1@${tag}.ae`, grade: 9, section: '9A' }, { name: `Student ${tag}2`, email: `s2@${tag}.ae`, grade: 9, section: '9A' }] });
    const cls = await admin('POST', '/school/classes', { name: `Science ${tag}`, subject: 'science', teacherId: t1.body.id, sections: ['9A'] });
    expect(cls.status, JSON.stringify(cls.body)).toBe(201);
    const other = await admin('POST', '/school/classes', { name: `English ${tag}`, subject: 'english', teacherId: t2.body.id, sections: ['9A'] });
    const teacher = await as(`u-t1-${tag}`, `t1@${tag}.ae`);
    const colleague = await as(`u-t2-${tag}`, `t2@${tag}.ae`);
    const s1 = await as(`u-s1-${tag}`, `s1@${tag}.ae`);
    const s2 = await as(`u-s2-${tag}`, `s2@${tag}.ae`);
    expect((await s1('GET', '/account')).body.me.role).toBe('student');
    expect((await s2('GET', '/account')).body.me.role).toBe('student');
    const post = await teacher('POST', `/teacher/classes/${cls.body.id}/assignments`, { title: 'Write about forces', instructions: null, dueDate: addDays(today, 3) });
    expect(post.status, JSON.stringify(post.body)).toBe(201);
    const setup = await admin('GET', '/school/setup');
    return { orgId: made.body.id, admin, teacher, colleague, s1, s2, cls: cls.body, other: other.body, item: post.body.assignment, roster: setup.body.students as { id: string; email: string }[] };
  };
  const A = await school('a');
  const B = await school('b');
  const stranger = await as('u-stranger', 'stranger@example.com');
  return { built, as, boss, A, B, stranger };
}

describe('cross-tenant access is refused', () => {
  it('a teacher of school A cannot read or change anything in school B', async () => {
    const { A, B } = await world();
    const sB = B.roster[0]!.id;
    for (const path of [
      `/teacher/classes/${B.cls.id}/report`, `/teacher/classes/${B.cls.id}/recommendations`, `/teacher/classes/${B.cls.id}/assignments`,
      `/teacher/classes/${B.cls.id}/weekly-reports`, `/teacher/classes/${B.cls.id}/gradebook`, `/teacher/classes/${B.cls.id}/stream`,
      `/teacher/classes/${B.cls.id}/students/${sB}`, `/teacher/classes/${B.cls.id}/assignments/${B.item.id}/handins`,
      `/teacher/classes/${B.cls.id}/assignments/${B.item.id}/handins/${sB}`, `/teacher/classes/${B.cls.id}/assignments/${B.item.id}/responses`,
    ]) expect((await A.teacher('GET', path)).status, path).toBe(404);
    expect((await A.teacher('POST', `/teacher/classes/${B.cls.id}/assignments`, { title: 'Sneaky homework', instructions: null, dueDate: addDays(today, 2) })).status).toBe(404);
    expect((await A.teacher('POST', `/teacher/classes/${B.cls.id}/announcements`, { text: 'hello' })).status).toBe(404);
    expect((await A.teacher('POST', `/teacher/classes/${B.cls.id}/assignments/${B.item.id}/handins/${sB}/review`, { action: 'mark', grade: 0 })).status).toBe(404);
    expect((await A.teacher('POST', `/teacher/classes/${B.cls.id}/assignments/${B.item.id}/messages/${sB}`, { text: 'hi' })).status).toBe(404);
    // copying their own assignment into the other school's class
    expect((await A.teacher('POST', `/teacher/classes/${A.cls.id}/assignments/${A.item.id}/copy`, { toClassId: B.cls.id })).status).toBe(404);
    // nothing about school B in their lists
    expect(JSON.stringify((await A.teacher('GET', '/teacher/students')).body)).not.toContain('Student b1');
    expect(JSON.stringify((await A.teacher('GET', '/teacher/inbox')).body)).not.toContain(B.cls.id);
  });

  it('a teacher cannot open a colleague’s class, or move a class to someone else', async () => {
    const { A } = await world();
    expect((await A.colleague('GET', `/teacher/classes/${A.cls.id}/report`)).status).toBe(403);
    expect((await A.colleague('GET', `/teacher/classes/${A.cls.id}/assignments/${A.item.id}/handins`)).status).toBe(403);
    const t2 = (await A.admin('GET', '/school/setup')).body.teachers.find((t: { email: string }) => t.email === 't2@a.ae').id;
    expect((await A.teacher('PATCH', `/school/classes/${A.cls.id}`, { teacherId: t2 })).status).toBe(403);
  });

  it('a school admin manages only their own school', async () => {
    const { A, B } = await world();
    expect((await A.admin('GET', `/orgs/${B.orgId}`)).status).toBe(403);
    expect((await A.admin('GET', `/orgs/${B.orgId}/students`)).status).toBe(403);
    expect((await A.admin('POST', `/orgs/${B.orgId}/microsoft/connect`)).status).toBe(403);
    expect((await A.admin('PATCH', `/school/classes/${B.cls.id}`, { name: 'Renamed by A' })).status).toBe(404);
    expect((await A.admin('DELETE', `/school/classes/${B.cls.id}`)).status).toBe(404);
    expect((await A.admin('DELETE', `/school/roster/${B.roster[0]!.id}`)).status).toBe(404);
    const tB = (await B.admin('GET', '/school/setup')).body.teachers[0].id;
    expect((await A.admin('DELETE', `/school/teachers/${tB}`)).status).toBe(404);
    // a class of A cannot get B's teacher or B's students
    expect((await A.admin('PATCH', `/school/classes/${A.cls.id}`, { teacherId: tB })).status).toBe(400);
    expect((await A.admin('PATCH', `/school/classes/${A.cls.id}`, { add: [B.roster[0]!.id] })).status).toBe(400);
    expect((await A.admin('POST', '/school/classes', { name: 'Mixed', subject: 'science', teacherId: tB })).status).toBe(400);
    // school admins are not platform admins
    expect((await A.admin('GET', '/platform/schools')).status).toBe(403);
    expect((await A.admin('GET', '/licensing/overview')).status).toBe(403);
    expect((await A.admin('GET', '/admin/overview')).status).toBe(403);
  });

  it('a student sees only their own work, files and classes', async () => {
    const { A, B } = await world();
    // student 2 cannot reach student 1's hand-in: the routes are about "me", and teachers see it only in their class
    const up = await A.s1('POST', '/files', { name: 'notes.png', mime: 'image/png', data: PNG });
    expect(up.status).toBe(201);
    expect((await A.s1('POST', `/student/assignments/${A.item.id}/handin`, { text: 'Forces make things move.', fileIds: [up.body.id] })).status).toBe(201);
    const mine = await A.s2('GET', `/student/assignments/${A.item.id}`);
    expect(mine.status).toBe(200);
    expect(mine.body.handIn).toBeNull();
    // nobody can hand in or message with someone else's upload
    const copied = await A.s2('POST', `/student/assignments/${A.item.id}/handin`, { text: 'copy', fileIds: [up.body.id] });
    expect(copied.status).toBe(400);
    expect(copied.body.code).toBe('file_not_found');
    expect((await A.teacher('POST', `/teacher/classes/${A.cls.id}/assignments/${A.item.id}/messages/${A.roster[1]!.id}`, { text: 'see this', fileIds: [up.body.id] })).status).toBe(400);
    // another school's assignment, announcement or reminders
    expect((await A.s1('GET', `/student/assignments/${B.item.id}`)).status).toBe(404);
    expect((await A.s1('POST', `/student/assignments/${B.item.id}/handin`, { text: 'hi' })).status).toBe(404);
    expect((await A.s1('POST', `/student/assignments/${B.item.id}/messages`, { text: 'hi' })).status).toBe(404);
    expect((await A.s1('POST', `/student/assignments/${B.item.id}/responses`, { answers: {} })).status).toBe(404);
    const ann = await B.teacher('POST', `/teacher/classes/${B.cls.id}/announcements`, { text: 'B only' });
    expect((await A.s1('POST', `/student/announcements/${ann.body.id}/replies`, { text: 'hi' })).status).toBe(404);
    expect(JSON.stringify((await A.s1('GET', '/student/stream')).body)).not.toContain('B only');
    expect((await A.s1('POST', '/student/reminders/rem_x/dismiss')).status).toBe(404);
    // the school portal and admin areas are closed to students
    for (const path of ['/teacher/me', '/school/setup', '/admin/overview', '/platform/schools', '/licensing/overview', `/orgs/${A.orgId}`]) {
      expect((await A.s1('GET', path)).status, path).toBe(403);
    }
    // a class at another school cannot be joined with a school-A account
    expect((await A.s1('POST', '/student/classes/join', { code: B.cls.joinCode })).status).toBe(409);
  });

  it('a parent sees only their own child, read only; x-child cannot pick someone else', async () => {
    const { as, A } = await world();
    const code = (await A.s1('POST', '/account/parent-code')).body.code;
    const mum = await as('u-mum', 'mum@example.com');
    await mum('POST', '/account/setup', { role: 'parent', name: 'Mum', childCode: code });
    const kid1 = (await A.s1('GET', '/account')).body.me.studentId;
    const kid2 = (await A.s2('GET', '/account')).body.me.studentId;
    const d = await mum('GET', '/dashboard', undefined, { 'x-child': kid2 });
    expect(d.status).toBe(200);
    expect(d.body.student.id).toBe(kid1);
    expect(d.body.student.id).not.toBe(kid2);
    expect((await mum('PUT', '/me/sync/study', { base: 0, data: {} })).status).toBe(200); // their own synced data
    expect((await mum('POST', '/student/me/subjects', { name: 'X', teacher: 'Y', target: 50 })).body.code).toBe('parent_read_only');
  });

  it('a stranger with a valid sign-in gets nothing', async () => {
    const { A, stranger } = await world();
    expect((await stranger('GET', '/dashboard')).body.code).toBe('needs_setup');
    expect((await stranger('GET', `/teacher/classes/${A.cls.id}/report`)).status).toBe(403);
    expect((await stranger('GET', '/account/export')).body.students).toEqual([]);
    expect((await stranger('GET', '/files/not-a-real-file-id-123')).status).toBe(404);
  });
});

describe('mass assignment: callers cannot set fields they do not own', () => {
  it('extra fields are refused or ignored', async () => {
    const { A, B } = await world();
    // a class keeps its school whatever the body says
    const r = await A.admin('PATCH', `/school/classes/${A.cls.id}`, { name: 'Science A1', orgId: B.orgId, joinCode: 'AAAAAA', teamsClassId: 'x' });
    expect(r.status).toBe(200);
    expect((await B.admin('GET', '/school/setup')).body.classes.some((c: { name: string }) => c.name === 'Science A1')).toBe(false);
    expect((await A.admin('GET', '/school/setup')).body.classes.find((c: { id: string }) => c.id === A.cls.id).joinCode).toBe(A.cls.joinCode);
    // a student's own records: strict schemas, unknown keys are a 400
    const sub = await A.s1('POST', '/student/me/subjects', { name: 'Chemistry', teacher: 'Mr K', target: 80 });
    expect(sub.status).toBe(201);
    expect((await A.s1('PATCH', `/student/me/subjects/${sub.body.id}`, { id: 'other', generate: true })).status).toBe(400);
    expect((await A.s1('PUT', '/student/me/cv', { headline: 'Me', real: true, createdBy: 'seed' })).status).toBe(400);
    // the account setup ignores role and org fields it does not define
    const p = await (await world()).as('u-new', 'new@example.com');
    const made = await p('POST', '/account/setup', { role: 'student', name: 'New', grade: 9, orgId: A.orgId, authUserId: 'u-boss', accountId: 'x' });
    expect(made.status).toBe(201);
    expect(made.body.me).toMatchObject({ role: 'student', authUserId: 'u-new' });
    expect(made.body.me.orgId).not.toBe(A.orgId);
  });
});

describe('demo-only routes are off with real sign-in', () => {
  it('no demo sign-up that makes claimable accounts, no simulated Microsoft directory', async () => {
    const { built } = await world();
    const post = (path: string, body: unknown) => built.app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const r = await post('/onboarding', { path: 'student', name: 'Victim', email: 'victim@example.com', grade: 9 });
    expect(r.status).toBe(410);
    expect(((await r.json()) as any).code).toBe('use_sign_in');
    expect((await built.app.request('/auth/microsoft/accounts?org=demo-school')).status).toBe(404);
    expect((await post('/auth/microsoft/callback', { code: 'sim:ms-t-thomas' })).status).toBe(404);
  });
});
