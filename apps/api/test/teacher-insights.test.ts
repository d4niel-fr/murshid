import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const DESAI = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-desai' };
const AHAMED = { 'x-dev-user': 'demo-ideal' };

async function setup() {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' } });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  return { req };
}

describe('a teacher with several classes', () => {
  it('teaches three classes of 30 to 60 students', async () => {
    const { req } = await setup();
    const me = (await req('GET', '/teacher/me', THOMAS)).body;
    expect(me.classes.map((c: { students: number }) => c.students)).toEqual([30, 44, 58]);
  });
  it('lists every student across their classes, worst status first, and only theirs', async () => {
    const { req } = await setup();
    const r = (await req('GET', '/teacher/students', THOMAS)).body;
    expect(r.students).toHaveLength(30 + 44 + 58);
    const rank = { at_risk: 0, watch: 1, on_track: 2, ahead: 3 } as Record<string, number>;
    const ranks = r.students.map((s: { status: string }) => rank[s.status]);
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    const desai = (await req('GET', '/teacher/students', DESAI)).body;
    expect(desai.students.every((s: { classes: { id: string }[] }) => s.classes.every((c) => c.id.startsWith('cls-math')))).toBe(true);
  });
});

describe('one student, seen by their teacher', () => {
  it('has eight weeks of study time, a grade trend, every subject and suggestions', async () => {
    const { req } = await setup();
    const r = await req('GET', '/teacher/classes/cls-eng-11ab/students/dss-ahamed-mehta', THOMAS);
    expect(r.status).toBe(200);
    expect(r.body.student).toMatchObject({ name: 'Ahamed Mehta', grade: 11 });
    expect(r.body.weeks).toHaveLength(8);
    expect(r.body.weeks.every((w: { studyMinutes: number }) => w.studyMinutes >= 0)).toBe(true);
    expect(r.body.gradeTrend.length).toBeGreaterThan(2);
    expect(r.body.subjects.map((s: { subject: string }) => s.subject)).toEqual(expect.arrayContaining(['English', 'Mathematics']));
    expect(r.body.suggestions.length).toBeGreaterThan(0);
    expect(r.body.suggestions[0]).toMatchObject({ title: expect.any(String), minutes: expect.any(Number), dueDate: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
  it('is 404 for a student outside the class, and refused for another teacher’s class', async () => {
    const { req } = await setup();
    expect((await req('GET', '/teacher/classes/cls-eng-11ab/students/dss-eshan-thakur', THOMAS)).status).toBe(404);
    expect((await req('GET', '/teacher/classes/cls-math-11bc/students/dss-ahamed-mehta', THOMAS)).status).toBeGreaterThanOrEqual(403);
  });
});

describe('personalised assignments', () => {
  it('reach only the chosen students', async () => {
    const { req } = await setup();
    const roster = (await req('GET', '/teacher/classes/cls-eng-11ab/report', THOMAS)).body.students.map((x: { id: string }) => x.id);
    const chosen = ['dss-ahamed-mehta', roster.find((id: string) => id !== 'dss-ahamed-mehta')];
    const post = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { title: 'Targeted practice: poem analysis', dueDate: '2026-10-26', studentIds: chosen });
    expect(post.status).toBe(201);
    expect(post.body).toMatchObject({ students: 2, personalised: true });
    expect(post.body.automation.replanned).toBe(2);
    const list = (await req('GET', '/teacher/classes/cls-eng-11ab/assignments', THOMAS)).body.items.find((x: { id: string }) => x.id === post.body.assignment.id);
    expect(list).toMatchObject({ students: 2, personalised: true });
    const ahamed = (await req('GET', '/student/school', AHAMED)).body.school.assignments;
    expect(ahamed.some((a: { id: string }) => a.id === post.body.assignment.id)).toBe(true);
    const detail = (await req('GET', `/teacher/classes/cls-eng-11ab/students/${chosen[1]}`, THOMAS)).body;
    expect(detail.items.some((i: { id: string; personalised: boolean }) => i.id === post.body.assignment.id && i.personalised)).toBe(true);
    const other = roster.find((id: string) => !chosen.includes(id));
    const otherDetail = (await req('GET', `/teacher/classes/cls-eng-11ab/students/${other}`, THOMAS)).body;
    expect(otherDetail.items.some((i: { id: string }) => i.id === post.body.assignment.id)).toBe(false);
  });
  it('refuses a student who is not in the class', async () => {
    const { req } = await setup();
    const r = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { title: 'Catch-up task', dueDate: '2026-10-26', studentIds: ['dss-eshan-thakur'] });
    expect(r.status).toBe(400);
  });
});
