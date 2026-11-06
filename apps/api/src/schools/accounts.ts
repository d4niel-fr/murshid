/**
 * Real accounts (production sign-in with Supabase): who the signed-in person is in Murshid.
 *
 * Someone signs in with email, Google or Microsoft; the token says who they are (lib/auth.ts). This file links that
 * sign-in to a Murshid account, the first time by email:
 *   - an account the school or a parent set up for that email (claimed on first sign-in),
 *   - a teacher the school invited (a teacher record with that email),
 *   - a student on a school roster with that email (imported, or synced from Microsoft 365),
 *   - otherwise nobody yet: the app asks "student or parent?" (POST /account/setup).
 * Platform admins are listed by email in PLATFORM_ADMIN_EMAILS.
 *
 * Supabase must keep email confirmation on (its default), so an email in a token belongs to the person signing in.
 */
import { randomInt } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { AuthInfo, Config, Ctx } from '../lib/context';
import { authMiddleware } from '../lib/auth';
import { dubaiDate } from '../lib/time';
import type { Api } from '../lib/router';
import type { DemoStore } from '../v1/store';
import type { Account } from './catalog';
import type { SchoolStore } from './store';

export type MeRole = 'student' | 'parent' | 'teacher' | 'school_admin' | 'platform_admin';
export interface Me {
  authUserId: string;
  email: string | null;
  name: string | null;
  role: MeRole | null;
  accountId: string | null;
  orgId: string | null;
  /** students: their app student id */
  studentId: string | null;
  teacherId: string | null;
  /** parents: linked children */
  children: { id: string; name: string }[];
}

const lower = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** A new real student in the app (no generated history). */
export function createRealStudent(store: DemoStore, input: { name: string; grade: number; school: string }, now: Date) {
  return store.createStudent({
    name: input.name, preferredName: input.name.split(' ')[0]!, nameAr: '', grade: input.grade, age: input.grade + 5, school: input.school,
    curriculum: 'british', classLabel: `Grade ${input.grade}`, emirate: 'dubai', languages: [], interests: [],
  }, now, { real: true }).profile;
}

/** A real student on a school's roster (no invented numbers). */
export function realRosterStudent(schools: SchoolStore, orgId: string, input: { name: string; grade: number; section?: string; email?: string; appId?: string | null }) {
  return { id: schools.nextId(`${orgId}-stu`), orgId, name: input.name, section: input.section ?? String(input.grade), grade: input.grade, appId: input.appId ?? null, email: input.email, electives: [], activities: [], events: [], diligence: 0.5, ability: 0.5, real: true };
}

/** Find (or, on first sign-in, link) the account for a verified sign-in. */
export function findAccount(schools: SchoolStore, store: DemoStore, auth: AuthInfo, now: Date): Account | undefined {
  const mine = schools.accounts.find((a) => a.authUserId === auth.userId);
  if (mine) return mine;
  const email = lower(auth.email);
  if (!email) return undefined;
  const day = dubaiDate(now);
  const waiting = schools.accounts.find((a) => !a.authUserId && lower(a.email) === email);
  if (waiting) { waiting.authUserId = auth.userId; return waiting; }
  const teacher = schools.teachers.find((t) => t.portal && lower(t.email) === email);
  if (teacher) {
    return schools.addAccount({ orgId: teacher.orgId, role: 'teacher', name: teacher.name, email: teacher.email, studentIds: [], via: 'email', createdAt: day, authUserId: auth.userId, teacherId: teacher.id });
  }
  const pupil = schools.roster.find((r) => lower(r.email) === email);
  if (pupil) {
    if (!pupil.appId) {
      const org = schools.org(pupil.orgId);
      const p = createRealStudent(store, { name: pupil.name, grade: pupil.grade ?? 11, school: org?.name ?? 'School' }, now);
      pupil.appId = p.id;
      schools.tenant[p.id] = pupil.orgId;
    }
    return schools.addAccount({ orgId: pupil.orgId, role: 'student', name: pupil.name, email: auth.email!, studentIds: [pupil.appId], via: 'email', createdAt: day, authUserId: auth.userId });
  }
  return undefined;
}

export function meOf(schools: SchoolStore, store: DemoStore, config: Config, auth: AuthInfo, now: Date): Me {
  const acc = findAccount(schools, store, auth, now);
  const base: Me = { authUserId: auth.userId, email: auth.email, name: auth.name ?? acc?.name ?? null, role: null, accountId: acc?.id ?? null, orgId: acc?.orgId ?? null, studentId: null, teacherId: null, children: [] };
  if (config.platformAdmins.includes(lower(auth.email))) return { ...base, role: 'platform_admin' };
  if (!acc) return base;
  const nameOf = (id: string) => (store.has(id) ? store.view(id, now).profile.name : id);
  if (acc.role === 'student') return { ...base, role: 'student', studentId: acc.studentIds[0] ?? null };
  if (acc.role === 'parent') return { ...base, role: 'parent', children: acc.studentIds.filter((id) => store.has(id)).map((id) => ({ id, name: nameOf(id) })) };
  if (acc.role === 'teacher') return { ...base, role: 'teacher', teacherId: acc.teacherId ?? null };
  return { ...base, role: 'school_admin' };
}

/** The signed-in person (production) — throws 401 without a valid token. */
export async function signedIn(c: Ctx, schools: SchoolStore, store: DemoStore): Promise<Me> {
  await authMiddleware(c, async () => {});
  const { config, now } = c.get('deps');
  return meOf(schools, store, config, c.get('auth'), now());
}

const Setup = z.discriminatedUnion('role', [
  z.object({ role: z.literal('student'), name: z.string().trim().min(1).max(80), grade: z.number().int().min(5).max(12), joinCode: z.string().trim().min(3).max(20).optional() }),
  z.object({ role: z.literal('parent'), name: z.string().trim().min(1).max(80), childCode: z.string().trim().min(4).max(12).optional() }),
]);
const Link = z.object({ code: z.string().trim().min(4).max(12) });

export function registerAccounts(api: Api, schools: SchoolStore, store: DemoStore) {
  const need = async (c: Ctx) => {
    if (c.get('deps').config.authMode === 'dev' && !c.req.header('authorization')) throw new HTTPException(400, { message: 'accounts need sign-in (this server runs the demo: pick a demo student instead)', cause: { code: 'demo_mode' } });
    return signedIn(c, schools, store);
  };
  const accountOf = (me: Me) => schools.accounts.find((a) => a.id === me.accountId);
  const summary = (me: Me) => {
    const licence = me.studentId ? schools.licenceOf(me.studentId) : null;
    const student = me.studentId && store.has(me.studentId) ? store.view(me.studentId, new Date()).profile : null;
    // children under 13 need a parent linked (UAE data law: a parent agrees for younger children)
    const needsParent = Boolean(student && student.age < 13 && !schools.accounts.some((a) => a.role === 'parent' && a.studentIds.includes(student.id)));
    return { me, needsSetup: me.role === null, licence, needsParent };
  };

  api.route({ method: 'get', path: '/account', tag: 'account', auth: 'custom', durable: 'tx', summary: 'Who I am in Murshid (links the sign-in to an account the first time, by email)' },
    async (c) => c.json(summary(await need(c))));

  api.route({ method: 'post', path: '/account/setup', tag: 'account', auth: 'custom', body: Setup, summary: 'First sign-in: become a student (optionally joining a school with its code) or a parent' },
    async (c, { body }) => {
      const me = await need(c);
      if (me.role) throw new HTTPException(409, { message: 'this sign-in already has an account', cause: { code: 'already_set_up' } });
      const b = body as z.output<typeof Setup>;
      const now = c.get('deps').now(); const day = dubaiDate(now);
      const email = me.email ?? `${me.authUserId}@users.murshid`;
      if (b.role === 'student') {
        const school = b.joinCode ? schools.orgs.find((o) => o.joinCode && lower(o.joinCode) === lower(b.joinCode)) : undefined;
        if (b.joinCode && !school) throw new HTTPException(400, { message: 'that school code is not recognised: check it with your school', cause: { code: 'bad_join_code' } });
        const org = school ?? schools.createFamily(`${b.name} (self)`, 'student', 'single', day);
        if (!school) { org.real = true; if (org.licence) { org.licence.status = 'trial'; org.licence.note = 'Free trial (no plan bought yet)'; } }
        const p = createRealStudent(store, { name: b.name, grade: b.grade, school: school?.name ?? 'Not linked to a school' }, now);
        schools.tenant[p.id] = org.id;
        if (school) schools.roster.push(realRosterStudent(schools, org.id, { name: b.name, grade: b.grade, email: me.email ?? undefined, appId: p.id }));
        schools.addAccount({ orgId: org.id, role: 'student', name: b.name, email, studentIds: [p.id], via: school ? 'join_code' : 'email', createdAt: day, authUserId: me.authUserId });
      } else {
        const org = schools.createFamily(`${b.name.split(' ').slice(-1)[0]} family`, 'parent', 'single', day);
        org.real = true;
        if (org.licence) { org.licence.status = 'trial'; org.licence.note = 'Free trial (no plan bought yet)'; }
        const acc = schools.addAccount({ orgId: org.id, role: 'parent', name: b.name, email, studentIds: [], via: 'email', createdAt: day, authUserId: me.authUserId });
        if (b.childCode) linkChild(acc, b.childCode);
      }
      return c.json(summary(await need(c)), 201);
    });

  /** A parent links to a child with the code from the child's settings. */
  const linkChild = (parent: Account, code: string) => {
    const child = schools.accounts.find((a) => a.role === 'student' && a.parentCode && a.parentCode === code.trim().toUpperCase());
    if (!child) throw new HTTPException(400, { message: 'that code does not match a student: ask your child for the code in their settings', cause: { code: 'bad_child_code' } });
    for (const id of child.studentIds) if (!parent.studentIds.includes(id)) parent.studentIds.push(id);
    child.parentCode = undefined; // one use
  };

  api.route({ method: 'post', path: '/account/parent-code', tag: 'account', auth: 'custom', summary: 'Student: a one-use code a parent types to link to this account' },
    async (c) => {
      const me = await need(c);
      const acc = accountOf(me);
      if (me.role !== 'student' || !acc) throw new HTTPException(403, { message: 'only students have a parent code' });
      acc.parentCode ??= Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[randomInt(32)]).join('');
      return c.json({ code: acc.parentCode });
    });

  api.route({ method: 'post', path: '/account/link-child', tag: 'account', auth: 'custom', body: Link, summary: 'Parent: link to a child with their code' },
    async (c, { body }) => {
      const me = await need(c);
      const acc = accountOf(me);
      if (me.role !== 'parent' || !acc) throw new HTTPException(403, { message: 'only parents link to a child' });
      linkChild(acc, (body as z.output<typeof Link>).code);
      return c.json(summary(await need(c)));
    });

  api.route({ method: 'get', path: '/account/export', tag: 'account', auth: 'custom', summary: 'Download everything Murshid keeps about me (JSON)' },
    async (c) => {
      const me = await need(c);
      const acc = accountOf(me);
      const students = (me.studentId ? [me.studentId] : me.children.map((x) => x.id)).filter((id) => store.has(id));
      const records = students.map((id) => { const v = store.view(id, c.get('deps').now()); return { profile: v.profile, record: { ...v.record, sessionEdits: [...v.record.sessionEdits], assessmentEdits: [...v.record.assessmentEdits] } }; });
      c.header('content-disposition', 'attachment; filename="murshid-my-data.json"');
      return c.json({ exportedAt: new Date().toISOString(), account: acc ?? null, me, students: records, audit: store.auditLog.filter((e) => e.studentId && students.includes(e.studentId)) });
    });

  api.route({ method: 'delete', path: '/account', tag: 'account', auth: 'custom', summary: 'Delete my account and the data in it (students: their record; parents: the link to children)' },
    async (c) => {
      const me = await need(c);
      const acc = accountOf(me);
      if (!acc) return c.json({ ok: true, deleted: false });
      if (acc.role === 'student') for (const id of acc.studentIds) { store.deleteStudent(id); delete schools.tenant[id]; for (const r of schools.roster) if (r.appId === id) r.appId = null; }
      schools.accounts.splice(schools.accounts.indexOf(acc), 1);
      return c.json({ ok: true, deleted: true });
    });
}
