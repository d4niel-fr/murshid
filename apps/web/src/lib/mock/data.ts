/**
 * Bundled mock "world" for one demo student. Same shapes as the Logic team's API.
 * Deterministic: a seeded RNG per student/activity, dates relative to `today` (Asia/Dubai).
 */
import { BANDS, demoPersonas, demoStudents, type BandId, type DemoActivity } from '../bands';
import { addDays, resolveDate, todayISO } from '../dates';
import type {
  Academics, Activity, Application, Dashboard, Extracurriculars, Goal, Opportunity, ProfileLinks,
  Session, Subject, Task, UpcomingItem,
} from '../types';

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

interface AreaProfile { sessionMinutes: [number, number]; perWeek: number; metric?: { name: string; unit: string; start: number; end: number; decimals: number } }

const PROFILES: Record<string, AreaProfile> = {
  gym: { sessionMinutes: [45, 80], perWeek: 3, metric: { name: 'Bench press', unit: 'kg', start: 52, end: 74, decimals: 1 } },
  athletics: { sessionMinutes: [40, 70], perWeek: 3, metric: { name: '800m time', unit: 's', start: 168, end: 154, decimals: 1 } },
  swimming: { sessionMinutes: [45, 60], perWeek: 2, metric: { name: '50m freestyle', unit: 's', start: 52, end: 46, decimals: 1 } },
  football: { sessionMinutes: [60, 90], perWeek: 2, metric: { name: 'Sprint 30m', unit: 's', start: 5.2, end: 4.7, decimals: 2 } },
  piano: { sessionMinutes: [20, 35], perWeek: 4, metric: { name: 'Pieces learned', unit: 'pieces', start: 1, end: 9, decimals: 0 } },
  coding: { sessionMinutes: [45, 90], perWeek: 1 },
  debate: { sessionMinutes: [45, 60], perWeek: 1 },
  hackathon: { sessionMinutes: [60, 120], perWeek: 1 },
};

const LOWER_IS_BETTER = new Set(['s', 'min']);
const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

/**
 * Provided demo sessions (term so far) + a synthetic year of history before them, so 12-week/term/year charts
 * have shape. History metrics are extrapolated backwards to meet the first provided value.
 */
function sessionsFor(a: DemoActivity, studentId: string, today: string): Session[] {
  const p = PROFILES[a.area] ?? { sessionMinutes: [45, 60] as [number, number], perWeek: 1 };
  const r = rng(hash(studentId + a.id));
  const provided: Session[] = a.sessions
    .filter((x) => x.date <= today)
    .map((x, i) => ({ id: `${a.id}-p${i}`, date: x.date, minutes: x.minutes, ...(x.metric ? { metric: { ...x.metric, name: cap(x.metric.name) } } : {}), ...(x.note ? { note: x.note } : {}) }));
  const firstDate = provided[0]?.date ?? addDays(today, 1);
  const pm = provided.find((x) => x.metric)?.metric;
  let m = p.metric ? { ...p.metric } : undefined;
  if (pm) {
    const lower = LOWER_IS_BETTER.has(pm.unit);
    const decimals = Number.isInteger(pm.value) && pm.value > 20 ? 0 : 2;
    m = { name: pm.name, unit: pm.unit, end: pm.value, start: lower ? pm.value * 1.07 : pm.value * (pm.unit === 'kg' ? 0.8 : 0.6), decimals };
  } else if (provided.length) {
    m = undefined; // provided sessions carry no metric: keep history metric-free too
  }
  if (m && a.name.includes('5k')) m = { ...m, name: '5k time', unit: 'min', start: 26.5, end: 22.8 };

  const out: Session[] = [];
  const span = Math.max(1, Math.round((Date.parse(firstDate) - Date.parse(addDays(today, -364))) / 86400000));
  for (let d = 364; d >= 0; d--) {
    const date = addDays(today, -d);
    if (date >= firstDate) break;
    const t = 1 - (Math.round((Date.parse(firstDate) - Date.parse(date)) / 86400000)) / span; // 0 → 1 up to firstDate
    const dip = d > 60 && d < 110 ? 0.45 : 1; // summer holiday dip
    const chance = (p.perWeek / 7) * (0.7 + 0.5 * t) * dip;
    if (r() > chance) continue;
    const [lo, hi] = p.sessionMinutes;
    const s: Session = { id: `${a.id}-${date}`, date, minutes: Math.round(lo + r() * (hi - lo)) };
    if (m) {
      const v = m.start + (m.end - m.start) * Math.pow(t, 0.8) + (r() - 0.5) * Math.abs(m.end - m.start) * 0.08;
      const f = Math.pow(10, m.decimals);
      s.metric = { name: m.name, unit: m.unit, value: Math.max(0, Math.round(v * f) / f) };
    }
    out.push(s);
  }
  if (a.area === 'hackathon') {
    // past hackathon weekends: long sessions with a shipped project
    const names = ['Smart bin sorter', 'Arabic flashcards bot', 'Bus tracker', 'Solar quiz app', 'Water-saving dashboard'];
    [300, 230, 160, 95, 55].forEach((ago, i) => {
      const date = addDays(today, -ago);
      if (date >= firstDate) return;
      out.push({ id: `${a.id}-event-${i}`, date, minutes: 600 + Math.round(r() * 480), note: names[i] });
    });
    out.sort((x, y) => x.date.localeCompare(y.date));
  }
  return [...out, ...provided];
}

export interface MockWorld {
  band: BandId;
  today: string;
  dashboard: Dashboard;
  academics: Academics;
  extracurriculars: Extracurriculars;
  goals: Goal[];
  opportunities: Opportunity[];
  applications: Application[];
  links: ProfileLinks;
}

const OPPS: Omit<Opportunity, 'deadline' | 'match'>[] = [
  { id: 'op1', title: 'Youth Hack Dubai', org: 'Dubai youth tech council (demo)', kind: 'hackathon', location: 'Dubai', tags: ['coding', 'team'], url: 'https://example.org/youth-hack' },
  { id: 'op2', title: 'UAE Junior Maths Olympiad', org: 'Maths teachers network (demo)', kind: 'olympiad', location: 'Online + Abu Dhabi', tags: ['maths'], url: 'https://example.org/jmo' },
  { id: 'op3', title: 'Summer Science Research Week', org: 'University outreach (demo)', kind: 'summer', location: 'Abu Dhabi', tags: ['physics', 'research'], url: 'https://example.org/ssrw' },
  { id: 'op4', title: 'Inter-school Athletics Championship', org: 'Schools sports league (demo)', kind: 'competition', location: 'Dubai', tags: ['athletics'], url: 'https://example.org/athletics' },
  { id: 'op5', title: 'Beach clean-up volunteers', org: 'Emirates green group (demo)', kind: 'volunteering', location: 'Sharjah', tags: ['service'], url: 'https://example.org/cleanup' },
  { id: 'op6', title: 'Robotics & AI summer internship', org: 'Tech park (demo)', kind: 'internship', location: 'Dubai', tags: ['coding', 'robotics'], url: 'https://example.org/intern' },
  { id: 'op7', title: 'STEM excellence scholarship', org: 'Education foundation (demo)', kind: 'scholarship', location: 'UAE', tags: ['academics'], url: 'https://example.org/scholarship' },
];

const TASKS: Record<BandId, Omit<Task, 'id' | 'done'>[]> = {
  'g5-6': [
    { title: 'Read for 20 minutes', area: 'academics', minutes: 20 },
    { title: 'Maths: times tables practice', area: 'academics', minutes: 15 },
    { title: 'Pack swim kit for tomorrow', area: 'extracurriculars' },
    { title: 'Piano practice', area: 'extracurriculars', minutes: 25 },
  ],
  'g7-8': [
    { title: 'Maths homework set 6', area: 'academics', minutes: 30, due: '19:00' },
    { title: 'Physics: revise forces', area: 'academics', minutes: 25 },
    { title: 'Football training', area: 'extracurriculars', minutes: 90, due: '16:30' },
    { title: 'Debate: prepare 2 arguments', area: 'extracurriculars', minutes: 20 },
  ],
  'g9-10': [
    { title: 'Physics past paper Q1–6', area: 'academics', minutes: 45, due: '18:00' },
    { title: 'Track session: 6×200m', area: 'extracurriculars', minutes: 60, due: '16:30' },
    { title: 'Chemistry lab report draft', area: 'academics', minutes: 30 },
    { title: 'Hackathon team call', area: 'extracurriculars', minutes: 30, due: '20:00' },
    { title: 'Lights out by 22:30', area: 'wellbeing' },
  ],
  'g11-12': [
    { title: 'Physics IA: finish evaluation', area: 'academics', minutes: 60 },
    { title: 'Maths HL: 2 integration questions', area: 'academics', minutes: 40 },
    { title: 'Gym: upper body', area: 'extracurriculars', minutes: 70, due: '17:00' },
    { title: 'Personal statement: paragraph 3', area: 'applications', minutes: 30 },
    { title: 'Email counsellor re: references', area: 'applications', minutes: 10 },
  ],
};

/** Today's list for the flagship persona (CBSE, football, swimming, a small business). */
const IDEAL_TASKS: (typeof TASKS)[BandId] = [
  { title: 'Economics: elasticity questions 1–8', area: 'academics', minutes: 45 },
  { title: 'Physics: kinematics numericals (ch. 3)', area: 'academics', minutes: 40 },
  { title: 'Swim squad: 3.8 km set', area: 'extracurriculars', minutes: 75, due: '17:30' },
  { title: 'Tideline: reply to two school club orders', area: 'applications', minutes: 20 },
  { title: 'UCAS statement: paragraph 2', area: 'applications', minutes: 30 },
];

export function buildMockWorld(band: BandId, now: Date = new Date(), persona?: string | null): MockWorld {
  const today = todayISO(now);
  // a named persona (e.g. the flagship demo-ideal) replaces the band's default student when it belongs to this band
  const p = persona ? demoPersonas[persona] : undefined;
  const s = p && p.band === band ? p : demoStudents[band];
  const r = rng(hash(s.id));

  const activities: Activity[] = s.activities.map((a) => {
    const sessions = sessionsFor(a, s.id, today);
    return { id: a.id, name: a.name, kind: a.kind, area: a.area, weeklyTargetMinutes: a.weeklyTargetMinutes, sessions, totalHours: round1(sessions.reduce((m, x) => m + x.minutes, 0) / 60) };
  });

  const subjects: Subject[] = s.subjects.map((x, i) => ({
    id: x.id, name: x.name, scale: x.scale ?? 'percent', current: x.current, target: x.target, trend: x.trend,
    nextAssessment: { title: `${x.name} assessment`, date: addDays(today, 3 + i * 4) },
  }));
  const scale = subjects.every((x) => x.scale === 'ib7') ? 'ib7' as const : 'percent' as const;
  const avgRaw = subjects.reduce((m, x) => m + x.current, 0) / Math.max(1, subjects.length);
  const average = scale === 'ib7' ? Math.round(avgRaw * 10) / 10 : Math.round(avgRaw);

  const goals: Goal[] = s.goals.map((g) => {
    // real milestone titles from the band seed; the ring always equals the share of ticked milestones
    const titles = (g as { milestones?: string[] }).milestones?.length ? (g as { milestones: string[] }).milestones : null;
    const n = titles?.length ?? 4;
    const doneCount = Math.round(g.progress * n);
    return {
      id: g.id, title: g.title, area: g.area, progress: doneCount / n, due: resolveDate(g.due, today),
      milestones: Array.from({ length: n }, (_, i) => ({ id: `${g.id}-m${i}`, title: titles?.[i] ?? `Milestone ${i + 1}`, done: i < doneCount })),
    };
  });

  const upcoming: UpcomingItem[] = s.upcoming
    .map((u) => ({ ...u, date: resolveDate(u.date, today) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const today_: Task[] = (s.id === 'demo-ideal' ? IDEAL_TASKS : TASKS[band]).map((t, i) => ({ ...t, id: `t-${band}-${i}`, done: i === 0 && band !== 'g5-6' }));

  const last28 = addDays(today, -27);
  const recentMin = activities.reduce((m, a) => m + a.sessions.filter((x) => x.date >= last28).reduce((k, x) => k + Math.min(x.minutes, 180), 0), 0);
  const targetMin = activities.reduce((m, a) => m + a.weeklyTargetMinutes * 4, 0);

  const progress = {
    academics: Math.min(100, Math.round((subjects.reduce((m, x) => m + Math.min(1, x.current / x.target), 0) / Math.max(1, subjects.length)) * 100)),
    extracurriculars: Math.min(100, Math.round((recentMin / Math.max(1, targetMin)) * 100)),
    goals: Math.round((goals.reduce((m, g) => m + g.progress, 0) / Math.max(1, goals.length)) * 100),
  };

  const opportunities: Opportunity[] = OPPS
    .filter((o) => BANDS[band].features.externalOpportunities || o.kind === 'competition' || o.kind === 'volunteering')
    .map((o, i) => ({ ...o, deadline: addDays(today, 6 + i * 7), match: Math.round(62 + r() * 35) }))
    .sort((a, b) => b.match - a.match);

  const applications: Application[] = BANDS[band].features.applications
    ? [
        { id: 'ap1', opportunityId: 'op3', title: 'Summer Science Research Week', status: 'in-progress', deadline: addDays(today, 20), checklist: [
          { id: 'c1', title: 'Personal statement', done: true }, { id: 'c2', title: 'Teacher reference', done: false }, { id: 'c3', title: 'Transcript upload', done: false }] },
        { id: 'ap2', opportunityId: 'op6', title: 'Robotics & AI summer internship', status: 'saved', deadline: addDays(today, 34), checklist: [
          { id: 'c1', title: 'CV', done: true }, { id: 'c2', title: 'Portfolio link', done: true }, { id: 'c3', title: 'Cover letter', done: false }] },
        { id: 'ap3', opportunityId: 'op7', title: 'STEM excellence scholarship', status: 'submitted', deadline: addDays(today, -3), checklist: [
          { id: 'c1', title: 'Essay', done: true }, { id: 'c2', title: 'Grades', done: true }] },
      ]
    : [];

  const links: ProfileLinks = {
    linkedin: s.links?.linkedin ?? null,
    github: s.links?.github ?? null,
    instagram: null,
    portfolio: s.links?.portfolio ?? null,
    resumeUrl: band === 'g11-12' ? '/demo-resume.pdf' : null,
    resumeName: band === 'g11-12' ? `${s.firstName}_${s.lastName.replace(/\s+/g, '_')}_CV.pdf` : null,
    connectedAt: {
      linkedin: s.links?.linkedin ? addDays(today, -40) : null,
      github: s.links?.github ? addDays(today, -75) : null,
      resume: band === 'g11-12' ? addDays(today, -12) : null,
    },
  };

  const best = activities.reduce((b, a) => (a.totalHours > b.totalHours ? a : b), activities[0]!);
  const highlights = [
    `${best.name}: ${best.totalHours}h logged this year`,
    `${subjects.slice().sort((a, b) => (b.trend.at(-1)! - b.trend[0]!) - (a.trend.at(-1)! - a.trend[0]!))[0]!.name} is your most improved subject`,
  ];

  const dashboard: Dashboard = {
    student: { id: s.id, firstName: s.firstName, lastName: s.lastName, nameAr: s.nameAr, grade: s.grade, classLabel: s.classLabel, school: s.school, band },
    band, today: today_, upcoming, progress, streaks: s.streaks, highlights,
  };

  return { band, today, dashboard, academics: { term: 'Term 1', average, scale, subjects }, extracurriculars: { activities }, goals, opportunities, applications, links };
}

const cache = new Map<string, MockWorld>();
export function mockWorld(band: BandId, now: Date = new Date(), persona?: string | null): MockWorld {
  const key = `${band}:${todayISO(now)}:${persona ?? ''}`;
  let w = cache.get(key);
  if (!w) { w = buildMockWorld(band, now, persona); cache.set(key, w); }
  return w;
}

/** A signed-in student's world before anything is added: their name and grade, nothing invented. */
export function emptyWorld(band: BandId, who: { name?: string | null; grade?: number | null; school?: string | null }, now: Date = new Date()): MockWorld {
  const [firstName = 'there', ...rest] = (who.name ?? '').trim().split(/\s+/).filter(Boolean);
  const grade = who.grade ?? 0;
  return {
    band, today: todayISO(now),
    dashboard: {
      student: { id: 'me', firstName, lastName: rest.join(' '), nameAr: who.name ?? '', grade, classLabel: grade ? `Grade ${grade}` : '', school: who.school ?? '', band },
      band, today: [], upcoming: [], progress: { academics: 0, extracurriculars: 0, goals: 0 }, streaks: { current: 0, best: 0 }, highlights: [],
    },
    academics: { term: '', average: 0, subjects: [] },
    extracurriculars: { activities: [] },
    goals: [], opportunities: [], applications: [],
    links: { linkedin: null, github: null, instagram: null, portfolio: null, resumeUrl: null, connectedAt: {} },
  };
}
