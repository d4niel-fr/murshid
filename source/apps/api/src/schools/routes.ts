/**
 * Murshid for Schools + licensing API.
 *
 *   public     GET  /plans, POST /onboarding, GET /auth/microsoft/authorize, GET /auth/microsoft/accounts,
 *              POST /auth/microsoft/callback
 *   teacher    GET  /teacher/me, /teacher/classes/:id/{report,recommendations,homework-timing,weekly-reports,assignments}
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
import { OOW, PLANS, SUBJECT_NAMES, type Stream, type Teacher } from './catalog';
import { classReport, delegation, homeworkTiming, shortDay, streamItems, studentWork, submission, weeklyReport, weeklyRollup, type WorkItem } from './engine';
import type { SchoolStore } from './store';
import { replanForPost } from './automation';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
export const SchoolSchemas = {
  Onboarding: z.union([
    z.object({ path: z.literal('parent'), parentName: z.string().trim().min(1).max(80), email: z.string().email(), childName: z.string().trim().min(1).max(80), childGrade: z.number().int().min(5).max(12), plan: z.enum(['family-plus', 'family-pro']).default('family-plus') }),
    z.object({ path: z.literal('student'), name: z.string().trim().min(1).max(80), email: z.string().email(), grade: z.number().int().min(5).max(12), plan: z.enum(['family-plus', 'family-pro']).default('family-plus') }),
    z.object({ path: z.literal('school'), via: z.literal('microsoft'), code: z.string().min(4).max(120) }),
    z.object({ path: z.literal('school'), via: z.literal('join_code'), joinCode: z.string().trim().min(3).max(20), name: z.string().trim().min(1).max(80), email: z.string().email(), grade: z.number().int().min(5).max(12) }),
  ]),
  MsAuthorize: z.object({ org: z.string().max(60).default(OOW), role: z.enum(['teacher', 'student', 'school_admin']).default('teacher'), adminConsent: z.enum(['true', 'false']).optional() }),
  MsAccounts: z.object({ org: z.string().max(60).default(OOW), role: z.enum(['teacher', 'student', 'school_admin']).optional() }),
  MsCallback: z.object({ code: z.string().min(4).max(120), state: z.string().max(120).optional() }),
  Timing: z.object({ minutes: z.coerce.number().int().min(10).max(240).optional() }),
  Weekly: z.object({ week: z.enum(['current', 'last']).default('current') }),
  Post: z.object({
    title: z.string().trim().min(3).max(140), instructions: z.string().max(1000).nullable().default(null),
    setDate: isoDate.optional(), dueDate: isoDate, dueTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default('08:00'),
    minutes: z.number().int().min(10).max(240).optional(),
  }),
};

type Staff = { role: 'teacher'; teacher: Teacher; orgId: string; actor: string } | { role: 'school_admin'; orgId: string; actor: string };

const nowMinutes = (d: Date) => Math.floor(((d.getTime() + 4 * 3_600_000) % 86_400_000) / 60_000);

export function registerSchools(api: Api, schools: SchoolStore, store: DemoStore, view: (c: Ctx) => Promise<DemoView>) {
  async function staff(c: Ctx): Promise<Staff> {
    const { config } = c.get('deps');
    let role: string | undefined; let userId: string | undefined; let orgId: string | undefined;
    if (config.authMode === 'dev' && !c.req.header('authorization')) {
      role = c.req.header('x-dev-role'); userId = c.req.header('x-dev-user-id'); orgId = c.req.header('x-dev-school-id');
      if (!role) throw new HTTPException(401, { message: 'teacher or school admin required (dev: x-dev-role: teacher + x-dev-user-id)' });
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
      const id = orgId ?? OOW;
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

  api.route({ method: 'get', path: '/teacher/classes/:id/assignments', tag: 'schools', auth: 'custom', summary: 'Assignments for the class (posted in the portal or synced from Teams) with hand-in counts' },
    async (c) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!); const day = today(c);
      const school = schools.school(s.orgId);
      const members = (schools.members[st.id] ?? []).map((id) => school.roster.find((r) => r.id === id)!);
      const items = streamItems(school, st, day).filter((it) => it.setDate <= day || it.posted).reverse().map((it) => {
        const subs = members.map((m) => submission(m, it, day).status);
        return { ...it, setLabel: shortDay(it.setDate), dueLabel: shortDay(it.dueDate), handedIn: subs.filter((x) => x === 'on_time' || x === 'late' || x === 'submitted').length, missing: subs.filter((x) => x === 'missing').length, students: members.length };
      });
      return c.json({ class: classCard(st), items });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/assignments', tag: 'schools', auth: 'custom', body: SchoolSchemas.Post, summary: 'Post an assignment: it lands in every linked student\'s Murshid app (Today list + School page)' },
    async (c, { body }) => {
      const s = await staff(c); const st = classOf(s, c.req.param('id')!); const day = today(c); const now = c.get('deps').now();
      const b = body as z.output<typeof SchoolSchemas.Post>;
      const setDate = b.setDate ?? day;
      if (b.dueDate <= setDate) throw new HTTPException(400, { message: 'due date must be after the set date' });
      const teacher = schools.teachers.find((t) => t.id === st.teacherId)!;
      const item: WorkItem = {
        id: schools.nextId(`${st.id}-post`), streamId: st.id, subject: st.subject, teacherId: st.teacherId, title: b.title, instructions: b.instructions,
        setDate, dueDate: b.dueDate, dueTime: b.dueTime, minutes: b.minutes ?? st.minutes, source: 'portal', posted: true, createdAt: now.toISOString(),
      };
      schools.posted.push(item);
      const delivered: { studentId: string; appId: string; taskId: string }[] = [];
      for (const rid of schools.members[st.id] ?? []) {
        const r = schools.roster.find((x) => x.id === rid);
        if (!r?.appId || !store.has(r.appId)) continue;
        const rec = store.record(r.appId, now);
        const subj = rec.profile.subjects.find((x) => x.id === st.subject || x.name.toLowerCase().startsWith(SUBJECT_NAMES[st.subject].toLowerCase().slice(0, 5)));
        const taskId = `school-${item.id}-${r.appId}`;
        rec.customTasks.push({
          id: taskId, title: `${SUBJECT_NAMES[st.subject]}: ${b.title} (due ${shortDay(b.dueDate)})`, kind: 'assignment', date: setDate, time: '16:30',
          durationMinutes: item.minutes, status: 'todo', overdue: false, subjectId: subj?.id ?? null, area: subj?.id ?? null, source: 'admin',
          notes: `Set by ${teacher.name} in Murshid for Schools${b.instructions ? ` \u00b7 ${b.instructions}` : ''}`,
        });
        delivered.push({ studentId: r.id, appId: r.appId, taskId });
        store.audit({ actor: s.actor, actorRole: 'admin', studentId: r.appId, action: 'create', resource: 'task', resourceId: taskId, summary: `${teacher.name} set "${b.title}" for ${st.name}`, at: now.toISOString() });
      }
      // automated follow-up for every student in the class: replan the week, set a reminder, flag overload
      const school = schools.school(s.orgId);
      const runs: Record<string, ReturnType<typeof replanForPost>> = {};
      for (const rid of schools.members[st.id] ?? []) {
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
      return c.json({ assignment: { ...item, setLabel: shortDay(setDate), dueLabel: shortDay(b.dueDate) }, class: classCard(st), students: schools.members[st.id]?.length ?? 0, deliveredToApp: delivered, automation }, 201);
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
        .map((x) => ({ id: x.item.id, title: x.item.title, subject: x.subjectName, teacher: x.teacherName, setDate: x.item.setDate, dueDate: x.item.dueDate, dueLabel: shortDay(x.item.dueDate), minutes: x.item.minutes, status: x.sub.status, source: x.item.source, posted: x.item.posted, instructions: x.item.instructions, trace: schools.automations[x.item.id]?.[r.id]?.trace ?? null }));
      return c.json({ ...base, today: day, family: null, school: { org: orgCard(org.id), section: r.section, classes, assignments, weeklyReport: weeklyReport(school, r, day, nowMinutes(v.now)) } });
    });

  api.route({ method: 'get', path: '/student/weekly-report', tag: 'schools', auth: 'custom', summary: "The student's automatic weekly report (submitted Fri 16:00 to their teachers)" },
    async (c) => {
      const v = await view(c);
      const r = schools.rosterByApp(v.profile.id);
      if (!r) throw new HTTPException(404, { message: 'weekly reports come with a school licence' });
      return c.json(weeklyReport(schools.school(r.orgId), r, dubaiDate(v.now), nowMinutes(v.now)));
    });
}
