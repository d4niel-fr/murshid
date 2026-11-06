import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import {
  ApplicationCreate, ApplicationStatus, ApplicationUpdate, OpportunityCreate, OpportunityStatus, OpportunityType,
  type Application, type Opportunity, type Student,
} from '../domain';
import { badRequest, currentStudent, forbidden, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { CHECKLIST_TEMPLATES, defaultChecklist } from '../services/checklists';
import { scoreOpportunity } from '../services/matching';

const OppQuery = z.object({
  grade: z.coerce.number().int().min(6).max(13).optional().describe('only opportunities open to this grade'),
  type: z.string().max(200).optional().describe(`comma list of ${OpportunityType.options.join('|')}`),
  deadline_before: z.string().max(200).optional(),
  deadline_after: z.string().max(200).optional(),
  status: OpportunityStatus.optional(),
  include_closed: z.enum(['true', 'false']).default('false'),
  emirate: z.string().max(200).optional(),
  tag: z.string().max(200).optional(),
  q: z.string().max(200).optional().describe('text search in title/organizer/tags'),
  eligible_only: z.enum(['true', 'false']).default('false').describe('hide opportunities the caller is not eligible for'),
  min_score: z.coerce.number().min(0).max(100).optional(),
  sort: z.enum(['score', 'deadline']).default('score'),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

/** Students get a match block; other roles just get the list. */
async function matchContext(c: Ctx): Promise<{ student: Student; goalCategories: string[] } | null> {
  const auth = c.get('auth');
  if (auth.role !== 'student') return null;
  const { repo } = c.get('deps');
  const student = await repo.students.findOne({ auth_user_id: auth.userId });
  if (!student) return null;
  const goals = await repo.goals.list({ student_id: student.id, status: 'active' });
  return { student, goalCategories: goals.map((g) => g.category) };
}

export function registerOpportunities(api: Api) {
  api.route({
    method: 'get', path: '/opportunities', tag: 'opportunities', query: OppQuery,
    summary: 'List/filter opportunities with a rule-based match score for the calling student',
  }, async (c, { query: q }) => {
    const { repo, now } = c.get('deps');
    const ctx = await matchContext(c);
    const types = q.type?.split(',').map((t) => t.trim()).filter(Boolean);
    if (types) for (const t of types) if (!OpportunityType.safeParse(t).success) badRequest(`unknown type: ${t}`);
    const needle = q.q?.toLowerCase();
    const t = (v: string) => new Date(v).getTime();

    const rows = (await repo.opportunities.list({ status: q.status }))
      .filter((o) => q.include_closed === 'true' || q.status === 'closed' || o.status !== 'closed')
      .filter((o) => !types || types.includes(o.type))
      .filter((o) => q.grade === undefined || ((o.min_grade ?? 0) <= q.grade && q.grade <= (o.max_grade ?? 99)))
      .filter((o) => !q.deadline_before || (o.deadline && t(o.deadline) < t(q.deadline_before)))
      .filter((o) => !q.deadline_after || (o.deadline && t(o.deadline) >= t(q.deadline_after)))
      .filter((o) => !q.emirate || o.emirate?.toLowerCase() === q.emirate.toLowerCase())
      .filter((o) => !q.tag || o.tags.some((tag) => tag.toLowerCase() === q.tag!.toLowerCase()))
      .filter((o) => !needle || `${o.title} ${o.organizer} ${o.tags.join(' ')}`.toLowerCase().includes(needle));

    const items = rows.map((o) => ({
      ...o,
      match: ctx ? scoreOpportunity(ctx.student, o, { now: now(), goalCategories: ctx.goalCategories as never }) : null,
    }))
      .filter((x) => q.eligible_only !== 'true' || !x.match || x.match.eligible)
      .filter((x) => q.min_score === undefined || (x.match?.score ?? 0) >= q.min_score);

    const byDeadline = (a: Opportunity, b: Opportunity) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999');
    items.sort((a, b) => q.sort === 'score' && ctx ? (b.match!.score - a.match!.score) || byDeadline(a, b) : byDeadline(a, b));
    return c.json({ items: items.slice(0, q.limit), total: items.length });
  });

  api.route({ method: 'get', path: '/opportunities/:id', tag: 'opportunities', summary: 'Get an opportunity with match details' }, async (c) => {
    const { repo, now } = c.get('deps');
    const o = (await repo.opportunities.get(c.req.param('id')!)) ?? notFound('opportunity');
    const ctx = await matchContext(c);
    return c.json({ ...o, match: ctx ? scoreOpportunity(ctx.student, o, { now: now(), goalCategories: ctx.goalCategories as never }) : null });
  });

  api.route({
    method: 'post', path: '/opportunities', tag: 'opportunities', body: OpportunityCreate,
    summary: 'Create an opportunity (admin only; the opportunities team ingests the real catalogue)',
  }, async (c, { body }) => {
    if (c.get('auth').role !== 'admin') forbidden('admin role required');
    const { repo, now } = c.get('deps');
    const o = await repo.opportunities.create({
      url: null, emirate: null, country: 'AE', min_grade: null, max_grade: null, eligibility_text: null,
      nationality_restriction: null, cost_aed: null, deadline: null, tags: [], source_id: 'manual',
      last_seen_at: now().toISOString(), status: 'open', ...body,
    });
    return c.json(o, 201);
  });
}

export function registerApplications(api: Api) {
  const own = async (c: Ctx, id: string): Promise<Application> => {
    const s = await currentStudent(c);
    const a = await c.get('deps').repo.applications.get(id);
    if (!a || a.student_id !== s.id) return notFound('application');
    return a;
  };
  const withOpp = async (c: Ctx, a: Application) => ({
    ...a, opportunity: await c.get('deps').repo.opportunities.get(a.opportunity_id),
    progress: a.checklist.length ? Math.round((a.checklist.filter((i) => i.done).length / a.checklist.length) * 100) : 0,
  });

  api.route({ method: 'get', path: '/applications/templates', tag: 'applications', summary: 'Default checklist template per opportunity type', auth: 'none' }, (c) =>
    c.json(CHECKLIST_TEMPLATES));

  api.route({ method: 'get', path: '/applications', tag: 'applications', summary: 'List my applications', query: z.object({ status: ApplicationStatus.optional() }) }, async (c, { query }) => {
    const s = await currentStudent(c);
    const rows = await c.get('deps').repo.applications.list({ student_id: s.id, status: query.status });
    return c.json({ items: await Promise.all(rows.map((a) => withOpp(c, a))) });
  });

  api.route({ method: 'post', path: '/applications', tag: 'applications', summary: 'Start an application (checklist from type template)', body: ApplicationCreate }, async (c, { body }) => {
    const s = await currentStudent(c);
    const { repo, now } = c.get('deps');
    const opp = (await repo.opportunities.get(body.opportunity_id)) ?? notFound('opportunity');
    if (await repo.applications.findOne({ student_id: s.id, opportunity_id: opp.id })) {
      throw new HTTPException(409, { message: 'application for this opportunity already exists' });
    }
    const a = await repo.applications.create({
      student_id: s.id, opportunity_id: opp.id, status: body.status, notes: body.notes,
      checklist: body.checklist ?? defaultChecklist(opp.type),
      submitted_at: body.status === 'submitted' ? now().toISOString() : null,
    });
    // deadline becomes an application task so the planner sees it
    if (opp.deadline) {
      await repo.tasks.create({
        student_id: s.id, title: `Apply: ${opp.title}`, kind: 'application', due_at: opp.deadline,
        est_minutes: 30 * Math.max(1, Math.ceil(a.checklist.length / 2)), status: 'todo', linked_goal_id: null,
        linked_material_id: null, linked_opportunity_id: opp.id, ai_use_level: 'none',
      });
    }
    return c.json(await withOpp(c, a), 201);
  });

  api.route({ method: 'get', path: '/applications/:id', tag: 'applications', summary: 'Get an application' }, async (c) =>
    c.json(await withOpp(c, await own(c, c.req.param('id')!))));

  api.route({ method: 'patch', path: '/applications/:id', tag: 'applications', summary: 'Update status / notes / checklist', body: ApplicationUpdate }, async (c, { body }) => {
    const a = await own(c, c.req.param('id')!);
    const { repo, now } = c.get('deps');
    const patch: Partial<Application> = { ...body };
    if (body.status === 'submitted' && !a.submitted_at) patch.submitted_at = now().toISOString();
    const updated = (await repo.applications.update(a.id, patch))!;
    if (body.status && ['submitted', 'accepted', 'rejected'].includes(body.status)) {
      const t = await repo.tasks.findOne({ student_id: a.student_id, linked_opportunity_id: a.opportunity_id, kind: 'application' });
      if (t && t.status !== 'done') await repo.tasks.update(t.id, { status: 'done' });
    }
    return c.json(await withOpp(c, updated));
  });

  api.route({
    method: 'patch', path: '/applications/:id/checklist/:index', tag: 'applications', summary: 'Set one checklist item done/undone',
    body: z.object({ done: z.boolean() }),
  }, async (c, { body }) => {
    const a = await own(c, c.req.param('id')!);
    const idx = Number(c.req.param('index'));
    if (!Number.isInteger(idx) || idx < 0 || idx >= a.checklist.length) return notFound('checklist item');
    const checklist = a.checklist.map((it, i) => (i === idx ? { ...it, done: body.done } : it));
    const status = a.status === 'saved' && body.done ? 'preparing' : a.status;
    return c.json(await withOpp(c, (await c.get('deps').repo.applications.update(a.id, { checklist, status }))!));
  });

  api.route({ method: 'delete', path: '/applications/:id', tag: 'applications', summary: 'Delete an application' }, async (c) => {
    const a = await own(c, c.req.param('id')!);
    await c.get('deps').repo.applications.delete(a.id);
    return c.body(null, 204);
  });
}
