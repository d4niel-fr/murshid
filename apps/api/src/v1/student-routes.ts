/**
 * Student-facing reads of the shared store that the dashboard does not cover: side projects, applications,
 * achievements, goals, sports detail, tasks (incl. those added by staff or Murshid) and the LinkedIn-ready CV.
 * Same student selection as the other v1 routes (x-dev-user).
 */
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { goalStates } from './data';
import { buildLinkedInPack, renderLinkedInCvPdf } from './linkedin';
import type { DemoStore, DemoView } from './store';
import { achievements, applications, projects, studentCard, tasks, training } from './views';
import { parseDay, parseTime } from './agent-tools';

const TasksQuery = z.object({ scope: z.enum(['today', 'week', 'overdue']).default('week') });
const TaskCreate = z.object({
  title: z.string().trim().min(1).max(120), date: z.string().min(1).max(20), time: z.string().max(10).optional(),
  durationMinutes: z.number().int().min(5).max(480).default(30), kind: z.enum(['study', 'assignment', 'activity', 'habit', 'application']).default('study'),
});
const TaskPatch = z.object({ status: z.enum(['todo', 'done']) });
const LinkedInIn = z.object({ headline: z.string().max(220).optional(), about: z.string().max(2600).optional() });

export function registerStudentExtras(api: Api, store: DemoStore, view: (c: Ctx) => Promise<DemoView>) {
  api.route({ method: 'get', path: '/student/projects', tag: 'v1', auth: 'custom', summary: 'Side projects / businesses with monthly revenue, customers and milestones' },
    async (c) => { const v = await view(c); return c.json({ student: studentCard(v), items: projects(v) }); });

  api.route({ method: 'get', path: '/student/applications', tag: 'v1', auth: 'custom', summary: 'Opportunities applied to, with status and outcome' },
    async (c) => { const v = await view(c); return c.json({ items: applications(v) }); });

  api.route({ method: 'get', path: '/student/achievements', tag: 'v1', auth: 'custom', summary: 'Achievements (newest first)' },
    async (c) => { const v = await view(c); return c.json({ items: achievements(v) }); });

  api.route({ method: 'get', path: '/student/goals', tag: 'v1', auth: 'custom', summary: 'Goals with weekly history and progress' },
    async (c) => { const v = await view(c); return c.json({ items: goalStates(v.profile, v.data, v.sessions) }); });

  api.route({ method: 'get', path: '/student/training', tag: 'v1', auth: 'custom', summary: 'Per sport: weekly load, personal bests, matches / races and upcoming fixtures' },
    async (c) => { const v = await view(c); return c.json({ items: training(v, 12) }); });

  api.route({ method: 'get', path: '/student/tasks', tag: 'v1', auth: 'custom', query: TasksQuery, summary: 'Tasks (today | week | overdue), incl. tasks added by staff and Murshid' },
    async (c, { query }) => { const v = await view(c); return c.json({ scope: query.scope, items: tasks(v, query.scope) }); });

  api.route({ method: 'post', path: '/student/tasks', tag: 'v1', auth: 'custom', body: TaskCreate, summary: 'Add a task to my planner' }, async (c, { body }) => {
    const v = await view(c);
    let date: string;
    try { date = parseDay(body.date, v.data.today); } catch (e) { throw new HTTPException(400, { message: (e as Error).message }); }
    const task = { id: store.nextId('task-s'), title: body.title, kind: body.kind, date, time: parseTime(body.time), durationMinutes: body.durationMinutes, status: 'todo' as const, overdue: false, subjectId: null, area: null, source: 'student' as const, notes: null };
    v.record.customTasks.push(task);
    return c.json({ task }, 201);
  });

  api.route({ method: 'patch', path: '/student/tasks/:id', tag: 'v1', auth: 'custom', body: TaskPatch, summary: 'Mark a task done / not done' }, async (c, { body }) => {
    const v = await view(c);
    const id = c.req.param('id')!;
    const custom = v.record.customTasks.find((t) => t.id === id);
    if (custom) custom.status = body.status;
    else v.record.taskStatus[id] = body.status;
    return c.json({ id, status: body.status });
  });

  api.route({ method: 'get', path: '/student/cv/linkedin', tag: 'v1', auth: 'custom', summary: 'LinkedIn profile pack (latest generated, or built now from my data)' }, async (c) => {
    const v = await view(c);
    return c.json({ ...(v.record.linkedin ?? buildLinkedInPack(v)), pdfUrl: '/student/cv/linkedin.pdf' });
  });

  api.route({ method: 'post', path: '/student/cv/linkedin', tag: 'v1', auth: 'custom', durable: 'late', body: LinkedInIn, successStatus: 200, summary: 'Regenerate the LinkedIn pack (optional own headline / About)' }, async (c, { body }) => {
    const v = await view(c);
    const pack = buildLinkedInPack(v, body);
    v.record.linkedin = pack;
    return c.json({ ...pack, pdfUrl: '/student/cv/linkedin.pdf' });
  });

  api.route({ method: 'get', path: '/student/cv/linkedin.pdf', tag: 'v1', auth: 'custom', summary: 'LinkedIn-ready CV as an ATS-safe PDF (application/pdf)' }, async (c) => {
    const v = await view(c);
    const pdf = await renderLinkedInCvPdf(v, v.record.linkedin ?? buildLinkedInPack(v));
    const name = `${v.profile.name.replace(/[^A-Za-z0-9]+/g, '-')}-LinkedIn-CV.pdf`;
    return new Response(new Uint8Array(pdf), { status: 200, headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${name}"`, 'cache-control': 'no-store' } });
  });
}
