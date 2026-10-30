import { describe, expect, it } from 'vitest';
import { SEED, setup } from './helpers';

describe('goals & milestones', () => {
  it('lists, creates, updates and deletes goals', async () => {
    const { aisha, rohan } = await setup();
    const list = await aisha('GET', '/goals');
    expect(list.body.items.length).toBe(2);
    const g = await aisha('POST', '/goals', { title: 'Learn Arabic calligraphy', category: 'skill' });
    expect(g.status).toBe(201);
    expect(g.body).toMatchObject({ status: 'active', progress: 0, parent_goal_id: null });
    expect((await rohan('GET', `/goals/${g.body.id}`)).status).toBe(404);
    const u = await aisha('PATCH', `/goals/${g.body.id}`, { status: 'paused' });
    expect(u.body.status).toBe('paused');
    expect((await aisha('GET', '/goals?status=paused')).body.items).toHaveLength(1);
    expect((await aisha('PATCH', `/goals/${g.body.id}`, { parent_goal_id: g.body.id })).status).toBe(400);
    expect((await aisha('DELETE', `/goals/${g.body.id}`)).status).toBe(204);
  });

  it('returns milestones and sub-goals; milestones drive progress', async () => {
    const { aisha } = await setup();
    const g = await aisha('GET', `/goals/${SEED.goalId}`);
    expect(g.body.milestones).toHaveLength(3);
    expect(g.body.sub_goals).toHaveLength(1);
    const m = await aisha('POST', `/goals/${SEED.goalId}/milestones`, { title: 'Visit open day' });
    expect(m.status).toBe(201);
    expect((await aisha('GET', `/goals/${SEED.goalId}`)).body.progress).toBe(25);
    for (const ms of (await aisha('GET', `/goals/${SEED.goalId}/milestones`)).body.items) {
      await aisha('PATCH', `/milestones/${ms.id}`, { done: true });
    }
    const done = await aisha('GET', `/goals/${SEED.goalId}`);
    expect(done.body).toMatchObject({ progress: 100, status: 'done' });
    expect((await aisha('DELETE', `/milestones/${m.body.id}`)).status).toBe(204);
  });

  it('hides other students\' milestones', async () => {
    const { aisha, rohan } = await setup();
    const ms = (await aisha('GET', `/goals/${SEED.goalId}/milestones`)).body.items;
    expect((await rohan('PATCH', `/milestones/${ms[0].id}`, { done: false })).status).toBe(404);
  });
});
