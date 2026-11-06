/**
 * The class picture behind the teacher portal: every roster student's work across ALL their subjects
 * (homework, submissions, grades), tests, sport and events, and the rule-based analysis built on it:
 *
 *   - class progress report (completion, overdue, remaining, at-risk flags)
 *   - delegation recommendations (support / lighter deadline / core / extension, peer pairs, mixed groups)
 *   - homework timing (on-time likelihood for every set-day x due-day option, the best one, a day-by-day load chart)
 *   - weekly reports each student "submits" automatically (Friday 16:00 Dubai), rolled up for the teacher
 *
 * Everything is deterministic (seeded by ids and the week) and explainable: every number comes with the rule
 * that produced it. No model calls.
 */
import { addDays, weekday } from '../lib/time';
import { clamp, dayDiff, mondayOfDate, rng, round } from '../v1/data';
import { CALENDAR, SUBJECT_NAMES, type RosterStudent, type Stream, type SubjectId, type Teacher } from './catalog';

// ---------- dates ----------
export const isSchoolDay = (d: string) => { const w = weekday(d); return w >= 1 && w <= 5; };
export function addSchoolDays(d: string, n: number): string {
  let x = d;
  let left = n;
  while (left > 0) { x = addDays(x, 1); if (isSchoolDay(x)) left--; }
  return x;
}
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOW_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDay = (d: string) => `${DOW[weekday(d)]} ${Number(d.slice(8, 10))} ${MON[Number(d.slice(5, 7)) - 1]}`;
export const dayName = (d: string) => DOW_LONG[weekday(d)]!;
/** Capacity for schoolwork + commitments after school (minutes). */
export const capacity = (d: string) => (isSchoolDay(d) ? 240 : 330);

// ---------- work items ----------
export interface WorkItem {
  id: string;
  streamId: string;
  subject: SubjectId;
  teacherId: string;
  title: string;
  instructions: string | null;
  setDate: string;
  dueDate: string;
  dueTime: string;
  minutes: number;
  source: 'portal' | 'teams';
  /** posted by a teacher in this session (not generated) */
  posted: boolean;
  createdAt?: string;
  /** how the work is handed in: a written task (default), a short form built in Murshid, or a Google / Microsoft form */
  format?: AssignmentFormat;
  formUrl?: string | null;
  questions?: FormQuestion[];
  /** personalised work: only these students get it (null/absent = the whole class) */
  assignees?: string[] | null;
  /** files the teacher attached (slides, PDFs, worksheets, images) and links */
  attachments?: import('./classroom').FileRef[];
  links?: import('./classroom').LinkRef[];
  /** hand-in must include at least one photo (e.g. "copy the slides into your notebook and send photos") */
  photosRequired?: boolean;
  /** optional marking rubric; the grade is the share of points */
  rubric?: import('./classroom').RubricCriterion[];
}

/** Whether a student gets an item: everyone in the class, unless it was set for chosen students only. */
export const assignedTo = (item: WorkItem, studentId: string) => !item.assignees || item.assignees.includes(studentId);
export type AssignmentFormat = 'task' | 'form' | 'google_form' | 'microsoft_form';
export interface FormQuestion { id: string; type: 'short' | 'long' | 'choice'; prompt: string; options?: string[]; required: boolean }
export interface FormResponse { answers: Record<string, string>; submittedAt: string; updatedAt: string }
export type SubStatus = 'on_time' | 'late' | 'missing' | 'submitted' | 'pending' | 'not_set';
export interface Submission { status: SubStatus; grade: number | null; submittedOn: string | null }

const TITLES: Partial<Record<SubjectId, string[]>> = {
  english: ['Close reading: "The Portrait of a Lady" (Khushwant Singh)', 'Note-making practice: unseen passage', 'Formal letter: complaint to a civic authority', 'Poem analysis: "A Photograph"', 'Debate speech draft (300 words)', 'Notice and poster writing', 'Summary: "We\u2019re Not Afraid to Die"', 'Article writing: screen time and sleep'],
  maths: ['Sets and functions: exercise 2.3', 'Trigonometric identities worksheet', 'Sequences and series problem set', 'Straight lines: past paper questions', 'Permutations and combinations drill', 'Limits: first principles practice', 'Complex numbers worksheet', 'Statistics: variance and SD set'],
  physics: ['Kinematics numericals (ch. 3)', 'Newton\u2019s laws problem sheet', 'Work, energy and power worksheet', 'Lab write-up: simple pendulum'],
  chemistry: ['Mole concept worksheet', 'Atomic structure questions', 'Periodic trends summary', 'Lab report: titration'],
  biology: ['Cell structure diagrams', 'Biomolecules notes', 'Plant kingdom classification table', 'Practical record: osmosis'],
  economics: ['Statistics for economics: data presentation', 'Demand and elasticity questions', 'Case study: UAE fuel prices', 'Consumer equilibrium worksheet'],
  business: ['Case study: a Dubai family business', 'Forms of business organisation notes', 'Business services worksheet', 'Social responsibility essay'],
  cs: ['Python lists practice', 'Flowcharts and pseudocode set', 'Number systems worksheet', 'Mini project: grade calculator'],
};

export interface School {
  roster: RosterStudent[];
  streams: Stream[];
  members: Record<string, string[]>;
  teachers: Teacher[];
  posted: WorkItem[];
  teamsConnected: boolean;
  /** a real school (not the demo): only what teachers post exists, nothing is generated */
  real?: boolean;
}

export function streamsOf(school: School, studentId: string): Stream[] {
  return school.streams.filter((s) => school.members[s.id]?.includes(studentId));
}

/** Generated homework for a stream around today (3 weeks back, 2 weeks ahead) plus anything a teacher posted. */
export function streamItems(school: School, stream: Stream, today: string): WorkItem[] {
  const out: WorkItem[] = [];
  const mon = mondayOfDate(today);
  const titles = TITLES[stream.subject] ?? ['Class work'];
  for (let d = addDays(mon, -21); !school.real && d <= addDays(mon, 13); d = addDays(d, 1)) {
    if (!stream.setDays.includes(weekday(d))) continue;
    const n = Math.round(dayDiff('2026-01-05', d) / 7) * stream.setDays.length + stream.setDays.indexOf(weekday(d));
    out.push({
      id: `${stream.id}-${d}`, streamId: stream.id, subject: stream.subject, teacherId: stream.teacherId,
      title: titles[((n % titles.length) + titles.length) % titles.length]!, instructions: null,
      setDate: d, dueDate: addSchoolDays(d, 2), dueTime: '08:00', minutes: stream.minutes,
      source: school.teamsConnected ? 'teams' : 'portal', posted: false,
    });
  }
  for (const p of school.posted) if (p.streamId === stream.id) out.push(p);
  return out.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}

/** Deterministic submission outcome for one student and one item, as of `today`. */
export function submission(st: RosterStudent, item: WorkItem, today: string): Submission {
  if (item.setDate > today) return { status: 'not_set', grade: null, submittedOn: null };
  const r = rng(`${st.seed ?? st.id}|${item.id}`);
  const a = r(); const b = r(); const g = r();
  const grade = (late: boolean) => clamp(Math.round(100 * (st.ability * 0.8 + 0.15) + (g - 0.5) * 14 - (late ? 6 : 0)), 35, 99);
  // work posted in Murshid: only real hand-ins count (they are recorded separately), so nothing is invented here
  if (item.posted) return item.dueDate < today ? { status: 'missing', grade: null, submittedOn: null } : { status: 'pending', grade: null, submittedOn: null };
  if (item.dueDate < today) {
    const onTime = Math.min(0.98, st.diligence * 0.97 + 0.03);
    if (a < onTime) return { status: 'on_time', grade: grade(false), submittedOn: addDays(item.dueDate, -1) };
    // older misses are usually caught up late
    const age = dayDiff(item.dueDate, today);
    if (a < onTime + 0.1 || (age > 4 && b < 0.8)) return { status: 'late', grade: grade(true), submittedOn: addDays(item.dueDate, Math.min(age, 1 + Math.floor(b * 3))) };
    return { status: 'missing', grade: null, submittedOn: null };
  }
  // open: some diligent students hand in early
  const span = Math.max(1, dayDiff(item.setDate, item.dueDate));
  const elapsed = dayDiff(item.setDate, today);
  if (!item.posted && a < st.diligence * 0.45 * (elapsed / span)) return { status: 'submitted', grade: grade(false), submittedOn: today };
  return { status: 'pending', grade: null, submittedOn: null };
}

// ---------- tests, events, load ----------
export interface DatedItem { date: string; title: string; kind: 'test' | 'event'; subject?: SubjectId; minutes: number; allStudents?: boolean }

export function calendarFor(st: RosterStudent, today: string): DatedItem[] {
  if (st.real) return []; // real students: tests come from their teachers and the school calendar, not the demo list
  const mon = mondayOfDate(today);
  // Grade 11 takes English, maths and electives; Grade 10 English and maths; Grade 12 (in this demo) English only
  const core: SubjectId[] = (st.grade ?? 11) === 12 ? ['english'] : ['english', 'maths'];
  const subs = new Set<SubjectId>([...core, ...st.electives]);
  return CALENDAR.filter((c) => (c.kind === 'test' ? subs.has(c.subject!) : c.allStudents || st.events.includes(c.eventTag ?? '')))
    .map((c) => ({ date: addDays(mon, c.weekOffset * 7 + c.weekday - 1), title: c.title, kind: c.kind, subject: c.subject, minutes: c.minutes, allStudents: c.allStudents }))
    .sort((x, y) => x.date.localeCompare(y.date));
}

export interface StudentWork {
  student: RosterStudent;
  items: { item: WorkItem; sub: Submission; subjectName: string; teacherName: string }[];
  calendar: DatedItem[];
}

/** `anchor` = the real today: tests and events stay on their dates when looking back at an earlier week. */
export function studentWork(school: School, st: RosterStudent, today: string, anchor = today): StudentWork {
  const items: StudentWork['items'] = [];
  for (const s of streamsOf(school, st.id)) {
    const t = school.teachers.find((x) => x.id === s.teacherId);
    for (const it of streamItems(school, s, today)) if (assignedTo(it, st.id)) items.push({ item: it, sub: submission(st, it, today), subjectName: SUBJECT_NAMES[s.subject], teacherName: t?.name ?? '' });
  }
  return { student: st, items, calendar: calendarFor(st, anchor) };
}

/** Minutes of commitments per date (homework spread over its window, test revision, sport, events). */
export function loadByDay(w: StudentWork, today: string, days: number, exclude?: (it: WorkItem) => boolean): Record<string, { minutes: number; tests: string[]; events: string[] }> {
  const out: Record<string, { minutes: number; tests: string[]; events: string[] }> = {};
  for (let i = 0; i < days; i++) out[addDays(today, i)] = { minutes: 0, tests: [], events: [] };
  const add = (d: string, m: number) => { const o = out[d]; if (o) o.minutes += m; };
  for (const { item, sub } of w.items) {
    if (exclude?.(item)) continue;
    if (sub.status === 'missing') { for (let i = 0; i < 3; i++) add(addDays(today, i), item.minutes / 3); continue; }
    if (sub.status !== 'pending' && sub.status !== 'not_set') continue;
    const from = item.setDate > today ? item.setDate : today;
    const span: string[] = [];
    for (let d = from; d < item.dueDate; d = addDays(d, 1)) span.push(d);
    if (!span.length) span.push(from);
    for (const d of span) add(d, item.minutes / span.length);
  }
  for (const c of w.calendar) {
    if (c.kind === 'test') {
      add(addDays(c.date, -1), 60); add(addDays(c.date, -2), 45); add(c.date, 30);
      out[c.date]?.tests.push(c.title);
    } else {
      add(c.date, c.minutes);
      out[c.date]?.events.push(c.title);
    }
  }
  for (const a of w.student.activities) for (const d of Object.keys(out)) if (a.days.includes(weekday(d))) add(d, a.minutes);
  for (const v of Object.values(out)) v.minutes = Math.round(v.minutes);
  return out;
}

// ---------- class progress report ----------
export type Status = 'ahead' | 'on_track' | 'watch' | 'at_risk';
export interface ProgressRow {
  id: string; name: string; section: string; appId: string | null; initials: string;
  status: Status; statusLabel: string; flags: string[];
  subject: { assigned: number; submitted: number; onTime: number; late: number; overdue: number; pending: number; completion: number; avgGrade: number | null; remaining: { title: string; dueDate: string; status: SubStatus }[] };
  all: { overdue: number; openNext7: number; testsNext7: { date: string; title: string }[]; eventsNext7: { date: string; title: string }[]; activityHoursNext7: number; loadPct: number };
}

const STATUS_LABEL: Record<Status, string> = { ahead: 'Ahead', on_track: 'On track', watch: 'Keep an eye', at_risk: 'At risk' };
export const initialsOf = (n: string) => n.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();

export function progressRow(school: School, stream: Stream, st: RosterStudent, today: string): ProgressRow {
  const w = studentWork(school, st, today);
  const mine = w.items.filter((x) => x.item.streamId === stream.id && x.sub.status !== 'not_set');
  const count = (s: SubStatus) => mine.filter((x) => x.sub.status === s).length;
  const onTime = count('on_time'); const late = count('late'); const overdue = count('missing'); const early = count('submitted'); const pending = count('pending');
  const submitted = onTime + late + early;
  const denom = onTime + late + overdue + early;
  const completion = denom ? Math.round((submitted / denom) * 100) : 100;
  const grades = mine.map((x) => x.sub.grade).filter((g): g is number => g !== null);
  const avgGrade = grades.length ? round(grades.reduce((t, g) => t + g, 0) / grades.length, 0) : null;
  const until = addDays(today, 7);
  const allOverdue = w.items.filter((x) => x.sub.status === 'missing').length;
  const openNext7 = w.items.filter((x) => (x.sub.status === 'pending' || x.sub.status === 'missing') && x.item.dueDate <= until).length;
  const testsNext7 = w.calendar.filter((c) => c.kind === 'test' && c.date >= today && c.date <= until).map((c) => ({ date: c.date, title: c.title }));
  const eventsNext7 = w.calendar.filter((c) => c.kind === 'event' && c.date >= today && c.date <= until).map((c) => ({ date: c.date, title: c.title }));
  const load = loadByDay(w, today, 7);
  const used = Object.values(load).reduce((t, v) => t + v.minutes, 0);
  const cap = Object.keys(load).reduce((t, d) => t + capacity(d), 0);
  const loadPct = Math.round((used / cap) * 100);
  let actMin = eventsNext7.reduce((t, e) => t + (w.calendar.find((c) => c.title === e.title && c.date === e.date)?.minutes ?? 0), 0);
  for (const a of st.activities) for (const d of Object.keys(load)) if (a.days.includes(weekday(d))) actMin += a.minutes;

  const flags: string[] = [];
  const subj = SUBJECT_NAMES[stream.subject];
  if (overdue) flags.push(`${overdue} overdue ${subj} task${overdue > 1 ? 's' : ''}`);
  if (allOverdue - overdue > 0) flags.push(`${allOverdue - overdue} overdue in other subjects`);
  if (completion < 85) flags.push(`${completion}% of ${subj} work handed in`);
  if (avgGrade !== null && avgGrade < 60) flags.push(`${subj} average ${avgGrade}%`);
  if (testsNext7.length >= 3) flags.push(`${testsNext7.length} tests in the next 7 days`);
  const ownEvents = eventsNext7.filter((e) => !w.calendar.find((c) => c.title === e.title && c.date === e.date)?.allStudents);
  if (ownEvents.length) flags.push(ownEvents.map((e) => `${e.title.replace(/ \(.*\)$/, '')} ${DOW[weekday(e.date)]}`).join(' + '));
  if (loadPct >= 85) flags.push(`Week is ${loadPct}% full`);

  let status: Status = 'on_track';
  if (overdue >= 2 || completion < 70 || (avgGrade !== null && avgGrade < 55) || allOverdue >= 4) status = 'at_risk';
  else if (overdue === 1 || completion < 85 || loadPct >= 85) status = 'watch';
  else if (completion >= 95 && (avgGrade ?? 0) >= 85 && loadPct < 70) status = 'ahead';

  return {
    id: st.id, name: st.name, section: st.section, appId: st.appId, initials: initialsOf(st.name), status, statusLabel: STATUS_LABEL[status], flags,
    subject: {
      assigned: mine.length, submitted, onTime, late, overdue, pending, completion, avgGrade,
      remaining: mine.filter((x) => x.sub.status === 'pending' || x.sub.status === 'missing').map((x) => ({ title: x.item.title, dueDate: x.item.dueDate, status: x.sub.status })),
    },
    all: { overdue: allOverdue, openNext7, testsNext7, eventsNext7, activityHoursNext7: round(actMin / 60, 1), loadPct },
  };
}

export function classReport(school: School, stream: Stream, today: string) {
  const rows = (school.members[stream.id] ?? []).map((id) => school.roster.find((s) => s.id === id)!).map((st) => progressRow(school, stream, st, today));
  const order: Record<Status, number> = { at_risk: 0, watch: 1, on_track: 2, ahead: 3 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.subject.completion - b.subject.completion || a.name.localeCompare(b.name));
  const by = (s: Status) => rows.filter((r) => r.status === s).length;
  const avg = (f: (r: ProgressRow) => number | null) => { const v = rows.map(f).filter((x): x is number => x !== null); return v.length ? round(v.reduce((t, x) => t + x, 0) / v.length, 0) : null; };
  return {
    today,
    summary: {
      students: rows.length, ahead: by('ahead'), onTrack: by('on_track'), watch: by('watch'), atRisk: by('at_risk'),
      avgCompletion: avg((r) => r.subject.completion), avgGrade: avg((r) => r.subject.avgGrade),
      overdue: rows.reduce((t, r) => t + r.subject.overdue, 0), heavyWeek: rows.filter((r) => r.all.loadPct >= 85).length,
    },
    rules: [
      'At risk: 2+ overdue tasks in this subject, under 70% handed in, average under 55%, or 4+ overdue across all subjects.',
      'Keep an eye: 1 overdue task, under 85% handed in, or a week that is 85%+ full (homework, revision, sport, events vs time after school).',
      'Ahead: 95%+ handed in, average 85%+, and a week under 70% full.',
    ],
    students: rows,
  };
}

// ---------- delegation ----------
const EXTENSION: Partial<Record<SubjectId, string>> = {
  english: 'Extension: compare the text with a second author and write a 400-word critical response',
  maths: 'Extension: two olympiad-style problems on the same topic',
  physics: 'Extension: derive the result and design a quick experiment to test it',
  chemistry: 'Extension: explain one anomaly in the trend with evidence',
  biology: 'Extension: link the topic to a current UAE health story',
  economics: 'Extension: apply the model to UAE data and evaluate',
  business: 'Extension: add a SWOT and a recommendation for the owner',
  cs: 'Extension: add input validation and tests',
};

export function delegation(school: School, stream: Stream, today: string) {
  const report = classReport(school, stream, today);
  const rows = report.students;
  const why = (r: ProgressRow, n = 2) => r.flags.slice(0, n).join('; ') || `${r.subject.completion}% handed in${r.subject.avgGrade !== null ? `, average ${r.subject.avgGrade}%` : ''}`;
  const support = rows.filter((r) => r.status === 'at_risk');
  const lighten = rows.filter((r) => r.status === 'watch' && r.subject.overdue === 0 && r.subject.completion >= 85 && (r.all.loadPct >= 85 || r.all.testsNext7.length >= 2 || r.all.eventsNext7.length > 0));
  const extension = rows.filter((r) => r.status === 'ahead');
  const used = new Set([...support, ...lighten, ...extension].map((r) => r.id));
  const core = rows.filter((r) => !used.has(r.id));
  const groups = [
    { id: 'support', title: 'Needs support', action: 'Check in this week, give the scaffolded version (core questions only) and agree a catch-up date.', students: support.map((r) => ({ id: r.id, name: r.name, reason: why(r) })) },
    { id: 'lighten', title: 'Same task, more time', action: 'Keep the task, move their due date by 2 school days. Their work is up to date; this week is the problem.', students: lighten.map((r) => ({ id: r.id, name: r.name, reason: why(r) })) },
    { id: 'core', title: 'Core task', action: 'Standard task and due date.', students: core.map((r) => ({ id: r.id, name: r.name, reason: why(r, 1) })) },
    { id: 'extension', title: 'Ready for extension', action: EXTENSION[stream.subject] ?? 'Extension: one harder task on the same topic, with a short reflection', students: extension.map((r) => ({ id: r.id, name: r.name, reason: `${r.subject.completion}% handed in, average ${r.subject.avgGrade}%, week ${r.all.loadPct}% full` })) },
  ];
  // peer pairs: each student needing support with a strong student who has a light week
  const helpers = [...extension, ...rows.filter((r) => r.status === 'on_track' && (r.subject.avgGrade ?? 0) >= 80 && r.all.loadPct < 80)];
  const pairs = support.slice(0, helpers.length).map((r, i) => ({
    support: { id: r.id, name: r.name }, partner: { id: helpers[i]!.id, name: helpers[i]!.name },
    reason: `${helpers[i]!.name.split(' ')[0]} is up to date (average ${helpers[i]!.subject.avgGrade}%) with a ${helpers[i]!.all.loadPct}%-full week; ${r.name.split(' ')[0]} has ${r.subject.overdue || r.all.overdue} task(s) to catch up.`,
  }));
  // mixed-attainment groups (snake draft by average) for group work
  const ranked = [...rows].sort((a, b) => (b.subject.avgGrade ?? 0) - (a.subject.avgGrade ?? 0));
  const nGroups = Math.max(1, Math.round(rows.length / 5));
  const mixed: { name: string; students: string[] }[] = Array.from({ length: nGroups }, (_, i) => ({ name: `Group ${i + 1}`, students: [] }));
  ranked.forEach((r, i) => { const round_ = Math.floor(i / nGroups); const k = round_ % 2 === 0 ? i % nGroups : nGroups - 1 - (i % nGroups); mixed[k]!.students.push(r.name); });
  return {
    today,
    summary: `${support.length} need support, ${lighten.length} need more time this week, ${extension.length} are ready for extension work.`,
    groups, pairs, mixedGroups: mixed,
    rules: [
      'Needs support = at risk in the progress report.',
      'Same task, more time = up to date in this subject but 2+ tests, a fixture/event, or an 85%+ full week in the next 7 days.',
      'Extension = ahead: 95%+ handed in, average 85%+, week under 70% full.',
      'Peer partners: strong students with light weeks, paired in order.',
    ],
  };
}

// ---------- homework timing ----------
/** Tests in the 2 days before a due date and on it (the "test crunch"). Shared by the best-day model and the replan. */
export function crunchTests(load: Record<string, { tests: string[] }>, due: string): string[] {
  return [addDays(due, -2), addDays(due, -1), due].flatMap((d) => load[d]?.tests ?? []);
}

/** At risk for a set/due window (same rule everywhere): no single day before it is due has room for the task,
 *  or 2+ tests fall in the 2 days before it is due. Returns the reason, or null when the student is fine. */
export function atRiskReason(load: Record<string, { minutes: number; tests: string[] }>, set: string, due: string, minutes: number): string | null {
  let bestDay = set; let bestFree = -Infinity;
  for (let d = set; d < due; d = addDays(d, 1)) {
    const f = capacity(d) - (load[d]?.minutes ?? 0);
    if (f > bestFree) { bestFree = f; bestDay = d; }
  }
  if (bestFree === -Infinity) { bestFree = capacity(set) - (load[set]?.minutes ?? 0); bestDay = set; }
  if (bestFree < minutes) return `no day before it is due has ${minutes} free minutes (best: ${dayName(bestDay)}, ${Math.max(0, Math.round(bestFree))} min free)`;
  const crunch = crunchTests(load, due);
  if (crunch.length >= 2) return `${crunch.length} tests in the 2 days before it is due (${crunch.slice(0, 2).join(', ')})`;
  return null;
}

/** A student counts as "likely on time" at 70%+. Students the at-risk rule flags are capped below that line, so the
 *  best-day on-time count and the at-risk (extra support) flags after posting always add up for the same window. */
export const ON_TIME_THRESHOLD = 0.7;

export function likelihoodFor(w: StudentWork, load: Record<string, { minutes: number; tests: string[]; events: string[] }>, set: string, due: string, minutes: number): number {
  let free = 0; let tests = 0; let events = 0;
  for (let d = set; d < due; d = addDays(d, 1)) {
    const l = load[d];
    if (!l) continue;
    free += Math.max(0, capacity(d) - l.minutes);
    events += l.events.length;
  }
  for (let d = addDays(set, 1); d <= due; d = addDays(d, 1)) tests += load[d]?.tests.length ?? 0;
  const ratio = free / Math.max(10, minutes);
  const base = 1 - Math.exp(-ratio / 0.9);
  const habit = 0.72 + 0.28 * w.student.diligence;
  const backlog = 0.04 * Math.min(3, w.items.filter((x) => x.sub.status === 'missing').length);
  const p = clamp(habit * base - 0.05 * tests - 0.04 * events - backlog, 0.03, 0.99);
  return atRiskReason(load, set, due, minutes) ? Math.min(p, ON_TIME_THRESHOLD - 0.1) : p;
}

export function homeworkTiming(school: School, stream: Stream, today: string, opts: { minutes?: number; nowMinutes?: number } = {}) {
  const minutes = opts.minutes ?? stream.minutes;
  const ids = school.members[stream.id] ?? [];
  const works = ids.map((id) => studentWork(school, school.roster.find((s) => s.id === id)!, today));
  const horizon = 21;
  // the teacher is choosing when to set this class's next task, so leave out its own not-yet-set generated homework
  const loads = works.map((w) => loadByDay(w, today, horizon, (it) => it.streamId === stream.id && !it.posted && it.setDate > today));
  // candidate set days: the next 5 school days (today only before 15:00 Dubai)
  const setDays: string[] = [];
  let d = isSchoolDay(today) && (opts.nowMinutes ?? 0) < 15 * 60 ? today : addSchoolDays(today, 1);
  while (setDays.length < 5) { if (isSchoolDay(d)) setDays.push(d); d = addDays(d, 1); }

  const options: { set: string; due: string; schoolDays: number; likelihood: number; onTime: number; atRisk: number; inWindow: { tests: string[]; events: string[] } }[] = [];
  for (const set of setDays) {
    for (let k = 1; k <= 3; k++) {
      const due = addSchoolDays(set, k);
      const ps = works.map((w, i) => likelihoodFor(w, loads[i]!, set, due, minutes));
      const likelihood = Math.round((ps.reduce((t, p) => t + p, 0) / ps.length) * 100);
      const tests = new Set<string>(); const events = new Set<string>();
      for (const l of loads) {
        for (let x = set; x <= due; x = addDays(x, 1)) {
          for (const t of l[x]?.tests ?? []) if (x > set) tests.add(`${t} (${DOW[weekday(x)]})`);
          for (const e of l[x]?.events ?? []) if (x < due) events.add(`${e.replace(/ \(.*\)$/, '')} (${DOW[weekday(x)]})`);
        }
      }
      options.push({ set, due, schoolDays: k, likelihood, onTime: ps.filter((p) => p >= ON_TIME_THRESHOLD).length, atRisk: works.map((_, i) => atRiskReason(loads[i]!, set, due, minutes)).filter(Boolean).length, inWindow: { tests: [...tests], events: [...events] } });
    }
  }
  // rule: rank by likelihood, minus 3 points when the window runs over the weekend (keep weekends free);
  // ties go to the earlier due date
  const spansWeekend = (o: { set: string; due: string }) => { for (let x = o.set; x < o.due; x = addDays(x, 1)) if (!isSchoolDay(x)) return true; return false; };
  const score = (o: { set: string; due: string; likelihood: number }) => o.likelihood - (spansWeekend(o) ? 3 : 0);
  const best = [...options].sort((a, b) => score(b) - score(a) || a.due.localeCompare(b.due) || a.set.localeCompare(b.set))[0]!;
  const worst = [...options].sort((a, b) => a.likelihood - b.likelihood)[0]!;

  // day-by-day class load for the next 10 days
  const days = Array.from({ length: 10 }, (_, i) => addDays(today, i)).map((date) => {
    const mins = loads.map((l) => l[date]!.minutes);
    const avg = Math.round(mins.reduce((t, m) => t + m, 0) / mins.length);
    const pct = Math.round((avg / capacity(date)) * 100);
    const tests = loads.filter((l) => l[date]!.tests.length).length;
    const events = loads.filter((l) => l[date]!.events.length).length;
    const titles = [...new Set(loads.flatMap((l) => [...l[date]!.tests, ...l[date]!.events]))];
    return { date, label: shortDay(date), schoolDay: isSchoolDay(date), avgMinutes: avg, loadPct: pct, level: pct >= 85 ? 'heavy' : pct >= 60 ? 'moderate' : 'light', studentsWithTest: tests, studentsWithEvent: events, items: titles };
  });

  const clear = [...new Set(works.flatMap((w) => w.calendar).filter((c) => c.date >= today && c.date <= addDays(best.due, 3)).map((c) => `${c.title.replace(/ \(.*\)$/, '')} (${DOW[weekday(c.date)]})`))]
    .filter((x) => !best.inWindow.tests.includes(x) && !best.inWindow.events.includes(x)).slice(0, 4);
  const headline = `Best day to set: ${dayName(best.set)}, due ${dayName(best.due)} \u2014 ${best.likelihood}% likely on time`;
  return {
    today, minutes, students: ids.length,
    best: { ...best, spansWeekend: spansWeekend(best), setLabel: shortDay(best.set), dueLabel: shortDay(best.due), headline,
      reason: `${best.onTime} of ${ids.length} students are likely to hand it in on time (enough free time between ${dayName(best.set)} and ${dayName(best.due)} for a ${minutes}-minute task).${best.atRisk ? ` ${best.atRisk} would be at risk and get extra support (no free day for it, or 2+ tests just before it is due).` : ''}${clear.length ? ` Keeps clear of ${clear.join(', ')}.` : ''}${best.inWindow.tests.length ? ` Still overlaps ${best.inWindow.tests.slice(0, 2).join(', ')}.` : ''}` },
    avoid: { ...worst, setLabel: shortDay(worst.set), dueLabel: shortDay(worst.due),
      reason: `Only ${worst.likelihood}% likely on time: ${[...worst.inWindow.tests, ...worst.inWindow.events].slice(0, 3).join(', ') || 'little free time'} fall${[...worst.inWindow.tests, ...worst.inWindow.events].length === 1 ? 's' : ''} in that window.` },
    heatmap: { setDays: setDays.map((s) => ({ date: s, label: shortDay(s) })), dueOffsets: [1, 2, 3], cells: options.map((o) => ({ set: o.set, due: o.due, dueLabel: shortDay(o.due), schoolDays: o.schoolDays, likelihood: o.likelihood, onTime: o.onTime, atRisk: o.atRisk, weekend: spansWeekend(o), best: o === best })) },
    days,
    method: [
      `For each student: free time = after-school capacity (240 min on school days, 330 at weekends) minus homework already set (spread to its due date), test revision (45 + 60 min before each test), sport and events.`,
      `On-time chance = habit x (1 - e^(-free time / task length / 0.9)), habit = 0.72 + 0.28 x hand-in record, minus 5 points per test and 4 per event inside the window and 4 per overdue task (max 3).`,
      `At risk (same rule as the replan after posting): no single day before it is due has room for the task, or 2+ tests in the 2 days before it is due. At-risk students are counted below the 70% on-time line, and the teacher sees them as "At risk: extra support" with the reason.`,
      `Class likelihood = average over the class. Best = highest likelihood, with 3 points off windows that run over the weekend (weekends stay free); ties go to the earlier due date.`,
    ],
  };
}

// ---------- weekly reports ----------
/** `tests`: the student's own assessment calendar when they use the app, so every page counts the same tests. */
export function weeklyReport(school: School, st: RosterStudent, today: string, nowMinutes: number, weekStart?: string, ownTests?: { date: string; title: string }[]) {
  const mon = weekStart ?? mondayOfDate(today);
  const fri = addDays(mon, 4);
  const submittedAtDue = today > fri || (today === fri && nowMinutes >= 16 * 60);
  const asOf = submittedAtDue ? fri : today;
  const w = studentWork(school, st, asOf, today);
  // the weekend before counts towards the week; work due this week counts once its due date has passed
  const inWeek = (d: string | null) => !!d && d >= addDays(mon, -2) && d <= asOf;
  const completed = w.items.filter((x) => (x.sub.status === 'on_time' || x.sub.status === 'late' || x.sub.status === 'submitted') && inWeek(x.sub.submittedOn));
  const dueThisWeek = w.items.filter((x) => x.item.dueDate >= mon && x.item.dueDate <= fri && (submittedAtDue ? x.item.dueDate <= fri : x.item.dueDate < today) && x.sub.status !== 'not_set' && x.sub.status !== 'pending');
  const onTime = dueThisWeek.filter((x) => x.sub.status === 'on_time' || x.sub.status === 'submitted').length;
  const missing = w.items.filter((x) => x.sub.status === 'missing');
  const remaining = w.items.filter((x) => x.sub.status === 'pending' && x.item.dueDate <= addDays(asOf, 7));
  const tests = ownTests ? ownTests.filter((c) => c.date > asOf && c.date <= addDays(asOf, 7)).sort((a, b) => a.date.localeCompare(b.date)) : w.calendar.filter((c) => c.kind === 'test' && c.date > asOf && c.date <= addDays(asOf, 7));
  const events = w.calendar.filter((c) => c.kind === 'event' && c.date >= mon && c.date <= addDays(fri, 1));
  const actMin = st.activities.reduce((t, a) => t + a.minutes * a.days.filter((d) => d >= 1 && d <= 6).length, 0) + events.reduce((t, e) => t + e.minutes, 0);
  const completion = dueThisWeek.length ? Math.round(((dueThisWeek.length - dueThisWeek.filter((x) => x.sub.status === 'missing').length) / dueThisWeek.length) * 100) : 100;
  // the percentage and the sentence use the same numbers: work due this week that was handed in (on time or late)
  const handedDue = dueThisWeek.length - dueThisWeek.filter((x) => x.sub.status === 'missing').length;
  const caughtUp = Math.max(0, completed.length - handedDue);
  const first = st.name.split(' ')[0];
  const summary = [
    dueThisWeek.length ? `${first} handed in ${handedDue} of the ${dueThisWeek.length} piece${dueThisWeek.length === 1 ? '' : 's'} of work due this week (${onTime} on time)${caughtUp ? `, and caught up on ${caughtUp} older piece${caughtUp === 1 ? '' : 's'}` : ''}.` : `${first} had no work due this week${completed.length ? ` and handed in ${completed.length} piece${completed.length === 1 ? '' : 's'}` : ''}.`,
    missing.length ? `${missing.length} overdue (${[...new Set(missing.map((x) => x.subjectName))].join(', ')}).` : 'Nothing overdue.',
    remaining.length ? `${remaining.length} due in the next 7 days${tests.length ? ` and ${tests.length} test${tests.length > 1 ? 's' : ''}` : ''}.` : tests.length ? `${tests.length} test${tests.length > 1 ? 's' : ''} coming up.` : '',
    actMin ? `${round(actMin / 60, 1)} h of sport and activities.` : '',
  ].filter(Boolean).join(' ');
  // the same summary in Arabic, for students and parents using the app in Arabic
  const summaryAr = [
    dueThisWeek.length ? `سلّم ${first} ${handedDue} من ${dueThisWeek.length} أعمال مستحقة هذا الأسبوع (${onTime} في الموعد)${caughtUp ? `، وأنجز ${caughtUp} من الأعمال الأقدم` : ''}.` : `لم يكن على ${first} أعمال مستحقة هذا الأسبوع.`,
    missing.length ? `${missing.length} متأخرة.` : 'لا شيء متأخر.',
    remaining.length ? `${remaining.length} مستحقة خلال الأيام السبعة القادمة${tests.length ? ` و${tests.length} ${tests.length > 1 ? 'اختبارات' : 'اختبار'}` : ''}.` : tests.length ? `${tests.length} ${tests.length > 1 ? 'اختبارات قادمة' : 'اختبار قادم'}.` : '',
    actMin ? `${round(actMin / 60, 1)} ساعة من الرياضة والأنشطة.` : '',
  ].filter(Boolean).join(' ');
  return {
    summaryAr,
    studentId: st.id, name: st.name, section: st.section, appId: st.appId, weekStart: mon, weekEnd: fri,
    status: submittedAtDue ? 'submitted' as const : 'draft' as const,
    submittedAt: submittedAtDue ? `${fri}T16:00:00+04:00` : null,
    autoSubmitsAt: `${fri}T16:00:00+04:00`,
    completion, completed: completed.length, dueThisWeek: dueThisWeek.length, onTime,
    completedItems: completed.slice(0, 8).map((x) => ({ title: x.item.title, subject: x.subjectName, on: x.sub.submittedOn })),
    overdue: missing.map((x) => ({ title: x.item.title, subject: x.subjectName, dueDate: x.item.dueDate })),
    remaining: remaining.map((x) => ({ title: x.item.title, subject: x.subjectName, dueDate: x.item.dueDate })),
    upcomingTests: tests.map((c) => ({ title: c.title, date: c.date })),
    activityHours: round(actMin / 60, 1),
    summary,
  };
}

export function weeklyRollup(school: School, stream: Stream, today: string, nowMinutes: number, which: 'current' | 'last' = 'current') {
  const mon = mondayOfDate(today);
  const weekStart = which === 'last' ? addDays(mon, -7) : mon;
  const reports = (school.members[stream.id] ?? []).map((id) => weeklyReport(school, school.roster.find((s) => s.id === id)!, today, nowMinutes, weekStart))
    .sort((a, b) => b.overdue.length - a.overdue.length || a.completion - b.completion || a.name.localeCompare(b.name));
  const avg = reports.length ? Math.round(reports.reduce((t, r) => t + r.completion, 0) / reports.length) : 0;
  const testCounts = new Map<string, number>();
  for (const r of reports) for (const t of r.upcomingTests) testCounts.set(`${t.title} (${shortDay(t.date)})`, (testCounts.get(`${t.title} (${shortDay(t.date)})`) ?? 0) + 1);
  return {
    weekStart, weekEnd: addDays(weekStart, 4),
    status: reports.every((r) => r.status === 'submitted') ? 'submitted' : 'draft',
    autoSubmitsAt: `${addDays(weekStart, 4)}T16:00:00+04:00`,
    rollup: {
      students: reports.length, submitted: reports.filter((r) => r.status === 'submitted').length,
      avgCompletion: avg, withOverdue: reports.filter((r) => r.overdue.length).length,
      remaining: reports.reduce((t, r) => t + r.remaining.length, 0),
      pressure: [...testCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([title, n]) => ({ title, students: n })),
    },
    reports,
  };
}
