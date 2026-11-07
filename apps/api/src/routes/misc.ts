import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { AgentChatInput, CvCreate, CvTarget } from '../domain';
import { audit, consentState, currentStudent, forbidden, notFound, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { addDays, dubaiInstant, isoDateRe, mondayOf } from '../lib/time';
import { stubAgent } from '../services/agent';
import { buildWeeklyBriefing } from '../services/briefing';
import { buildJsonResume } from '../services/cv';
import { planWeek } from '../services/planner';
import { scoreOpportunity } from '../services/matching';
import type { Student } from '../domain';

// ---------- CV ----------
export function registerCv(api: Api) {
  api.route({ method: 'get', path: '/cv', tag: 'cv', summary: 'List my CV versions', query: z.object({ target: CvTarget.optional() }) }, async (c, { query }) => {
    const s = await currentStudent(c);
    const rows = await c.get('deps').repo.cvVersions.list({ student_id: s.id, target: query.target });
    return c.json({ items: rows.sort((a, b) => b.created_at.localeCompare(a.created_at)) });
  });
  api.route({
    method: 'post', path: '/cv', tag: 'cv', body: CvCreate,
    summary: 'Create a CV version (JSON Resume) from profile + achievements',
    description: 'pdf_url is null until packages/documents renders it. AI-LATER: tailored wording.',
  }, async (c, { body }) => {
    const s = await currentStudent(c);
    const { repo, now } = c.get('deps');
    const achievements = await repo.achievements.list({ student_id: s.id });
    const school = s.school_id ? await repo.schools.get(s.school_id) : null;
    const json = buildJsonResume(s, achievements, { target: body.target, school, basics: body.basics });
    const cv = await repo.cvVersions.create({
      student_id: s.id, template: body.template, target: body.target, json: JSON.parse(JSON.stringify(json)),
      pdf_url: null, created_at: now().toISOString(),
    });
    return c.json(cv, 201);
  });
  const own = async (c: Ctx, id: string) => {
    const s = await currentStudent(c);
    const cv = await c.get('deps').repo.cvVersions.get(id);
    if (!cv || cv.student_id !== s.id) return notFound('cv version');
    return cv;
  };
  api.route({ method: 'get', path: '/cv/:id', tag: 'cv', summary: 'Get a CV version' }, async (c) => c.json(await own(c, c.req.param('id')!)));
  api.route({ method: 'delete', path: '/cv/:id', tag: 'cv', summary: 'Delete a CV version' }, async (c) => {
    const cv = await own(c, c.req.param('id')!);
    await c.get('deps').repo.cvVersions.delete(cv.id);
    return c.body(null, 204);
  });
}

// ---------- Connections (placeholders; real OAuth lives in packages/connectors) ----------
export const PROVIDERS: Record<string, { scopes: string[]; authorize: string }> = {
  google_classroom: { scopes: ['classroom.courses.readonly', 'classroom.coursework.me.readonly'], authorize: 'https://accounts.google.com/o/oauth2/v2/auth' },
  google_calendar: { scopes: ['calendar.readonly'], authorize: 'https://accounts.google.com/o/oauth2/v2/auth' },
  microsoft_teams: { scopes: ['EduAssignments.ReadBasic', 'Calendars.Read'], authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize' },
  managebac: { scopes: ['read'], authorize: 'https://example.managebac.invalid/oauth/authorize' },
  toddle: { scopes: ['read'], authorize: 'https://example.toddle.invalid/oauth/authorize' },
};

export function registerConnections(api: Api) {
  api.route({ method: 'get', path: '/connections', tag: 'connections', summary: 'List my connections and available providers' }, async (c) => {
    const s = await currentStudent(c);
    return c.json({ items: await c.get('deps').repo.connections.list({ student_id: s.id }), providers: Object.keys(PROVIDERS) });
  });

  api.route({
    method: 'post', path: '/connections/:provider/start', tag: 'connections',
    summary: 'Start connecting a provider (placeholder OAuth URL). Under-18s need guardian consent.',
  }, async (c) => {
    const s = await currentStudent(c);
    const provider = c.req.param('provider')!;
    const p = PROVIDERS[provider] ?? notFound('provider');
    const cs = await consentState(c, s);
    if (!cs.can_connect) throw new HTTPException(403, { message: 'guardian consent required before connecting accounts (under 18)' });
    const { repo, config } = c.get('deps');
    const state = crypto.randomUUID();
    let conn = await repo.connections.findOne({ student_id: s.id, provider });
    const pendingState = { status: `pending:${state}`, scopes: p.scopes };
    conn = conn ? (await repo.connections.update(conn.id, pendingState))! : await repo.connections.create({
      student_id: s.id, provider, token_ref: null, last_sync_at: null, ...pendingState,
    });
    const redirect = `${config.publicApiUrl}/connections/${provider}/callback`;
    const url = `${p.authorize}?client_id=PLACEHOLDER&response_type=code&state=${state}` +
      `&redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(p.scopes.join(' '))}`;
    return c.json({ connection_id: conn.id, authorize_url: url, state, placeholder: true }, 201);
  });

  api.route({
    method: 'get', path: '/connections/:provider/callback', tag: 'connections', auth: 'none',
    summary: 'OAuth callback placeholder: marks the connection connected (no token exchange yet)',
    query: z.object({ state: z.string().min(1).max(200), code: z.string().max(2000).optional(), error: z.string().max(500).optional() }),
  }, async (c, { query }) => {
    const { repo, now } = c.get('deps');
    const provider = c.req.param('provider')!;
    const conn = (await repo.connections.findOne({ provider, status: `pending:${query.state}` })) ?? notFound('pending connection');
    if (query.error || !query.code) {
      return c.json(await repo.connections.update(conn.id, { status: 'error' }), 400);
    }
    // Real implementation (packages/connectors): exchange code, store token in vault, keep only a reference.
    const updated = await repo.connections.update(conn.id, {
      status: 'connected', token_ref: `vault://connections/${conn.id}`, last_sync_at: now().toISOString(),
    });
    return c.json(updated);
  });

  api.route({ method: 'delete', path: '/connections/:id', tag: 'connections', summary: 'Disconnect' }, async (c) => {
    const s = await currentStudent(c);
    const { repo } = c.get('deps');
    const conn = await repo.connections.get(c.req.param('id')!);
    if (!conn || conn.student_id !== s.id) return notFound('connection');
    await repo.connections.delete(conn.id);
    return c.body(null, 204);
  });
}

// ---------- Planner & briefing ----------
const WeekQuery = z.object({
  start: z.string().regex(isoDateRe).optional().describe('YYYY-MM-DD; defaults to Monday of the current Dubai week'),
});
const PlannerQuery = WeekQuery.extend({
  max_minutes_per_day: z.coerce.number().int().min(15).max(720).optional(),
  block_minutes: z.coerce.number().int().min(15).max(240).optional(),
  weekday_start: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM, Mon–Thu window start (default 16:00)'),
  weekday_end: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM (default 21:00)'),
  weekend_start: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM, Sat/Sun (default 10:00)'),
  weekend_end: z.string().regex(/^\d{2}:\d{2}$/).optional().describe('HH:MM (default 20:00)'),
});
const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

async function studentWeekData(c: Ctx, s: Student) {
  const { repo } = c.get('deps');
  const goals = await repo.goals.list({ student_id: s.id });
  const milestones = (await Promise.all(goals.map((g) => repo.milestones.list({ goal_id: g.id })))).flat();
  return {
    tasks: await repo.tasks.list({ student_id: s.id }),
    events: await repo.calendarEvents.list({ student_id: s.id }),
    goals, milestones,
    applications: await repo.applications.list({ student_id: s.id }),
    opportunities: await repo.opportunities.list(),
  };
}

export function registerPlanner(api: Api) {
  api.route({
    method: 'get', path: '/planner/week', tag: 'planner', query: PlannerQuery,
    summary: 'Rule-based weekly plan: open tasks spread into free slots (Asia/Dubai), avoiding calendar events',
  }, async (c, { query }) => {
    const s = await currentStudent(c);
    const { repo, now } = c.get('deps');
    const n = now();
    const weekStart = query.start ?? mondayOf(n);
    const plan = planWeek(await repo.tasks.list({ student_id: s.id }), await repo.calendarEvents.list({ student_id: s.id }), {
      weekStart, now: n,
      ...(query.max_minutes_per_day ? { maxMinutesPerDay: query.max_minutes_per_day } : {}),
      ...(query.block_minutes ? { blockMinutes: query.block_minutes } : {}),
      ...(query.weekday_start || query.weekday_end ? { weekdayWindow: [hm(query.weekday_start ?? '16:00'), hm(query.weekday_end ?? '21:00')] } : {}),
      ...(query.weekend_start || query.weekend_end ? { weekendWindow: [hm(query.weekend_start ?? '10:00'), hm(query.weekend_end ?? '20:00')] } : {}),
    });
    return c.json(plan);
  });

  api.route({ method: 'get', path: '/briefing/weekly', tag: 'briefing', query: WeekQuery, summary: 'Rule-based weekly briefing JSON (rendered/sent by packages/notify)' }, async (c, { query }) => {
    const s = await currentStudent(c);
    const n = c.get('deps').now();
    return c.json(buildWeeklyBriefing({ student: s, ...(await studentWeekData(c, s)), weekStart: query.start ?? mondayOf(n), now: n }));
  });
}

// ---------- Guardian summary views ----------
export function registerGuardian(api: Api) {
  const linked = async (c: Ctx) => {
    const auth = c.get('auth');
    if (auth.role !== 'guardian') forbidden('guardian role required');
    if (!auth.email) forbidden('guardian token has no email');
    return c.get('deps').repo.guardians.list({ email: auth.email! });
  };

  api.route({ method: 'get', path: '/guardian/students', tag: 'guardian', summary: 'Students linked to the calling guardian' }, async (c) => {
    const links = await linked(c);
    const { repo } = c.get('deps');
    const items = await Promise.all(links.map(async (g) => {
      const s = await repo.students.get(g.student_id);
      return { student_id: g.student_id, name: g.consent_status === 'granted' ? s?.preferred_name ?? s?.full_name : null, relation: g.relation, consent_status: g.consent_status };
    }));
    return c.json({ items });
  });

  api.route({
    method: 'get', path: '/guardian/students/:studentId/summary', tag: 'guardian',
    summary: 'Summary view of a linked student (no material contents, no chat)', query: WeekQuery,
  }, async (c, { query }) => {
    const links = await linked(c);
    const link = links.find((g) => g.student_id === c.req.param('studentId'));
    if (!link) return notFound('student');
    if (link.consent_status !== 'granted') forbidden('guardian link is not verified/consented');
    const { repo, now } = c.get('deps');
    const s = (await repo.students.get(link.student_id)) ?? notFound('student');
    await audit(c, 'read_summary', `students/${s.id}`);
    const n = now();
    const b = buildWeeklyBriefing({ student: s, ...(await studentWeekData(c, s)), weekStart: query.start ?? mondayOf(n), now: n });
    return c.json({
      student: { id: s.id, name: s.preferred_name ?? s.full_name, grade: s.grade },
      week_start: b.week_start,
      week_end: b.week_end,
      tasks: { due_this_week: b.tasks.due_this_week.length, overdue: b.tasks.overdue.length, open: b.tasks.open_count },
      study_planned_minutes: b.plan.planned_minutes,
      goals: b.goals.map((g) => ({ title: g.title, progress: g.progress })),
      applications: b.applications.map((a) => ({ opportunity_title: a.opportunity_title, status: a.status, deadline: a.deadline })),
      upcoming_deadlines: [
        ...b.tasks.due_this_week.map((t) => ({ title: t.title, due_at: t.due_at, kind: t.kind })),
        ...b.applications.filter((a) => a.deadline && Date.parse(a.deadline) < dubaiInstant(addDays(b.week_start, 7)).getTime())
          .map((a) => ({ title: a.opportunity_title, due_at: a.deadline, kind: 'application' as const })),
      ],
    });
  });
}

// ---------- Agent (stub) ----------
export function registerAgent(api: Api) {
  api.route({
    method: 'post', path: '/agent/chat', tag: 'agent', body: AgentChatInput,
    summary: 'Agent chat — deterministic stub (AI-LATER via packages/agent-gateway)',
  }, async (c, { body }) => {
    const s = await currentStudent(c);
    const { repo, now } = c.get('deps');
    await audit(c, 'agent_read', `students/${s.id}`); // the agent reads student data
    const n = now();
    const weekEnd = dubaiInstant(addDays(mondayOf(n), 7)).getTime();
    const tasks = (await repo.tasks.list({ student_id: s.id })).filter((t) => t.status === 'todo' || t.status === 'doing');
    const goals = await repo.goals.list({ student_id: s.id, status: 'active' });
    const top = (await repo.opportunities.list())
      .map((o) => ({ o, m: scoreOpportunity(s, o, { now: n, goalCategories: goals.map((g) => g.category) }) }))
      .filter((x) => x.m.eligible).sort((a, b) => b.m.score - a.m.score)[0];
    const reply = await stubAgent.chat(body.message, {
      studentName: s.preferred_name ?? s.full_name,
      openTasks: tasks.length,
      dueThisWeek: tasks.filter((t) => t.due_at && Date.parse(t.due_at) >= n.getTime() && Date.parse(t.due_at) < weekEnd),
      topOpportunity: top ? { title: top.o.title, score: top.m.score } : null,
    });
    return c.json({ ...reply, thread_id: body.thread_id ?? null });
  });
}
