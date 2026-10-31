/**
 * One student, seen by their teacher: study time per week, grades over time, on-time rate, every subject, the work
 * in this class, upcoming tests, and personalised assignment ideas. Deterministic and explainable like the rest of
 * the class picture (engine.ts): study minutes are an estimate from hand-in habits and workload, labelled as such.
 */
import { addDays } from '../lib/time';
import { clamp, mondayOfDate, rng, round } from '../v1/data';
import { SUBJECT_NAMES, type RosterStudent, type Stream } from './catalog';
import { addSchoolDays, initialsOf, progressRow, shortDay, streamsOf, studentWork, type School, type Status } from './engine';

const WEEKS = 8;
const STATUS_RANK: Record<Status, number> = { at_risk: 0, watch: 1, on_track: 2, ahead: 3 };

export interface WeekPoint { weekStart: string; label: string; studyMinutes: number; handedIn: number; set: number; onTimeRate: number | null; avgGrade: number | null }
export interface Suggestion { kind: 'catch_up' | 'practice' | 'stretch' | 'check_in'; title: string; instructions: string; minutes: number; dueDate: string; why: string }

/** Estimated study minutes for a week: hand-in habits, attainment and that week's workload, with week-to-week noise. */
function studyMinutes(st: RosterStudent, weekStart: string, workloadMinutes: number): number {
  const r = rng(`${st.seed ?? st.id}|study|${weekStart}`);
  const base = 90 + st.diligence * 260 + st.ability * 60;
  return Math.round(clamp(base * (0.75 + r() * 0.5) + workloadMinutes * 0.35, 30, 900) / 5) * 5;
}

export function studentInsight(school: School, stream: Stream, st: RosterStudent, today: string) {
  const row = progressRow(school, stream, st, today);
  const w = studentWork(school, st, today);
  const thisMonday = mondayOfDate(today);
  const weeks: WeekPoint[] = [];
  for (let i = WEEKS - 1; i >= 0; i--) {
    const start = addDays(thisMonday, -7 * i);
    const end = addDays(start, 6);
    const due = w.items.filter((x) => x.item.dueDate >= start && x.item.dueDate <= end && x.item.dueDate < today);
    const mine = due.filter((x) => x.item.streamId === stream.id);
    const handed = mine.filter((x) => x.sub.status === 'on_time' || x.sub.status === 'late').length;
    const onTime = mine.filter((x) => x.sub.status === 'on_time').length;
    const grades = mine.map((x) => x.sub.grade).filter((g): g is number => g !== null);
    const workload = due.reduce((t, x) => t + x.item.minutes, 0);
    weeks.push({
      weekStart: start, label: shortDay(start).replace(/^\w+ /, ''),
      studyMinutes: i === 0 ? Math.round(studyMinutes(st, start, workload) * Math.min(1, (Date.parse(today) - Date.parse(start)) / (7 * 86_400_000) + 0.15) / 5) * 5 : studyMinutes(st, start, workload),
      handedIn: handed, set: mine.length, onTimeRate: mine.length ? Math.round((onTime / mine.length) * 100) : null,
      avgGrade: grades.length ? round(grades.reduce((t, g) => t + g, 0) / grades.length, 0) : null,
    });
  }
  const mineAll = w.items.filter((x) => x.item.streamId === stream.id && x.sub.status !== 'not_set');
  const marked = mineAll.filter((x) => x.sub.grade !== null).sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate));
  const gradeTrend = marked.map((x) => ({ date: x.item.dueDate, label: shortDay(x.item.dueDate), title: x.item.title, grade: x.sub.grade! }));
  const done = mineAll.filter((x) => ['on_time', 'late', 'missing'].includes(x.sub.status));
  const onTimeRate = done.length ? Math.round((done.filter((x) => x.sub.status === 'on_time').length / done.length) * 100) : null;
  const lastFull = weeks[weeks.length - 2];
  const prevFull = weeks[weeks.length - 3];

  const subjects = streamsOf(school, st.id).map((s) => {
    const p = progressRow(school, s, st, today);
    const t = school.teachers.find((x) => x.id === s.teacherId);
    return { classId: s.id, subject: SUBJECT_NAMES[s.subject], teacher: t?.name ?? '', completion: p.subject.completion, avgGrade: p.subject.avgGrade, overdue: p.subject.overdue, mine: s.id === stream.id };
  });

  const items = mineAll.slice().sort((a, b) => b.item.dueDate.localeCompare(a.item.dueDate)).slice(0, 12).map((x) => ({
    id: x.item.id, title: x.item.title, setLabel: shortDay(x.item.setDate), dueLabel: shortDay(x.item.dueDate), dueDate: x.item.dueDate,
    status: x.sub.status, grade: x.sub.grade, personalised: Boolean(x.item.assignees), format: x.item.format ?? 'task',
  }));

  return {
    student: { id: st.id, name: st.name, section: st.section, grade: st.grade ?? 11, initials: initialsOf(st.name), appId: st.appId },
    status: row.status, statusLabel: row.statusLabel, flags: row.flags,
    stats: {
      completion: row.subject.completion, avgGrade: row.subject.avgGrade, onTimeRate, overdue: row.subject.overdue, pending: row.subject.pending,
      studyHoursLastWeek: lastFull ? round(lastFull.studyMinutes / 60, 1) : null,
      studyTrendPct: lastFull && prevFull && prevFull.studyMinutes ? Math.round(((lastFull.studyMinutes - prevFull.studyMinutes) / prevFull.studyMinutes) * 100) : null,
      loadPct: row.all.loadPct, testsNext7: row.all.testsNext7.length,
    },
    weeks, gradeTrend, subjects, items,
    tests: w.calendar.filter((c) => c.kind === 'test' && c.date >= today && c.date <= addDays(today, 14)).map((c) => ({ date: c.date, label: shortDay(c.date), title: c.title })),
    suggestions: suggestionsFor(stream, row, marked.map((x) => ({ title: x.item.title, grade: x.sub.grade! })), today),
    method: [
      'Hand-in, on-time and grade figures come from this class’s work up to today.',
      'Study time is an estimate from hand-in habits, attainment and that week’s workload (synthetic demo data).',
      'Suggestions follow fixed rules: overdue work first, then the weakest recent grade, then stretch work for students who are ahead.',
    ],
  };
}

/** Personalised work ideas, most useful first. Each is ready to post as-is. */
function suggestionsFor(stream: Stream, row: ReturnType<typeof progressRow>, marked: { title: string; grade: number }[], today: string): Suggestion[] {
  const subj = SUBJECT_NAMES[stream.subject];
  const due = addSchoolDays(today, 3);
  const out: Suggestion[] = [];
  const overdue = row.subject.remaining.filter((r) => r.status === 'missing');
  if (overdue.length) out.push({ kind: 'catch_up', title: `Catch-up: ${overdue[0]!.title}`, instructions: `Finish "${overdue[0]!.title}" in two 25-minute sessions. Hand in what you have, even if it is not perfect.`, minutes: 50, dueDate: due, why: `${overdue.length} overdue ${subj} task${overdue.length > 1 ? 's' : ''}` });
  const weakest = marked.slice(-6).sort((a, b) => a.grade - b.grade)[0];
  if (weakest && weakest.grade < 70) out.push({ kind: 'practice', title: `Targeted practice: ${weakest.title.replace(/:.*$/, '')}`, instructions: `A short set on the skills from "${weakest.title}" (marked ${weakest.grade}%). Three questions, then check against the model answer.`, minutes: 30, dueDate: due, why: `Lowest recent mark: ${weakest.grade}%` });
  if (row.status === 'ahead' || (row.subject.avgGrade ?? 0) >= 85) out.push({ kind: 'stretch', title: `Extension: beyond the syllabus in ${subj}`, instructions: 'An open task one step beyond this week’s work. Bring one question to the next lesson.', minutes: 40, dueDate: addSchoolDays(today, 5), why: `Average ${row.subject.avgGrade ?? '-'}%, ${row.subject.completion}% handed in` });
  if (!out.length || row.all.loadPct >= 85) out.push({ kind: 'check_in', title: `Check-in: how is ${subj} going?`, instructions: 'A two-question check-in form: what felt easy this week, and what you would like help with.', minutes: 10, dueDate: due, why: row.all.loadPct >= 85 ? `Week is ${row.all.loadPct}% full` : 'Steady: a light check-in keeps the conversation going' });
  return out.slice(0, 3);
}

/** Every student across a teacher's classes (or the whole school for an admin), worst status first. */
export function teacherStudents(school: School, classes: Stream[], today: string) {
  const byId = new Map<string, { st: RosterStudent; classes: { id: string; name: string; status: Status; completion: number; avgGrade: number | null }[] }>();
  for (const c of classes) {
    for (const id of school.members[c.id] ?? []) {
      const st = school.roster.find((r) => r.id === id);
      if (!st) continue;
      const p = progressRow(school, c, st, today);
      const e = byId.get(id) ?? { st, classes: [] };
      e.classes.push({ id: c.id, name: c.name, status: p.status, completion: p.subject.completion, avgGrade: p.subject.avgGrade });
      byId.set(id, e);
    }
  }
  return [...byId.values()].map(({ st, classes: cs }) => {
    const worst = cs.slice().sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])[0]!;
    const grades = cs.map((x) => x.avgGrade).filter((g): g is number => g !== null);
    return {
      id: st.id, name: st.name, section: st.section, grade: st.grade ?? 11, initials: initialsOf(st.name), appId: st.appId,
      status: worst.status, classes: cs.map((x) => ({ id: x.id, name: x.name, status: x.status })),
      completion: Math.round(cs.reduce((t, x) => t + x.completion, 0) / cs.length),
      avgGrade: grades.length ? round(grades.reduce((t, g) => t + g, 0) / grades.length, 0) : null,
    };
  }).sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name));
}
