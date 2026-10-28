import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const DESAI = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-desai' };
const OTHER = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-dbs-clarke' };
const ADMIN = { 'x-dev-role': 'admin' };

async function setup(now = NOW) {
  const built = await createSeededApp({ now: () => now, config: { authMode: 'dev', jwtSecret: '' } });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { ...built, req };
}

describe('licensing: families vs institutions', () => {
  it('lists plans with schools featured', async () => {
    const { req } = await setup();
    const r = await req('GET', '/plans');
    expect(r.status).toBe(200);
    expect(r.body.featured).toBe('school');
    expect(r.body.families.map((p: any) => [p.id, p.priceAed])).toEqual([['family-plus', 29], ['family-pro', 79]]);
    expect(r.body.schools[0]).toMatchObject({ id: 'school', per: 'student-year', rangeAed: [120, 180], featured: true });
  });

  it('keeps every app student in exactly one tenant, typed by licence', async () => {
    const { req } = await setup();
    const o = (await req('GET', '/licensing/overview', ADMIN)).body;
    const oow = o.institutions.find((i: any) => i.id === 'gems-oow');
    expect(oow).toMatchObject({ name: "Our Own High School Al Warqa'a", group: { name: 'GEMS Education' }, licence: { type: 'institution', status: 'pilot' } });
    expect(oow.students.map((s: any) => s.id)).toEqual(['demo-ideal']);
    expect(o.families.every((f: any) => f.licence.type === 'family')).toBe(true);
    const famIds = o.families.flatMap((f: any) => f.students.map((s: any) => s.id));
    const instIds = o.institutions.flatMap((f: any) => f.students.map((s: any) => s.id));
    expect(famIds.sort()).toEqual(['demo-g5', 'demo-g7', 'demo-g9']);
    expect(famIds.some((id: string) => instIds.includes(id))).toBe(false);
    expect((await req('GET', '/licensing/overview', THOMAS)).status).toBe(403);
  });

  it('admin student list carries the licence and filters by it', async () => {
    const { req } = await setup();
    const inst = (await req('GET', '/admin/students?licence=institution', ADMIN)).body.items.map((s: any) => s.id).sort();
    expect(inst).toEqual(['demo-g11', 'demo-ideal']);
    const oow = (await req('GET', '/admin/students?orgId=gems-oow', ADMIN)).body.items;
    expect(oow.map((s: any) => s.id)).toEqual(['demo-ideal']);
    expect(oow[0].licence).toMatchObject({ type: 'institution', orgName: "Our Own High School Al Warqa'a" });
  });

  it('onboards a parent, a student and a school student into separate tenants', async () => {
    const { req } = await setup();
    const parent = await req('POST', '/onboarding', {}, { path: 'parent', parentName: 'Nadia Karim', email: 'nadia@example.com', childName: 'Sami Karim', childGrade: 8, plan: 'family-pro' });
    expect(parent.status).toBe(201);
    expect(parent.body.licence).toMatchObject({ type: 'family', boughtBy: 'parent', plan: 'family-pro' });
    expect(parent.body.account).toMatchObject({ role: 'parent', studentIds: [parent.body.student.id] });

    const student = await req('POST', '/onboarding', {}, { path: 'student', name: 'Lea Haddad', email: 'lea@example.com', grade: 10 });
    expect(student.body.licence).toMatchObject({ type: 'family', boughtBy: 'student', plan: 'family-plus' });
    expect(student.body.org.id).not.toBe(parent.body.org.id);

    const school = await req('POST', '/onboarding', {}, { path: 'school', via: 'join_code', joinCode: 'oow-g11', name: 'New Student', email: 'new@example.com', grade: 11 });
    expect(school.body.licence).toMatchObject({ type: 'institution', orgId: 'gems-oow', boughtBy: 'school' });
    expect((await req('POST', '/onboarding', {}, { path: 'school', via: 'join_code', joinCode: 'NOPE', name: 'X', email: 'x@example.com', grade: 11 })).status).toBe(400);

    // the school sees its own new student but never the family ones
    const roster = (await req('GET', '/orgs/gems-oow/students', ADMIN)).body.appStudents.map((s: any) => s.id);
    expect(roster).toContain(school.body.student.id);
    expect(roster).not.toContain(parent.body.student.id);
    expect(roster).not.toContain(student.body.student.id);
  });
});

describe('Microsoft 365 (simulated connector)', () => {
  it('signs a teacher in and maps them to the portal', async () => {
    const { req } = await setup();
    const start = (await req('GET', '/auth/microsoft/authorize?org=gems-oow&role=teacher')).body;
    expect(start).toMatchObject({ connector: 'microsoft365', simulated: true });
    const accounts = (await req('GET', '/auth/microsoft/accounts?org=gems-oow&role=teacher')).body.items;
    expect(accounts.map((a: any) => a.name)).toEqual(['Ms. Sana Thomas', 'Mr. Vikram Desai']);
    const cb = await req('POST', '/auth/microsoft/callback', {}, { code: accounts[0].code, state: start.state });
    expect(cb.body.session.headers).toEqual({ 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' });
    const me = (await req('GET', '/teacher/me', cb.body.session.headers)).body;
    expect(me.teacher.name).toBe('Ms. Sana Thomas');
    expect(me.classes.map((c: any) => [c.id, c.students])).toEqual([['cls-eng-11ab', 30]]);
    expect((await req('POST', '/auth/microsoft/callback', {}, { code: 'sim:nobody' })).status).toBe(400);
  });

  it('a student signs in with Microsoft and lands on their school licence', async () => {
    const { req } = await setup();
    const acc = (await req('GET', '/auth/microsoft/accounts?org=gems-oow&role=student')).body.items[0];
    const r = await req('POST', '/onboarding', {}, { path: 'school', via: 'microsoft', code: acc.code });
    expect(r.status).toBe(201);
    expect(r.body.student).toEqual({ id: 'demo-ideal', name: 'Ahamed Mehta' });
    expect(r.body.licence.type).toBe('institution');
  });

  it('school admin connects Microsoft 365 and Teams classes sync', async () => {
    const { req } = await setup();
    expect((await req('GET', '/orgs/gems-oow', ADMIN)).body.microsoft.connected).toBe(false);
    const r = await req('POST', '/orgs/gems-oow/microsoft/connect', ADMIN);
    expect(r.status).toBe(200);
    expect(r.body.microsoft).toMatchObject({ connected: true, simulated: true, synced: { classes: 10, teachers: 10, students: 38 } });
    expect(r.body.microsoft.synced.assignments).toBeGreaterThan(20);
    const a = (await req('GET', '/teacher/classes/cls-eng-11ab/assignments', THOMAS)).body.items;
    expect(a[0].source).toBe('teams');
    expect((await req('GET', '/student/school', { 'x-dev-user': 'demo-ideal' })).body.licence.connectedVia).toBe('microsoft365');
    expect((await req('POST', '/orgs/demo-british/microsoft/connect', ADMIN)).status).toBe(403);
  });
});

describe('teacher portal', () => {
  it('only shows a teacher their own classes in their own school', async () => {
    const { req } = await setup();
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report')).status).toBe(401);
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report', DESAI)).status).toBe(403);
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report', OTHER)).status).toBe(404);
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report', { 'x-dev-role': 'student', 'x-dev-user-id': 't-thomas' })).status).toBe(403);
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report', ADMIN)).status).toBe(200);
  });

  it('class progress report: 30 students, all-subject workload, explainable status', async () => {
    const { req } = await setup();
    const r = (await req('GET', '/teacher/classes/cls-eng-11ab/report', THOMAS)).body;
    expect(r.class).toMatchObject({ name: 'Grade 11 English (11A/11B)', teacher: { name: 'Ms. Sana Thomas' }, students: 30 });
    expect(r.students).toHaveLength(30);
    const s = r.summary;
    expect(s.ahead + s.onTrack + s.watch + s.atRisk).toBe(30);
    expect(s.atRisk).toBeGreaterThan(0);
    expect(r.rules.length).toBe(3);
    const ahamed = r.students.find((x: any) => x.name === 'Ahamed Mehta');
    expect(ahamed.appId).toBe('demo-ideal');
    expect(ahamed.all.loadPct).toBeGreaterThanOrEqual(85); // football + swimming + tests
    expect(ahamed.status).toBe('watch');
    for (const st of r.students) {
      expect(st.subject.completion).toBeGreaterThanOrEqual(0);
      expect(st.subject.completion).toBeLessThanOrEqual(100);
      if (st.status === 'at_risk') expect(st.flags.length).toBeGreaterThan(0);
    }
    // at-risk students come first
    expect(r.students[0].status).toBe('at_risk');
    // deterministic
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/report', THOMAS)).body).toEqual(r);
  });

  it('delegation recommendations cover every student once, with reasons', async () => {
    const { req } = await setup();
    const r = (await req('GET', '/teacher/classes/cls-eng-11ab/recommendations', THOMAS)).body;
    const ids = r.groups.flatMap((g: any) => g.students.map((s: any) => s.id));
    expect(ids).toHaveLength(30);
    expect(new Set(ids).size).toBe(30);
    expect(r.groups.map((g: any) => g.id)).toEqual(['support', 'lighten', 'core', 'extension']);
    expect(r.groups.flatMap((g: any) => g.students).every((s: any) => s.reason.length > 0)).toBe(true);
    expect(r.groups.find((g: any) => g.id === 'lighten').students.map((s: any) => s.name)).toContain('Ahamed Mehta');
    for (const p of r.pairs) expect(p.support.id).not.toBe(p.partner.id);
    expect(r.mixedGroups.flatMap((g: any) => g.students)).toHaveLength(30);
  });

  it('homework timing: likelihood for every option, best one explained, heavy days visible', async () => {
    const { req } = await setup(new Date('Wed 2026-10-14 10:00 AM (UTC+04:00)'));
    const r = (await req('GET', '/teacher/classes/cls-math-11bc/homework-timing', DESAI)).body;
    expect(r.heatmap.setDays).toHaveLength(5);
    expect(r.heatmap.cells).toHaveLength(15);
    for (const c of r.heatmap.cells) { expect(c.likelihood).toBeGreaterThanOrEqual(3); expect(c.likelihood).toBeLessThanOrEqual(99); }
    expect(r.best).toMatchObject({ set: '2026-10-20', due: '2026-10-22' });
    expect(r.best.headline).toMatch(/^Best day to set: Tuesday, due Thursday \u2014 \d+% likely on time$/);
    expect(r.best.likelihood).toBeGreaterThanOrEqual(80);
    // setting today for tomorrow runs into tomorrow's Chemistry test
    expect(r.avoid).toMatchObject({ set: '2026-10-14', due: '2026-10-15' });
    expect(r.avoid.likelihood).toBeLessThan(r.best.likelihood - 30);
    expect(r.days).toHaveLength(10);
    expect(r.days.find((d: any) => d.date === '2026-10-15').items).toContain('Chemistry unit test');
    expect(r.method.length).toBe(4);
    // a longer task is less likely to be on time
    const long = (await req('GET', '/teacher/classes/cls-math-11bc/homework-timing?minutes=150', DESAI)).body;
    expect(long.best.likelihood).toBeLessThan(r.best.likelihood);
  });

  it('weekly reports: drafts before Friday 16:00, submitted after, rolled up', async () => {
    const { req } = await setup();
    const cur = (await req('GET', '/teacher/classes/cls-eng-11ab/weekly-reports', THOMAS)).body;
    expect(cur.status).toBe('draft');
    expect(cur.autoSubmitsAt).toBe('2026-10-16T16:00:00+04:00');
    expect(cur.reports).toHaveLength(30);
    const last = (await req('GET', '/teacher/classes/cls-eng-11ab/weekly-reports?week=last', THOMAS)).body;
    expect(last).toMatchObject({ weekStart: '2026-10-05', status: 'submitted', rollup: { students: 30, submitted: 30 } });
    const one = last.reports[0];
    expect(one.summary).toMatch(/handed in/);
    expect(Array.isArray(one.remaining)).toBe(true);
    const fri = await setup(new Date('Fri 2026-10-16 4:30 PM (UTC+04:00)'));
    expect((await fri.req('GET', '/teacher/classes/cls-eng-11ab/weekly-reports', THOMAS)).body.status).toBe('submitted');
    expect((await req('GET', '/student/weekly-report', { 'x-dev-user': 'demo-ideal' })).body.name).toBe('Ahamed Mehta');
    expect((await req('GET', '/student/weekly-report', { 'x-dev-user': 'demo-g9' })).status).toBe(404);
  });

  it('best-day model and the at-risk flags after posting agree for the same window', async () => {
    const { req } = await setup(new Date('Thu 2026-10-15 10:00 AM (UTC+04:00)'));
    for (const [cls, who] of [['cls-math-11bc', DESAI], ['cls-eng-11ab', THOMAS]] as const) {
      const t = (await req('GET', `/teacher/classes/${cls}/homework-timing`, who)).body;
      expect(t.method.join(' ')).toMatch(/At risk/);
      const post = await req('POST', `/teacher/classes/${cls}/assignments`, who, { title: 'Consistency check task', setDate: t.best.set, dueDate: t.best.due, minutes: t.minutes });
      expect(post.status).toBe(201);
      const flagged = post.body.automation.overloaded.length;
      // every student flagged at risk is outside the "likely on time" count, and the counts match the model
      expect(flagged).toBe(t.best.atRisk);
      expect(t.best.onTime + flagged).toBeLessThanOrEqual(t.students);
      for (const o of post.body.automation.overloaded) expect(o.reason).toMatch(/free minutes|tests in the 2 days before/);
    }
  });

  it('posting an assignment lands in the student app end to end', async () => {
    const { req } = await setup();
    const post = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { title: 'Poem analysis: "Keeping Quiet"', instructions: '300 words, two quotations.', dueDate: '2026-10-14', minutes: 45 });
    expect(post.status).toBe(201);
    expect(post.body.students).toBe(30);
    expect(post.body.deliveredToApp).toEqual([expect.objectContaining({ appId: 'demo-ideal' })]);
    // student app: Today list + School page
    const today = (await req('GET', '/student/tasks?scope=today', { 'x-dev-user': 'demo-ideal' })).body.items;
    expect(today.find((t: any) => t.title.startsWith('English: Poem analysis: "Keeping Quiet"'))).toMatchObject({ source: 'admin', kind: 'assignment' });
    const school = (await req('GET', '/student/school', { 'x-dev-user': 'demo-ideal' })).body;
    expect(school.school.assignments[0]).toMatchObject({ title: 'Poem analysis: "Keeping Quiet"', teacher: 'Ms. Sana Thomas', posted: true, status: 'pending' });
    // teacher list + analytics see it
    const list = (await req('GET', '/teacher/classes/cls-eng-11ab/assignments', THOMAS)).body.items;
    expect(list[0]).toMatchObject({ title: 'Poem analysis: "Keeping Quiet"', handedIn: 0, students: 30 });
    // automated follow-up: every student's week replanned, reminder set, overload checked, explained in a trace
    const auto = post.body.automation;
    expect(auto).toMatchObject({ students: 30, replanned: 30, reminders: 30, inApp: 1 });
    expect(auto.featured.trace).toMatchObject({ kind: 'automation', engine: { mode: 'rules' } });
    expect(auto.featured.trace.plan.length).toBeGreaterThanOrEqual(4);
    expect(auto.featured.trace.tools.map((t: any) => t.id)).toEqual(expect.arrayContaining(['read_timetable', 'schedule_work_session', 'set_reminder', 'flag_overload']));
    expect(auto.featured.trace.actions[0]).toMatch(/Scheduled a 45-min work session/);
    const week = (await req('GET', '/student/tasks?scope=week', { 'x-dev-user': 'demo-ideal' })).body.items;
    expect(week.some((t: any) => t.title === 'Work on English: Poem analysis: "Keeping Quiet"' && t.source === 'murshid')).toBe(true);
    expect(school.school.assignments[0].trace.kind).toBe('automation');
    // validation + access
    expect((await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { title: 'x', dueDate: '2026-10-14' })).status).toBe(400);
    expect((await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { title: 'Backwards', dueDate: '2026-10-11' })).status).toBe(400);
    expect((await req('POST', '/teacher/classes/cls-eng-11ab/assignments', DESAI, { title: 'Not mine', dueDate: '2026-10-14' })).status).toBe(403);
  });

  it('student school page: school licence with classes, family licence without', async () => {
    const { req } = await setup();
    const s = (await req('GET', '/student/school', { 'x-dev-user': 'demo-ideal' })).body;
    expect(s.licence).toMatchObject({ type: 'institution', orgName: "Our Own High School Al Warqa'a", parentOrgName: 'GEMS Education', connectedVia: 'portal' });
    expect(s.school.classes.map((c: any) => c.subject).sort()).toEqual(['business', 'economics', 'english', 'maths', 'physics']);
    expect(s.school.weeklyReport.status).toBe('draft');
    const f = (await req('GET', '/student/school', { 'x-dev-user': 'demo-g7' })).body;
    expect(f).toMatchObject({ licence: { type: 'family', boughtBy: 'parent' }, school: null, family: { parent: { name: 'Imran Siddiqui' } } });
  });
});
