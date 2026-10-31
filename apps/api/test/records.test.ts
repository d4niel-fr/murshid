import { describe, expect, it } from 'vitest';
import { setup } from './helpers';

describe('tasks', () => {
  it('CRUD + filters, scoped per student', async () => {
    const { aisha, rohan } = await setup();
    const all = (await aisha('GET', '/tasks')).body.items;
    expect(all).toHaveLength(5);
    expect(all[0].title).toBe('Physics problem set 3'); // sorted by due
    const t = await aisha('POST', '/tasks', { title: 'Flashcards', est_minutes: 20 });
    expect(t.body).toMatchObject({ kind: 'study', status: 'todo', ai_use_level: 'none' });
    expect((await aisha('PATCH', `/tasks/${t.body.id}`, { status: 'done' })).body.status).toBe('done');
    expect((await aisha('GET', '/tasks?status=done')).body.items).toHaveLength(1);
    expect((await aisha('GET', '/tasks?status=todo,doing')).body.items).toHaveLength(5);
    expect((await aisha('GET', '/tasks?due_before=2026-10-15T00:00:00Z')).body.items).toHaveLength(1);
    expect((await rohan('DELETE', `/tasks/${t.body.id}`)).status).toBe(404);
    expect((await aisha('DELETE', `/tasks/${t.body.id}`)).status).toBe(204);
    expect((await aisha('POST', '/tasks', { title: '' })).status).toBe(400);
    expect((await aisha('PATCH', `/tasks/${all[0].id}`, { ai_use_level: 'full' })).status).toBe(400);
  });
});

describe('calendar', () => {
  it('CRUD with range filter and end>start validation', async () => {
    const { aisha } = await setup();
    const week = (await aisha('GET', '/calendar?from=2026-10-12T00:00:00Z&to=2026-10-19T00:00:00Z')).body.items;
    expect(week).toHaveLength(4);
    expect((await aisha('POST', '/calendar', { title: 'Bad', start_at: '2026-10-13T10:00:00Z', end_at: '2026-10-13T09:00:00Z' })).status).toBe(400);
    const e = await aisha('POST', '/calendar', { title: 'Dentist', start_at: '2026-10-13T12:00:00Z', end_at: '2026-10-13T13:00:00Z' });
    expect(e.status).toBe(201);
    expect((await aisha('PATCH', `/calendar/${e.body.id}`, { end_at: '2026-10-13T11:00:00Z' })).status).toBe(400);
    expect((await aisha('PATCH', `/calendar/${e.body.id}`, { title: 'Orthodontist' })).body.title).toBe('Orthodontist');
    // the new event blocks Tuesday's slot in the planner
    const plan = (await aisha('GET', '/planner/week')).body;
    expect(plan.days[1].events.map((x: any) => x.title)).toContain('Orthodontist');
    expect((await aisha('DELETE', `/calendar/${e.body.id}`)).status).toBe(204);
  });
});

describe('achievements', () => {
  it('CRUD and category filter', async () => {
    const { aisha, rohan } = await setup();
    expect((await aisha('GET', '/achievements')).body.items).toHaveLength(4);
    const a = await aisha('POST', '/achievements', { title: 'Hackathon finalist', category: 'project', date: '2026-09-01' });
    expect(a.status).toBe(201);
    expect((await aisha('GET', '/achievements?category=project')).body.items).toHaveLength(1);
    expect((await rohan('GET', `/achievements/${a.body.id}`)).status).toBe(404);
    expect((await aisha('POST', '/achievements', { title: 'x', category: 'party' })).status).toBe(400);
  });
});
