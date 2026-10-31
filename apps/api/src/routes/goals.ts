import { z } from 'zod';
import { GoalCategory, GoalCreate, GoalStatus, GoalUpdate, MilestoneCreate, MilestoneUpdate, type Goal } from '../domain';
import { badRequest, currentStudent, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';

async function ownGoal(c: Ctx, id: string): Promise<Goal> {
  const s = await currentStudent(c);
  const g = await c.get('deps').repo.goals.get(id);
  if (!g || g.student_id !== s.id) return notFound('goal');
  return g;
}

/** progress = % of milestones done (only when the goal has milestones). */
async function recomputeProgress(c: Ctx, goalId: string): Promise<void> {
  const { repo } = c.get('deps');
  const ms = await repo.milestones.list({ goal_id: goalId });
  if (!ms.length) return;
  const progress = Math.round((ms.filter((m) => m.done).length / ms.length) * 100);
  await repo.goals.update(goalId, { progress, ...(progress === 100 ? { status: 'done' as const } : {}) });
}

export function registerGoals(api: Api) {
  api.route({
    method: 'get', path: '/goals', tag: 'goals', summary: 'List my goals',
    query: z.object({ status: GoalStatus.optional(), category: GoalCategory.optional(), parent_goal_id: z.string().optional() }),
  }, async (c, { query }) => {
    const s = await currentStudent(c);
    const goals = await c.get('deps').repo.goals.list({ student_id: s.id, status: query.status, category: query.category, parent_goal_id: query.parent_goal_id });
    return c.json({ items: goals });
  });

  api.route({ method: 'post', path: '/goals', tag: 'goals', summary: 'Create a goal', body: GoalCreate }, async (c, { body }) => {
    const s = await currentStudent(c);
    if (body.parent_goal_id) await ownGoal(c, body.parent_goal_id);
    return c.json(await c.get('deps').repo.goals.create({ ...body, student_id: s.id }), 201);
  });

  api.route({ method: 'get', path: '/goals/:id', tag: 'goals', summary: 'Get a goal with milestones and sub-goals' }, async (c) => {
    const g = await ownGoal(c, c.req.param('id')!);
    const { repo } = c.get('deps');
    return c.json({ ...g, milestones: await repo.milestones.list({ goal_id: g.id }), sub_goals: await repo.goals.list({ parent_goal_id: g.id }) });
  });

  api.route({ method: 'patch', path: '/goals/:id', tag: 'goals', summary: 'Update a goal', body: GoalUpdate }, async (c, { body }) => {
    const g = await ownGoal(c, c.req.param('id')!);
    if (body.parent_goal_id) {
      if (body.parent_goal_id === g.id) badRequest('goal cannot be its own parent');
      await ownGoal(c, body.parent_goal_id);
    }
    return c.json(await c.get('deps').repo.goals.update(g.id, body));
  });

  api.route({ method: 'delete', path: '/goals/:id', tag: 'goals', summary: 'Delete a goal and its milestones' }, async (c) => {
    const g = await ownGoal(c, c.req.param('id')!);
    const { repo } = c.get('deps');
    for (const m of await repo.milestones.list({ goal_id: g.id })) await repo.milestones.delete(m.id);
    for (const sub of await repo.goals.list({ parent_goal_id: g.id })) await repo.goals.update(sub.id, { parent_goal_id: null });
    await repo.goals.delete(g.id);
    return c.body(null, 204);
  });

  api.route({ method: 'get', path: '/goals/:id/milestones', tag: 'milestones', summary: 'List milestones of a goal' }, async (c) => {
    const g = await ownGoal(c, c.req.param('id')!);
    return c.json({ items: await c.get('deps').repo.milestones.list({ goal_id: g.id }) });
  });

  api.route({ method: 'post', path: '/goals/:id/milestones', tag: 'milestones', summary: 'Add a milestone (recomputes goal progress)', body: MilestoneCreate }, async (c, { body }) => {
    const g = await ownGoal(c, c.req.param('id')!);
    const m = await c.get('deps').repo.milestones.create({ ...body, goal_id: g.id });
    await recomputeProgress(c, g.id);
    return c.json(m, 201);
  });

  const ownMilestone = async (c: Ctx, id: string) => {
    const m = (await c.get('deps').repo.milestones.get(id)) ?? notFound('milestone');
    await ownGoal(c, m.goal_id).catch(() => notFound('milestone'));
    return m;
  };

  api.route({ method: 'patch', path: '/milestones/:id', tag: 'milestones', summary: 'Update a milestone (recomputes goal progress)', body: MilestoneUpdate }, async (c, { body }) => {
    const m = await ownMilestone(c, c.req.param('id')!);
    const updated = await c.get('deps').repo.milestones.update(m.id, body);
    await recomputeProgress(c, m.goal_id);
    return c.json(updated);
  });

  api.route({ method: 'delete', path: '/milestones/:id', tag: 'milestones', summary: 'Delete a milestone' }, async (c) => {
    const m = await ownMilestone(c, c.req.param('id')!);
    await c.get('deps').repo.milestones.delete(m.id);
    await recomputeProgress(c, m.goal_id);
    return c.body(null, 204);
  });
}
