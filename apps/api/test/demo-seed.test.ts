import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW } from './helpers';

const ME = { 'x-dev-user': 'demo-ideal' };
const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const ADMIN = { 'x-dev-role': 'admin' };

describe('the demo looks lived-in with no setup', () => {
  it('every student, teacher and school screen has example data', async () => {
    const { app } = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, demoExtras: true });
    const get = async (path: string, h: Record<string, string>) => { const r = await app.request(path, { headers: h }); expect(r.status, path).toBe(200); return r.json() as Promise<any>; };
    expect((await get('/me/notifications', ME)).items.length).toBeGreaterThan(3);
    const stream = await get('/student/stream', ME);
    expect(stream.announcements.length).toBeGreaterThan(2);
    expect(stream.reminders.length).toBe(1);
    expect((await get('/student/reports', ME)).terms[0].subjects.length).toBeGreaterThan(3);
    expect((await get('/student/feelings', ME)).prompt.question).toMatch(/mock/);
    const health = await get('/me/health', ME);
    expect(health.summary.steps).toBeGreaterThan(3000);
    expect(health.workouts.length).toBeGreaterThan(2);
    const school = await get('/student/school', ME);
    expect(school.school.assignments.some((a: any) => a.title === 'Compare two poems about power')).toBe(true);
    const inbox = await get('/teacher/inbox', THOMAS);
    expect(inbox.total).toBeGreaterThan(3);
    expect((await get('/school/leave', ADMIN)).pending).toHaveLength(2);
    // a real school stays empty: the seed only touches the fictional demo school
  });
});
