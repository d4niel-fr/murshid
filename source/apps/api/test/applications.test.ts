import { describe, expect, it } from 'vitest';
import { CHECKLIST_TEMPLATES } from '../src/services/checklists';
import { setup } from './helpers';

describe('applications', () => {
  it('exposes templates for every opportunity type', async () => {
    const { call } = await setup();
    const r = await call('GET', '/applications/templates');
    expect(Object.keys(r.body).sort()).toEqual(Object.keys(CHECKLIST_TEMPLATES).sort());
  });

  it('creates an application with the type checklist and an application task', async () => {
    const { aisha, rohan } = await setup();
    const opp = (await aisha('GET', '/opportunities?type=olympiad')).body.items[0];
    const a = await aisha('POST', '/applications', { opportunity_id: opp.id });
    expect(a.status).toBe(201);
    expect(a.body.checklist.map((c: any) => c.item)).toEqual(CHECKLIST_TEMPLATES.olympiad);
    expect(a.body).toMatchObject({ status: 'saved', progress: 0, opportunity: { id: opp.id } });
    const tasks = (await aisha('GET', '/tasks?kind=application')).body.items;
    expect(tasks[0]).toMatchObject({ linked_opportunity_id: opp.id, due_at: opp.deadline });
    expect((await aisha('POST', '/applications', { opportunity_id: opp.id })).status).toBe(409);
    expect((await rohan('GET', `/applications/${a.body.id}`)).status).toBe(404);

    const tick = await aisha('PATCH', `/applications/${a.body.id}/checklist/0`, { done: true });
    expect(tick.body).toMatchObject({ status: 'preparing', progress: 20 });
    expect((await aisha('PATCH', `/applications/${a.body.id}/checklist/99`, { done: true })).status).toBe(404);

    const sub = await aisha('PATCH', `/applications/${a.body.id}`, { status: 'submitted', notes: 'sent' });
    expect(sub.body.submitted_at).toBeTruthy();
    expect((await aisha('GET', '/tasks?kind=application')).body.items[0].status).toBe('done');
    expect((await aisha('GET', '/applications?status=submitted')).body.items).toHaveLength(1);
    expect((await aisha('DELETE', `/applications/${a.body.id}`)).status).toBe(204);
  });

  it('accepts a custom checklist and 404s for unknown opportunities', async () => {
    const { aisha } = await setup();
    const opp = (await aisha('GET', '/opportunities?type=mun')).body.items[0];
    const a = await aisha('POST', '/applications', { opportunity_id: opp.id, checklist: [{ item: 'Ask mum', done: false }] });
    expect(a.body.checklist).toEqual([{ item: 'Ask mum', done: false }]);
    expect((await aisha('POST', '/applications', { opportunity_id: 'nope' })).status).toBe(404);
  });
});
