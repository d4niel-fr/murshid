import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW } from './helpers';

async function setupAdmin() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' } });
  const req = async (method: string, path: string, opts: { admin?: boolean; as?: string; body?: unknown; role?: string } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.admin !== false) headers['x-dev-role'] = opts.role ?? 'admin';
    if (opts.as) headers['x-dev-user'] = opts.as;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await built.app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* pdf / sse */ }
    return { status: res.status, body, headers: res.headers };
  };
  const student = (method: string, path: string, as = 'demo-ideal', body?: unknown) => req(method, path, { admin: false, as, body });
  return { ...built, req, student };
}

describe('admin auth', () => {
  it('requires the admin role', async () => {
    const { req } = await setupAdmin();
    expect((await req('GET', '/admin/students', { admin: false })).status).toBe(401);
    expect((await req('GET', '/admin/students', { role: 'student' })).status).toBe(403);
    expect((await req('GET', '/admin/students')).status).toBe(200);
  });
});

describe('admin: students', () => {
  it('lists and searches every student, flagship included', async () => {
    const { req } = await setupAdmin();
    const all = (await req('GET', '/admin/students')).body;
    expect(all.total).toBe(5);
    const ideal = all.items.find((s: any) => s.id === 'demo-ideal');
    expect(ideal).toMatchObject({ name: 'Ahamed Mehta', grade: 11, flagship: true, synthetic: true, activities: ['football', 'swimming'], projects: ['Tideline'] });
    expect((await req('GET', '/admin/students?q=tideline')).body.items.map((s: any) => s.id)).toEqual(['demo-ideal']);
    expect((await req('GET', '/admin/students?grade=11')).body.total).toBe(2);
  });

  it('detail view has every tab with a year of data', async () => {
    const { req } = await setupAdmin();
    const d = (await req('GET', '/admin/students/demo-ideal')).body;
    for (const k of ['profile', 'subjects', 'assessments', 'activities', 'tasks', 'goals', 'opportunities', 'applications', 'projects', 'achievements', 'cv', 'links', 'audit']) expect(d).toHaveProperty(k);
    expect(d.assessments.length).toBeGreaterThan(80);
    expect(d.activities.find((a: any) => a.id === 'football').totals.sessions).toBeGreaterThan(60);
    expect(d.projects[0].totals.revenueAed).toBeGreaterThan(10000);
    expect((await req('GET', '/admin/students/nope')).status).toBe(404);
  });

  it('creates, edits (zod-validated) and deletes a student; seed students cannot be deleted', async () => {
    const { req, student } = await setupAdmin();
    const bad = await req('POST', '/admin/students', { body: { name: 'X' } });
    expect(bad.status).toBe(400);
    expect(bad.body.details.length).toBeGreaterThan(0);
    const created = await req('POST', '/admin/students', { body: { name: 'Mariam Test', preferredName: 'Mariam', grade: 10, age: 15, school: 'Demo School', curriculum: 'british', emirate: 'dubai', interests: ['art'] } });
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(id).toBe('stu-mariam-test');
    expect((await student('GET', '/dashboard', id)).body.student).toMatchObject({ name: 'Mariam Test', grade: 10 });
    const patched = await req('PATCH', `/admin/students/${id}`, { body: { grade: 11, classLabel: 'Year 12' } });
    expect(patched.body).toMatchObject({ grade: 11, band: 'g11-12' });
    expect((await req('PATCH', `/admin/students/${id}`, { body: { grade: 42 } })).status).toBe(400);
    expect((await req('DELETE', '/admin/students/demo-g5')).status).toBe(400);
    expect((await req('DELETE', `/admin/students/${id}`)).status).toBe(200);
    expect((await student('GET', '/dashboard', id)).status).toBe(404);
  });
});

describe('admin edits show up in the student API at once (shared store)', () => {
  it('assessment: add upcoming, then grade it', async () => {
    const { req, student } = await setupAdmin();
    const a = await req('POST', '/admin/students/demo-ideal/assessments', { body: { subjectId: 'economics', title: 'Economics mock: market failure', kind: 'exam', date: '2026-10-15', maxScore: 80 } });
    expect(a.status).toBe(201);
    expect(a.body.status).toBe('upcoming');
    const acad = (await student('GET', '/academics')).body;
    expect(acad.upcoming.some((x: any) => x.title === 'Economics mock: market failure')).toBe(true);
    expect((await student('GET', '/dashboard')).body.upcoming.some((x: any) => x.title === 'Economics mock: market failure')).toBe(true);
    expect((await req('POST', '/admin/students/demo-ideal/assessments', { body: { subjectId: 'economics', title: 'x', kind: 'quiz', date: '2026-10-01', maxScore: 20, score: 25 } })).status).toBe(400);
    const graded = await req('PATCH', `/admin/students/demo-ideal/assessments/${a.body.id}`, { body: { score: 72, date: '2026-10-11' } });
    expect(graded.body).toMatchObject({ status: 'graded', percent: 90 });
    expect((await student('GET', '/academics')).body.assessments.some((x: any) => x.id === a.body.id && x.percent === 90)).toBe(true);
  });

  it('task: added by staff appears in today/week, can be completed and deleted', async () => {
    const { req, student } = await setupAdmin();
    const t = await req('POST', '/admin/students/demo-ideal/tasks', { body: { title: 'Hand in English essay draft', date: '2026-10-12', time: '15:00', kind: 'assignment', subjectId: 'english' } });
    expect(t.status).toBe(201);
    const today = (await student('GET', '/dashboard')).body.today;
    expect(today.find((x: any) => x.title === 'Hand in English essay draft')).toMatchObject({ source: 'admin', time: '15:00' });
    await req('PATCH', `/admin/students/demo-ideal/tasks/${t.body.id}`, { body: { status: 'done' } });
    expect((await student('GET', '/student/tasks?scope=today')).body.items.find((x: any) => x.id === t.body.id).done).toBe(true);
    await req('DELETE', `/admin/students/demo-ideal/tasks/${t.body.id}`);
    expect((await student('GET', '/student/tasks?scope=today')).body.items.some((x: any) => x.id === t.body.id)).toBe(false);
  });

  it('opportunity: published to a grade range reaches matching students first, not others', async () => {
    const { req, student } = await setupAdmin();
    const o = await req('POST', '/admin/opportunities', { body: { title: 'Dubai Youth Business Forum (Demo)', organizer: 'Example Chamber', type: 'competition', deadline: '2026-11-01', minGrade: 10, maxGrade: 12, why: 'Pitch your venture to real founders.', tags: ['business'] } });
    expect(o.status).toBe(201);
    const ideal = (await student('GET', '/dashboard')).body.opportunities;
    expect(ideal[0]).toMatchObject({ title: 'Dubai Youth Business Forum (Demo)', source: 'admin' });
    expect((await student('GET', '/dashboard', 'demo-g7')).body.opportunities.some((x: any) => x.title.startsWith('Dubai Youth Business'))).toBe(false);
    const cat = (await req('GET', '/admin/opportunities')).body.items[0];
    expect(cat.reach.sort()).toEqual(['demo-g11', 'demo-ideal']);
    await req('PATCH', `/admin/opportunities/${o.body.id}`, { body: { status: 'closed' } });
    expect((await student('GET', '/dashboard')).body.opportunities.some((x: any) => x.source === 'admin')).toBe(false);
    expect((await req('POST', '/admin/opportunities', { body: { title: 't', organizer: 'o', type: 'competition', deadline: '2026-11-01', minGrade: 12, maxGrade: 10, why: 'w' } })).status).toBe(400);
  });

  it('goals, activities + sessions, projects + milestones, achievements, CV and links', async () => {
    const { req, student } = await setupAdmin();
    const g = await req('POST', '/admin/students/demo-ideal/goals', { body: { title: 'Read 6 economics books', category: 'academic', unit: 'books', start: 0, target: 6, dueDate: '2027-03-01', current: 2 } });
    expect(g.status).toBe(201);
    expect(g.body.progress).toBe(33);
    expect((await student('GET', '/dashboard')).body.progress.goals.some((x: any) => x.title === 'Read 6 economics books')).toBe(true);
    expect((await req('PATCH', '/admin/students/demo-ideal/goals/goal-free100', { body: { current: 50 } })).status).toBe(400);

    const s = await req('POST', '/admin/students/demo-ideal/activities/swimming/sessions', { body: { date: '2026-10-11', minutes: 90, metrics: { free100: 55.1 }, type: 'race', note: 'Time trial' } });
    expect(s.status).toBe(201);
    const ex = (await student('GET', '/extracurriculars')).body.activities.find((a: any) => a.id === 'swimming');
    expect(ex.bestMetrics.free100).toBe(55.1);
    expect((await req('POST', '/admin/students/demo-ideal/activities/swimming/sessions', { body: { date: '2026-10-11', minutes: 30, metrics: { bogus: 1 } } })).status).toBe(400);
    expect((await req('POST', '/admin/students/demo-ideal/activities', { body: { kind: 'gym', detail: 'Strength block', days: [1, 3], minutes: 45, weeklyTargetMinutes: 90 } })).status).toBe(201);
    expect((await student('GET', '/extracurriculars')).body.activities.map((a: any) => a.id)).toContain('gym');

    const ms = await req('POST', '/admin/students/demo-ideal/projects/tideline/milestones', { body: { title: 'Stock 200 team towels', date: '2026-11-15' } });
    expect(ms.status).toBe(201);
    expect((await student('GET', '/student/projects')).body.items[0].milestones.some((m: any) => m.title === 'Stock 200 team towels')).toBe(true);
    await req('POST', '/admin/students/demo-ideal/achievements', { body: { title: 'House colours for sport', category: 'sport', date: '2026-10-08' } });
    expect((await student('GET', '/student/achievements')).body.items[0].title).toBe('House colours for sport');

    const cv = await req('PUT', '/admin/students/demo-ideal/cv', { body: { headline: 'Founder of Tideline | 1st XI vice-captain' } });
    expect(cv.body.headline).toBe('Founder of Tideline | 1st XI vice-captain');
    expect((await student('GET', '/student/cv/linkedin')).body.headline).toBe('Founder of Tideline | 1st XI vice-captain');
    expect((await req('PUT', '/admin/students/demo-ideal/cv', { body: { email: 'not-an-email' } })).status).toBe(400);
    const links = await req('PUT', '/admin/students/demo-ideal/links', { body: { github: '@ahamed-demo' } });
    expect(links.body.github).toBe('https://github.com/ahamed-demo');
    expect((await student('GET', '/profile/links')).body.github).toBe('https://github.com/ahamed-demo');
  });

  it('every admin edit is in the audit log, newest first', async () => {
    const { req } = await setupAdmin();
    await req('POST', '/admin/students/demo-g9/tasks', { body: { title: 'Science lab report', date: '2026-10-13' } });
    await req('PATCH', '/admin/students/demo-g9/subjects/maths', { body: { target: 96 } });
    const log = (await req('GET', '/admin/audit?studentId=demo-g9')).body.items;
    expect(log.map((e: any) => [e.action, e.resource])).toEqual([['update', 'subject'], ['create', 'task']]);
    expect(log[0]).toMatchObject({ actor: 'dev-admin', actorRole: 'admin', changes: { target: { from: 95, to: 96 } } });
    expect((await req('GET', '/admin/overview')).body.editsToday).toBeGreaterThanOrEqual(2);
  });
});
