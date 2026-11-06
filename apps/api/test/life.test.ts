import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const DESAI = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-desai' };
const ADMIN = { 'x-dev-role': 'admin' };
const AHAMED = { 'x-dev-user': 'demo-ideal' };
const CLASS = 'cls-eng-11ab';
const ME = 'dss-ahamed-mehta';
const today = dubaiDate(NOW);

async function setup() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' } });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed };
  };
  return { req, built };
}

describe('feelings check-in', () => {
  it('saves one check-in a day, keeps private notes private, and tells the chosen teacher', async () => {
    const { req, built } = await setup();
    const first = await req('GET', '/student/feelings', AHAMED);
    expect(first.status).toBe(200);
    expect(first.body.emotions.length).toBeGreaterThan(20);
    expect(first.body.teachers.some((t: any) => t.id === 't-thomas')).toBe(true);

    const a = await req('POST', '/student/feelings', AHAMED, { mood: 2, words: ['worried', 'tired'], note: 'Big test tomorrow', share: 'private' });
    expect(a.status).toBe(201);
    const b = await req('POST', '/student/feelings', AHAMED, { mood: 4, words: ['calm'], note: 'Feeling better', share: 'teacher', talkTo: 't-thomas' });
    expect(b.status).toBe(200); // replaced today's
    expect(b.body.id).toBe(a.body.id);
    expect((await req('GET', '/student/feelings', AHAMED)).body.today.mood).toBe(4);
    expect(built.deps.notify!.inbox['t-thomas']?.[0]?.title).toMatch(/would like to talk/);

    // only one of the student's own teachers
    expect((await req('POST', '/student/feelings', AHAMED, { mood: 3, talkTo: 't-nobody' })).status).toBe(400);
    expect((await req('POST', '/student/feelings', AHAMED, { mood: 3, words: ['not-a-feeling'] })).status).toBe(400);

    const cls = await req('GET', `/teacher/classes/${CLASS}/feelings?days=7`, THOMAS);
    expect(cls.status).toBe(200);
    const me = cls.body.students.find((s: any) => s.id === ME);
    expect(me.last).toMatchObject({ mood: 4, words: ['calm'], talk: true });
    expect(me.flag).toBe('talk');
    // another teacher cannot read a class that is not theirs
    expect((await req('GET', `/teacher/classes/${CLASS}/feelings`, DESAI)).status).toBe(403);
  });

  it('never shows a private check-in to a teacher', async () => {
    const { req } = await setup();
    await req('POST', '/student/feelings', AHAMED, { mood: 1, words: ['scared'], note: 'secret', share: 'private' });
    const cls = await req('GET', `/teacher/classes/${CLASS}/feelings?days=1`, THOMAS);
    const me = cls.body.students.find((s: any) => s.id === ME);
    expect(JSON.stringify(me)).not.toContain('secret');
    expect(me.last?.date === today && me.last?.mood === 1).toBe(false);
  });

  it('lets a teacher ask the class a check-in question', async () => {
    const { req } = await setup();
    expect((await req('POST', `/teacher/classes/${CLASS}/feelings/prompt`, THOMAS, { question: 'How ready do you feel for Thursday?' })).status).toBe(201);
    expect((await req('GET', '/student/feelings', AHAMED)).body.prompt.question).toMatch(/Thursday/);
    expect((await req('GET', '/student/today-at-school', AHAMED)).body.prompt.question).toMatch(/Thursday/);
  });
});

describe('timetable, attendance and leave', () => {
  it('shows a week with now and next, and a teacher can set the real times', async () => {
    const { req } = await setup();
    const tt = await req('GET', '/student/timetable', AHAMED);
    expect(tt.status).toBe(200);
    expect(tt.body.lessons.length).toBeGreaterThan(10);
    expect(tt.body.clashes).toEqual([]);
    const put = await req('PUT', `/teacher/classes/${CLASS}/timetable`, THOMAS, { lessons: [{ day: 1, start: '07:45', end: '08:30', room: 'E12' }, { day: 3, start: '10:30', end: '11:15', link: 'https://teams.microsoft.com/l/meetup-join/x' }] });
    expect(put.status).toBe(200);
    const after = await req('GET', '/student/timetable', AHAMED);
    expect(after.body.lessons.filter((l: any) => l.classId === CLASS)).toHaveLength(2);
    expect((await req('PUT', `/teacher/classes/${CLASS}/timetable`, THOMAS, { lessons: [{ day: 1, start: '08:00', end: '09:00' }, { day: 1, start: '08:30', end: '09:30' }] })).status).toBe(400);
    expect((await req('PUT', `/teacher/classes/${CLASS}/timetable`, THOMAS, { lessons: [{ day: 1, start: '08:00', end: '09:00', link: 'javascript:alert(1)' }] })).status).toBe(400);
  });

  it('takes the register, tells an absent student, and approved leave shows as excused', async () => {
    const { req, built } = await setup();
    const reg = await req('GET', `/teacher/classes/${CLASS}/attendance`, THOMAS);
    expect(reg.status).toBe(200);
    expect(reg.body.taken).toBe(false);
    expect(reg.body.students.length).toBeGreaterThan(5);
    const marks = Object.fromEntries(reg.body.students.map((s: any) => [s.id, 'present']));
    marks[ME] = 'absent';
    expect((await req('PUT', `/teacher/classes/${CLASS}/attendance`, THOMAS, { date: today, marks })).status).toBe(200);
    expect(built.deps.notify!.inbox['demo-ideal']?.[0]?.title).toMatch(/absent/);
    expect((await req('PUT', `/teacher/classes/${CLASS}/attendance`, THOMAS, { date: addDays(today, 1), marks })).status).toBe(400);

    const mine = await req('GET', '/student/attendance', AHAMED);
    expect(mine.body.classes.find((c: any) => c.id === CLASS).recent[0]).toEqual({ date: today, mark: 'absent' });

    const leave = await req('POST', '/student/leave', AHAMED, { from: addDays(today, 3), to: addDays(today, 4), reason: 'appointment', note: 'Dentist' });
    expect(leave.status).toBe(201);
    expect((await req('POST', '/student/leave', AHAMED, { from: addDays(today, 4), to: addDays(today, 3), reason: 'other' })).status).toBe(400);
    const list = await req('GET', '/school/leave', ADMIN);
    expect(list.body.pending.some((l: any) => l.id === leave.body.id)).toBe(true);
    expect((await req('GET', '/school/leave', THOMAS)).status).toBe(403);
    expect((await req('POST', `/school/leave/${leave.body.id}`, ADMIN, { decision: 'approved', reply: 'Get well soon' })).body.status).toBe('approved');
    const that = await req('GET', `/teacher/classes/${CLASS}/attendance?date=${addDays(today, 3)}`, THOMAS);
    expect(that.body.students.find((s: any) => s.id === ME)).toMatchObject({ mark: 'excused', leave: { reason: 'appointment' } });
    // an answered request cannot be withdrawn
    expect((await req('DELETE', `/student/leave/${leave.body.id}`, AHAMED)).status).toBe(409);
  });
});

describe('points, polls, events and reports', () => {
  it('awards points to class members only, notifies, and can be undone', async () => {
    const { req, built } = await setup();
    const before = (await req('GET', '/student/points', AHAMED)).body.total;
    const r = await req('POST', `/teacher/classes/${CLASS}/points`, THOMAS, { studentIds: [ME, 'not-in-class'], reason: 'helping', points: 2 });
    expect(r.status).toBe(201);
    expect(r.body.awarded).toHaveLength(1);
    expect(built.deps.notify!.inbox['demo-ideal']?.[0]?.title).toBe('+2 for helping others');
    expect((await req('GET', '/student/points', AHAMED)).body.total).toBe(before + 2);
    expect((await req('DELETE', `/teacher/points/${r.body.awarded[0].id}`, DESAI)).status).toBe(403);
    expect((await req('DELETE', `/teacher/points/${r.body.awarded[0].id}`, THOMAS)).status).toBe(200);
    expect((await req('GET', '/student/points', AHAMED)).body.total).toBe(before);
    expect((await req('POST', `/teacher/classes/${CLASS}/points`, THOMAS, { studentIds: [ME], reason: 'helping', points: 0 })).status).toBe(400);
  });

  it('runs a poll: students see results only after answering, and closed polls take no answers', async () => {
    const { req } = await setup();
    const p = await req('POST', `/teacher/classes/${CLASS}/polls`, THOMAS, { kind: 'choice', question: 'Which poem next?', options: ['Ozymandias', 'Remains'] });
    expect(p.status).toBe(201);
    let mine = (await req('GET', '/student/polls', AHAMED)).body.polls[0];
    expect(mine.counts).toBeNull();
    expect((await req('POST', `/student/polls/${p.body.id}/answer`, AHAMED, { choice: 7 })).status).toBe(400);
    expect((await req('POST', `/student/polls/${p.body.id}/answer`, AHAMED, { choice: 1 })).status).toBe(200);
    mine = (await req('GET', '/student/polls', AHAMED)).body.polls[0];
    expect(mine.counts).toEqual([0, 1]);
    const exit = await req('POST', `/teacher/classes/${CLASS}/polls`, THOMAS, { kind: 'exit', question: 'One thing you learned today' });
    await req('POST', `/student/polls/${exit.body.id}/answer`, AHAMED, { text: 'Iambic pentameter' });
    const t = await req('GET', `/teacher/classes/${CLASS}/polls`, THOMAS);
    expect(t.body.polls[0].texts[0]).toMatchObject({ text: 'Iambic pentameter', name: expect.any(String) });
    // students never see each other's written answers
    expect((await req('GET', '/student/polls', AHAMED)).body.polls.every((x: any) => x.texts.length === 0)).toBe(true);
    await req('POST', `/teacher/polls/${p.body.id}/close`, THOMAS);
    expect((await req('POST', `/student/polls/${p.body.id}/answer`, AHAMED, { choice: 0 })).status).toBe(409);
  });

  it('school dates: admins add them, students see the ones for their grade', async () => {
    const { req } = await setup();
    const ev = await req('POST', '/school/events', ADMIN, { title: 'Grade 11 science fair', date: addDays(today, 10), kind: 'event', grades: [11] });
    expect(ev.status).toBe(201);
    expect((await req('POST', '/school/events', THOMAS, { title: 'Staff party', date: today, kind: 'event' })).status).toBe(403);
    const mine = await req('GET', '/student/events', AHAMED);
    expect(mine.body.upcoming.some((e: any) => e.title === 'Grade 11 science fair')).toBe(true);
    await req('POST', '/school/events', ADMIN, { title: 'Grade 9 trip', date: addDays(today, 5), kind: 'trip', grades: [9] });
    expect((await req('GET', '/student/events', AHAMED)).body.upcoming.some((e: any) => e.title === 'Grade 9 trip')).toBe(false);
  });

  it('term reports: suggestions, saving, and students only see them once published', async () => {
    const { req, built } = await setup();
    const rep = await req('GET', `/teacher/classes/${CLASS}/reports`, THOMAS);
    expect(rep.status).toBe(200);
    const row = rep.body.rows.find((r: any) => r.id === ME);
    expect(row.suggestions.length).toBeGreaterThan(1);
    expect(row.average).not.toBeNull();
    expect((await req('PUT', `/teacher/classes/${CLASS}/reports/${ME}`, THOMAS, { comment: 'A thoughtful reader.', effort: 4 })).status).toBe(200);
    expect((await req('GET', '/student/reports', AHAMED)).body.terms).toEqual([]);
    expect((await req('POST', `/teacher/classes/${CLASS}/reports/publish`, THOMAS, {})).body.published).toBe(true);
    const mine = await req('GET', '/student/reports', AHAMED);
    expect(mine.body.terms[0].subjects[0]).toMatchObject({ comment: 'A thoughtful reader.', effort: 4, effortLabel: 'Excellent effort' });
    expect(built.deps.notify!.inbox['demo-ideal']?.[0]?.kind).toBe('report');
    expect((await req('PUT', `/teacher/classes/${CLASS}/reports/someone-else`, THOMAS, { comment: 'x', effort: 2 })).status).toBe(404);
  });

  it('school-wide wellbeing and attendance are for school admins', async () => {
    const { req } = await setup();
    const w = await req('GET', '/school/wellbeing', ADMIN);
    expect(w.status).toBe(200);
    expect(w.body.grades.length).toBeGreaterThan(0);
    expect((await req('GET', '/school/wellbeing', THOMAS)).status).toBe(403);
    const a = await req('GET', '/school/attendance', ADMIN);
    expect(a.body.classes.length).toBeGreaterThan(3);
  });
});
