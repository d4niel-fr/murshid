/**
 * Admin portal API (/admin/*): school / admin staff see every student and create or edit the information that
 * feeds the student platform. Writes go to the same DemoStore the student routes and Murshid's agents read, so a
 * change shows up in /dashboard, /academics, /chat… on the next request. Every write is audited.
 *
 * Auth: dev mode accepts `x-dev-role: admin` (optional `x-dev-user-id` names the staff member, default dev-admin);
 * jwt mode requires a verified token whose murshid_role is admin.
 */
import { ACTIVITY_KINDS, ASSESSMENT_KINDS, PROFILE_LINK_KEYS, enumLabel, type ActivitySession, type AssessmentResult, type ProfileLinkKey } from '@murshid/core';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authMiddleware } from '../lib/auth';
import type { Ctx } from '../lib/context';
import type { Api, RouteSpec } from '../lib/router';
import { addDays } from '../lib/time';
import { dayDiff, goalStates, type DemoTask } from '../v1/data';
import { bandForGrade, type ActivityDef, type GoalDef, type SubjectDef } from '../v1/profiles';
import { linkRestrictions, normalizeLink } from '../v1/routes';
import type { AuditEntry, CatalogOpportunity, DemoStore, DemoView } from '../v1/store';
import { buildLinkedInPack } from '../v1/linkedin';
import {
  achievements, activitySummaries, applications, opportunities, projects, studentCard, subjectSummaries, tasks,
} from '../v1/views';

// ---------- schemas (zod v4) ----------
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'expected HH:MM (24h)');
const CURRICULA = ['british', 'american', 'indian_cbse', 'ib', 'uae_moe'] as const;
const EMIRATES = ['dubai', 'abu_dhabi', 'sharjah'] as const;
const OPP_TYPES = ['competition', 'internship', 'scholarship', 'summer_program', 'volunteering', 'olympiad', 'mun', 'hackathon', 'course'] as const;
const GOAL_CATS = ['academic', 'university', 'career', 'sport', 'skill', 'personal'] as const;
const ACH_CATS = ['academic', 'award', 'sport', 'project', 'volunteering', 'work', 'certificate', 'leadership'] as const;
const APP_STATUS = ['saved', 'preparing', 'submitted', 'accepted', 'rejected'] as const;
const name = z.string().trim().min(1).max(120);
const list = z.array(z.string().trim().min(1).max(60)).max(20);

export const AdminSchemas = {
  StudentsQuery: z.object({ q: z.string().max(100).optional(), grade: z.coerce.number().int().min(1).max(13).optional(), licence: z.enum(['family', 'institution']).optional(), orgId: z.string().max(60).optional() }),
  StudentCreate: z.object({
    name, preferredName: z.string().trim().min(1).max(60), nameAr: z.string().max(120).default(''), grade: z.number().int().min(5).max(13),
    age: z.number().int().min(9).max(19), school: name, curriculum: z.enum(CURRICULA), classLabel: z.string().max(60).optional(),
    emirate: z.enum(EMIRATES), nationality: z.string().max(60).optional(), languages: list.default([]), interests: list.default([]),
  }),
  ProfilePatch: z.object({
    name, preferredName: z.string().trim().min(1).max(60), nameAr: z.string().max(120), grade: z.number().int().min(5).max(13),
    age: z.number().int().min(9).max(19), school: name, curriculum: z.enum(CURRICULA), classLabel: z.string().min(1).max(60), emirate: z.enum(EMIRATES),
    nationality: z.string().max(60), languages: list, interests: list, studyStreakDays: z.number().int().min(0).max(1000),
  }).partial().strict(),
  SubjectIn: z.object({ name, teacher: z.string().trim().min(1).max(80), target: z.number().min(1).max(100), nameAr: z.string().max(80).optional() }),
  AssessmentIn: z.object({
    subjectId: z.string().min(1).max(60), title: name, kind: z.enum(ASSESSMENT_KINDS), date: isoDate, maxScore: z.number().positive().max(1000),
    score: z.number().min(0).max(1000).nullable().default(null),
  }).refine((a) => a.score === null || a.score <= a.maxScore, { message: 'score cannot exceed maxScore', path: ['score'] }),
  ActivityIn: z.object({
    kind: z.enum(ACTIVITY_KINDS), detail: name, role: z.string().max(120).optional(), days: z.array(z.number().int().min(0).max(6)).max(7).default([]),
    minutes: z.number().int().min(5).max(600).default(60), weeklyTargetMinutes: z.number().int().min(0).max(3000).default(120),
    metrics: z.array(z.object({ key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,30}$/), label: z.string().min(1).max(60), unit: z.string().min(1).max(20), better: z.enum(['higher', 'lower']) })).max(8).default([]),
  }),
  SessionIn: z.object({
    date: isoDate, minutes: z.number().int().min(1).max(720), metrics: z.record(z.string(), z.number().finite()).default({}),
    note: z.string().max(280).nullable().default(null), type: z.enum(['training', 'match', 'race']).default('training'),
  }),
  TaskIn: z.object({
    title: name, date: isoDate, time: hhmm.default('17:00'), durationMinutes: z.number().int().min(5).max(480).default(30),
    kind: z.enum(['study', 'assignment', 'activity', 'habit', 'application']).default('assignment'), subjectId: z.string().max(60).nullable().default(null),
    notes: z.string().max(500).nullable().default(null), status: z.enum(['todo', 'done']).default('todo'),
  }),
  GoalIn: z.object({
    title: name, titleAr: z.string().max(120).default(''), category: z.enum(GOAL_CATS), unit: z.string().min(1).max(20), start: z.number(), target: z.number(),
    better: z.enum(['higher', 'lower']).default('higher'), dueDate: isoDate, current: z.number(),
  }).refine((g) => g.start !== g.target, { message: 'start and target must differ', path: ['target'] }),
  OpportunityIn: z.object({
    title: name, organizer: name, type: z.enum(OPP_TYPES), emirate: z.enum(EMIRATES).nullable().default(null), deadline: isoDate,
    minGrade: z.number().int().min(5).max(13), maxGrade: z.number().int().min(5).max(13), costAed: z.number().min(0).max(100000).default(0),
    tags: list.default([]), why: z.string().trim().min(1).max(280), url: z.string().url().max(300).optional(),
    audience: z.object({ studentIds: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]) }).default({ studentIds: 'all' }),
    status: z.enum(['draft', 'published', 'closed']).default('published'),
  }).refine((o) => o.minGrade <= o.maxGrade, { message: 'minGrade must be <= maxGrade', path: ['maxGrade'] }),
  ApplicationIn: z.object({
    title: name, organizer: name, type: z.enum(OPP_TYPES), status: z.enum(APP_STATUS), outcome: z.string().max(280).nullable().default(null),
    appliedAt: isoDate.nullable().default(null), opportunityId: z.string().max(80).nullable().default(null),
  }),
  ProjectIn: z.object({
    name, tagline: z.string().trim().min(1).max(160), kind: z.enum(['business', 'app', 'club', 'creative', 'research']), role: z.string().trim().min(1).max(60),
    startDate: isoDate, url: z.string().url().max(300).nullable().default(null), status: z.enum(['active', 'paused', 'done']).default('active'), skills: list.default([]),
  }),
  MilestoneIn: z.object({ title: name, date: isoDate, done: z.boolean().default(false) }),
  AchievementIn: z.object({ title: name, category: z.enum(ACH_CATS), date: isoDate, description: z.string().max(400).default('') }),
  CvIn: z.object({
    headline: z.string().trim().min(1).max(220), summary: z.string().max(2600), email: z.string().email().nullable(), phone: z.string().max(30).nullable(),
    location: z.string().min(1).max(80), skills: z.array(z.string().trim().min(1).max(60)).max(40),
    certifications: z.array(z.object({ name, issuer: z.string().min(1).max(120), date: z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/) })).max(20),
    featured: z.array(z.object({ title: name, url: z.string().url().nullable(), description: z.string().max(280) })).max(10),
    predicted: z.string().max(120).nullable(), universityGoal: z.string().max(160).nullable(),
  }).partial().strict(),
  LinksIn: z.object(Object.fromEntries(PROFILE_LINK_KEYS.map((k) => [k, z.string().max(300).nullable().optional()])) as Record<ProfileLinkKey, z.ZodOptional<z.ZodNullable<z.ZodString>>>).strict(),
  AuditQuery: z.object({ studentId: z.string().max(80).optional(), limit: z.coerce.number().int().min(1).max(500).default(100) }),
};

const partialOf = <T extends z.ZodObject>(s: T) => s.partial().strict();
const AssessmentPatch = z.object({ title: name, kind: z.enum(ASSESSMENT_KINDS), date: isoDate, maxScore: z.number().positive().max(1000), score: z.number().min(0).max(1000).nullable(), subjectId: z.string().min(1).max(60) }).partial().strict();
const GoalPatch = z.object({ title: name, titleAr: z.string().max(120), category: z.enum(GOAL_CATS), unit: z.string().min(1).max(20), target: z.number(), dueDate: isoDate, current: z.number() }).partial().strict();
const OppPatch = z.object({ title: name, organizer: name, type: z.enum(OPP_TYPES), deadline: isoDate, costAed: z.number().min(0), tags: list, why: z.string().min(1).max(280), status: z.enum(['draft', 'published', 'closed']), minGrade: z.number().int(), maxGrade: z.number().int(), audience: z.object({ studentIds: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]) }) }).partial().strict();

// ---------- helpers ----------
const notFound = (what: string): never => { throw new HTTPException(404, { message: `${what} not found` }); };
const bad = (msg: string): never => { throw new HTTPException(400, { message: msg }); };

export async function requireAdmin(c: Ctx): Promise<string> {
  const { config } = c.get('deps');
  if (config.authMode === 'dev' && !c.req.header('authorization')) {
    if (c.req.header('x-dev-role') !== 'admin') throw new HTTPException(c.req.header('x-dev-role') ? 403 : 401, { message: 'admin role required (dev: x-dev-role: admin)' });
    return c.req.header('x-dev-user-id') ?? 'dev-admin';
  }
  await authMiddleware(c, async () => {});
  const auth = c.get('auth');
  if (auth.role !== 'admin') throw new HTTPException(403, { message: 'admin role required' });
  return auth.userId;
}

function diff(before: Record<string, unknown>, after: Record<string, unknown>): Record<string, { from: unknown; to: unknown }> {
  const out: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(after)) if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) out[k] = { from: before[k] ?? null, to: after[k] };
  return out;
}

export function studentSummary(v: DemoView) {
  const subs = subjectSummaries(v);
  const goals = goalStates(v.profile, v.data, v.sessions);
  const week = tasks(v, 'week');
  const overdue = tasks(v, 'overdue');
  return {
    ...studentCard(v), nationality: v.profile.nationality ?? null, flagship: Boolean(v.profile.flagship), createdBy: v.record.createdBy,
    average: subs.length ? Math.round((subs.reduce((t, s) => t + s.current, 0) / subs.length) * 10) / 10 : null,
    subjects: subs.length, activities: v.profile.activities.map((a) => a.id), projects: v.record.projects.map((p) => p.name),
    goalsProgress: goals.length ? Math.round(goals.reduce((t, g) => t + g.progress, 0) / goals.length) : null,
    openTasksWeek: week.filter((t) => !t.done).length, overdue: overdue.length,
    lastSession: v.sessions[v.sessions.length - 1]?.date ?? null,
  };
}

export type LicenceLookup = (studentId: string) => { type: 'family' | 'institution'; orgId: string; orgName: string; planName: string; boughtBy: string };

export function registerAdmin(api: Api, store: DemoStore, licenceOf?: LicenceLookup) {
  const S = AdminSchemas;
  const ctx = async (c: Ctx) => {
    const actor = await requireAdmin(c);
    const now = c.get('deps').now();
    return { actor, now, today: addDays(now.toISOString().slice(0, 10), 0) };
  };
  const studentView = (c: Ctx, now: Date): DemoView => {
    const id = c.req.param('id')!;
    if (!store.has(id)) notFound(`student "${id}"`);
    return store.view(id, now);
  };
  const log = (actor: string, now: Date, studentId: string | null, action: AuditEntry['action'], resource: string, resourceId: string, summary: string, changes?: Record<string, unknown>) =>
    store.audit({ actor, actorRole: 'admin', studentId, action, resource, resourceId, summary, changes, at: now.toISOString() });
  const R = <B extends z.ZodType = z.ZodUndefined, Q extends z.ZodType = z.ZodUndefined>(spec: Omit<RouteSpec<B, Q>, 'tag' | 'auth'>): RouteSpec<B, Q> => ({ ...spec, tag: 'admin', auth: 'custom' });

  // ----- overview + students -----
  api.route(R({ method: 'get', path: '/admin/overview', summary: 'Counts for the admin home: students, published opportunities, edits today' }), async (c) => {
    const { now } = await ctx(c);
    const ids = store.ids();
    const views = ids.map((id) => store.view(id, now));
    const today = views[0]?.data.today ?? '';
    return c.json({
      students: ids.length, byGrade: Object.fromEntries([...new Set(views.map((v) => v.profile.grade))].sort((a, b) => a - b).map((g) => [g, views.filter((v) => v.profile.grade === g).length])),
      overdueTasks: views.reduce((t, v) => t + tasks(v, 'overdue').length, 0),
      upcomingAssessments7d: views.reduce((t, v) => t + v.data.assessments.filter((a) => a.status === 'upcoming' && dayDiff(today, a.date) <= 7).length, 0),
      catalog: { published: store.catalog.filter((o) => o.status === 'published').length, total: store.catalog.length },
      editsToday: store.auditLog.filter((e) => e.at.slice(0, 10) === now.toISOString().slice(0, 10)).length,
      recentAudit: store.auditLog.slice(-8).reverse(),
    });
  });

  api.route(R({ method: 'get', path: '/admin/students', query: S.StudentsQuery, summary: 'List / search students' }), async (c, { query }) => {
    const { now } = await ctx(c);
    const q = (query as z.output<typeof S.StudentsQuery>).q?.toLowerCase().trim();
    const { grade, licence, orgId } = query as z.output<typeof S.StudentsQuery>;
    const items = store.ids().map((id) => ({ ...studentSummary(store.view(id, now)), licence: licenceOf?.(id) ?? null }))
      .filter((s) => (!grade || s.grade === grade) && (!q || [s.name, s.preferredName, s.school, s.id, ...s.interests, ...s.projects].join(' ').toLowerCase().includes(q)))
      .filter((s) => (!licence || s.licence?.type === licence) && (!orgId || s.licence?.orgId === orgId));
    return c.json({ total: items.length, items });
  });

  api.route(R({ method: 'post', path: '/admin/students', body: S.StudentCreate, summary: 'Create a student' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const b = body as z.output<typeof S.StudentCreate>;
    const rec = store.createStudent({ ...b, classLabel: b.classLabel ?? (b.curriculum === 'british' ? `Year ${b.grade + 1} (Grade ${b.grade})` : `Grade ${b.grade}`) }, now);
    log(actor, now, rec.profile.id, 'create', 'student', rec.profile.id, `Created student ${b.name}`);
    return c.json(studentSummary(store.view(rec.profile.id, now)), 201);
  });

  api.route(R({ method: 'get', path: '/admin/students/:id', summary: 'Everything about one student (tabs of the detail view)' }), async (c) => {
    const { now } = await ctx(c);
    const v = studentView(c, now);
    const p = v.profile;
    const subjName = new Map(p.subjects.map((s) => [s.id, s.name]));
    const added = new Set(v.record.assessmentsAdded.map((a) => a.id));
    return c.json({
      summary: studentSummary(v),
      profile: { name: p.name, preferredName: p.preferredName, nameAr: p.nameAr, grade: p.grade, age: p.age, school: p.school, curriculum: p.curriculum, classLabel: p.classLabel, emirate: p.emirate, nationality: p.nationality ?? '', languages: p.languages, interests: p.interests, studyStreakDays: p.studyStreakDays },
      subjects: subjectSummaries(v).map((s) => ({ ...s, generated: p.subjects.find((x) => x.id === s.id)?.generate !== false })),
      assessments: [...v.data.assessments].reverse().map((a) => ({ ...a, subject: subjName.get(a.subjectId) ?? a.subjectId, kindLabel: enumLabel('assessmentKind', a.kind), source: added.has(a.id) ? 'admin' : v.record.assessmentEdits.has(a.id) ? 'edited' : 'generated' })),
      activities: activitySummaries(v, 40).map((a) => {
        const def = p.activities.find((x) => x.id === a.id)!;
        return { ...a, role: def.role ?? null, days: def.days, minutesPerSession: def.minutes, fixtures: def.fixtures ? { kind: def.fixtures.kind, everyWeeks: def.fixtures.everyWeeks } : null };
      }),
      tasks: { week: tasks(v, 'week'), overdue: tasks(v, 'overdue'), custom: [...v.record.customTasks].sort((a, b) => b.date.localeCompare(a.date)) },
      goals: goalStates(p, v.data, v.sessions).map(({ history, ...g }) => ({ ...g, sourceKind: p.goals.find((x) => x.id === g.id)?.source.kind ?? 'manual', history: history.filter((_, i) => i % 4 === 0 || i === history.length - 1) })),
      opportunities: opportunities(v, undefined, 50),
      applications: applications(v),
      projects: projects(v),
      achievements: achievements(v),
      cv: v.record.cv,
      links: { ...store.getLinks(p.id, now), restrictions: linkRestrictions(p.age) },
      linkedin: v.record.linkedin ?? null,
      audit: store.auditLog.filter((e) => e.studentId === p.id).slice(-30).reverse(),
    });
  });

  api.route(R({ method: 'patch', path: '/admin/students/:id', body: S.ProfilePatch, summary: 'Edit profile fields (name, grade, school, curriculum…)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const p = v.record.profile;
    const b = body as z.output<typeof S.ProfilePatch>;
    const before = { ...p } as unknown as Record<string, unknown>;
    Object.assign(p, b);
    if (b.grade !== undefined) p.band = bandForGrade(b.grade);
    store.touch(p.id);
    log(actor, now, p.id, 'update', 'profile', p.id, `Edited profile of ${p.name}`, diff(before, b as Record<string, unknown>));
    return c.json(studentSummary(store.view(p.id, now)));
  });

  api.route(R({ method: 'delete', path: '/admin/students/:id', summary: 'Delete a student created in the admin portal (seed students cannot be deleted)' }), async (c) => {
    const { actor, now } = await ctx(c);
    const id = c.req.param('id')!;
    if (!store.has(id)) notFound(`student "${id}"`);
    if (!store.deleteStudent(id)) bad('seed demo students cannot be deleted');
    log(actor, now, id, 'delete', 'student', id, `Deleted student ${id}`);
    return c.json({ ok: true });
  });

  // ----- subjects -----
  api.route(R({ method: 'post', path: '/admin/students/:id/subjects', body: S.SubjectIn, summary: 'Add a subject' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.SubjectIn>;
    let id = b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject';
    while (v.record.profile.subjects.some((s) => s.id === id)) id += '-2';
    const def: SubjectDef = { id, name: b.name, nameAr: b.nameAr ?? b.name, teacher: b.teacher, base: b.target - 10, slope: 0, target: b.target, every: 3, generate: false };
    v.record.profile.subjects.push(def);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'create', 'subject', id, `Added subject ${b.name}`);
    return c.json(def, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/subjects/:sid', body: partialOf(S.SubjectIn), summary: 'Edit a subject (name, teacher, target)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const s = v.record.profile.subjects.find((x) => x.id === c.req.param('sid')) ?? notFound('subject');
    const before = { ...s } as unknown as Record<string, unknown>;
    Object.assign(s, body);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'update', 'subject', s.id, `Edited subject ${s.name}`, diff(before, body as Record<string, unknown>));
    return c.json(s);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/subjects/:sid', summary: 'Remove a subject (and its assessments from the views)' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const sid = c.req.param('sid')!;
    const p = v.record.profile;
    if (!p.subjects.some((s) => s.id === sid)) notFound('subject');
    p.subjects = p.subjects.filter((s) => s.id !== sid);
    v.record.assessmentsAdded = v.record.assessmentsAdded.filter((a) => a.subjectId !== sid);
    store.touch(p.id);
    log(actor, now, p.id, 'delete', 'subject', sid, `Removed subject ${sid}`);
    return c.json({ ok: true });
  });

  // ----- assessments -----
  api.route(R({ method: 'post', path: '/admin/students/:id/assessments', body: S.AssessmentIn, summary: 'Add an assessment (score null = upcoming)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.AssessmentIn>;
    if (!v.profile.subjects.some((s) => s.id === b.subjectId)) bad(`unknown subject "${b.subjectId}"`);
    if (b.score !== null && b.date > v.data.today) bad('a future assessment cannot have a score yet');
    const a: AssessmentResult = { id: store.nextId(`${v.profile.id}-${b.subjectId}-adm`), subjectId: b.subjectId, title: b.title, kind: b.kind, date: b.date, maxScore: b.maxScore, score: b.score, percent: b.score === null ? null : Math.round((b.score / b.maxScore) * 100), status: b.score === null ? 'upcoming' : 'graded' };
    v.record.assessmentsAdded.push(a);
    log(actor, now, v.profile.id, 'create', 'assessment', a.id, `Added ${a.status} assessment "${a.title}" on ${a.date}`);
    return c.json(a, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/assessments/:aid', body: AssessmentPatch, summary: 'Edit an assessment (e.g. enter a grade)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const aid = c.req.param('aid')!;
    const cur = v.data.assessments.find((a) => a.id === aid) ?? notFound('assessment');
    const next = { ...cur, ...(body as object) } as AssessmentResult;
    if (next.score !== null && next.score > next.maxScore) bad('score cannot exceed maxScore');
    next.percent = next.score === null ? null : Math.round((next.score / next.maxScore) * 100);
    next.status = next.score === null ? 'upcoming' : 'graded';
    v.record.assessmentEdits.set(aid, next);
    log(actor, now, v.profile.id, 'update', 'assessment', aid, `Edited assessment "${next.title}"`, diff(cur as unknown as Record<string, unknown>, body as Record<string, unknown>));
    return c.json(next);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/assessments/:aid', summary: 'Delete an assessment' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const aid = c.req.param('aid')!;
    const cur = v.data.assessments.find((a) => a.id === aid) ?? notFound('assessment');
    v.record.assessmentEdits.set(aid, null);
    log(actor, now, v.profile.id, 'delete', 'assessment', aid, `Deleted assessment "${cur.title}"`);
    return c.json({ ok: true });
  });

  // ----- activities + sessions -----
  api.route(R({ method: 'post', path: '/admin/students/:id/activities', body: S.ActivityIn, summary: 'Add a sport / activity' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.ActivityIn>;
    if (v.record.profile.activities.some((a) => a.id === b.kind)) bad(`${b.kind} is already one of this student's activities`);
    const def: ActivityDef = { id: b.kind, days: b.days, minutes: b.minutes, weeklyTargetMinutes: b.weeklyTargetMinutes, detail: b.detail, detailAr: b.detail, role: b.role, generate: false, metrics: b.metrics.map((m) => ({ ...m, start: 0, end: 0, decimals: 2 })) };
    v.record.profile.activities.push(def);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'create', 'activity', b.kind, `Added activity ${b.kind} (${b.detail})`);
    return c.json(def, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/activities/:aid', body: z.object({ detail: name, role: z.string().max(120), days: z.array(z.number().int().min(0).max(6)).max(7), minutes: z.number().int().min(5).max(600), weeklyTargetMinutes: z.number().int().min(0).max(3000) }).partial().strict(), summary: 'Edit an activity (detail, role, days, targets)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const a = v.record.profile.activities.find((x) => x.id === c.req.param('aid')) ?? notFound('activity');
    const before = { ...a } as unknown as Record<string, unknown>;
    Object.assign(a, body);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'update', 'activity', a.id, `Edited activity ${a.id}`, diff(before, body as Record<string, unknown>));
    return c.json(a);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/activities/:aid', summary: 'Remove an activity' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const aid = c.req.param('aid')!;
    const p = v.record.profile;
    if (!p.activities.some((a) => a.id === aid)) notFound('activity');
    p.activities = p.activities.filter((a) => a.id !== aid);
    p.goals = p.goals.filter((g) => !('activity' in g.source) || g.source.activity !== aid);
    store.touch(p.id);
    log(actor, now, p.id, 'delete', 'activity', aid, `Removed activity ${aid}`);
    return c.json({ ok: true });
  });
  api.route(R({ method: 'post', path: '/admin/students/:id/activities/:aid/sessions', body: S.SessionIn, summary: 'Log a session (training, match or race)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const aid = c.req.param('aid')!;
    const def = v.profile.activities.find((a) => a.id === aid) ?? notFound('activity');
    const b = body as z.output<typeof S.SessionIn>;
    if (b.date > v.data.today) bad('date cannot be in the future');
    const unknown = Object.keys(b.metrics).filter((k) => !def.metrics.some((m) => m.key === k));
    if (unknown.length) throw new HTTPException(400, { message: `unknown metric(s): ${unknown.join(', ')}`, cause: { allowed: def.metrics.map((m) => m.key) } });
    const s = store.logSession(v.profile.id, { activityId: aid, date: b.date, minutes: b.minutes, metrics: b.metrics, note: b.note, ...(b.type !== 'training' ? { type: b.type } : {}) }, now);
    log(actor, now, v.profile.id, 'create', 'session', s.id, `Logged ${b.type} session for ${aid} on ${b.date} (${b.minutes} min)`);
    return c.json(s, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/sessions/:sid', body: z.object({ date: isoDate, minutes: z.number().int().min(1).max(720), metrics: z.record(z.string(), z.number().finite()), note: z.string().max(280).nullable() }).partial().strict(), summary: 'Edit a logged or generated session' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const sid = c.req.param('sid')!;
    const cur = v.sessions.find((s) => s.id === sid) ?? notFound('session');
    const next: ActivitySession = { ...cur, ...(body as object) };
    v.record.sessionEdits.set(sid, next);
    log(actor, now, v.profile.id, 'update', 'session', sid, `Edited ${cur.activityId} session on ${cur.date}`, diff(cur as unknown as Record<string, unknown>, body as Record<string, unknown>));
    return c.json(next);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/sessions/:sid', summary: 'Delete a session' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const sid = c.req.param('sid')!;
    const cur = v.sessions.find((s) => s.id === sid) ?? notFound('session');
    v.record.sessionEdits.set(sid, null);
    log(actor, now, v.profile.id, 'delete', 'session', sid, `Deleted ${cur.activityId} session on ${cur.date}`);
    return c.json({ ok: true });
  });

  // ----- tasks -----
  api.route(R({ method: 'post', path: '/admin/students/:id/tasks', body: S.TaskIn, summary: 'Add a task / deadline' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.TaskIn>;
    if (b.subjectId && !v.profile.subjects.some((s) => s.id === b.subjectId)) bad(`unknown subject "${b.subjectId}"`);
    const t: DemoTask = { id: store.nextId('task-a'), title: b.title, kind: b.kind, date: b.date, time: b.time, durationMinutes: b.durationMinutes, status: b.status, overdue: false, subjectId: b.subjectId, area: b.subjectId, source: 'admin', notes: b.notes };
    v.record.customTasks.push(t);
    log(actor, now, v.profile.id, 'create', 'task', t.id, `Added task "${t.title}" due ${t.date} ${t.time}`);
    return c.json(t, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/tasks/:tid', body: z.object({ title: name, date: isoDate, time: hhmm, durationMinutes: z.number().int().min(5).max(480), status: z.enum(['todo', 'done']), notes: z.string().max(500).nullable() }).partial().strict(), summary: 'Edit a task (generated tasks: status only)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const tid = c.req.param('tid')!;
    const b = body as Record<string, unknown>;
    const custom = v.record.customTasks.find((t) => t.id === tid);
    if (custom) {
      const before = { ...custom } as unknown as Record<string, unknown>;
      Object.assign(custom, b);
      log(actor, now, v.profile.id, 'update', 'task', tid, `Edited task "${custom.title}"`, diff(before, b));
      return c.json(custom);
    }
    if (Object.keys(b).some((k) => k !== 'status')) bad('generated tasks can only change status; delete and re-create to change details');
    if (!b.status) bad('status is required');
    v.record.taskStatus[tid] = b.status as 'todo' | 'done';
    log(actor, now, v.profile.id, 'update', 'task', tid, `Marked task ${tid} ${String(b.status)}`);
    return c.json({ id: tid, status: b.status });
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/tasks/:tid', summary: 'Delete a task (generated tasks are hidden)' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const tid = c.req.param('tid')!;
    const before = v.record.customTasks.length;
    v.record.customTasks = v.record.customTasks.filter((t) => t.id !== tid);
    if (v.record.customTasks.length === before) v.record.hiddenTasks.push(tid);
    log(actor, now, v.profile.id, 'delete', 'task', tid, `Deleted task ${tid}`);
    return c.json({ ok: true });
  });

  // ----- goals -----
  api.route(R({ method: 'post', path: '/admin/students/:id/goals', body: S.GoalIn, summary: 'Add a goal' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.GoalIn>;
    const g: GoalDef = { id: store.nextId('goal-a'), title: b.title, titleAr: b.titleAr || b.title, category: b.category, unit: b.unit, start: b.start, target: b.target, better: b.better, dueInDays: dayDiff(v.data.today, b.dueDate), source: { kind: 'manual', current: b.current } };
    v.record.profile.goals.push(g);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'create', 'goal', g.id, `Added goal "${g.title}"`);
    return c.json(goalStates(store.view(v.profile.id, now).profile, store.view(v.profile.id, now).data, v.sessions).find((x) => x.id === g.id), 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/goals/:gid', body: GoalPatch, summary: 'Edit a goal (current value only for manual goals)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const g = v.record.profile.goals.find((x) => x.id === c.req.param('gid')) ?? notFound('goal');
    const b = body as z.output<typeof GoalPatch>;
    const before = { ...g } as unknown as Record<string, unknown>;
    if (b.current !== undefined) {
      if (g.source.kind !== 'manual') bad('this goal is measured from data; only manual goals take a current value');
      g.source = { kind: 'manual', current: b.current };
    }
    if (b.dueDate) g.dueInDays = dayDiff(v.data.today, b.dueDate);
    const { current: _c, dueDate: _d, ...rest } = b;
    Object.assign(g, rest);
    store.touch(v.profile.id);
    log(actor, now, v.profile.id, 'update', 'goal', g.id, `Edited goal "${g.title}"`, diff(before, b as Record<string, unknown>));
    const nv = store.view(v.profile.id, now);
    return c.json(goalStates(nv.profile, nv.data, nv.sessions).find((x) => x.id === g.id));
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/goals/:gid', summary: 'Delete a goal' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const gid = c.req.param('gid')!;
    const p = v.record.profile;
    if (!p.goals.some((g) => g.id === gid)) notFound('goal');
    p.goals = p.goals.filter((g) => g.id !== gid);
    store.touch(p.id);
    log(actor, now, p.id, 'delete', 'goal', gid, `Deleted goal ${gid}`);
    return c.json({ ok: true });
  });

  // ----- opportunities (catalog + per-student) -----
  api.route(R({ method: 'get', path: '/admin/opportunities', summary: 'Opportunity catalog (published by staff) and how many students each reaches' }), async (c) => {
    const { now } = await ctx(c);
    const views = store.ids().map((id) => store.view(id, now));
    return c.json({ items: store.catalog.map((o) => ({ ...o, reach: views.filter((v) => store.catalogFor(v.record.profile).some((x) => x.id === o.id)).map((v) => v.profile.id) })) });
  });
  api.route(R({ method: 'post', path: '/admin/opportunities', body: S.OpportunityIn, summary: 'Create an opportunity and publish it to students (all in a grade range, or listed students)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const b = body as z.output<typeof S.OpportunityIn>;
    if (Array.isArray(b.audience.studentIds)) for (const id of b.audience.studentIds) if (!store.has(id)) bad(`unknown student "${id}"`);
    const o: CatalogOpportunity = {
      id: store.nextId('opp-adm'), title: b.title, organizer: b.organizer, type: b.type, emirate: b.emirate, deadline: b.deadline, deadlineInDays: 0,
      minGrade: b.minGrade, maxGrade: b.maxGrade, costAed: b.costAed, tags: b.tags, why: b.why, url: b.url, source: 'admin', publishedAt: now.toISOString(),
      audience: { studentIds: b.audience.studentIds, minGrade: b.minGrade, maxGrade: b.maxGrade }, status: b.status, createdAt: now.toISOString(),
    };
    store.catalog.push(o);
    log(actor, now, null, b.status === 'published' ? 'publish' : 'create', 'opportunity', o.id, `${b.status === 'published' ? 'Published' : 'Drafted'} opportunity "${o.title}" to ${b.audience.studentIds === 'all' ? `grades ${b.minGrade}-${b.maxGrade}` : b.audience.studentIds.join(', ')}`);
    return c.json(o, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/opportunities/:oid', body: OppPatch, summary: 'Edit / close an opportunity' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const o = store.catalog.find((x) => x.id === c.req.param('oid')) ?? notFound('opportunity');
    const before = { ...o } as unknown as Record<string, unknown>;
    const b = body as z.output<typeof OppPatch>;
    Object.assign(o, b);
    if (b.audience) o.audience = { ...o.audience, studentIds: b.audience.studentIds };
    if (b.minGrade !== undefined) o.audience.minGrade = b.minGrade;
    if (b.maxGrade !== undefined) o.audience.maxGrade = b.maxGrade;
    log(actor, now, null, 'update', 'opportunity', o.id, `Edited opportunity "${o.title}"`, diff(before, b as Record<string, unknown>));
    return c.json(o);
  });
  api.route(R({ method: 'delete', path: '/admin/opportunities/:oid', summary: 'Delete an opportunity from the catalog' }), async (c) => {
    const { actor, now } = await ctx(c);
    const i = store.catalog.findIndex((x) => x.id === c.req.param('oid'));
    if (i < 0) notFound('opportunity');
    const [o] = store.catalog.splice(i, 1);
    log(actor, now, null, 'delete', 'opportunity', o!.id, `Deleted opportunity "${o!.title}"`);
    return c.json({ ok: true });
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/opportunities/:oid', summary: "Remove a student-specific (seeded) opportunity from a student's feed" }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const oid = c.req.param('oid')!;
    const p = v.record.profile;
    if (!p.opportunities.some((o) => o.id === oid)) notFound('student opportunity');
    p.opportunities = p.opportunities.filter((o) => o.id !== oid);
    log(actor, now, p.id, 'delete', 'opportunity', oid, `Removed ${oid} from ${p.name}'s feed`);
    return c.json({ ok: true });
  });

  // ----- applications -----
  api.route(R({ method: 'post', path: '/admin/students/:id/applications', body: S.ApplicationIn, summary: 'Record an application' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.ApplicationIn>;
    const app = { id: store.nextId('app-a'), ...b, updatedAt: v.data.today, source: 'admin' as const };
    v.record.applications.push(app);
    log(actor, now, v.profile.id, 'create', 'application', app.id, `Recorded application "${b.title}" (${b.status})`);
    return c.json(app, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/applications/:appId', body: z.object({ status: z.enum(APP_STATUS), outcome: z.string().max(280).nullable(), appliedAt: isoDate.nullable() }).partial().strict(), summary: 'Update an application (status / outcome)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const app = v.record.applications.find((a) => a.id === c.req.param('appId')) ?? notFound('application');
    const before = { ...app } as unknown as Record<string, unknown>;
    Object.assign(app, body, { updatedAt: v.data.today });
    log(actor, now, v.profile.id, 'update', 'application', app.id, `Updated application "${app.title}" → ${app.status}`, diff(before, body as Record<string, unknown>));
    return c.json(app);
  });

  // ----- side projects + milestones -----
  api.route(R({ method: 'post', path: '/admin/students/:id/projects', body: S.ProjectIn, summary: 'Add a side project' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const b = body as z.output<typeof S.ProjectIn>;
    const proj = { id: store.nextId('proj'), ...b, milestones: [] };
    v.record.projects.push(proj);
    log(actor, now, v.profile.id, 'create', 'project', proj.id, `Added side project ${b.name}`);
    return c.json(proj, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/projects/:pid', body: partialOf(S.ProjectIn), summary: 'Edit a side project' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const proj = v.record.projects.find((x) => x.id === c.req.param('pid')) ?? notFound('project');
    const before = { ...proj } as unknown as Record<string, unknown>;
    Object.assign(proj, body);
    log(actor, now, v.profile.id, 'update', 'project', proj.id, `Edited side project ${proj.name}`, diff(before, body as Record<string, unknown>));
    return c.json(proj);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/projects/:pid', summary: 'Delete a side project' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const pid = c.req.param('pid')!;
    if (!v.record.projects.some((p) => p.id === pid)) notFound('project');
    v.record.projects = v.record.projects.filter((p) => p.id !== pid);
    log(actor, now, v.profile.id, 'delete', 'project', pid, `Deleted side project ${pid}`);
    return c.json({ ok: true });
  });
  api.route(R({ method: 'post', path: '/admin/students/:id/projects/:pid/milestones', body: S.MilestoneIn, summary: 'Add a milestone' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const proj = v.record.projects.find((x) => x.id === c.req.param('pid')) ?? notFound('project');
    const ms = { id: store.nextId(`${proj.id}-m`), ...(body as z.output<typeof S.MilestoneIn>), source: 'admin' as const };
    proj.milestones.push(ms);
    log(actor, now, v.profile.id, 'create', 'milestone', ms.id, `Added milestone "${ms.title}" to ${proj.name}`);
    return c.json(ms, 201);
  });
  api.route(R({ method: 'patch', path: '/admin/students/:id/projects/:pid/milestones/:mid', body: partialOf(z.object({ title: name, date: isoDate, done: z.boolean() })), summary: 'Edit / complete a milestone' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const proj = v.record.projects.find((x) => x.id === c.req.param('pid')) ?? notFound('project');
    const ms = proj.milestones.find((m) => m.id === c.req.param('mid')) ?? notFound('milestone');
    const before = { ...ms } as unknown as Record<string, unknown>;
    Object.assign(ms, body);
    log(actor, now, v.profile.id, 'update', 'milestone', ms.id, `Edited milestone "${ms.title}"`, diff(before, body as Record<string, unknown>));
    return c.json(ms);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/projects/:pid/milestones/:mid', summary: 'Delete a milestone' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const proj = v.record.projects.find((x) => x.id === c.req.param('pid')) ?? notFound('project');
    const mid = c.req.param('mid')!;
    if (!proj.milestones.some((m) => m.id === mid)) notFound('milestone');
    proj.milestones = proj.milestones.filter((m) => m.id !== mid);
    log(actor, now, v.profile.id, 'delete', 'milestone', mid, `Deleted milestone ${mid}`);
    return c.json({ ok: true });
  });

  // ----- achievements -----
  api.route(R({ method: 'post', path: '/admin/students/:id/achievements', body: S.AchievementIn, summary: 'Add an achievement' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const a = { id: store.nextId('ach'), ...(body as z.output<typeof S.AchievementIn>), source: 'admin' as const };
    v.record.achievements.push(a);
    log(actor, now, v.profile.id, 'create', 'achievement', a.id, `Added achievement "${a.title}"`);
    return c.json(a, 201);
  });
  api.route(R({ method: 'delete', path: '/admin/students/:id/achievements/:achId', summary: 'Delete an achievement' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const id = c.req.param('achId')!;
    if (!v.record.achievements.some((a) => a.id === id)) notFound('achievement');
    v.record.achievements = v.record.achievements.filter((a) => a.id !== id);
    log(actor, now, v.profile.id, 'delete', 'achievement', id, `Deleted achievement ${id}`);
    return c.json({ ok: true });
  });

  // ----- CV fields, links, LinkedIn pack -----
  api.route(R({ method: 'put', path: '/admin/students/:id/cv', body: S.CvIn, summary: 'Edit CV fields (headline, summary, skills, certifications, featured…)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const before = { ...v.record.cv } as unknown as Record<string, unknown>;
    Object.assign(v.record.cv, body);
    v.record.linkedin = undefined; // stale: regenerate from the new fields
    log(actor, now, v.profile.id, 'update', 'cv', v.profile.id, 'Edited CV fields', diff(before, body as Record<string, unknown>));
    return c.json(v.record.cv);
  });
  api.route(R({ method: 'put', path: '/admin/students/:id/links', body: S.LinksIn, summary: 'Edit social / portfolio links (same validation and age rules as the student)' }), async (c, { body }) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    const cur = store.getLinks(v.profile.id, now);
    const at = now.toISOString();
    const b = body as Record<ProfileLinkKey, string | null | undefined>;
    for (const key of PROFILE_LINK_KEYS) {
      if (!(key in b)) continue;
      const raw = b[key];
      const next = raw === null || raw === undefined || raw.trim() === '' ? null : normalizeLink(key, raw, v.profile.age);
      if (next !== cur[key]) cur.connectedAt[key] = next ? at : null;
      cur[key] = next;
    }
    cur.updatedAt = at;
    store.setLinks(v.profile.id, cur, now);
    log(actor, now, v.profile.id, 'update', 'links', v.profile.id, `Edited links: ${Object.keys(b).join(', ')}`);
    return c.json({ ...cur, restrictions: linkRestrictions(v.profile.age) });
  });
  api.route(R({ method: 'post', path: '/admin/students/:id/linkedin', successStatus: 200, summary: 'Regenerate the LinkedIn pack from current data' }), async (c) => {
    const { actor, now } = await ctx(c);
    const v = studentView(c, now);
    v.record.linkedin = buildLinkedInPack(v);
    log(actor, now, v.profile.id, 'create', 'linkedin_pack', v.profile.id, 'Regenerated the LinkedIn pack');
    return c.json({ ...v.record.linkedin, pdfUrl: '/student/cv/linkedin.pdf' });
  });

  // ----- audit -----
  api.route(R({ method: 'get', path: '/admin/audit', query: S.AuditQuery, summary: 'Audit log of admin edits and Murshid (agent) writes, newest first' }), async (c, { query }) => {
    await ctx(c);
    const q = query as z.output<typeof S.AuditQuery>;
    const items = store.auditLog.filter((e) => !q.studentId || e.studentId === q.studentId).slice(-q.limit).reverse();
    return c.json({ total: items.length, items });
  });
}
