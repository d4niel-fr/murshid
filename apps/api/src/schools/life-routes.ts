/**
 * School life API (see life.ts).
 *
 *   student   GET  /student/today-at-school                one call for Home: check-in, now/next lesson, open polls, points, next event
 *             GET/POST /student/feelings, DELETE /student/feelings/:id
 *             GET  /student/timetable
 *             GET  /student/attendance, POST /student/leave (student or parent), DELETE /student/leave/:id
 *             GET  /student/points
 *             GET  /student/polls, POST /student/polls/:id/answer
 *             GET  /student/events
 *             GET  /student/reports
 *   teacher   GET  /teacher/classes/:id/feelings, POST /teacher/classes/:id/feelings/prompt
 *             GET/PUT /teacher/classes/:id/timetable
 *             GET/PUT /teacher/classes/:id/attendance
 *             GET/POST /teacher/classes/:id/points, DELETE /teacher/points/:id
 *             GET/POST /teacher/classes/:id/polls, POST /teacher/polls/:id/close
 *             GET  /teacher/classes/:id/reports, PUT /teacher/classes/:id/reports/:studentId, POST /teacher/classes/:id/reports/publish
 *   school    GET  /school/wellbeing, GET /school/attendance
 *             GET  /school/leave, POST /school/leave/:id
 *             GET/POST /school/events, DELETE /school/events/:id
 */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import type { NoteKind } from '../notify/hub';
import { addDays, dubaiDate, weekday } from '../lib/time';
import type { DemoView } from '../v1/store';
import { SUBJECT_NAMES, type RosterStudent, type Stream } from './catalog';
import { initialsOf, streamsOf } from './engine';
import {
  attendanceRate, commentBank, concern, CONFIDENCE, demoEvents, demoFeelings, demoMark, demoPoints, EFFORT, EMOTION_IDS, EMOTIONS, generatedLessons,
  POINT_REASONS, REASON_LABEL, termOf, termStart, toMin, type CheckIn, type Lesson, type LeaveRequest, type Mark, type PointAward, type Poll, type SchoolEvent, type Term,
} from './life';
import type { Staff } from './routes';
import type { SchoolStore } from './store';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD');
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'use HH:MM');
const term = z.enum(['T1', 'T2', 'T3']);

export const LifeSchemas = {
  CheckIn: z.object({
    mood: z.number().int().min(1).max(5),
    words: z.array(z.enum(EMOTION_IDS as [string, ...string[]])).max(3).default([]),
    note: z.string().trim().max(500).default(''),
    share: z.enum(['teacher', 'private']).default('teacher'),
    talkTo: z.string().min(1).max(60).nullable().default(null),
  }),
  Prompt: z.object({ question: z.string().trim().min(3).max(160) }),
  Days: z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }),
  Timetable: z.object({
    lessons: z.array(z.object({ day: z.number().int().min(1).max(5), start: hhmm, end: hhmm, room: z.string().trim().max(24).default(''), link: z.string().trim().url().max(500).refine((u) => /^https:\/\//.test(u), 'lesson links must start with https://').nullable().default(null) }))
      .max(30).refine((l) => l.every((x) => x.start < x.end), 'each lesson must end after it starts'),
  }),
  Register: z.object({ date: date.optional() }),
  Marks: z.object({ date, marks: z.record(z.string().min(1).max(80), z.enum(['present', 'late', 'absent', 'excused'])).refine((m) => Object.keys(m).length <= 400, 'too many students') }),
  Leave: z.object({
    from: date, to: date, reason: z.enum(['illness', 'appointment', 'family', 'religious', 'competition', 'other']), note: z.string().trim().max(500).default(''),
  }).refine((b) => b.from <= b.to, { message: 'the last day must be on or after the first', path: ['to'] }),
  Decide: z.object({ decision: z.enum(['approved', 'declined']), reply: z.string().trim().max(300).default('') }),
  Award: z.object({
    studentIds: z.array(z.string().min(1).max(80)).min(1).max(200),
    reason: z.enum(POINT_REASONS), points: z.number().int().min(-3).max(5).refine((n) => n !== 0, 'points cannot be 0'), note: z.string().trim().max(200).default(''),
  }),
  Poll: z.object({
    kind: z.enum(['choice', 'exit', 'confidence']), question: z.string().trim().min(3).max(200),
    options: z.array(z.string().trim().min(1).max(80)).max(6).default([]), anonymous: z.boolean().default(false),
  }).superRefine((b, ctx) => { if (b.kind === 'choice' && b.options.length < 2) ctx.addIssue({ code: 'custom', path: ['options'], message: 'add 2 to 6 options' }); }),
  Answer: z.object({ choice: z.number().int().min(0).max(5).nullable().default(null), text: z.string().trim().max(600).default('') }),
  Event: z.object({
    title: z.string().trim().min(2).max(120), date, end: date.optional(), kind: z.enum(['holiday', 'exam', 'trip', 'event', 'meeting', 'sport']),
    grades: z.array(z.number().int().min(1).max(13)).max(13).default([]), note: z.string().trim().max(300).default(''),
  }).refine((b) => !b.end || b.end >= b.date, { message: 'the end must be on or after the start', path: ['end'] }),
  ReportQuery: z.object({ term: term.optional() }),
  Report: z.object({ term: term.optional(), comment: z.string().trim().max(1500), effort: z.number().int().min(1).max(4) }),
  Publish: z.object({ term: term.optional(), published: z.boolean().default(true) }),
};

interface Helpers {
  view: (c: Ctx) => Promise<DemoView>;
  staff: (c: Ctx) => Promise<Staff>;
  classOf: (s: Staff, id: string) => Stream;
  today: (c: Ctx) => string;
  nowMinutes: (d: Date) => number;
  /** class averages and missing work from the gradebook */
  averages: (st: Stream, day: string) => Map<string, { average: number | null; missing: number }>;
}

export function registerLife(api: Api, schools: SchoolStore, h: Helpers) {
  const life = schools.life;
  const S = LifeSchemas;
  const isReal = (orgId: string) => Boolean(schools.org(orgId)?.real);
  const teacherOf = (st: Stream) => schools.teachers.find((t) => t.id === st.teacherId);
  const membersOf = (st: Stream) => (schools.members[st.id] ?? []).map((id) => schools.roster.find((x) => x.id === id)).filter((x): x is RosterStudent => Boolean(x)).sort((a, b) => a.name.localeCompare(b.name));
  const staffName = (s: Staff) => (s.role === 'teacher' ? s.teacher.name : 'School office');
  const schoolAdmin = async (c: Ctx) => { const s = await h.staff(c); if (s.role !== 'school_admin') throw new HTTPException(403, { message: 'school admin role required' }); return s; };
  const notify = (c: Ctx, who: string | null | undefined, n: { kind: NoteKind; title: string; body: string; url: string }) => { if (who) c.get('deps').notify?.notify(who, n); };

  /* ---------- who is asking (students; parents read, and may ask for leave) ---------- */
  async function pupil(c: Ctx, opts: { parentMayWrite?: boolean } = {}): Promise<{ r: RosterStudent; now: Date; by: 'student' | 'parent'; byName: string }> {
    const whoami = c.get('deps').whoami;
    const dev = c.get('deps').config.authMode === 'dev' && !c.req.header('authorization');
    if (opts.parentMayWrite && whoami && !dev) {
      const me = await whoami(c);
      if (me.role === 'parent') {
        const child = me.children.find((x) => x.id === c.req.header('x-child')) ?? me.children[0];
        const r = child ? schools.rosterByApp(child.id) : undefined;
        if (!r) throw new HTTPException(404, { message: 'your child is not linked to a school yet', cause: { code: 'no_school' } });
        return { r, now: c.get('deps').now(), by: 'parent', byName: me.name ?? me.email ?? 'Parent' };
      }
    }
    const v = await h.view(c);
    const r = schools.rosterByApp(v.profile.id);
    if (!r) throw new HTTPException(404, { message: 'this comes with a school licence', cause: { code: 'no_school' } });
    return { r, now: v.now, by: 'student', byName: r.name };
  }

  /* ---------- feelings ---------- */
  const checkInsOf = (r: RosterStudent, today: string): CheckIn[] => {
    const own = life.feelings[r.id] ?? [];
    if (isReal(r.orgId)) return own;
    const days = new Set(own.map((x) => x.date));
    return [...demoFeelings(r, today).filter((x) => !days.has(x.date)), ...own].sort((a, b) => a.at.localeCompare(b.at));
  };
  const promptFor = (r: RosterStudent, today: string) => {
    const mine = streamsOf(schools.school(r.orgId), r.id).map((st) => st.id);
    return mine.flatMap((id) => life.prompts[id] ?? []).filter((p) => p.date === today).sort((a, b) => b.id.localeCompare(a.id))[0] ?? null;
  };
  const weekAverages = (list: CheckIn[], today: string) => Array.from({ length: 6 }, (_, i) => {
    const from = addDays(today, -7 * (6 - i) + 1); const to = addDays(from, 6);
    const xs = list.filter((x) => x.date >= from && x.date <= to);
    return { from, to, average: xs.length ? Math.round((xs.reduce((t, x) => t + x.mood, 0) / xs.length) * 10) / 10 : null, count: xs.length };
  });

  api.route({ method: 'get', path: '/student/feelings', tag: 'life', auth: 'custom', summary: 'My check-ins (only I see my notes), the feelings words, and today\'s question from a teacher' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now);
      const list = checkInsOf(r, today);
      const counts: Record<string, number> = {};
      for (const x of list.filter((x) => x.date >= addDays(today, -30))) for (const w of x.words) counts[w] = (counts[w] ?? 0) + 1;
      let streak = 0;
      for (let d = today, guard = 0; guard < 120; d = addDays(d, -1), guard++) {
        const w = weekday(d); if (w === 0 || w === 6) continue;
        if (list.some((x) => x.date === d)) streak++; else if (d !== today) break;
      }
      const teachers = [...new Map(streamsOf(schools.school(r.orgId), r.id).map((st) => teacherOf(st)).filter(Boolean).map((t) => [t!.id, { id: t!.id, name: t!.name }])).values()];
      return c.json({
        emotions: EMOTIONS, today: list.filter((x) => x.date === today).at(-1) ?? null, history: list.slice(-40).reverse(),
        weeks: weekAverages(list, today), words: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ id, n })),
        streak, prompt: promptFor(r, today), teachers,
      });
    });

  api.route({ method: 'post', path: '/student/feelings', tag: 'life', auth: 'custom', body: S.CheckIn, summary: 'Check in: how I feel (1–5), up to 3 words, a private note; share with my teachers or keep it private' },
    async (c, { body }) => {
      const { r, now } = await pupil(c); const b = body as z.infer<typeof S.CheckIn>; const today = dubaiDate(now);
      const teachers = new Set(streamsOf(schools.school(r.orgId), r.id).map((st) => st.teacherId));
      if (b.talkTo && !teachers.has(b.talkTo)) throw new HTTPException(400, { message: 'pick one of your own teachers' });
      const list = (life.feelings[r.id] ??= []);
      // one check-in a day: checking in again replaces today's
      const at = list.findIndex((x) => x.date === today);
      const entry: CheckIn = { id: at >= 0 ? list[at]!.id : life.id('feel'), studentId: r.id, date: today, at: now.toISOString(), mood: b.mood as CheckIn['mood'], words: [...new Set(b.words)], note: b.note, share: b.talkTo ? 'teacher' : b.share, talkTo: b.talkTo, promptId: promptFor(r, today)?.id ?? null };
      const before = at >= 0 ? list[at]!.talkTo : null;
      if (at >= 0) list[at] = entry; else list.push(entry);
      if (list.length > 400) list.splice(0, list.length - 400);
      if (b.talkTo && b.talkTo !== before) {
        notify(c, b.talkTo, { kind: 'feelings', title: `${r.name} would like to talk`, body: 'They asked for a chat in today\'s check-in. Find a quiet moment today.', url: '/admin/teacher/wellbeing' });
      }
      return c.json(entry, at >= 0 ? 200 : 201);
    });

  api.route({ method: 'delete', path: '/student/feelings/:id', tag: 'life', auth: 'custom', summary: 'Delete one of my check-ins' },
    async (c) => {
      const { r } = await pupil(c);
      const list = life.feelings[r.id] ?? [];
      const i = list.findIndex((x) => x.id === c.req.param('id'));
      if (i < 0) throw new HTTPException(404, { message: 'check-in not found' });
      list.splice(i, 1);
      return c.json({ deleted: true });
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/feelings', tag: 'life', auth: 'custom', query: S.Days, summary: 'How the class feels: mood by day, common words, who to check in with (shared check-ins only; private ones are counted, never shown)' },
    async (c, { query }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const today = h.today(c);
      const days = (query as { days: number }).days; const from = addDays(today, -days + 1);
      const people = membersOf(st).map((m) => ({ m, list: checkInsOf(m, today).filter((x) => x.date >= from) }));
      const all = people.flatMap((p) => p.list);
      const byDay = new Map<string, number[]>();
      for (const x of all) { const d = byDay.get(x.date) ?? [0, 0, 0, 0, 0]; d[x.mood - 1]!++; byDay.set(x.date, d); }
      const words: Record<string, number> = {};
      for (const x of all.filter((x) => x.share === 'teacher')) for (const w of x.words) words[w] = (words[w] ?? 0) + 1;
      // private check-ins only count towards totals once there are enough to stay anonymous
      const shown = all.length >= 5 ? all : all.filter((x) => x.share === 'teacher');
      const dist = [0, 0, 0, 0, 0]; for (const x of shown) dist[x.mood - 1]!++;
      const students = people.map(({ m, list }) => {
        const shared = list.filter((x) => x.share === 'teacher');
        const last = shared.at(-1) ?? null;
        const flag = concern(checkInsOf(m, today), today);
        return {
          id: m.id, name: m.name, initials: initialsOf(m.name), section: m.section, checkIns: list.length,
          last: last ? { date: last.date, mood: last.mood, words: last.words, note: last.note || null, talk: last.talkTo === st.teacherId || (s.role === 'school_admin' && Boolean(last.talkTo)) } : null,
          average: shared.length ? Math.round((shared.reduce((t, x) => t + x.mood, 0) / shared.length) * 10) / 10 : null,
          flag, trend: shared.slice(-10).map((x) => x.mood),
        };
      }).sort((a, b) => Number(Boolean(b.flag)) - Number(Boolean(a.flag)) || (a.average ?? 9) - (b.average ?? 9));
      return c.json({
        days, from, to: today, responses: all.length, students, distribution: dist, emotions: EMOTIONS,
        byDay: [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([d, counts]) => ({ date: d, counts, average: Math.round((counts.reduce((t, n, i) => t + n * (i + 1), 0) / Math.max(1, counts.reduce((t, n) => t + n, 0))) * 10) / 10 })),
        words: Object.entries(words).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id, n]) => ({ id, n })),
        prompts: (life.prompts[st.id] ?? []).slice(-10).reverse(),
      });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/feelings/prompt', tag: 'life', auth: 'custom', body: S.Prompt, summary: 'Ask the class a check-in question today (shown above the check-in)' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!);
      const p = { id: life.id('prm'), streamId: st.id, question: (body as { question: string }).question, date: h.today(c), by: staffName(s) };
      (life.prompts[st.id] ??= []).push(p);
      if (life.prompts[st.id]!.length > 60) life.prompts[st.id]!.shift();
      for (const m of membersOf(st)) notify(c, m.appId, { kind: 'feelings', title: `${st.name}: check-in`, body: p.question, url: '/app/feelings' });
      return c.json(p, 201);
    });

  api.route({ method: 'get', path: '/school/wellbeing', tag: 'life', auth: 'custom', query: S.Days, summary: 'Wellbeing across the school: check-ins by grade, and every student who asked to talk or has been low' },
    async (c, { query }) => {
      const s = await schoolAdmin(c); const today = h.today(c); const from = addDays(today, -(query as { days: number }).days + 1);
      const roster = schools.roster.filter((x) => x.orgId === s.orgId);
      const byGrade = new Map<number, { n: number; sum: number; low: number; students: number }>();
      const flagged: unknown[] = [];
      for (const m of roster) {
        const list = checkInsOf(m, today);
        const recent = list.filter((x) => x.date >= from);
        const g = byGrade.get(m.grade ?? 0) ?? { n: 0, sum: 0, low: 0, students: 0 };
        g.students++; g.n += recent.length; g.sum += recent.reduce((t, x) => t + x.mood, 0); g.low += recent.filter((x) => x.mood <= 2).length;
        byGrade.set(m.grade ?? 0, g);
        const flag = concern(list, today);
        if (flag) {
          const last = list.filter((x) => x.share === 'teacher').at(-1)!;
          flagged.push({ id: m.id, name: m.name, section: m.section, grade: m.grade ?? null, flag, last: { date: last.date, mood: last.mood, words: last.words }, talkTo: last.talkTo ? schools.teachers.find((t) => t.id === last.talkTo)?.name ?? null : null });
        }
      }
      return c.json({
        from, to: today,
        grades: [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, g]) => ({ grade, students: g.students, checkIns: g.n, average: g.n ? Math.round((g.sum / g.n) * 10) / 10 : null, lowShare: g.n ? Math.round((g.low / g.n) * 100) : null })),
        flagged,
      });
    });

  /* ---------- timetable ---------- */
  const lessonsFor = (r: RosterStudent) => {
    const classes = streamsOf(schools.school(r.orgId), r.id);
    const missing = classes.filter((st) => !life.timetable[st.id]);
    const gen = !isReal(r.orgId) && missing.length ? generatedLessons(missing, r.seed ?? r.id) : new Map<string, Lesson[]>();
    return classes.flatMap((st) => (life.timetable[st.id] ?? gen.get(st.id) ?? []).map((l) => ({ ...l, classId: st.id, className: st.name, subject: st.subject, subjectName: SUBJECT_NAMES[st.subject], teacher: teacherOf(st)?.name ?? '' })))
      .sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
  };

  api.route({ method: 'get', path: '/student/timetable', tag: 'life', auth: 'custom', summary: 'My week of lessons, what is on now and next (Dubai time), and any clashes' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now); const mins = h.nowMinutes(now); const wd = weekday(today);
      const lessons = lessonsFor(r);
      const todays = lessons.filter((l) => l.day === wd);
      const current = todays.find((l) => toMin(l.start) <= mins && mins < toMin(l.end)) ?? null;
      const next = todays.find((l) => toMin(l.start) > mins) ?? (() => {
        for (let i = 1; i <= 7; i++) { const d = ((wd + i - 1) % 7) + 1; const first = lessons.find((l) => l.day === d); if (first) return { ...first, nextDay: true }; }
        return null;
      })();
      const clashes = lessons.flatMap((a, i) => lessons.slice(i + 1).filter((b) => b.day === a.day && a.start < b.end && b.start < a.end).map((b) => ({ day: a.day, a: a.className, b: b.className, at: a.start })));
      return c.json({ lessons, today: wd, nowMinutes: mins, current, next, clashes, generated: !isReal(r.orgId) && lessons.length > 0 && streamsOf(schools.school(r.orgId), r.id).some((st) => !life.timetable[st.id]) });
    });

  api.route({ method: 'get', path: '/teacher/classes/:id/timetable', tag: 'life', auth: 'custom', summary: 'When this class meets' },
    async (c) => { const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); return c.json({ lessons: life.timetable[st.id] ?? [], set: Boolean(life.timetable[st.id]) }); });

  api.route({ method: 'put', path: '/teacher/classes/:id/timetable', tag: 'life', auth: 'custom', body: S.Timetable, summary: 'Set when this class meets (day, start, end, room, online lesson link)' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!);
      const lessons = (body as z.infer<typeof S.Timetable>).lessons.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
      for (let i = 1; i < lessons.length; i++) if (lessons[i]!.day === lessons[i - 1]!.day && lessons[i]!.start < lessons[i - 1]!.end) throw new HTTPException(400, { message: 'two lessons of this class overlap' });
      life.timetable[st.id] = lessons;
      return c.json({ lessons, set: true });
    });

  /* ---------- attendance ---------- */
  /** a recorded mark; demo schools fill earlier school days from a fixed seed */
  const markFor = (st: Stream, m: RosterStudent, d: string, today: string): Mark | null => {
    const set = life.attendance[st.id]?.[d]?.[m.id];
    if (set) return set;
    if (isReal(st.orgId) || d >= today) return null;
    const w = weekday(d);
    return w >= 1 && w <= 5 ? demoMark(m, st.id, d) : null;
  };
  const leaveOn = (m: RosterStudent, d: string) => life.leave.find((l) => l.studentId === m.id && l.status === 'approved' && l.from <= d && d <= l.to) ?? null;
  const pastSchoolDays = (today: string, from: string) => { const out: string[] = []; for (let d = today; d >= from && out.length < 120; d = addDays(d, -1)) { const w = weekday(d); if (w >= 1 && w <= 5) out.push(d); } return out; };

  api.route({ method: 'get', path: '/teacher/classes/:id/attendance', tag: 'life', auth: 'custom', query: S.Register, summary: 'The register for a day (default today), approved leave, and each student\'s attendance this term' },
    async (c, { query }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const today = h.today(c);
      const day = (query as { date?: string }).date ?? today;
      const days = pastSchoolDays(today, termStart(today));
      const students = membersOf(st).map((m) => {
        const marks = days.map((d) => markFor(st, m, d, today)).filter((x): x is Mark => Boolean(x));
        const leave = leaveOn(m, day);
        return { id: m.id, name: m.name, initials: initialsOf(m.name), section: m.section, mark: life.attendance[st.id]?.[day]?.[m.id] ?? (leave ? 'excused' : null), leave: leave ? { reason: leave.reason, note: leave.note } : null, rate: attendanceRate(marks), absences: marks.filter((x) => x === 'absent').length, lates: marks.filter((x) => x === 'late').length };
      });
      const taken = Boolean(life.attendance[st.id]?.[day]);
      const rates = students.flatMap((x) => (x.rate === null ? [] : [x.rate]));
      return c.json({ class: { id: st.id, name: st.name }, date: day, today, taken, students, classRate: rates.length ? Math.round((rates.reduce((t, x) => t + x, 0) / rates.length) * 10) / 10 : null });
    });

  api.route({ method: 'put', path: '/teacher/classes/:id/attendance', tag: 'life', auth: 'custom', body: S.Marks, summary: 'Take or correct the register for a day' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const b = body as z.infer<typeof S.Marks>; const today = h.today(c);
      if (b.date > today) throw new HTTPException(400, { message: 'you can only take the register for today or earlier' });
      if (b.date < addDays(today, -60)) throw new HTTPException(400, { message: 'registers older than 60 days are locked' });
      const members = new Set(schools.members[st.id] ?? []);
      const day = (life.attendance[st.id] ??= {})[b.date] ??= {};
      let changed = 0;
      for (const [id, mark] of Object.entries(b.marks)) {
        if (!members.has(id)) continue;
        if (day[id] !== mark) changed++;
        const before = day[id]; day[id] = mark;
        // tell the student (and so their parent's view) when they are marked absent without leave
        if (mark === 'absent' && before !== 'absent' && b.date === today) {
          const m = schools.roster.find((x) => x.id === id);
          if (m && !leaveOn(m, b.date)) notify(c, m.appId, { kind: 'attendance', title: `Marked absent in ${st.name}`, body: 'If you were there or had a reason, tell your teacher or ask for leave in Murshid.', url: '/app/attendance' });
        }
      }
      return c.json({ date: b.date, saved: Object.keys(day).length, changed });
    });

  api.route({ method: 'get', path: '/student/attendance', tag: 'life', auth: 'custom', summary: 'My attendance this term by class, recent absences and lates, and my leave requests' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now);
      const days = pastSchoolDays(today, termStart(today));
      const classes = streamsOf(schools.school(r.orgId), r.id).map((st) => {
        const marks = days.map((d) => ({ d, m: markFor(st, r, d, today) })).filter((x): x is { d: string; m: Mark } => Boolean(x.m));
        return { id: st.id, name: st.name, subjectName: SUBJECT_NAMES[st.subject], rate: attendanceRate(marks.map((x) => x.m)), absent: marks.filter((x) => x.m === 'absent').length, late: marks.filter((x) => x.m === 'late').length, excused: marks.filter((x) => x.m === 'excused').length, recent: marks.filter((x) => x.m !== 'present').slice(0, 6).map((x) => ({ date: x.d, mark: x.m })) };
      });
      const all = classes.flatMap((x) => x.rate === null ? [] : [x.rate]);
      return c.json({
        term: termOf(today), from: termStart(today), rate: all.length ? Math.round((all.reduce((t, x) => t + x, 0) / all.length) * 10) / 10 : null,
        classes, leave: life.leave.filter((l) => l.studentId === r.id).slice(-20).reverse(),
      });
    });

  api.route({ method: 'post', path: '/student/leave', tag: 'life', auth: 'custom', body: S.Leave, summary: 'Ask for leave (a student, or their parent): the school office approves it and registers show it as excused' },
    async (c, { body }) => {
      const { r, now, by, byName } = await pupil(c, { parentMayWrite: true }); const b = body as z.infer<typeof S.Leave>; const today = dubaiDate(now);
      if (b.from < addDays(today, -14)) throw new HTTPException(400, { message: 'leave can be asked for up to 2 weeks after the day' });
      if (b.to > addDays(b.from, 30)) throw new HTTPException(400, { message: 'for more than 30 days, contact the school office' });
      if (life.leave.filter((l) => l.studentId === r.id && l.status === 'pending').length >= 5) throw new HTTPException(429, { message: 'you already have 5 requests waiting: wait for a reply first' });
      const req: LeaveRequest = { id: life.id('lv'), orgId: r.orgId, studentId: r.id, from: b.from, to: b.to, reason: b.reason, note: b.note, by, byName, status: 'pending', decidedBy: null, decidedAt: null, reply: '', at: now.toISOString() };
      life.leave.push(req);
      if (life.leave.length > 5000) life.leave.splice(0, life.leave.length - 5000);
      return c.json(req, 201);
    });

  api.route({ method: 'delete', path: '/student/leave/:id', tag: 'life', auth: 'custom', summary: 'Withdraw a leave request that has not been answered' },
    async (c) => {
      const { r } = await pupil(c, { parentMayWrite: true });
      const i = life.leave.findIndex((l) => l.id === c.req.param('id') && l.studentId === r.id);
      if (i < 0) throw new HTTPException(404, { message: 'request not found' });
      if (life.leave[i]!.status !== 'pending') throw new HTTPException(409, { message: 'this request was already answered' });
      life.leave.splice(i, 1);
      return c.json({ withdrawn: true });
    });

  api.route({ method: 'get', path: '/school/leave', tag: 'life', auth: 'custom', summary: 'Leave requests: waiting first, then the latest answered' },
    async (c) => {
      const s = await schoolAdmin(c);
      const list = life.leave.filter((l) => l.orgId === s.orgId).map((l) => { const m = schools.roster.find((x) => x.id === l.studentId); return { ...l, name: m?.name ?? 'Student', section: m?.section ?? '' }; });
      return c.json({ pending: list.filter((l) => l.status === 'pending'), answered: list.filter((l) => l.status !== 'pending').slice(-40).reverse() });
    });

  api.route({ method: 'post', path: '/school/leave/:id', tag: 'life', auth: 'custom', body: S.Decide, summary: 'Approve or decline a leave request (the student is told)' },
    async (c, { body }) => {
      const s = await schoolAdmin(c); const b = body as z.infer<typeof S.Decide>;
      const l = life.leave.find((x) => x.id === c.req.param('id') && x.orgId === s.orgId);
      if (!l) throw new HTTPException(404, { message: 'request not found' });
      l.status = b.decision; l.reply = b.reply; l.decidedBy = s.actor; l.decidedAt = c.get('deps').now().toISOString();
      const m = schools.roster.find((x) => x.id === l.studentId);
      notify(c, m?.appId, { kind: 'attendance', title: `Leave ${b.decision === 'approved' ? 'approved' : 'declined'}`, body: b.reply || `${l.from}${l.to !== l.from ? ` to ${l.to}` : ''}`, url: '/app/attendance' });
      return c.json(l);
    });

  api.route({ method: 'get', path: '/school/attendance', tag: 'life', auth: 'custom', summary: 'Attendance across the school this term, by class, and today\'s registers still to take' },
    async (c) => {
      const s = await schoolAdmin(c); const today = h.today(c);
      const days = pastSchoolDays(today, termStart(today)).slice(0, 40);
      const classes = schools.streams.filter((st) => st.orgId === s.orgId).map((st) => {
        const marks = membersOf(st).flatMap((m) => days.map((d) => markFor(st, m, d, today)).filter((x): x is Mark => Boolean(x)));
        return { id: st.id, name: st.name, teacher: teacherOf(st)?.name ?? '', rate: attendanceRate(marks), takenToday: Boolean(life.attendance[st.id]?.[today]) };
      }).sort((a, b) => (a.rate ?? 101) - (b.rate ?? 101));
      return c.json({ date: today, classes });
    });

  /* ---------- points ---------- */
  const pointsOf = (m: RosterStudent, today: string): PointAward[] => {
    const own = life.points[m.id] ?? [];
    if (isReal(m.orgId)) return own;
    const demo = streamsOf(schools.school(m.orgId), m.id).flatMap((st) => demoPoints(m, st, teacherOf(st)?.name ?? 'Teacher', today));
    return [...demo, ...own].sort((a, b) => a.at.localeCompare(b.at));
  };

  api.route({ method: 'get', path: '/teacher/classes/:id/points', tag: 'life', auth: 'custom', summary: 'Points in this class: each student\'s total and the latest awards' },
    async (c) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const today = h.today(c); const from = termStart(today);
      const rows = membersOf(st).map((m) => {
        const ps = pointsOf(m, today).filter((p) => p.streamId === st.id && p.at.slice(0, 10) >= from);
        return { id: m.id, name: m.name, initials: initialsOf(m.name), section: m.section, total: ps.reduce((t, p) => t + p.points, 0), positive: ps.filter((p) => p.points > 0).reduce((t, p) => t + p.points, 0), needsWork: ps.filter((p) => p.points < 0).length };
      });
      const recent = membersOf(st).flatMap((m) => pointsOf(m, today).filter((p) => p.streamId === st.id).map((p) => ({ ...p, name: m.name }))).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
      return c.json({ students: rows, recent, reasons: POINT_REASONS.map((id) => ({ id, label: REASON_LABEL[id], positive: !['off_task', 'unprepared', 'late'].includes(id) })), classTotal: rows.reduce((t, r) => t + r.total, 0) });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/points', tag: 'life', auth: 'custom', body: S.Award, summary: 'Give points (or a needs-work note) to one or more students' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const b = body as z.infer<typeof S.Award>;
      const members = new Set(schools.members[st.id] ?? []);
      const ids = [...new Set(b.studentIds)].filter((id) => members.has(id));
      if (!ids.length) throw new HTTPException(400, { message: 'none of those students are in this class' });
      const at = c.get('deps').now().toISOString();
      const out = ids.map((id) => {
        const p: PointAward = { id: life.id('pt'), studentId: id, streamId: st.id, by: s.actor, byName: staffName(s), reason: b.reason, points: b.points, note: b.note, at };
        const list = (life.points[id] ??= []); list.push(p); if (list.length > 500) list.shift();
        if (b.points > 0) notify(c, schools.roster.find((x) => x.id === id)?.appId, { kind: 'points', title: `+${b.points} for ${REASON_LABEL[b.reason].toLowerCase()}`, body: `${staffName(s)} · ${st.name}${b.note ? `: ${b.note}` : ''}`, url: '/app/points' });
        return p;
      });
      return c.json({ awarded: out }, 201);
    });

  api.route({ method: 'delete', path: '/teacher/points/:id', tag: 'life', auth: 'custom', summary: 'Undo points you gave' },
    async (c) => {
      const s = await h.staff(c);
      for (const list of Object.values(life.points)) {
        const i = list.findIndex((p) => p.id === c.req.param('id'));
        if (i < 0) continue;
        h.classOf(s, list[i]!.streamId); // only the class's own teacher (or the school admin)
        list.splice(i, 1);
        return c.json({ deleted: true });
      }
      throw new HTTPException(404, { message: 'award not found' });
    });

  api.route({ method: 'get', path: '/student/points', tag: 'life', auth: 'custom', summary: 'My points this term: total, by reason and by class, and the latest' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now); const from = termStart(today);
      const list = pointsOf(r, today).filter((p) => p.at.slice(0, 10) >= from);
      const byReason: Record<string, number> = {}; const byClass: Record<string, number> = {};
      for (const p of list) { byReason[p.reason] = (byReason[p.reason] ?? 0) + p.points; byClass[p.streamId] = (byClass[p.streamId] ?? 0) + p.points; }
      const week = list.filter((p) => p.at.slice(0, 10) >= addDays(today, -6)).reduce((t, p) => t + p.points, 0);
      return c.json({
        term: termOf(today), total: list.reduce((t, p) => t + p.points, 0), week,
        byReason: Object.entries(byReason).sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, label: REASON_LABEL[id as keyof typeof REASON_LABEL], n })),
        byClass: streamsOf(schools.school(r.orgId), r.id).map((st) => ({ id: st.id, name: st.name, subjectName: SUBJECT_NAMES[st.subject], n: byClass[st.id] ?? 0 })).sort((a, b) => b.n - a.n),
        recent: list.slice(-20).reverse().map((p) => ({ ...p, label: REASON_LABEL[p.reason], className: schools.streams.find((x) => x.id === p.streamId)?.name ?? '' })),
      });
    });

  /* ---------- polls and exit tickets ---------- */
  const pollCard = (p: Poll, withNames: boolean) => {
    const answers = Object.entries(p.answers);
    const options = p.kind === 'confidence' ? CONFIDENCE : p.options;
    const counts = options.map((_, i) => answers.filter(([, a]) => a.choice === i).length);
    return {
      id: p.id, streamId: p.streamId, kind: p.kind, question: p.question, options, anonymous: p.anonymous, open: p.open, at: p.at, closedAt: p.closedAt,
      responses: answers.length, counts,
      texts: answers.filter(([, a]) => a.text).map(([id, a]) => ({ text: a.text, at: a.at, name: withNames && !p.anonymous ? schools.roster.find((x) => x.id === id)?.name ?? null : null, choice: a.choice })),
    };
  };

  api.route({ method: 'get', path: '/teacher/classes/:id/polls', tag: 'life', auth: 'custom', summary: 'Polls, confidence checks and exit tickets for this class, with results' },
    async (c) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!);
      const members = membersOf(st);
      return c.json({ polls: life.polls.filter((p) => p.streamId === st.id).slice(-30).reverse().map((p) => ({ ...pollCard(p, true), waiting: p.anonymous ? null : members.filter((m) => !p.answers[m.id]).map((m) => m.name) })), students: members.length, confidence: CONFIDENCE });
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/polls', tag: 'life', auth: 'custom', body: S.Poll, summary: 'Ask the class: a multiple-choice poll, a confidence check, or an exit ticket (a short written answer)' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const b = body as z.infer<typeof S.Poll>;
      const p: Poll = { id: life.id('poll'), streamId: st.id, kind: b.kind, question: b.question, options: b.kind === 'choice' ? b.options : [], anonymous: b.anonymous, open: true, at: c.get('deps').now().toISOString(), closedAt: null, by: s.actor, answers: {} };
      life.polls.push(p);
      if (life.polls.length > 3000) life.polls.splice(0, life.polls.length - 3000);
      for (const m of membersOf(st)) notify(c, m.appId, { kind: 'announcement', title: `${st.name}: ${b.kind === 'exit' ? 'exit ticket' : 'quick question'}`, body: b.question, url: '/app/polls' });
      return c.json(pollCard(p, true), 201);
    });

  api.route({ method: 'post', path: '/teacher/polls/:id/close', tag: 'life', auth: 'custom', summary: 'Close a poll (no more answers)' },
    async (c) => {
      const s = await h.staff(c);
      const p = life.polls.find((x) => x.id === c.req.param('id'));
      if (!p) throw new HTTPException(404, { message: 'poll not found' });
      h.classOf(s, p.streamId);
      p.open = false; p.closedAt = c.get('deps').now().toISOString();
      return c.json(pollCard(p, true));
    });

  api.route({ method: 'get', path: '/student/polls', tag: 'life', auth: 'custom', summary: 'Questions from my teachers: open ones first, with my answer' },
    async (c) => {
      const { r } = await pupil(c);
      const mine = new Map(streamsOf(schools.school(r.orgId), r.id).map((st) => [st.id, st]));
      const list = life.polls.filter((p) => mine.has(p.streamId)).slice(-30).reverse().map((p) => {
        const card = pollCard(p, false);
        const mineAns = p.answers[r.id] ?? null;
        // results show once you have answered or the poll is closed; written answers stay with the teacher
        const seeResults = Boolean(mineAns) || !p.open;
        return { ...card, texts: [], counts: seeResults && p.kind !== 'exit' ? card.counts : null, className: mine.get(p.streamId)!.name, mine: mineAns };
      });
      return c.json({ polls: list.sort((a, b) => Number(b.open && !b.mine) - Number(a.open && !a.mine)) });
    });

  api.route({ method: 'post', path: '/student/polls/:id/answer', tag: 'life', auth: 'custom', body: S.Answer, summary: 'Answer a poll or exit ticket (answering again changes it while it is open)' },
    async (c, { body }) => {
      const { r, now } = await pupil(c); const b = body as z.infer<typeof S.Answer>;
      const p = life.polls.find((x) => x.id === c.req.param('id'));
      if (!p || !(schools.members[p.streamId] ?? []).includes(r.id)) throw new HTTPException(404, { message: 'poll not found' });
      if (!p.open) throw new HTTPException(409, { message: 'this poll has closed' });
      const n = p.kind === 'confidence' ? CONFIDENCE.length : p.options.length;
      if (p.kind !== 'exit' && (b.choice === null || b.choice >= n)) throw new HTTPException(400, { message: 'pick one of the options' });
      if (p.kind === 'exit' && !b.text) throw new HTTPException(400, { message: 'write your answer' });
      p.answers[r.id] = { choice: p.kind === 'exit' ? null : b.choice, text: b.text, at: now.toISOString() };
      return c.json({ ...pollCard(p, false), texts: [], mine: p.answers[r.id] });
    });

  /* ---------- events ---------- */
  const eventsOf = (orgId: string, today: string): SchoolEvent[] => [...(isReal(orgId) ? [] : demoEvents(orgId, today)), ...life.events.filter((e) => e.orgId === orgId)].sort((a, b) => a.date.localeCompare(b.date));

  api.route({ method: 'get', path: '/student/events', tag: 'life', auth: 'custom', summary: 'School dates for me: holidays, exams, trips, sport and meetings (this school year)' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now);
      const list = eventsOf(r.orgId, today).filter((e) => !e.grades.length || (r.grade !== undefined && e.grades.includes(r.grade)));
      return c.json({ today, upcoming: list.filter((e) => e.end >= today).slice(0, 30), past: list.filter((e) => e.end < today).slice(-10).reverse() });
    });

  api.route({ method: 'get', path: '/school/events', tag: 'life', auth: 'custom', summary: 'Every school date' },
    async (c) => { const s = await h.staff(c); const today = h.today(c); return c.json({ events: eventsOf(s.orgId, today).map((e) => ({ ...e, editable: !e.id.startsWith('demo-') })) }); });

  api.route({ method: 'post', path: '/school/events', tag: 'life', auth: 'custom', body: S.Event, summary: 'Add a school date (students and parents see it; an exam or holiday also blocks study plans)' },
    async (c, { body }) => {
      const s = await schoolAdmin(c); const b = body as z.infer<typeof S.Event>;
      const e: SchoolEvent = { id: life.id('ev'), orgId: s.orgId, title: b.title, date: b.date, end: b.end ?? b.date, kind: b.kind, grades: b.grades, note: b.note, by: s.actor };
      life.events.push(e);
      return c.json(e, 201);
    });

  api.route({ method: 'delete', path: '/school/events/:id', tag: 'life', auth: 'custom', summary: 'Remove a school date' },
    async (c) => {
      const s = await schoolAdmin(c);
      const i = life.events.findIndex((e) => e.id === c.req.param('id') && e.orgId === s.orgId);
      if (i < 0) throw new HTTPException(404, { message: 'event not found' });
      life.events.splice(i, 1);
      return c.json({ deleted: true });
    });

  /* ---------- term reports ---------- */
  const termOfQuery = (c: Ctx, t?: Term) => t ?? termOf(h.today(c));

  api.route({ method: 'get', path: '/teacher/classes/:id/reports', tag: 'life', auth: 'custom', query: S.ReportQuery, summary: 'Term report for each student: average, attendance, points, missing work, your comment, and suggested comments' },
    async (c, { query }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const today = h.today(c); const t = termOfQuery(c, (query as { term?: Term }).term);
      const avg = h.averages(st, today); const from = termStart(today); const days = pastSchoolDays(today, from);
      const saved = life.reports[st.id]?.[t] ?? {};
      const rows = membersOf(st).map((m) => {
        const a = avg.get(m.id) ?? { average: null, missing: 0 };
        const attendance = attendanceRate(days.map((d) => markFor(st, m, d, today)).filter((x): x is Mark => Boolean(x)));
        const points = pointsOf(m, today).filter((p) => p.streamId === st.id && p.at.slice(0, 10) >= from).reduce((tt, p) => tt + p.points, 0);
        return { id: m.id, name: m.name, section: m.section, average: a.average, missing: a.missing, attendance, points, report: saved[m.id] ?? null, suggestions: commentBank(m.name, SUBJECT_NAMES[st.subject], { average: a.average, attendance, points, missing: a.missing }) };
      });
      return c.json({ class: { id: st.id, name: st.name, subjectName: SUBJECT_NAMES[st.subject] }, term: t, published: (life.published[st.id] ?? []).includes(t), done: rows.filter((r) => r.report?.comment).length, rows, effort: EFFORT });
    });

  api.route({ method: 'put', path: '/teacher/classes/:id/reports/:studentId', tag: 'life', auth: 'custom', body: S.Report, summary: 'Save a student\'s term comment and effort grade' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const b = body as z.infer<typeof S.Report>; const t = termOfQuery(c, b.term);
      const sid = c.req.param('studentId')!;
      if (!(schools.members[st.id] ?? []).includes(sid)) throw new HTTPException(404, { message: 'student not found in this class' });
      const entry = { comment: b.comment, effort: b.effort as 1 | 2 | 3 | 4, updatedAt: c.get('deps').now().toISOString(), by: staffName(s) };
      ((life.reports[st.id] ??= {})[t] ??= {})[sid] = entry;
      return c.json(entry);
    });

  api.route({ method: 'post', path: '/teacher/classes/:id/reports/publish', tag: 'life', auth: 'custom', body: S.Publish, summary: 'Show this term\'s reports to students and parents (or hide them again)' },
    async (c, { body }) => {
      const s = await h.staff(c); const st = h.classOf(s, c.req.param('id')!); const b = body as z.infer<typeof S.Publish>; const t = termOfQuery(c, b.term);
      const set = new Set(life.published[st.id] ?? []);
      const was = set.has(t);
      if (b.published) set.add(t); else set.delete(t);
      life.published[st.id] = [...set];
      if (b.published && !was) for (const m of membersOf(st)) if (life.reports[st.id]?.[t]?.[m.id]) notify(c, m.appId, { kind: 'report', title: `${st.name}: your ${t.replace('T', 'Term ')} report`, body: 'Your teacher\'s comment is ready.', url: '/app/reports' });
      return c.json({ term: t, published: b.published });
    });

  api.route({ method: 'get', path: '/student/reports', tag: 'life', auth: 'custom', summary: 'My published term reports: each subject\'s comment, effort, average and attendance' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now); const from = termStart(today); const days = pastSchoolDays(today, from);
      const terms = (['T1', 'T2', 'T3'] as Term[]).map((t) => ({
        term: t,
        subjects: streamsOf(schools.school(r.orgId), r.id).flatMap((st) => {
          const e = (life.published[st.id] ?? []).includes(t) ? life.reports[st.id]?.[t]?.[r.id] : undefined;
          if (!e) return [];
          const a = h.averages(st, today).get(r.id);
          return [{ classId: st.id, className: st.name, subjectName: SUBJECT_NAMES[st.subject], teacher: e.by, comment: e.comment, effort: e.effort, effortLabel: EFFORT[e.effort], average: t === termOf(today) ? a?.average ?? null : null, attendance: t === termOf(today) ? attendanceRate(days.map((d) => markFor(st, r, d, today)).filter((x): x is Mark => Boolean(x))) : null, updatedAt: e.updatedAt }];
        }),
      })).filter((x) => x.subjects.length);
      return c.json({ student: { name: r.name, section: r.section, grade: r.grade ?? null, school: schools.org(r.orgId)?.name ?? '' }, current: termOf(today), terms });
    });

  /* ---------- one call for Home ---------- */
  api.route({ method: 'get', path: '/student/today-at-school', tag: 'life', auth: 'custom', summary: 'For Home: today\'s check-in, the lesson now and next, open questions from teachers, points this week, the next school date' },
    async (c) => {
      const { r, now } = await pupil(c); const today = dubaiDate(now); const mins = h.nowMinutes(now); const wd = weekday(today);
      const lessons = lessonsFor(r).filter((l) => l.day === wd);
      const current = lessons.find((l) => toMin(l.start) <= mins && mins < toMin(l.end)) ?? null;
      const next = lessons.find((l) => toMin(l.start) > mins) ?? null;
      const mine = new Set(streamsOf(schools.school(r.orgId), r.id).map((st) => st.id));
      const polls = life.polls.filter((p) => mine.has(p.streamId) && p.open && !p.answers[r.id]).length;
      const week = pointsOf(r, today).filter((p) => p.at.slice(0, 10) >= addDays(today, -6)).reduce((t, p) => t + p.points, 0);
      const ev = eventsOf(r.orgId, today).find((e) => e.end >= today && (!e.grades.length || (r.grade !== undefined && e.grades.includes(r.grade)))) ?? null;
      const checkIn = (life.feelings[r.id] ?? []).find((x) => x.date === today) ?? null;
      return c.json({ date: today, checkedIn: Boolean(checkIn), mood: checkIn?.mood ?? null, prompt: promptFor(r, today), current, next, lessonsLeft: lessons.filter((l) => toMin(l.end) > mins).length, polls, pointsWeek: week, event: ev });
    });
}
