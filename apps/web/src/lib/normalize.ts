/**
 * Tolerant adapters: Logic team's v1 API payloads (apps/api/src/v1/schemas.ts) → the web's contract-shaped types.
 * Accepts both the contract shape (docs/V1-WEB-CONTRACT.md) and the richer v1 shape; returns null if neither fits,
 * so the client falls back to the bundled mock.
 */
import type { BandId } from './bands';
import type {
  Academics, ChartSpec, Dashboard, Opportunity, ProfileLinks, Subject, Task, UpcomingItem, UpcomingType,
} from './types';

type O = Record<string, unknown>;
const isObj = (x: unknown): x is O => typeof x === 'object' && x !== null && !Array.isArray(x);
const str = (x: unknown, d = ''): string => (typeof x === 'string' ? x : d);
const num = (x: unknown, d = 0): number => (typeof x === 'number' && Number.isFinite(x) ? x : d);
const clampPct = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
const BANDS: BandId[] = ['g5-6', 'g7-8', 'g9-10', 'g11-12'];

export function toChartSpec(x: unknown): ChartSpec | null {
  if (!isObj(x) || typeof x.type !== 'string' || !Array.isArray(x.series) || !Array.isArray(x.data) || typeof x.xKey !== 'string') return null;
  return { ...(x as unknown as ChartSpec), insight: str(x.insight), title: str(x.title), id: str(x.id, `api-${Math.random().toString(36).slice(2)}`), generatedBy: x.generatedBy === 'ai' ? 'ai' : 'rules' };
}

function taskArea(x: O): Task['area'] {
  const a = str(x.area).toLowerCase();
  const k = str(x.kind).toLowerCase();
  if (['academics', 'extracurriculars', 'goals', 'wellbeing', 'applications'].includes(a)) return a as Task['area'];
  if (a && ['athletics', 'gym', 'hackathon', 'robotics', 'music', 'football', 'coding'].includes(a)) return 'extracurriculars';
  if (/application|essay|statement/.test(k)) return 'applications';
  if (/session|training|practice|activity/.test(k)) return 'extracurriculars';
  if (/sleep|wellbeing|rest/.test(k)) return 'wellbeing';
  return 'academics';
}

export function toTask(x: unknown): Task | null {
  if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string') return null;
  const due = str(x.due) || str(x.time) || undefined;
  return {
    id: x.id, title: x.title, area: taskArea(x), done: x.done === true || x.status === 'done',
    ...(due ? { due } : {}),
    ...(typeof x.minutes === 'number' ? { minutes: x.minutes } : typeof x.durationMinutes === 'number' && x.durationMinutes > 0 ? { minutes: x.durationMinutes } : {}),
  };
}

function upcomingType(x: O): UpcomingType {
  const t = str(x.type) || str(x.kind);
  const known: UpcomingType[] = ['test', 'homework', 'event', 'competition', 'deadline', 'exam', 'session'];
  if (known.includes(t as UpcomingType)) return t as UpcomingType;
  if (t === 'assessment') return /exam|mock|paper/i.test(str(x.title)) ? 'exam' : 'test';
  return 'event';
}

export function toUpcoming(x: unknown): UpcomingItem | null {
  if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string' || typeof x.date !== 'string') return null;
  return { id: x.id, title: x.title, date: x.date, type: upcomingType(x) };
}

export function toDashboard(x: unknown, locale: 'en' | 'ar' = 'en'): Dashboard | null {
  if (!isObj(x) || !Array.isArray(x.today) || !Array.isArray(x.upcoming) || !isObj(x.progress) || !isObj(x.student)) return null;
  const s = x.student;
  const full = str(s.name, `${str(s.firstName)} ${str(s.lastName)}`).trim();
  const first = str(s.firstName) || str(s.preferredName) || full.split(' ')[0] || '';
  const last = str(s.lastName) || full.split(' ').slice(1).join(' ');
  const band = (BANDS.includes(x.band as BandId) ? x.band : BANDS.includes(s.band as BandId) ? s.band : 'g9-10') as BandId;
  const p = x.progress;
  const academics = typeof p.academics === 'number' ? p.academics
    : isObj(p.academics) ? (num(p.academics.target) ? (num(p.academics.average) / num(p.academics.target)) * 100 : num(p.academics.average)) : 0;
  const extracurriculars = typeof p.extracurriculars === 'number' ? p.extracurriculars
    : isObj(p.extracurriculars) ? (num(p.extracurriculars.weeklyTargetMinutes) ? (Math.max(num(p.extracurriculars.thisWeekMinutes), num(p.extracurriculars.last7dMinutes)) / num(p.extracurriculars.weeklyTargetMinutes)) * 100 : 0) : 0;
  const goals = typeof p.goals === 'number' ? p.goals
    : Array.isArray(p.goals) && p.goals.length ? (p.goals as O[]).reduce((m, g) => m + (num(g.progress) > 1 ? num(g.progress) : num(g.progress) * 100), 0) / p.goals.length : 0;
  const st = isObj(x.streaks) ? x.streaks : {};
  const highlights = Array.isArray(x.highlights)
    ? (x.highlights as unknown[]).map((h) => (typeof h === 'string' ? h : isObj(h) ? (locale === 'ar' ? str(h.textAr) || str(h.text) : str(h.text)) : '')).filter(Boolean)
    : [];
  return {
    student: { id: str(s.id), firstName: first, lastName: last, nameAr: str(s.nameAr, full), grade: num(s.grade, 9), classLabel: str(s.classLabel), school: str(s.school), band },
    band,
    today: (x.today as unknown[]).map(toTask).filter((t): t is Task => !!t),
    upcoming: (x.upcoming as unknown[]).map(toUpcoming).filter((u): u is UpcomingItem => !!u),
    progress: { academics: clampPct(academics), extracurriculars: clampPct(extracurriculars), goals: clampPct(goals) },
    streaks: { current: num(st.current, num(st.studyDays)), best: num(st.best, num(st.longestStudyDays)) },
    highlights,
  };
}

export function toAcademics(x: unknown): Academics | null {
  if (!isObj(x) || !Array.isArray(x.subjects)) return null;
  const subjects: Subject[] = [];
  for (const raw of x.subjects as unknown[]) {
    if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') continue;
    let trend: number[] = [];
    if (Array.isArray(raw.trend)) trend = (raw.trend as unknown[]).filter((n): n is number => typeof n === 'number');
    else if (Array.isArray(raw.grades)) trend = (raw.grades as O[]).map((g) => num(g.percent)).slice(-4);
    else if (Array.isArray(raw.monthly)) trend = (raw.monthly as O[]).map((g) => num(g.average)).slice(-4);
    const current = num(raw.current);
    if (trend.length < 2) trend = [current - num(raw.delta12w), current];
    subjects.push({ id: raw.id, name: raw.name, scale: raw.scale === 'ib7' ? 'ib7' : 'percent', current, target: num(raw.target, current), trend });
  }
  if (!subjects.length) return null;
  const term = isObj(x.term) ? str(x.term.label, 'Term') : str(x.term, 'Term');
  const scale = subjects.every((s) => s.scale === 'ib7') ? 'ib7' : 'percent';
  return { term, average: num(x.average, subjects.reduce((m, s) => m + s.current, 0) / subjects.length), scale, subjects };
}

export function toLinks(x: unknown): ProfileLinks | null {
  if (!isObj(x) || !('linkedin' in x) || !('github' in x)) return null;
  const n = (k: string) => (typeof x[k] === 'string' && x[k] ? (x[k] as string) : null);
  return {
    linkedin: n('linkedin'), github: n('github'), instagram: n('instagram'), portfolio: n('portfolio'),
    resumeUrl: n('resumeUrl') ?? n('resume'), resumeName: n('resumeName'),
    connectedAt: isObj(x.connectedAt) ? (x.connectedAt as ProfileLinks['connectedAt']) : {},
  };
}

const OPP_KIND: Record<string, Opportunity['kind']> = {
  competition: 'competition', olympiad: 'olympiad', 'summer-program': 'summer', summer: 'summer', internship: 'internship',
  hackathon: 'hackathon', volunteering: 'volunteering', scholarship: 'scholarship', 'university-event': 'summer',
};

export function toOpportunity(x: unknown): Opportunity | null {
  if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string') return null;
  const m = num(x.match, num(x.matchScore));
  return {
    id: x.id, title: x.title, org: str(x.org) || str(x.organizer), kind: OPP_KIND[str(x.kind) || str(x.type)] ?? 'competition',
    deadline: str(x.deadline), location: str(x.location) || str(x.emirateLabel) || 'UAE', match: Math.round(m <= 1 ? m * 100 : m),
    tags: Array.isArray(x.tags) ? (x.tags as unknown[]).map(String) : [], url: str(x.url, '#'),
    ...(x.saved === true ? { saved: true } : {}),
  };
}

/** Normalise tool-call args so the inline tool UIs always get web shapes. */
export function normalizeToolArgs(name: string, args: Record<string, unknown>): Record<string, unknown> {
  if (name === 'show_tasks' && Array.isArray(args.tasks)) return { ...args, tasks: (args.tasks as unknown[]).map(toTask).filter(Boolean) };
  if (name === 'show_opportunities') {
    const list = Array.isArray(args.opportunities) ? args.opportunities : Array.isArray(args.items) ? args.items : [];
    return { ...args, opportunities: (list as unknown[]).map(toOpportunity).filter(Boolean) };
  }
  return args;
}
