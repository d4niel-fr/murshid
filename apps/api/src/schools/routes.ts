/**
 * Murshid for Schools + licensing API.
 *
 *   public     GET  /plans, POST /onboarding, GET /auth/microsoft/authorize, GET /auth/microsoft/accounts,
 *              POST /auth/microsoft/callback
 *   teacher    GET  /teacher/me, /teacher/students, /teacher/classes/:id/{report,recommendations,homework-timing,weekly-reports,assignments,students/:studentId}
 *              POST /teacher/classes/:id/assignments  (lands in every linked student's Murshid app)
 *   school     GET  /orgs/:id, /orgs/:id/students; POST /orgs/:id/microsoft/connect | disconnect
 *   platform   GET  /licensing/overview (families vs institutions, kept apart)
 *   student    GET  /student/school, /student/weekly-report
 *
 * Dev auth: teachers send `x-dev-role: teacher` + `x-dev-user-id: t-thomas`; school admins `x-dev-role: admin`
 * (+ optional `x-dev-school-id`, default the demo school tenant for the proposed pilot). Teachers only ever see classes they teach, in
 * their own school; school admins only their own school.
 */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { authMiddleware } from '../lib/auth';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { dubaiDate } from '../lib/time';
import type { DemoStore, DemoView } from '../v1/store';
import { DEMO_SCHOOL, PLANS, SUBJECT_NAMES, type Stream, type Teacher } from './catalog';
import { assignedTo, classReport, delegation, homeworkTiming, shortDay, streamItems, studentWork, submission, weeklyReport, weeklyRollup, type WorkItem } from './engine';
import type { SchoolStore } from './store';
import { replanForPost } from './automation';
import { refOf } from './classroom';
import { registerClassroom } from './classroom-routes';
import { registerSetup } from './setup';
import { studentInsight, teacherStudents } from './insights';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD')
  .refine((d) => { const t = new Date(`${d}T00:00:00Z`); return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d; }, 'not a real date');
export const SchoolSchemas = {
  Onboarding: z.union([
    z.object({ path: z.literal('parent'), parentName: z.string().trim().min(1).max(80), email: z.string().email(), childName: z.string().trim().min(1).max(80), childGrade: z.number().int().min(5).max(12), plan: z.enum(['single', 'family-plus', 'family-pro']).default('single').transform(() => 'single' as const) }),
    z.object({ path: z.literal('student'), name: z.string().trim().min(1).max(80), email: z.string().email(), grade: z.number().int().min(5).max(12), plan: z.enum(['single', 'family-plus', 'family-pro']).default('single').transform(() => 'single' as const) }),
    z.object({ path: z.literal('school'), via: z.literal('microsoft'), code: z.string().min(4).max(120) }),
    z.object({ path: z.literal('school'), via: z.literal('join_code'), joinCode: z.string().trim().min(3).max(20), name: z.string().trim().min(1).max(80), email: z.string().email(), grade: z.number().int().min(5).max(12) }),
  ]),
  MsAuthorize: z.object({ org: z.string().max(60).default(DEMO_SCHOOL), role: z.enum(['teacher', 'student', 'school_admin']).default('teacher'), adminConsent: z.enum(['true', 'false']).optional() }),
  MsAccounts: z.object({ org: z.string().max(60).default(DEMO_SCHOOL), role: z.enum(['teacher', 'student', 'school_admin']).optional() }),
  MsCallback: z.object({ code: z.string().min(4).max(120), state: z.string().max(120).optional() }),
  Timing: z.object({ minutes: z.coerce.number().int().min(10).max(240).optional() }),
  Weekly: z.object({ week: z.enum(['current', 'last']).default('current') }),
  Post: z.object({
    title: z.string().trim().min(3).max(140), instructions: z.string().max(1000).nullable().default(null),
    setDate: isoDate.optional(), dueDate: isoDate, dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('08:00'),
    minutes: z.number().int().min(10).max(240).optional(),
    format: z.enum(['task', 'form', 'google_form', 'microsoft_form']).default('task'),
    formUrl: z.string().trim().url().max(500).nullable().optional(),
    questions: z.array(z.object({
      id: z.string().regex(/^[a-z0-9_-]{1,24}$/i), type: z.enum(['short', 'long', 'choice']), prompt: z.string().trim().min(2).max(300),
      options: z.array(z.string().trim().min(1).max(120)).min(2).max(6).optional(), required: z.boolean().default(true),
    })).max(20).optional(),
    /** personalised: set it for these students only (they must be in the class); omit for the whole class */
    studentIds: z.array(z.string().min(1).max(80)).min(1).max(200).optional(),
    /** files uploaded with POST /files by this teacher (slides, PDFs, worksheets, images) */
    attachmentIds: z.array(z.string().min(8).max(64)).max(10).optional(),
    links: z.array(z.object({ url: z.string().trim().url().max(500).refine((u) => /^https?:\/\//.test(u), 'links must start with http(s)://'), label: z.string().trim().max(80).default('') })).max(10).optional(),
    photosRequired: z.boolean().default(false),
    rubric: z.array(z.object({ label: z.string().trim().min(2).max(80), points: z.number().int().min(1).max(100) })).max(8).optional(),
  }).superRefine((b, ctx) => {
    const url = b.formUrl ?? '';
    if (b.format === 'google_form' && !FORM_HOSTS.google.test(url)) ctx.addIssue({ code: 'custom', path: ['formUrl'], message: 'Paste a Google Forms link (docs.google.com/forms/… or forms.gle/…)' });
    if (b.format === 'microsoft_form' && !FORM_HOSTS.microsoft.test(url)) ctx.addIssue({ code: 'custom', path: ['formUrl'], message: 'Paste a Microsoft Forms link (forms.office.com/… or forms.microsoft.com/…)' });
    if (b.format === 'form') {
      if (!b.questions?.length) ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Add at least one question' });
      b.questions?.forEach((q, i) => { if (q.type === 'choice' && !q.options) ctx.addIssue({ code: 'custom', path: ['questions', i, 'options'], message: 'A choice question needs 2 to 6 options' }); });
      if (new Set(b.questions?.map((q) => q.id)).size !== (b.questions?.length ?? 0)) ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Question ids must be unique' });
    }
  }),
  Respond: z.object({ answers: z.record(z.string().regex(/^[a-z0-9_-]{1,24}$/i), z.string().max(4000)) }),
};

/** Only real form hosts are accepted for linked forms. */
export const FORM_HOSTS = {
  google: /^https:\/\/(docs\.google\.com\/forms\/|forms\.gle\/)/,
  microsoft: /^https:\/\/(forms\.office\.com\/|forms\.microsoft\.com\/|forms\.cloud\.microsoft\/)/,
};

export type Staff = { role: 'teacher'; teacher: Teacher; orgId: string; actor: string } | { role: 'school_admin'; orgId: string; actor: string };

const nowMinutes = (d: Date) => Math.floor(((d.getTime() + 4 * 3_600_000) % 86_400_000) / 60_000);

export function registerSchools(api: Api, schools: SchoolStore, store: DemoStore, view: (c: Ctx) => Promise<DemoView>) {
  async function staff(c: Ctx): Promise<Staff> {
    const { config } = c.get('deps');
    let role: string | undefined; let userId: string | undefined; let orgId: string | undefined;
    if (config.authMode === 'dev' && !c.req.header('authorization')) {
      role = c.req.header('x-dev-role'); userId = c.req.header('x-dev-user-id'); orgId = c.req.header('x-dev-school-id');
      if (!role) throw new HTTPException(401, { message: 'teacher or school admin required (dev: x-dev-role: teacher + x-dev-user-id)' });
    } else if (c.get('deps').whoami) {
      const me = await c.get('deps').whoami!(c);
      if (me.role === 'teacher') { role = 'teacher'; userId = me.teacherId ?? undefined; }
      else if (me.role === 'school_admin') { role = 'school_admin'; userId = me.accountId ?? me.authUserId; orgId = me.orgId ?? undefined; }
      else throw new HTTPException(403, { message: 'the school portal is for teachers and school staff', cause: { code: me.role ? 'not_staff' : 'needs_setup' } });
    } else {
      await authMiddleware(c, async () => {});
      const a = c.get('auth');
      role = a.role === 'counsellor' ? 'teacher' : a.role; userId = a.userId; orgId = a.schoolId ?? undefined;
    }
    if (role === 'teacher') {
      const t = schools.teachers.find((x) => x.id === userId && x.portal);
      if (!t) throw new HTTPException(403, { message: 'unknown teacher' });
      return { role: 'teacher', teacher: t, orgId: t.orgId, actor: t.id };
    }
    if (role === 'admin' || role === 'school_admin') {
      const id = orgId ?? DEMO_SCHOOL;
      if (schools.org(id)?.licence?.type !== 'institution') throw new HTTPException(403, { message: 'not a licensed school' });
      return { role: 'school_admin', orgId: id, actor: userId ?? 'dev-admin' };
    }
    throw new HTTPException(403, { message: 'teacher or school admin role required' });
  }

  const classOf = (s: Staff, id: string): Stream => {
    const st = schools.streams.find((x) => x.id === id);
    if (!st || st.orgId !== s.orgId) throw new HTTPException(404, { message: 'class not found' });
    if (s.role === 'teacher' && st.teacherId !== s.teacher.id) throw new HTTPException(403, { message: 'not your class' });
    return st;
  };
  const today = (c: Ctx) => dubaiDate(c.get('deps').now());
  const classCard = (st: Stream) => {
    const t = schools.teachers.find((x) => x.id === st.teacherId)!;
    return { id: st.id, name: st.name, subject: st.subject, subjectName: SUBJECT_NAMES[st.subject], teacher: { id: t.id, name: t.name }, students: schools.members[st.id]?.length ?? 0, setDays: st.setDays, minutes: st.minutes, teamsClassId: schools.org(st.orgId)?.microsoft?.connected ? st.teamsClassId : null };
  };
  const orgCard = (orgId: string) => {
    const o = schools.org(orgId)!;
    const parent = o.parentOrgId ? schools.org(o.parentOrgId) : null;
    const appStudents = Object.entries(schools.tenant).filter(([, org]) => org === orgId).map(([id]) => id);
    return {
      id: o.id, name: o.name, shortName: o.shortName, kind: o.kind, group: parent ? { id: parent.id, name: parent.name } : null, emirate: o.emirate,
      licence: o.licence, joinCode: o.joinCode,
      usage: { rosterStudents: schools.roster.filter((r) => r.orgId === orgId).length, appStudents: appStudents.length, teachers: schools.teachers.filter((t) => t.orgId === orgId).length, seats: o.licence?.seats ?? null },
      microsoft: o.microsoft ? { ...o.microsoft, connector: schools.microsoft.label, simulated: schools.microsoft.simulated } : null,
    };
  };

  // ---------- public: plans, onboarding, Microsoft sign-in ----------
  api.route({ method: 'get', path: '/plans', tag: 'schools', auth: 'none', summary: 'Plans: families (parent or student buys) vs schools (licence per student per year, featured)' },
    (c) => c.json({ currency: 'AED', families: PLANS.filter((p) => p.audience === 'families'), schools: PLANS.filter((p) => p.audience === 'schools'), featured: 'school' }));

  api.route({ method: 'post', path: '/onboarding', tag: 'schools', auth: 'none', body: SchoolSchemas.Onboarding, summary: 'Get Murshid: "I\'m a parent" | "I\'m a student" | "My school provides Murshid"' },
    async (c, { body }) => {
      const now = c.get('deps').now();
      const day = dubaiDate(now);
      const b = body as z.output<typeof SchoolSchemas.Onboarding>;
      const mkStudent = (name: string, grade: number, school: string) => store.createStudent({
        name, preferredName: name.split(' ')[0]!, nameAr: '', grade, age: grade + 5, school, curriculum: 'british', classLabel: `Grade ${grade}`, emirate: 'dubai', languages: [], interests: [],
      }, now).profile;
      if (b.path === 'parent' || b.path === 'student') {
        const familyName = b.path === 'parent' ? `${b.parentName.split(' ').slice(-1)[0]} family` : `${b.name} (self)`;
        const org = schools.createFamily(familyName, b.path, b.plan, day);
        const child = mkStudent(b.path === 'parent' ? b.childName : b.name, b.path === 'parent' ? b.childGrade : b.grade, 'Not linked to a school');
        schools.tenant[child.id] = org.id;
        const account = schools.addAccount({ orgId: org.id, role: b.path, name: b.path === 'parent' ? b.parentName : b.name, email: b.email, studentIds: [child.id], via: 'email', createdAt: day });
        return c.json({ path: b.path, account, org: orgCard(org.id), student: { id: child.id, name: child.name }, licence: schools.licenceOf(child.id), demo: true }, 201);
      }
      if (b.via === 'microsoft') {
        const who = schools.microsoft.exchangeCode(b.code);
        if (!who) throw new HTTPException(400, { message: 'Microsoft sign-in failed (unknown code)' });
        if (who.role !== 'student' || !who.appId) throw new HTTPException(400, { message: 'this Microsoft account is not a student account at a Murshid school' });
        return c.json({ path: 'school', via: 'microsoft', account: { id: who.id, name: who.name, email: who.email, role: 'student', orgId: who.orgId }, org: orgCard(who.orgId), student: { id: who.appId, name: who.name }, licence: schools.licenceOf(who.appId), demo: true }, 201);
      }
      const org = schools.orgs.find((o) => o.joinCode && o.joinCode.toLowerCase() === b.joinCode.toLowerCase());
      if (!org) throw new HTTPException(400, { message: 'school code not recognised' });
      const st = mkStudent(b.name, b.grade, org.name);
      schools.tenant[st.id] = org.id;
      const account = schools.addAccount({ orgId: org.id, role: 'student', name: b.name, email: b.email, studentIds: [st.id], via: 'join_code', createdAt: day });
      return c.json({ path: 'school', via: 'join_code', account, org: orgCard(org.id), student: { id: st.id, name: st.name }, licence: schools.licenceOf(st.id), demo: true }, 201);
    });

  api.route({ method: 'get', path: '/auth/microsoft/authorize', tag: 'schools', auth: 'none', query: SchoolSchemas.MsAuthorize, summary: 'Start "Sign in with Microsoft" (simulated Entra ID for the demo)' },
    (c, { query }) => {
      const q = query as z.output<typeof SchoolSchemas.MsAuthorize>;
      const state = schools.nextId('ms-state');
      return c.json({ url: schools.microsoft.authorizeUrl({ orgId: q.org, role: q.role, state, adminConsent: q.adminConsent === 'true' }), state, connector: schools.microsoft.id, simulated: schools.microsoft.simulated });
    });

  api.route({ method: 'get', path: '/auth/microsoft/accounts', tag: 'schools', auth: 'none', query: SchoolSchemas.MsAccounts, summary: 'Accounts on the simulated Microsoft sign-in page (demo only)' },
    (c, { query }) => {
      const q = query as z.output<typeof SchoolSchemas.MsAccounts>;
      const org = schools.org(q.org);
      return c.json({ org: org ? { id: org.id, name: org.name, domain: org.microsoft?.domain ?? null } : null, simulated: true,
        items: schools.microsoft.accounts(q.org).filter((a) => !q.role || a.role === q.role).map((a) => ({ id: a.id, name: a.name, email: a.email, role: a.role, code: `sim:${a.id}` })) });
    });

  api.route({ method: 'post', path: '/auth/microsoft/callback', tag: 'schools', auth: 'none', body: SchoolSchemas.MsCallback, summary: 'Finish Microsoft sign-in: maps the Entra identity to a Murshid teacher / student / school admin' },
    (c, { body }) => {
      const who = schools.microsoft.exchangeCode((body as { code: string }).code);
      if (!who) throw new HTTPException(400, { message: 'Microsoft sign-in failed (unknown code)' });
      const headers: Record<string, string> = who.role === 'teacher' ? { 'x-dev-role': 'teacher', 'x-dev-user-id': who.teacherId! }
        : who.role === 'school_admin' ? { 'x-dev-role': 'admin', 'x-dev-school-id': who.orgId } : { 'x-dev-user': who.appId ?? '' };
      return c.json({ user: who, org: orgCard(who.orgId), session: { role: who.role, headers, note: 'dev session headers (demo); production issues a Murshid session after verifying the Entra ID token' } });
    });

  // ---------- teacher ----------
  api.route({ method: 'get', path: '/teacher/me', tag: 'schools', auth: 'custom', summary: 'Signed-in teacher (or school admin), their school and classes' }, async (c) => {
    const s = await staff(c);
    const classes = schools.streams.filter((st) => st.orgId === s.orgId && (s.role === 'school_admin' || st.teacherId === s.teacher.id)).map(classCard);
    return c.json({ role: s.role, teacher: s.role === 'teacher' ? { id: s.teacher.id, name: s.teacher.name, email: s.teacher.email, subject: s.teacher.subject, subjectName: SUBJECT_NAMES[s.teacher.subject] } : null, org: orgCard(s.orgId), classes, today: today(c) });
  });

  api.route({ method: 'get', path: '/teacher/classes/:id/report', tag: 'schools', auth: 'custom', summary: 'Class progress report: completion, overdue and remaining work per student, at-risk flags (all subjects considered)' },
    async (c) => { const s = await staff(c); const st = classOf(s, c.req.param('id')!); return c.json({ class: classCard(st), ...classReport(schools.school(s.orgId), st, today(c)) }); });

  api.route({ method: 'get', path: '/teacher/classes/:id/recommendations', tag: 'schools', auth: 'custom', summary: 'How to delegate the next task: support / more time / core / extension groups, peer partners, mixed groups' },
    async (c) => { const s = await staff(c); const st = classOf(s, c.req.param('id')!); return c.json({ class: classCard(st), ...delegation(schools.school(s.orgId), st, today(c)) }); });

  api.route({ method: 'get', path: '/teacher/classes/:id/homework-timing', tag: 'schools', auth: 'custom', query: SchoolSchemas.Timing, summary: 'Best day to set homework and best due date, with the class on-time likelihood for every option' },
    async (c, { query }) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!);
      return c.json({ class: classCard(st), ...homeworkTiming(schools.school(s.orgId), st, today(c), { minutes: (query as { minutes?: number }).minutes, nowMinutes: nowMinutes(c.get('deps').now()) }) });
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/weekly-reports', tag: 'schools', auth: 'custom', query: SchoolSchemas.Weekly, summary: 'Weekly reports every student submits automatically (Fri 16:00), rolled up for the teacher' },
    async (c, { query }) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!);
      return c.json({ class: classCard(st), ...weeklyRollup(schools.school(s.orgId), st, today(c), nowMinutes(c.get('deps').now()), (query as { week: 'current' | 'last' }).week) });
    });

  api.route({ method: 'get', path: '/teacher/students', tag: 'schools', auth: 'custom', summary: 'Every student across the teacher\u2019s classes (a school admin sees the whole school), worst status first' },
    async (c) => {
      const s = await staff(c); const school = schools.school(s.orgId);
      const classes = schools.streams.filter((st) => st.orgId === s.orgId && (s.role === 'school_admin' || st.teacherId === s.teacher.id));
      return c.json({ classes: classes.map(classCard), students: teacherStudents(school, classes, today(c)) });
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/students/:studentId', tag: 'schools', auth: 'custom', summary: 'One student in the class: study time per week, grades over time, every subject, recent work, upcoming tests and personalised assignment ideas' },
    async (c) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!); const school = schools.school(s.orgId);
      const sid = c.req.param('studentId')!;
      if (!(schools.members[st.id] ?? []).includes(sid)) throw new HTTPException(404, { message: 'student not found in this class' });
      const r = school.roster.find((x) => x.id === sid)!;
      return c.json({ class: classCard(st), ...studentInsight(school, st, r, today(c)) });
    });

  /** Post an assignment to a class (used by POST /assignments and by copying to another class). */
  function createPost(c: Ctx, s: Staff, st: Stream, b: z.output<typeof SchoolSchemas.Post>) {
      const day = today(c); const now = c.get('deps').now();
      const setDate = b.setDate ?? day;
      if (b.dueDate <= setDate) throw new HTTPException(400, { message: 'due date must be after the set date', cause: [{ path: 'dueDate', message: 'must be after the set date' }] });
      if (b.dueDate < day) throw new HTTPException(400, { message: 'the due date has already passed', cause: [{ path: 'dueDate', message: 'choose today or later' }] });
      const teacher = schools.teachers.find((t) => t.id === st.teacherId)!;
      const classMembers = schools.members[st.id] ?? [];
      const studentIds = b.studentIds ? [...new Set(b.studentIds)] : null;
      if (studentIds?.some((id) => !classMembers.includes(id))) throw new HTTPException(400, { message: 'every chosen student must be in this class', cause: { code: 'not_in_class' } });
      const targets = studentIds ?? classMembers;
      const attachments = (b.attachmentIds ?? []).map((fid) => {
        const f = schools.classroom.files.get(fid);
        if (!f || f.owner !== s.actor) throw new HTTPException(400, { message: 'an attachment was not found: upload it again', cause: { code: 'attachment_not_found' } });
        return refOf(f);
      });
      const item: WorkItem = {
        id: schools.nextId(`${st.id}-post`), streamId: st.id, subject: st.subject, teacherId: st.teacherId, title: b.title, instructions: b.instructions,
        setDate, dueDate: b.dueDate, dueTime: b.dueTime, minutes: b.minutes ?? st.minutes, source: 'portal', posted: true, createdAt: now.toISOString(),
        format: b.format, formUrl: b.format === 'google_form' || b.format === 'microsoft_form' ? b.formUrl ?? null : null,
        questions: b.format === 'form' ? b.questions!.map((q) => ({ ...q, options: q.type === 'choice' ? q.options : undefined })) : undefined,
        assignees: studentIds,
        attachments, links: (b.links ?? []).map((l) => ({ url: l.url, label: l.label || l.url.replace(/^https?:\/\//, '').slice(0, 60) })),
        photosRequired: b.photosRequired,
        rubric: b.rubric?.map((r, i) => ({ id: `c${i + 1}`, label: r.label, points: r.points })),
      };
      schools.posted.push(item); schools.postedById.set(item.id, item);
      const extras = [attachments.length ? `${attachments.length} attachment${attachments.length === 1 ? '' : 's'}` : '', b.photosRequired ? 'hand in photos of your notes' : ''].filter(Boolean).join(' \u00b7 ');
      const how = (extras ? ` \u00b7 ${extras}` : '') + (b.format === 'google_form' ? ` \u00b7 Google Form: ${item.formUrl}` : b.format === 'microsoft_form' ? ` \u00b7 Microsoft Form: ${item.formUrl}` : b.format === 'form' ? ` \u00b7 Answer the ${item.questions!.length}-question form on your School page` : '');
      const delivered: { studentId: string; appId: string; taskId: string }[] = [];
      for (const rid of targets) {
        const r = schools.roster.find((x) => x.id === rid);
        if (!r?.appId || !store.has(r.appId)) continue;
        const rec = store.record(r.appId, now);
        const subj = rec.profile.subjects.find((x) => x.id === st.subject || x.name.toLowerCase().startsWith(SUBJECT_NAMES[st.subject].toLowerCase().slice(0, 5)));
        const taskId = `school-${item.id}-${r.appId}`;
        rec.customTasks.push({
          id: taskId, title: `${SUBJECT_NAMES[st.subject]}: ${b.title} (due ${shortDay(b.dueDate)})`, kind: 'assignment', date: setDate, time: '16:30',
          durationMinutes: item.minutes, status: 'todo', overdue: false, subjectId: subj?.id ?? null, area: subj?.id ?? null, source: 'admin',
          notes: `Set by ${teacher.name} in Murshid for Schools${b.instructions ? ` \u00b7 ${b.instructions}` : ''}${how}`,
        });
        delivered.push({ studentId: r.id, appId: r.appId, taskId });
        store.audit({ actor: s.actor, actorRole: 'admin', studentId: r.appId, action: 'create', resource: 'task', resourceId: taskId, summary: `${teacher.name} set "${b.title}" for ${st.name}`, at: now.toISOString() });
      }
      // automated follow-up for every student in the class: replan the week, set a reminder, flag overload
      const school = schools.school(s.orgId);
      const runs: Record<string, ReturnType<typeof replanForPost>> = {};
      for (const rid of targets) {
        const r = school.roster.find((x) => x.id === rid);
        if (!r) continue;
        const run = replanForPost(school, r, item, day);
        runs[r.id] = run;
        if (!r.appId || !store.has(r.appId)) continue;
        const rec = store.record(r.appId, now);
        const subjectId = rec.customTasks.find((t) => t.id === `school-${item.id}-${r.appId}`)?.subjectId ?? null;
        rec.customTasks.push(
          { id: `auto-${item.id}-${r.appId}-session`, title: `Work on ${SUBJECT_NAMES[st.subject]}: ${b.title}`, kind: 'study', date: run.sessionDate, time: '17:00', durationMinutes: item.minutes, status: 'todo', overdue: false, subjectId, area: subjectId, source: 'murshid', notes: 'Murshid picked the lightest day before it is due.' },
          { id: `auto-${item.id}-${r.appId}-reminder`, title: `Reminder: ${b.title} is due ${shortDay(b.dueDate)}`, kind: 'study', date: run.reminderDate, time: '19:00', durationMinutes: 5, status: 'todo', overdue: false, subjectId, area: subjectId, source: 'murshid', notes: null },
        );
        store.audit({ actor: 'murshid', actorRole: 'agent', studentId: r.appId, action: 'create', resource: 'task', resourceId: `auto-${item.id}-${r.appId}-session`, summary: `Murshid replanned the week for "${b.title}": work session ${shortDay(run.sessionDate)}, reminder ${shortDay(run.reminderDate)}${run.overloaded ? `; at risk, extra support (${run.overloadReason})` : ''}`, at: now.toISOString() });
      }
      schools.automations[item.id] = runs;
      const all = Object.values(runs);
      const overloaded = all.filter((x) => x.overloaded).map((x) => ({ studentId: x.studentId, name: school.roster.find((r) => r.id === x.studentId)?.name ?? x.studentId, reason: x.overloadReason }));
      const featured = all.find((x) => delivered.some((d) => d.studentId === x.studentId)) ?? all.find((x) => x.overloaded) ?? all[0];
      const automation = {
        students: all.length, replanned: all.length, reminders: all.length, inApp: delivered.length, overloaded,
        featured: featured ? { studentId: featured.studentId, name: school.roster.find((r) => r.id === featured.studentId)?.name ?? '', trace: featured.trace } : null,
      };
      return { assignment: { ...item, setLabel: shortDay(setDate), dueLabel: shortDay(b.dueDate) }, class: classCard(st), students: targets.length, personalised: Boolean(studentIds), deliveredToApp: delivered, automation };
  }

  api.route({ method: 'get', path: '/teacher/classes/:id/assignments', tag: 'schools', auth: 'custom', summary: 'Assignments for the class (posted in the portal or synced from Teams) with hand-in counts' },
    async (c) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!); const day = today(c);
      const school = schools.school(s.orgId);
      const members = (schools.members[st.id] ?? []).map((id) => school.roster.find((r) => r.id === id)!);
      const items = streamItems(school, st, day).filter((it) => it.setDate <= day || it.posted).reverse().map((it) => {
        const answered = schools.responses[it.id] ?? {};
        const hands = schools.classroom.handins[it.id] ?? {};
        const threads = schools.classroom.threads[it.id] ?? {};
        const got = members.filter((m) => assignedTo(it, m.id));
        const subs = got.map((m) => (answered[m.id] || hands[m.id] ? 'submitted' : it.posted && it.dueDate >= day ? 'pending' : submission(m, it, day).status));
        const toReview = got.filter((m) => hands[m.id]?.state === 'handed_in').length;
        const unread = got.reduce((t, m) => { const th = threads[m.id]; return t + (th ? th.messages.slice(th.seenByTeacher).filter((x) => x.from === 'student').length : 0); }, 0);
        return { ...it, toReview, unread, attachmentCount: it.attachments?.length ?? 0, format: it.format ?? 'task', setLabel: shortDay(it.setDate), dueLabel: shortDay(it.dueDate), handedIn: subs.filter((x) => x === 'on_time' || x === 'late' || x === 'submitted').length, missing: subs.filter((x) => x === 'missing').length, responses: Object.keys(answered).length, students: got.length,
          personalised: Boolean(it.assignees), assigneeNames: it.assignees ? got.slice(0, 4).map((m) => m.name) : undefined };
      });
      return c.json({ class: classCard(st), items });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments', tag: 'schools', auth: 'custom', body: SchoolSchemas.Post, summary: 'Post an assignment: it lands in every linked student\'s Murshid app (Today list + School page)' },
    async (c, { body }) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!);
      return c.json(createPost(c, s, st, body as z.output<typeof SchoolSchemas.Post>), 201);
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments/:itemId/copy', tag: 'schools', auth: 'custom', body: z.object({ toClassId: z.string().min(1).max(80), dueDate: isoDate.optional(), setDate: isoDate.optional() }),
    summary: 'Copy a posted assignment to another of your classes (same instructions, attachments, links, rubric and photo setting)' },
    async (c, { body }) => {
      const s = await staff(c); const from = classOf(s, c.req.param('id')!); const day = today(c);
      const b = body as { toClassId: string; dueDate?: string; setDate?: string };
      const to = classOf(s, b.toClassId);
      if (to.id === from.id) throw new HTTPException(400, { message: 'choose a different class', cause: { code: 'same_class' } });
      const item = schools.postedById.get(c.req.param('itemId')!);
      if (!item || item.streamId !== from.id) throw new HTTPException(404, { message: 'assignment not found (only work posted in Murshid can be copied)' });
      const setDate = b.setDate ?? (item.setDate >= day ? item.setDate : day);
      const dueDate = b.dueDate ?? (item.dueDate > setDate ? item.dueDate : null);
      if (!dueDate) throw new HTTPException(400, { message: 'the original due date has passed: choose a new one', cause: [{ path: 'dueDate', message: 'required' }] });
      const parsed = SchoolSchemas.Post.safeParse({
        title: item.title, instructions: item.instructions, setDate, dueDate, dueTime: item.dueTime, minutes: item.minutes,
        format: item.format ?? 'task', formUrl: item.formUrl ?? undefined, questions: item.questions,
        attachmentIds: item.attachments?.map((f) => f.id), links: item.links, photosRequired: Boolean(item.photosRequired),
        rubric: item.rubric?.map((r) => ({ label: r.label, points: r.points })),
      });
      if (!parsed.success) throw new HTTPException(400, { message: 'this assignment cannot be copied as it is', cause: parsed.error.issues.map((x) => ({ path: x.path.join('.'), message: x.message })) });
      // the copy shares the original's files
      for (const f of item.attachments ?? []) { const stored = schools.classroom.files.get(f.id); if (stored) stored.owner = s.actor; }
      return c.json(createPost(c, s, to, parsed.data), 201);
    });

  // ---------- school (org) ----------
  const orgAccess = async (c: Ctx) => {
    const s = await staff(c);
    const id = c.req.param('id')!;
    if (id !== s.orgId) throw new HTTPException(403, { message: 'not your school' });
    return { s, id };
  };
  api.route({ method: 'get', path: '/orgs/:id', tag: 'schools', auth: 'custom', summary: 'School tenant: licence, seats, Microsoft 365 connection' },
    async (c) => { const { id } = await orgAccess(c); return c.json({ ...orgCard(id), classes: schools.streams.filter((x) => x.orgId === id).map(classCard) }); });

  api.route({ method: 'get', path: '/orgs/:id/students', tag: 'schools', auth: 'custom', summary: "This school's students only (roster + Murshid app accounts); family accounts never appear" },
    async (c) => {
      const { id } = await orgAccess(c);
      const now = c.get('deps').now();
      const app = Object.entries(schools.tenant).filter(([sid, org]) => org === id && store.has(sid)).map(([sid]) => { const v = store.view(sid, now); return { id: sid, name: v.profile.name, grade: v.profile.grade, licence: schools.licenceOf(sid) }; });
      return c.json({ orgId: id, roster: schools.roster.filter((r) => r.orgId === id).map((r) => ({ id: r.id, name: r.name, section: r.section, appId: r.appId })), appStudents: app });
    });

  api.route({ method: 'post', path: '/orgs/:id/microsoft/connect', tag: 'schools', auth: 'custom', summary: 'Connect Microsoft 365 (simulated admin consent): Entra sign-in for staff and students, Teams classes + assignments sync' },
    async (c) => {
      const { s, id } = await orgAccess(c);
      const org = schools.org(id)!;
      if (!org.microsoft) throw new HTTPException(400, { message: 'no Microsoft tenant on file for this school' });
      const now = c.get('deps').now().toISOString();
      const classes = schools.microsoft.listClasses(id);
      org.microsoft.connected = true;
      org.microsoft.connectedAt = org.microsoft.connectedAt ?? now;
      org.microsoft.connectedBy = s.actor;
      org.microsoft.lastSyncAt = now;
      const school = schools.school(id);
      const day = today(c);
      const assignments = school.streams.reduce((t, st) => t + streamItems(school, st, day).filter((it) => it.setDate <= day).length, 0);
      org.microsoft.synced = { classes: classes.length, teachers: school.teachers.length, students: school.roster.length, assignments };
      return c.json({ ...orgCard(id), classes });
    });

  api.route({ method: 'post', path: '/orgs/:id/microsoft/disconnect', tag: 'schools', auth: 'custom', summary: 'Disconnect Microsoft 365' },
    async (c) => {
      const { id } = await orgAccess(c);
      const ms = schools.org(id)!.microsoft;
      if (ms) { ms.connected = false; ms.lastSyncAt = null; ms.synced = null; }
      return c.json(orgCard(id));
    });

  // ---------- platform: licensing overview ----------
  api.route({ method: 'get', path: '/licensing/overview', tag: 'schools', auth: 'custom', summary: 'Families vs institutions, kept apart (Murshid platform admin)' }, async (c) => {
    const { config } = c.get('deps');
    if (config.authMode === 'dev' && !c.req.header('authorization')) {
      if (c.req.header('x-dev-role') !== 'admin') throw new HTTPException(c.req.header('x-dev-role') ? 403 : 401, { message: 'admin role required' });
    } else { await authMiddleware(c, async () => {}); if (c.get('auth').role !== 'admin') throw new HTTPException(403, { message: 'admin role required' }); }
    const now = c.get('deps').now();
    const studentsOf = (orgId: string) => Object.entries(schools.tenant).filter(([sid, o]) => o === orgId && store.has(sid)).map(([sid]) => ({ id: sid, name: store.view(sid, now).profile.name }));
    const pick = (type: 'family' | 'institution') => schools.orgs.filter((o) => o.licence?.type === type).map((o) => ({
      ...orgCard(o.id), students: studentsOf(o.id), accounts: schools.accounts.filter((a) => a.orgId === o.id).map((a) => ({ id: a.id, role: a.role, name: a.name, via: a.via })),
    }));
    const institutions = pick('institution');
    const families = pick('family');
    return c.json({
      institutions, families,
      totals: {
        institutions: institutions.length, institutionStudents: institutions.reduce((t, o) => t + o.usage.rosterStudents + o.students.filter((s) => !schools.rosterByApp(s.id)).length, 0),
        families: families.length, familyStudents: families.reduce((t, o) => t + o.students.length, 0),
      },
    });
  });

  // ---------- student ----------
  api.route({ method: 'get', path: '/student/school', tag: 'schools', auth: 'custom', summary: "The student's licence (school or family) and, under a school licence, classes, teachers and work from teachers" },
    async (c) => {
      const v = await view(c);
      const licence = schools.licenceOf(v.profile.id);
      const base = { student: { id: v.profile.id, name: v.profile.name }, licence };
      if (licence.type === 'family') {
        const payer = schools.accounts.find((a) => a.orgId === licence.orgId && a.role === 'parent');
        return c.json({ ...base, family: { plan: licence.planName, boughtBy: licence.boughtBy, parent: payer ? { name: payer.name } : null }, school: null });
      }
      const org = schools.org(licence.orgId)!;
      const r = schools.rosterByApp(v.profile.id);
      if (!r) return c.json({ ...base, family: null, school: { org: orgCard(org.id), classes: [], assignments: [], weeklyReport: null } });
      const day = dubaiDate(v.now);
      const school = schools.school(org.id);
      const w = studentWork(school, r, day);
      const classes = school.streams.filter((st) => schools.members[st.id]?.includes(r.id)).map(classCard);
      const assignments = w.items.filter((x) => x.sub.status === 'pending' || x.sub.status === 'missing' || (x.item.posted && x.sub.status !== 'not_set'))
        .sort((a, b) => Number(b.item.posted) - Number(a.item.posted) || a.item.dueDate.localeCompare(b.item.dueDate))
        .map((x) => {
          const mine = schools.responses[x.item.id]?.[r.id];
          const hand = schools.classroom.handins[x.item.id]?.[r.id];
          const th = schools.classroom.threads[x.item.id]?.[r.id];
          const unread = th ? th.messages.slice(th.seenByStudent).filter((m) => m.from === 'teacher').length : 0;
          const handIn = hand ? { state: hand.state, grade: hand.state === 'marked' ? hand.grade : null, late: hand.late, files: hand.files.length, feedback: hand.state !== 'handed_in' ? hand.feedback : null } : null;
          return { handIn, unread, attachments: x.item.attachments?.length ?? 0, photosRequired: Boolean(x.item.photosRequired), id: x.item.id, title: x.item.title, subject: x.subjectName, teacher: x.teacherName, setDate: x.item.setDate, dueDate: x.item.dueDate, dueLabel: shortDay(x.item.dueDate), minutes: x.item.minutes, status: hand ? (hand.state === 'handed_in' ? 'submitted' : hand.state) : mine ? 'submitted' : x.sub.status, source: x.item.source, posted: x.item.posted, instructions: x.item.instructions,
            format: x.item.format ?? 'task', formUrl: x.item.formUrl ?? null, questions: x.item.questions ?? null, response: mine ?? null, trace: schools.automations[x.item.id]?.[r.id]?.trace ?? null };
        });
      // the app student's own tests (the same ones the dashboard counts)
      const subjectName = new Map(v.profile.subjects.map((x) => [x.id, x.name]));
      const ownTests = v.data.assessments.filter((a) => a.status === 'upcoming' && (a.kind === 'test' || a.kind === 'quiz' || a.kind === 'exam'))
        .map((a) => ({ date: a.date, title: `${subjectName.get(a.subjectId) ?? ''} ${a.kind === 'quiz' ? 'quiz' : a.kind === 'exam' ? 'exam' : 'test'}: ${a.title}`.trim() }));
      return c.json({ ...base, today: day, family: null, school: { org: orgCard(org.id), section: r.section, classes, assignments, weeklyReport: weeklyReport(school, r, day, nowMinutes(v.now), undefined, ownTests) } });
    });

  // ---------- built-in forms ----------
  api.route({ method: 'post', path: '/student/assignments/:id/responses', tag: 'schools', auth: 'custom', body: SchoolSchemas.Respond, summary: 'Answer a built-in form assignment (one response per student: sending again updates it)' },
    async (c, { body }) => {
      const v = await view(c);
      const r = schools.rosterByApp(v.profile.id);
      if (!r) throw new HTTPException(404, { message: 'form assignments come with a school licence' });
      const item = schools.postedById.get(c.req.param('id')!);
      if (!item || !(schools.members[item.streamId] ?? []).includes(r.id)) throw new HTTPException(404, { message: 'assignment not found' });
      if (item.format !== 'form' || !item.questions) throw new HTTPException(400, { message: 'this assignment is not a Murshid form', cause: { code: 'not_a_form' } });
      const answers = (body as z.output<typeof SchoolSchemas.Respond>).answers;
      const known = new Set(item.questions.map((q) => q.id));
      const clean: Record<string, string> = {};
      for (const [k, val] of Object.entries(answers)) if (known.has(k)) clean[k] = val.trim();
      const missing = item.questions.filter((q) => q.required && !clean[q.id]).map((q) => q.id);
      if (missing.length) throw new HTTPException(400, { message: 'answer every required question', cause: missing.map((id) => ({ path: `answers.${id}`, message: 'required' })) });
      const bad = item.questions.filter((q) => q.type === 'choice' && clean[q.id] && !q.options!.includes(clean[q.id]!)).map((q) => q.id);
      if (bad.length) throw new HTTPException(400, { message: 'pick one of the listed options', cause: bad.map((id) => ({ path: `answers.${id}`, message: 'not an option' })) });
      const at = v.now.toISOString();
      const prev = (schools.responses[item.id] ??= {})[r.id];
      schools.responses[item.id]![r.id] = { answers: clean, submittedAt: prev?.submittedAt ?? at, updatedAt: at };
      store.audit({ actor: v.profile.id, actorRole: 'student', studentId: v.profile.id, action: prev ? 'update' : 'create', resource: 'assignment_response', resourceId: item.id, summary: `${prev ? 'Updated' : 'Submitted'} the form "${item.title}"`, at });
      return c.json({ assignmentId: item.id, status: 'submitted', updated: Boolean(prev), response: schools.responses[item.id]![r.id] }, prev ? 200 : 201);
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/assignments/:itemId/responses', tag: 'schools', auth: 'custom', summary: 'Answers to a built-in form assignment, one row per student' },
    async (c) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!);
      const item = schools.postedById.get(c.req.param('itemId')!);
      if (!item || item.streamId !== st.id) throw new HTTPException(404, { message: 'assignment not found' });
      const school = schools.school(s.orgId);
      const answered = schools.responses[item.id] ?? {};
      const rows = (schools.members[st.id] ?? []).filter((id) => assignedTo(item, id)).map((id) => school.roster.find((x) => x.id === id)!).filter(Boolean)
        .map((m) => ({ studentId: m.id, name: m.name, section: m.section, response: answered[m.id] ?? null }));
      return c.json({ assignment: { id: item.id, title: item.title, format: item.format ?? 'task', questions: item.questions ?? [] }, responded: rows.filter((x) => x.response).length, students: rows.length, rows });
    });

  api.route({ method: 'get', path: '/student/weekly-report', tag: 'schools', auth: 'custom', summary: "The student's automatic weekly report (submitted Fri 16:00 to their teachers)" },
    async (c) => {
      const v = await view(c);
      const r = schools.rosterByApp(v.profile.id);
      if (!r) throw new HTTPException(404, { message: 'weekly reports come with a school licence' });
      return c.json(weeklyReport(schools.school(r.orgId), r, dubaiDate(v.now), nowMinutes(v.now)));
    });

  // ---------- classroom: files, hand-ins, review, messages, reminders, announcements, inbox, gradebook ----------
  registerClassroom(api, schools, store, { view, staff, classOf, today, nowMinutes, classCard });
  registerSetup(api, schools, store, { staff, classOf, classCard, view });
}
