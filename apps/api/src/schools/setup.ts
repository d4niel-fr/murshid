/**
 * Setting up a real school without Microsoft 365: Murshid's team adds the school and its admin; the school admin
 * invites teachers by email, imports the student list (or students join with the school code), and makes classes;
 * teachers add students to their classes or share a class code. Microsoft 365 sync (microsoft-graph.ts) fills the
 * same records automatically.
 */
import { randomInt } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { dubaiDate } from '../lib/time';
import { findBySecret } from '../lib/security';
import type { DemoStore, DemoView } from '../v1/store';
import { realRosterStudent, signedIn, type Me } from './accounts';
import { SUBJECT_IDS, SUBJECT_NAMES, type Org, type Stream, type SubjectId } from './catalog';
import type { Staff } from './routes';
import type { SchoolStore } from './store';

const code = (len: number) => Array.from({ length: len }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
const subject = z.enum(SUBJECT_IDS as [SubjectId, ...SubjectId[]]);
const email = z.string().trim().toLowerCase().email().max(160);
const days = z.array(z.number().int().min(1).max(5)).min(1).max(5);

export const SetupSchemas = {
  School: z.object({
    name: z.string().trim().min(2).max(120), shortName: z.string().trim().min(1).max(20).optional(),
    emirate: z.enum(['dubai', 'abu_dhabi', 'sharjah']).default('dubai'),
    adminName: z.string().trim().min(1).max(80), adminEmail: email,
    seats: z.number().int().min(1).max(20_000).default(100), status: z.enum(['trial', 'active']).default('trial'),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  }),
  Teacher: z.object({ name: z.string().trim().min(1).max(80), email, subject: subject.default('other') }),
  Roster: z.object({ students: z.array(z.object({ name: z.string().trim().min(1).max(80), email: email.optional(), grade: z.number().int().min(1).max(13), section: z.string().trim().min(1).max(12).optional() })).min(1).max(1000) }),
  Class: z.object({
    name: z.string().trim().min(2).max(80), subject, teacherId: z.string().min(1).max(60),
    setDays: days.default([1, 3]), minutes: z.number().int().min(10).max(240).default(40),
    studentIds: z.array(z.string().min(1).max(80)).max(400).default([]), sections: z.array(z.string().trim().max(12)).max(20).default([]),
  }),
  ClassPatch: z.object({
    name: z.string().trim().min(2).max(80).optional(), teacherId: z.string().min(1).max(60).optional(), setDays: days.optional(), minutes: z.number().int().min(10).max(240).optional(),
    add: z.array(z.string().min(1).max(80)).max(400).default([]), remove: z.array(z.string().min(1).max(80)).max(400).default([]),
  }),
  JoinClass: z.object({ code: z.string().trim().min(4).max(12) }),
};

interface Helpers { staff: (c: Ctx) => Promise<Staff>; classOf: (s: Staff, id: string) => Stream; classCard: (st: Stream) => unknown; view: (c: Ctx) => Promise<DemoView> }

export function registerSetup(api: Api, schools: SchoolStore, store: DemoStore, h: Helpers) {
  const S = SetupSchemas;
  const platformAdmin = async (c: Ctx): Promise<Me | null> => {
    if (c.get('deps').config.authMode === 'dev' && !c.req.header('authorization')) {
      if (c.req.header('x-dev-role') !== 'admin') throw new HTTPException(403, { message: 'Murshid admin role required (dev: x-dev-role: admin)' });
      return null;
    }
    const me = await signedIn(c, schools, store);
    if (me.role !== 'platform_admin') throw new HTTPException(403, { message: 'Murshid admin role required (PLATFORM_ADMIN_EMAILS)' });
    return me;
  };
  const schoolAdmin = async (c: Ctx) => {
    const s = await h.staff(c);
    if (s.role !== 'school_admin') throw new HTTPException(403, { message: 'school admin role required' });
    return s;
  };
  const orgCard = (o: Org) => ({
    id: o.id, name: o.name, shortName: o.shortName, emirate: o.emirate, licence: o.licence, joinCode: o.joinCode, real: Boolean(o.real),
    teachers: schools.teachers.filter((t) => t.orgId === o.id).length, students: schools.roster.filter((r) => r.orgId === o.id).length, classes: schools.streams.filter((s) => s.orgId === o.id).length,
  });
  const today = (c: Ctx) => dubaiDate(c.get('deps').now());

  /* ---------- Murshid team: schools ---------- */
  api.route({ method: 'get', path: '/platform/schools', tag: 'setup', auth: 'custom', summary: 'Murshid admin: every school with its licence and size' },
    async (c) => { await platformAdmin(c); return c.json({ items: schools.orgs.filter((o) => o.kind === 'school').map(orgCard) }); });

  api.route({ method: 'post', path: '/platform/schools', tag: 'setup', auth: 'custom', body: S.School, summary: 'Murshid admin: add a school and its first school admin (who signs in with that email)' },
    async (c, { body }) => {
      await platformAdmin(c);
      const b = body as z.output<typeof S.School>;
      if (schools.accounts.some((a) => a.email.toLowerCase() === b.adminEmail)) throw new HTTPException(409, { message: 'that admin email already has a Murshid account', cause: { code: 'email_taken' } });
      const day = today(c);
      const id = schools.nextId('sch');
      let join = `${(b.shortName ?? b.name).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'SCH'}-${code(4)}`;
      while (schools.orgs.some((o) => o.joinCode === join)) join = `${join.split('-')[0]}-${code(4)}`;
      const org: Org = {
        id, real: true, name: b.name, shortName: b.shortName ?? b.name, kind: 'school', parentOrgId: null, emirate: b.emirate,
        licence: { type: 'institution', plan: 'school', status: b.status, boughtBy: 'school', seats: b.seats, priceAed: 150, per: 'student-year', startDate: day, endDate: b.endDate ?? `${Number(day.slice(0, 4)) + 1}-06-30`, note: b.status === 'trial' ? 'Trial' : 'Licensed' },
        joinCode: join, microsoft: null,
      };
      schools.orgs.push(org);
      schools.addAccount({ orgId: id, role: 'school_admin', name: b.adminName, email: b.adminEmail, studentIds: [], via: 'email', createdAt: day });
      return c.json(orgCard(org), 201);
    });

  /* ---------- school admin: teachers, students, classes ---------- */
  api.route({ method: 'get', path: '/school/setup', tag: 'setup', auth: 'custom', summary: 'School admin: teachers, students and classes, with the school code' },
    async (c) => {
      const s = await schoolAdmin(c);
      const org = schools.org(s.orgId)!;
      return c.json({
        school: orgCard(org),
        teachers: schools.teachers.filter((t) => t.orgId === s.orgId).map((t) => ({ ...t, subjectName: SUBJECT_NAMES[t.subject], signedIn: schools.accounts.some((a) => a.teacherId === t.id && a.authUserId) })),
        students: schools.roster.filter((r) => r.orgId === s.orgId).map((r) => ({ id: r.id, name: r.name, email: r.email ?? null, grade: r.grade ?? null, section: r.section, usesApp: Boolean(r.appId) })),
        classes: schools.streams.filter((x) => x.orgId === s.orgId).map((x) => ({ ...(h.classCard(x) as object), joinCode: x.joinCode ?? null })),
        subjects: SUBJECT_IDS.map((id) => ({ id, name: SUBJECT_NAMES[id] })),
      });
    });

  api.route({ method: 'post', path: '/school/teachers', tag: 'setup', auth: 'custom', body: S.Teacher, summary: 'School admin: invite a teacher (they sign in with this email)' },
    async (c, { body }) => {
      const s = await schoolAdmin(c);
      const b = body as z.output<typeof S.Teacher>;
      if (schools.teachers.some((t) => t.email.toLowerCase() === b.email)) throw new HTTPException(409, { message: 'a teacher with that email is already set up', cause: { code: 'email_taken' } });
      const t = { id: schools.nextId('tch'), orgId: s.orgId, name: b.name, email: b.email, subject: b.subject, portal: true };
      schools.teachers.push(t);
      return c.json(t, 201);
    });

  api.route({ method: 'delete', path: '/school/teachers/:id', tag: 'setup', auth: 'custom', summary: 'School admin: remove a teacher (their classes must move to someone else first)' },
    async (c) => {
      const s = await schoolAdmin(c);
      const t = schools.teachers.find((x) => x.id === c.req.param('id') && x.orgId === s.orgId);
      if (!t) throw new HTTPException(404, { message: 'teacher not found' });
      if (schools.streams.some((x) => x.teacherId === t.id)) throw new HTTPException(409, { message: 'move this teacher’s classes to someone else first', cause: { code: 'has_classes' } });
      schools.teachers.splice(schools.teachers.indexOf(t), 1);
      const acc = schools.accounts.find((a) => a.teacherId === t.id);
      if (acc) schools.accounts.splice(schools.accounts.indexOf(acc), 1);
      return c.json({ ok: true });
    });

  api.route({ method: 'post', path: '/school/roster', tag: 'setup', auth: 'custom', body: S.Roster, summary: 'School admin: import students (name, email, grade, section); students sign in with that email' },
    async (c, { body }) => {
      const s = await schoolAdmin(c);
      const org = schools.org(s.orgId)!;
      const seats = org.licence?.seats ?? Infinity;
      const have = schools.roster.filter((r) => r.orgId === s.orgId);
      const known = new Set(have.flatMap((r) => (r.email ? [r.email.toLowerCase()] : [])));
      const added = []; const skipped: string[] = [];
      for (const x of (body as z.output<typeof S.Roster>).students) {
        if (x.email && known.has(x.email)) { skipped.push(x.email); continue; }
        if (have.length + added.length >= seats) throw new HTTPException(409, { message: `the licence has ${seats} seats: ask Murshid for more`, cause: { code: 'seats_full', added: added.length } });
        const r = realRosterStudent(schools, s.orgId, { name: x.name, grade: x.grade, section: x.section, email: x.email });
        schools.roster.push(r); added.push(r); if (x.email) known.add(x.email);
      }
      return c.json({ added: added.length, skipped }, 201);
    });

  api.route({ method: 'delete', path: '/school/roster/:id', tag: 'setup', auth: 'custom', summary: 'School admin: remove a student from the school (and its classes)' },
    async (c) => {
      const s = await schoolAdmin(c);
      const r = schools.roster.find((x) => x.id === c.req.param('id') && x.orgId === s.orgId);
      if (!r) throw new HTTPException(404, { message: 'student not found' });
      schools.roster.splice(schools.roster.indexOf(r), 1);
      for (const k of Object.keys(schools.members)) schools.members[k] = schools.members[k]!.filter((id) => id !== r.id);
      if (r.appId) delete schools.tenant[r.appId];
      return c.json({ ok: true });
    });

  const memberIds = (orgId: string, ids: string[], sections: string[]) => {
    const roster = schools.roster.filter((r) => r.orgId === orgId);
    const bad = ids.filter((id) => !roster.some((r) => r.id === id));
    if (bad.length) throw new HTTPException(400, { message: 'every student must be on this school’s roster', cause: { code: 'not_on_roster', ids: bad } });
    return [...new Set([...ids, ...roster.filter((r) => sections.includes(r.section)).map((r) => r.id)])];
  };

  api.route({ method: 'post', path: '/school/classes', tag: 'setup', auth: 'custom', body: S.Class, summary: 'School admin: make a class (subject, teacher, students by id or whole sections); it gets a join code' },
    async (c, { body }) => {
      const s = await schoolAdmin(c);
      const b = body as z.output<typeof S.Class>;
      if (!schools.teachers.some((t) => t.id === b.teacherId && t.orgId === s.orgId)) throw new HTTPException(400, { message: 'that teacher is not at this school', cause: { code: 'bad_teacher' } });
      const st: Stream = { id: schools.nextId('cls'), orgId: s.orgId, subject: b.subject, teacherId: b.teacherId, name: b.name, setDays: b.setDays, minutes: b.minutes, teamsClassId: '', joinCode: code(6) };
      schools.streams.push(st);
      schools.members[st.id] = memberIds(s.orgId, b.studentIds, b.sections);
      return c.json({ ...(h.classCard(st) as object), joinCode: st.joinCode }, 201);
    });

  api.route({ method: 'patch', path: '/school/classes/:id', tag: 'setup', auth: 'custom', body: S.ClassPatch, summary: 'Teacher or school admin: rename a class, change its teacher or days, add or remove students' },
    async (c, { body }) => {
      const s = await h.staff(c);
      const st = h.classOf(s, c.req.param('id')!);
      const b = body as z.output<typeof S.ClassPatch>;
      if (b.teacherId && s.role !== 'school_admin') throw new HTTPException(403, { message: 'only the school admin moves a class to another teacher' });
      if (b.teacherId && !schools.teachers.some((t) => t.id === b.teacherId && t.orgId === s.orgId)) throw new HTTPException(400, { message: 'that teacher is not at this school', cause: { code: 'bad_teacher' } });
      Object.assign(st, Object.fromEntries(Object.entries({ name: b.name, teacherId: b.teacherId, setDays: b.setDays, minutes: b.minutes }).filter(([, v]) => v !== undefined)));
      const now = new Set(schools.members[st.id] ?? []);
      for (const id of memberIds(s.orgId, b.add, [])) now.add(id);
      for (const id of b.remove) now.delete(id);
      schools.members[st.id] = [...now];
      return c.json(h.classCard(st));
    });

  api.route({ method: 'delete', path: '/school/classes/:id', tag: 'setup', auth: 'custom', summary: 'School admin: delete a class (its posted work stays in the records)' },
    async (c) => {
      const s = await schoolAdmin(c);
      const st = h.classOf(s, c.req.param('id')!);
      schools.streams.splice(schools.streams.indexOf(st), 1);
      delete schools.members[st.id];
      return c.json({ ok: true });
    });

  api.route({ method: 'post', path: '/school/join-code', tag: 'setup', auth: 'custom', summary: 'School admin: make a new school code (the old one stops working)' },
    async (c) => {
      const s = await schoolAdmin(c);
      const org = schools.org(s.orgId)!;
      org.joinCode = `${org.shortName.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'SCH'}-${code(4)}`;
      return c.json({ joinCode: org.joinCode });
    });

  /* ---------- students: join a class with its code ---------- */
  api.route({ method: 'post', path: '/student/classes/join', tag: 'setup', auth: 'custom', body: S.JoinClass, summary: 'Student: join a class with the code from the teacher (joins the school too, when needed)' },
    async (c, { body }) => {
      const v = await h.view(c);
      const me = c.get('deps').whoami ? await signedIn(c, schools, store) : null;
      const codeIn = (body as z.output<typeof S.JoinClass>).code.trim().toUpperCase();
      const st = findBySecret(schools.streams, (x) => x.joinCode, codeIn);
      if (!st) throw new HTTPException(404, { message: 'no class with that code: check it with your teacher', cause: { code: 'bad_class_code' } });
      const appId = v.profile.id;
      let r = schools.rosterByApp(appId);
      if (r && r.orgId !== st.orgId) throw new HTTPException(409, { message: 'that class is at another school', cause: { code: 'other_school' } });
      if (!r) {
        r = realRosterStudent(schools, st.orgId, { name: v.profile.name, grade: v.profile.grade, appId, email: me?.email ?? undefined });
        schools.roster.push(r);
        schools.tenant[appId] = st.orgId;
        const acc = schools.accounts.find((a) => a.role === 'student' && a.studentIds.includes(appId));
        if (acc) acc.orgId = st.orgId;
      }
      const m = schools.members[st.id] ?? (schools.members[st.id] = []);
      if (!m.includes(r.id)) m.push(r.id);
      return c.json(h.classCard(st), 201);
    });
}

