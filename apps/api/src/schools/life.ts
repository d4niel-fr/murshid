/**
 * School life around the lessons: how students feel (a daily check-in, like Microsoft Reflect), the timetable,
 * attendance and leave requests, points for effort and kindness, quick polls and exit tickets, school events, and
 * term reports with teacher comments.
 *
 * Saved as its own document (see lib/units.ts). Demo schools get a believable history generated from fixed seeds;
 * real schools start empty and only show what people entered.
 */
import { addDays, weekday } from '../lib/time';
import { clamp, rng } from '../v1/data';
import type { RosterStudent, Stream } from './catalog';

/* ------------------------------------------------------------------ feelings */

export type Mood = 1 | 2 | 3 | 4 | 5;
export interface Emotion { id: string; mood: Mood; en: string; ar: string; simple?: boolean }
/** Feelings words by mood (nouns in Arabic so they read the same for everyone). `simple` = the younger set. */
export const EMOTIONS: Emotion[] = [
  { id: 'excited', mood: 5, en: 'Excited', ar: 'حماس', simple: true }, { id: 'proud', mood: 5, en: 'Proud', ar: 'فخر', simple: true },
  { id: 'happy', mood: 5, en: 'Happy', ar: 'سعادة', simple: true }, { id: 'grateful', mood: 5, en: 'Grateful', ar: 'امتنان' },
  { id: 'confident', mood: 5, en: 'Confident', ar: 'ثقة' }, { id: 'energised', mood: 5, en: 'Full of energy', ar: 'نشاط' },
  { id: 'calm', mood: 4, en: 'Calm', ar: 'هدوء', simple: true }, { id: 'content', mood: 4, en: 'Content', ar: 'رضا' },
  { id: 'hopeful', mood: 4, en: 'Hopeful', ar: 'تفاؤل' }, { id: 'relaxed', mood: 4, en: 'Relaxed', ar: 'راحة' },
  { id: 'curious', mood: 4, en: 'Curious', ar: 'فضول', simple: true }, { id: 'focused', mood: 4, en: 'Focused', ar: 'تركيز' },
  { id: 'fine', mood: 3, en: 'Fine', ar: 'بخير', simple: true }, { id: 'tired', mood: 3, en: 'Tired', ar: 'تعب', simple: true },
  { id: 'bored', mood: 3, en: 'Bored', ar: 'ملل', simple: true }, { id: 'distracted', mood: 3, en: 'Distracted', ar: 'تشتّت' },
  { id: 'unsure', mood: 3, en: 'Unsure', ar: 'تردّد' },
  { id: 'worried', mood: 2, en: 'Worried', ar: 'قلق', simple: true }, { id: 'stressed', mood: 2, en: 'Stressed', ar: 'توتّر' },
  { id: 'sad', mood: 2, en: 'Sad', ar: 'حزن', simple: true }, { id: 'frustrated', mood: 2, en: 'Frustrated', ar: 'إحباط' },
  { id: 'lonely', mood: 2, en: 'Lonely', ar: 'وحدة' }, { id: 'confused', mood: 2, en: 'Confused', ar: 'حيرة', simple: true },
  { id: 'overwhelmed', mood: 1, en: 'Overwhelmed', ar: 'ضغط كبير' }, { id: 'anxious', mood: 1, en: 'Anxious', ar: 'قلق شديد' },
  { id: 'angry', mood: 1, en: 'Angry', ar: 'غضب', simple: true }, { id: 'upset', mood: 1, en: 'Upset', ar: 'انزعاج' },
  { id: 'hurt', mood: 1, en: 'Hurt', ar: 'ألم' }, { id: 'scared', mood: 1, en: 'Scared', ar: 'خوف', simple: true },
];
export const EMOTION_IDS = EMOTIONS.map((e) => e.id);

export interface CheckIn {
  id: string; studentId: string; date: string; at: string; mood: Mood; words: string[];
  /** only the student sees the note, unless they share the check-in */
  note: string; share: 'teacher' | 'private';
  /** the teacher the student asked to talk to */
  talkTo: string | null; promptId: string | null;
  /** generated for a demo school */
  demo?: boolean;
}
export interface Prompt { id: string; streamId: string; question: string; date: string; by: string }

/* ------------------------------------------------------------------ timetable */

export interface Lesson { day: number; start: string; end: string; room: string; link: string | null }
/** A typical UAE secondary day: 7 lessons with a break and lunch. */
export const PERIODS: [string, string][] = [['07:45', '08:30'], ['08:35', '09:20'], ['09:25', '10:10'], ['10:30', '11:15'], ['11:20', '12:05'], ['12:10', '12:55'], ['13:30', '14:15']];
export const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/* ------------------------------------------------------------------ attendance */

export type Mark = 'present' | 'late' | 'absent' | 'excused';
export type LeaveReason = 'illness' | 'appointment' | 'family' | 'religious' | 'competition' | 'other';
export interface LeaveRequest {
  id: string; orgId: string; studentId: string; from: string; to: string; reason: LeaveReason; note: string;
  by: 'student' | 'parent'; byName: string; status: 'pending' | 'approved' | 'declined'; decidedBy: string | null; decidedAt: string | null; reply: string; at: string;
}

/* ------------------------------------------------------------------ points */

export const POINT_REASONS = ['effort', 'participation', 'helping', 'teamwork', 'kindness', 'leadership', 'creativity', 'improvement', 'homework', 'focus', 'off_task', 'unprepared', 'late'] as const;
export type PointReason = (typeof POINT_REASONS)[number];
export const REASON_LABEL: Record<PointReason, string> = {
  effort: 'Great effort', participation: 'Taking part', helping: 'Helping others', teamwork: 'Teamwork', kindness: 'Kindness', leadership: 'Leadership',
  creativity: 'Creativity', improvement: 'Big improvement', homework: 'Excellent homework', focus: 'Focused work', off_task: 'Off task', unprepared: 'Not prepared', late: 'Late to class',
};
export interface PointAward { id: string; studentId: string; streamId: string; by: string; byName: string; reason: PointReason; points: number; note: string; at: string; demo?: boolean }

/* ------------------------------------------------------------------ polls */

export interface Poll {
  id: string; streamId: string; kind: 'choice' | 'exit' | 'confidence'; question: string; options: string[]; anonymous: boolean;
  open: boolean; at: string; closedAt: string | null; by: string;
  answers: Record<string, { choice: number | null; text: string; at: string }>;
}
export const CONFIDENCE = ['I could teach it', 'I get it', 'Getting there', 'I’m lost'];

/* ------------------------------------------------------------------ events and reports */

export type EventKind = 'holiday' | 'exam' | 'trip' | 'event' | 'meeting' | 'sport';
export interface SchoolEvent { id: string; orgId: string; title: string; date: string; end: string; kind: EventKind; grades: number[]; note: string; by: string }
export type Term = 'T1' | 'T2' | 'T3';
export interface ReportEntry { comment: string; effort: 1 | 2 | 3 | 4; updatedAt: string; by: string }
/** UAE school year: Term 1 Aug–Dec, Term 2 Jan–Mar, Term 3 Apr–Jul. */
export const termOf = (date: string): Term => { const m = Number(date.slice(5, 7)); return m >= 8 ? 'T1' : m <= 3 ? 'T2' : 'T3'; };
export const termStart = (date: string): string => {
  const y = Number(date.slice(0, 4)); const t = termOf(date);
  return t === 'T1' ? `${y}-08-25` : t === 'T2' ? `${y}-01-05` : `${y}-04-06`;
};
export const EFFORT = ['', 'Needs to try harder', 'Some effort', 'Good effort', 'Excellent effort'];

/* ------------------------------------------------------------------ the store */

export class SchoolLife {
  /** roster student id -> their check-ins, newest last */
  feelings: Record<string, CheckIn[]> = {};
  prompts: Record<string, Prompt[]> = {};
  timetable: Record<string, Lesson[]> = {};
  /** class -> date -> roster student -> mark */
  attendance: Record<string, Record<string, Record<string, Mark>>> = {};
  leave: LeaveRequest[] = [];
  points: Record<string, PointAward[]> = {};
  polls: Poll[] = [];
  events: SchoolEvent[] = [];
  /** class -> term -> roster student -> comment */
  reports: Record<string, Record<string, Record<string, ReportEntry>>> = {};
  /** class -> terms whose reports students and parents can see */
  published: Record<string, string[]> = {};
  private seq = 0;
  id(prefix: string) { return `${prefix}-${(++this.seq).toString(36)}${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`; }
}

/* ------------------------------------------------------------------ demo history (fixed seeds, never for real schools) */

const schoolDaysBack = (today: string, n: number) => {
  const out: string[] = [];
  for (let d = addDays(today, -1); out.length < n; d = addDays(d, -1)) { const w = weekday(d); if (w >= 1 && w <= 5) out.push(d); }
  return out.reverse();
};

/** A demo student's check-ins over the last few school weeks: mostly fine, the less steady ones dip now and then. */
export function demoFeelings(st: RosterStudent, today: string, days = 20): CheckIn[] {
  return schoolDaysBack(today, days).flatMap((date, i) => {
    const r = rng(`${st.seed ?? st.id}|feel|${date}`);
    if (r() > 0.55 + st.diligence * 0.35) return [];
    const base = 2.6 + st.diligence * 1.6 + (r() - 0.5) * 1.8 - (weekday(date) === 1 ? 0.3 : 0) + (weekday(date) === 4 ? 0.3 : 0);
    const mood = clamp(Math.round(base), 1, 5) as Mood;
    const pool = EMOTIONS.filter((e) => e.mood === mood);
    const w = [pool[Math.floor(r() * pool.length)]!.id];
    if (r() > 0.6) { const extra = pool[Math.floor(r() * pool.length)]!.id; if (extra !== w[0]) w.push(extra); }
    return [{ id: `demo-${st.id}-${date}`, studentId: st.id, date, at: `${date}T04:${String(10 + (i % 40)).padStart(2, '0')}:00.000Z`, mood, words: w, note: '', share: r() > 0.15 ? 'teacher' as const : 'private' as const, talkTo: null, promptId: null, demo: true }];
  });
}

/** A demo register: most students present, a few late, the occasional absence (fixed per student and day). */
export function demoMark(st: RosterStudent, streamId: string, date: string): Mark {
  const r = rng(`${st.seed ?? st.id}|att|${date}`)();
  const r2 = rng(`${st.seed ?? st.id}|att|${streamId}|${date}`)();
  if (r < 0.025 + (1 - st.diligence) * 0.05) return r2 < 0.5 ? 'excused' : 'absent';
  if (r2 < 0.03 + (1 - st.diligence) * 0.08) return 'late';
  return 'present';
}

/** A few demo points per student per class, so the totals mean something. */
export function demoPoints(st: RosterStudent, stream: Stream, teacherName: string, today: string): PointAward[] {
  return schoolDaysBack(today, 15).flatMap((date) => {
    const r = rng(`${st.seed ?? st.id}|pts|${stream.id}|${date}`);
    if (r() > 0.18) return [];
    const good = r() < 0.82 + st.diligence * 0.12;
    const reasons: PointReason[] = good ? ['effort', 'participation', 'helping', 'teamwork', 'kindness', 'homework', 'focus', 'improvement'] : ['off_task', 'unprepared', 'late'];
    const reason = reasons[Math.floor(r() * reasons.length)]!;
    return [{ id: `demo-${st.id}-${stream.id}-${date}`, studentId: st.id, streamId: stream.id, by: stream.teacherId, byName: teacherName, reason, points: good ? 1 + Math.floor(r() * 2) : -1, note: '', at: `${date}T07:30:00.000Z`, demo: true }];
  });
}

/** A student's week when the school has not entered a timetable: their classes spread over the periods, no clashes. */
export function generatedLessons(streams: Stream[], seed: string): Map<string, Lesson[]> {
  const out = new Map<string, Lesson[]>(streams.map((s) => [s.id, []]));
  if (!streams.length) return out;
  const slots: { day: number; p: number }[] = [];
  for (let day = 1; day <= 5; day++) for (let p = 0; p < PERIODS.length; p++) slots.push({ day, p });
  const r = rng(`${seed}|tt`);
  for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [slots[i], slots[j]] = [slots[j]!, slots[i]!]; }
  // core subjects get more lessons
  const weight = (s: Stream) => (['maths', 'english', 'arabic', 'science', 'physics', 'chemistry', 'biology'].includes(s.subject) ? 5 : s.subject === 'islamic' || s.subject === 'social' ? 3 : 4);
  const queue = streams.flatMap((s) => Array.from({ length: weight(s) }, () => s));
  queue.slice(0, slots.length).forEach((s, i) => {
    const slot = slots[i]!;
    out.get(s.id)!.push({ day: slot.day, start: PERIODS[slot.p]![0], end: PERIODS[slot.p]![1], room: `${s.subject.slice(0, 3).toUpperCase()}-${1 + (s.id.length % 9)}${s.subject.length % 3}`, link: null });
  });
  return out;
}

/** UAE holidays and a few school dates for demo schools, relative to the school year. */
export function demoEvents(orgId: string, today: string): SchoolEvent[] {
  const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7));
  const yr = m >= 8 ? y : y - 1; // the school year that started in August
  const e = (id: string, title: string, date: string, end: string, kind: EventKind, note = '', grades: number[] = []) => ({ id: `demo-${id}-${yr}`, orgId, title, date, end, kind, grades, note, by: 'school' });
  return [
    e('pt1', 'Parent–teacher meetings', `${yr}-10-15`, `${yr}-10-16`, 'meeting', 'Book a slot with each teacher from the School page.'),
    e('mid1', 'Term 1 assessment week', `${yr}-11-23`, `${yr}-11-27`, 'exam', 'Revision timetables go out two weeks before.'),
    e('nd', 'Eid Al Etihad (UAE National Day)', `${yr}-12-02`, `${yr}-12-03`, 'holiday', 'School closed.'),
    e('sports', 'Sports day', `${yr}-11-12`, `${yr}-11-12`, 'sport', 'PE kit and water bottle.'),
    e('trip', 'Grade 10 trip: Museum of the Future', `${yr}-11-19`, `${yr}-11-19`, 'trip', 'Consent form due the Monday before.', [10]),
    e('wb', 'Winter break', `${yr}-12-14`, `${yr + 1}-01-02`, 'holiday', 'School reopens on Monday 5 January.'),
    e('t2', 'Term 2 starts', `${yr + 1}-01-05`, `${yr + 1}-01-05`, 'event'),
    e('mock', 'Grade 12 mock exams', `${yr + 1}-02-09`, `${yr + 1}-02-20`, 'exam', '', [12]),
    e('spring', 'Spring break', `${yr + 1}-03-23`, `${yr + 1}-04-03`, 'holiday'),
  ];
}

/* ------------------------------------------------------------------ summaries */

export const markWeight: Record<Mark, number> = { present: 1, late: 1, excused: 1, absent: 0 };
/** Attendance rate (late and excused count as attended, absences do not). */
export function attendanceRate(marks: Mark[]): number | null {
  if (!marks.length) return null;
  return Math.round((marks.reduce((t, m) => t + markWeight[m], 0) / marks.length) * 1000) / 10;
}

/** Who to check in with: asked to talk, or low on 2 of their last 3 shared check-ins this fortnight. */
export function concern(list: CheckIn[], today: string): 'talk' | 'low' | null {
  const recent = list.filter((x) => x.share === 'teacher' && x.date >= addDays(today, -14)).slice(-3);
  if (recent.some((x) => x.talkTo)) return 'talk';
  return recent.filter((x) => x.mood <= 2).length >= 2 ? 'low' : null;
}

/** Comment-bank suggestions built from what the record shows (the teacher edits before saving). */
export function commentBank(name: string, subject: string, o: { average: number | null; attendance: number | null; points: number; missing: number }): string[] {
  const first = name.split(/\s+/)[0] ?? name;
  const out: string[] = [];
  if (o.average !== null && o.average >= 85) out.push(`${first} has made excellent progress in ${subject} this term and consistently produces work of a high standard.`);
  else if (o.average !== null && o.average >= 70) out.push(`${first} is making good progress in ${subject} and understands most of what we have covered this term.`);
  else if (o.average !== null) out.push(`${first} is working towards the expected standard in ${subject}; regular revision of each topic will help secure the basics.`);
  if (o.missing >= 2) out.push(`Handing in every piece of homework on time is ${first}'s next step: ${o.missing} pieces are still missing.`);
  else out.push(`${first} completes homework reliably and on time.`);
  if (o.points >= 8) out.push(`${first} contributes positively in lessons and is a kind, helpful member of the class.`);
  else if (o.points < 0) out.push(`Staying focused for the whole lesson would help ${first} make faster progress.`);
  if (o.attendance !== null && o.attendance < 92) out.push(`Attendance (${o.attendance}%) has affected continuity; please help ${first} be in every lesson.`);
  out.push(`Next term, ${first} should aim to ask questions as soon as something is unclear and review feedback before each new task.`);
  return out;
}
