/**
 * Synthetic demo students for the v1 web app (docs/V1-WEB-CONTRACT.md). Fictional people only.
 * Selected with the `x-dev-user` header: demo-g5 | demo-g7 | demo-g9 | demo-g11 (default demo-g11).
 */
import type { ActivityKind, ActivityMetricDef, DemoStudentId, OpportunityType, ProfileLinkKey, V1BandId } from '@murshid/core';
import { IDEAL_PROFILE } from './ideal';
import { DEMO_EXTRAS } from './extras';

export interface SubjectDef {
  id: string;
  name: string;
  nameAr: string;
  teacher: string;
  /** score (%) a year ago, and points gained per week since */
  base: number;
  slope: number;
  target: number;
  /** assess every N teaching weeks */
  every: number;
  /** false = no generated history (subjects added by staff) */
  generate?: boolean;
}

export interface MetricGen extends ActivityMetricDef { start: number; end: number; decimals: number }

/** Fixtures for a sport: school matches (football) or galas/meets (swimming). */
export interface FixtureDef {
  kind: 'match' | 'race';
  /** weekday (0=Sun..6=Sat) the fixture falls on */
  day: number;
  everyWeeks: number;
  minutes: number;
  /** metric keys recorded at fixtures (from ActivityDef.metrics) */
  metricKeys: string[];
  /** opponent / meet names cycled through */
  names: string[];
  /** months (1-12) with no fixtures (off-season) */
  offMonths?: number[];
}

export interface ActivityDef {
  id: ActivityKind;
  /** weekdays (0=Sun..6=Sat) with a regular session; [] = event-based (hackathons) */
  days: number[];
  minutes: number;
  weeklyTargetMinutes: number;
  metrics: MetricGen[];
  /** event-based activities: one event every N weeks, on Saturday */
  eventEveryWeeks?: number;
  /** metric keys recorded at regular training sessions (default: all except fixture-only keys) */
  trainingMetricKeys?: string[];
  fixtures?: FixtureDef;
  /** role / level for CV and coach context, e.g. "Vice-captain, U18 1st XI" */
  role?: string;
  /** false = no generated history (activities added by staff) */
  generate?: boolean;
  detail: string;
  detailAr: string;
}

export type GoalSource =
  | { kind: 'metric'; activity: ActivityKind; metric: string }
  | { kind: 'subject'; subject: string }
  | { kind: 'events'; activity: ActivityKind }
  | { kind: 'weekly-sessions'; activity: ActivityKind }
  | { kind: 'steady'; perWeek: number } // e.g. books read, milestones done
  | { kind: 'manual'; current: number } // entered by staff / the student
  | { kind: 'project'; project: string; metric: 'revenue' | 'customers' | 'orders' };

export interface GoalDef {
  id: string;
  title: string;
  titleAr: string;
  category: 'academic' | 'university' | 'career' | 'sport' | 'skill' | 'personal';
  unit: string;
  start: number;
  target: number;
  better: 'higher' | 'lower';
  dueInDays: number;
  source: GoalSource;
}

export interface OppDef {
  id: string;
  title: string;
  organizer: string;
  type: OpportunityType;
  emirate: string | null;
  deadlineInDays: number;
  minGrade: number;
  maxGrade: number;
  costAed: number;
  tags: string[];
  why: string;
  /** absolute deadline (YYYY-MM-DD); overrides deadlineInDays (admin-published opportunities) */
  deadline?: string;
  url?: string;
  source?: 'demo' | 'admin';
  publishedAt?: string;
}

/** A side project / small business the student runs. Monthly metrics are generated from `growth`. */
export interface ProjectDef {
  id: string;
  name: string;
  tagline: string;
  kind: 'business' | 'app' | 'club' | 'creative' | 'research';
  role: string;
  /** days relative to today */
  startInDays: number;
  url?: string;
  /** monthly revenue (AED) / orders / new customers generator; omit for non-commercial projects */
  growth?: { revenueStart: number; revenueEnd: number; aov: number; repeatRate: number; followersEnd?: number };
  milestones: { title: string; inDays: number; done?: boolean }[];
  skills: string[];
}

export interface CvFields {
  headline: string;
  summary: string;
  email: string | null;
  phone: string | null;
  location: string;
  skills: string[];
  certifications: { name: string; issuer: string; date: string }[];
  featured: { title: string; url: string | null; description: string }[];
  /** predicted grades line for the CV, e.g. "Predicted A*A*A" */
  predicted: string | null;
  universityGoal: string | null;
}

export interface PastOppDef {
  title: string;
  organizer: string;
  type: OpportunityType;
  /** days relative to today (negative = past) */
  appliedInDays: number;
  status: 'saved' | 'preparing' | 'submitted' | 'accepted' | 'rejected';
  outcome?: string;
}

export interface AchievementDef {
  title: string;
  category: 'academic' | 'award' | 'sport' | 'project' | 'volunteering' | 'work' | 'certificate' | 'leadership';
  inDays: number;
  description: string;
}

export interface DemoProfile {
  /** demo-g5 … demo-ideal, or an id minted by the admin portal */
  id: string;
  name: string;
  preferredName: string;
  nameAr: string;
  grade: number;
  band: V1BandId;
  age: number;
  school: string;
  curriculum: 'british' | 'american' | 'indian_cbse' | 'ib' | 'uae_moe';
  classLabel: string;
  emirate: 'dubai' | 'abu_dhabi' | 'sharjah';
  languages: string[];
  interests: string[];
  studyStreakDays: number;
  subjects: SubjectDef[];
  activities: ActivityDef[];
  goals: GoalDef[];
  links: Partial<Record<ProfileLinkKey, string>>;
  opportunities: OppDef[];
  projects?: ProjectDef[];
  cv?: Partial<CvFields>;
  pastOpportunities?: PastOppDef[];
  achievements?: AchievementDef[];
  nationality?: string;
  /** flagship persona shown first in demos */
  flagship?: boolean;
}

export function bandForGrade(grade: number): V1BandId {
  return grade <= 6 ? 'g5-6' : grade <= 8 ? 'g7-8' : grade <= 10 ? 'g9-10' : 'g11-12';
}

export const m = (key: string, label: string, unit: string, better: 'higher' | 'lower', start: number, end: number, decimals = 0): MetricGen =>
  ({ key, label, unit, better, start, end, decimals });

export const sub = (id: string, name: string, nameAr: string, teacher: string, base: number, slope: number, target: number, every = 2): SubjectDef =>
  ({ id, name, nameAr, teacher, base, slope, target, every });

const BASE_PROFILES: Record<Exclude<DemoStudentId, 'demo-ideal'>, DemoProfile> = {
  'demo-g5': {
    id: 'demo-g5', name: 'Layla Haddad', preferredName: 'Layla', nameAr: 'ليلى حداد', grade: 5, band: 'g5-6', age: 10,
    school: 'Demo Primary School', curriculum: 'british', classLabel: 'Year 6 (Grade 5)', emirate: 'dubai',
    languages: ['English', 'Arabic'], interests: ['reading', 'running', 'piano', 'animals'], studyStreakDays: 4,
    subjects: [
      sub('english', 'English', 'اللغة الإنجليزية', 'Ms. Demo', 74, 0.12, 85),
      sub('arabic', 'Arabic', 'اللغة العربية', 'Ms. Example', 70, 0.15, 80, 3),
      sub('maths', 'Maths', 'الرياضيات', 'Mr. Sample', 68, 0.2, 85),
      sub('science', 'Science', 'العلوم', 'Ms. Test', 77, 0.08, 85, 3),
      sub('social-studies', 'Social Studies', 'الدراسات الاجتماعية', 'Mr. Demo', 80, 0.03, 85, 3),
    ],
    activities: [
      { id: 'athletics', days: [2, 4], minutes: 45, weeklyTargetMinutes: 90, detail: 'School running club', detailAr: 'نادي الجري المدرسي',
        metrics: [m('sprint50m', '50m sprint', 's', 'lower', 9.9, 9.1, 2)] },
      { id: 'music', days: [1, 3, 6], minutes: 20, weeklyTargetMinutes: 60, detail: 'Piano practice', detailAr: 'تمرين البيانو',
        metrics: [m('piecesLearned', 'Pieces learned', 'pieces', 'higher', 0, 9)] },
    ],
    goals: [
      { id: 'goal-reading', title: 'Read 20 books this year', titleAr: 'قراءة 20 كتابًا هذا العام', category: 'personal', unit: 'books',
        start: 0, target: 20, better: 'higher', dueInDays: 260, source: { kind: 'steady', perWeek: 0.55 } },
      { id: 'goal-50m', title: 'Run 50m in under 9 seconds', titleAr: 'الجري 50 مترًا في أقل من 9 ثوانٍ', category: 'sport', unit: 's',
        start: 9.9, target: 9.0, better: 'lower', dueInDays: 150, source: { kind: 'metric', activity: 'athletics', metric: 'sprint50m' } },
    ],
    links: {},
    opportunities: [
      { id: 'opp-g5-spelling', title: 'Emirates Junior Spelling Bee (Demo)', organizer: 'Example Literacy Trust', type: 'competition', emirate: 'dubai', deadlineInDays: 18, minGrade: 4, maxGrade: 7, costAed: 0, tags: ['reading', 'english'], why: 'You love reading and your English is climbing.' },
      { id: 'opp-g5-science', title: 'Young Scientists Weekend (Demo)', organizer: 'Example Science Centre', type: 'course', emirate: 'sharjah', deadlineInDays: 25, minGrade: 4, maxGrade: 6, costAed: 150, tags: ['science', 'animals'], why: 'Hands-on science with animals.' },
      { id: 'opp-g5-run', title: 'Kids Fun Run 3K (Demo)', organizer: 'Example Sports Council', type: 'competition', emirate: 'dubai', deadlineInDays: 9, minGrade: 3, maxGrade: 8, costAed: 50, tags: ['running', 'sport'], why: 'A good next step after running club.' },
    ],
  },
  'demo-g7': {
    id: 'demo-g7', name: 'Omar Siddiqui', preferredName: 'Omar', nameAr: 'عمر صدّيقي', grade: 7, band: 'g7-8', age: 12,
    school: 'Demo American School', curriculum: 'american', classLabel: 'Grade 7', emirate: 'abu_dhabi',
    languages: ['Arabic', 'English'], interests: ['robotics', 'football', 'oud', 'space'], studyStreakDays: 6,
    subjects: [
      sub('english', 'English Language Arts', 'اللغة الإنجليزية', 'Ms. Demo', 71, 0.1, 85),
      sub('arabic', 'Arabic', 'اللغة العربية', 'Mr. Example', 82, 0.05, 90, 3),
      sub('maths', 'Math', 'الرياضيات', 'Ms. Sample', 72, 0.22, 90),
      sub('science', 'Science', 'العلوم', 'Mr. Test', 75, 0.14, 88),
      sub('social-studies', 'Social Studies', 'الدراسات الاجتماعية', 'Ms. Demo', 78, 0.04, 85, 3),
      sub('islamic-studies', 'Islamic Studies', 'التربية الإسلامية', 'Mr. Example', 86, 0.02, 90, 3),
      sub('computing', 'Computing', 'الحوسبة', 'Ms. Test', 80, 0.18, 92, 3),
    ],
    activities: [
      { id: 'athletics', days: [1, 3], minutes: 60, weeklyTargetMinutes: 120, detail: 'Track & field squad', detailAr: 'فريق ألعاب القوى',
        metrics: [m('time100m', '100m time', 's', 'lower', 15.6, 14.7, 2)] },
      { id: 'robotics', days: [4], minutes: 90, weeklyTargetMinutes: 90, detail: 'VEX IQ robotics club', detailAr: 'نادي روبوتات VEX IQ',
        metrics: [m('autonomousScore', 'Autonomous run score', 'pts', 'higher', 12, 31)] },
      { id: 'music', days: [2, 6], minutes: 30, weeklyTargetMinutes: 60, detail: 'Oud lessons', detailAr: 'دروس العود',
        metrics: [m('maqamatLearned', 'Maqamat learned', 'maqamat', 'higher', 1, 5)] },
    ],
    goals: [
      { id: 'goal-maths-a', title: 'Reach an A in Math', titleAr: 'الحصول على A في الرياضيات', category: 'academic', unit: '%',
        start: 72, target: 90, better: 'higher', dueInDays: 230, source: { kind: 'subject', subject: 'maths' } },
      { id: 'goal-robotics-league', title: 'Qualify for the regional robotics league', titleAr: 'التأهل لدوري الروبوتات الإقليمي', category: 'skill', unit: 'pts',
        start: 12, target: 35, better: 'higher', dueInDays: 120, source: { kind: 'metric', activity: 'robotics', metric: 'autonomousScore' } },
    ],
    links: {},
    opportunities: [
      { id: 'opp-g7-robot', title: 'Junior Robotics League (Demo)', organizer: 'Example Robotics Org', type: 'competition', emirate: 'abu_dhabi', deadlineInDays: 21, minGrade: 6, maxGrade: 9, costAed: 200, tags: ['robotics', 'coding'], why: 'Your autonomous score is close to the qualifying mark.' },
      { id: 'opp-g7-space', title: 'Space Explorers Camp (Demo)', organizer: 'Example Space Academy', type: 'summer_program', emirate: 'dubai', deadlineInDays: 60, minGrade: 6, maxGrade: 9, costAed: 1200, tags: ['space', 'science'], why: 'Matches your interest in space.' },
      { id: 'opp-g7-maths', title: 'Emirates Maths Challenge (Demo)', organizer: 'Example Maths Society', type: 'olympiad', emirate: null, deadlineInDays: 14, minGrade: 6, maxGrade: 8, costAed: 0, tags: ['maths'], why: 'Good practice for your Math goal.' },
    ],
  },
  'demo-g9': {
    id: 'demo-g9', name: 'Priya Menon', preferredName: 'Priya', nameAr: 'بريا مينون', grade: 9, band: 'g9-10', age: 14,
    school: 'Demo Indian High School', curriculum: 'indian_cbse', classLabel: 'Class 9', emirate: 'sharjah',
    languages: ['English', 'Hindi', 'Arabic'], interests: ['coding', 'ai', 'fitness', 'debate'], studyStreakDays: 9,
    subjects: [
      sub('english', 'English', 'اللغة الإنجليزية', 'Ms. Demo', 79, 0.08, 90),
      sub('maths', 'Mathematics', 'الرياضيات', 'Mr. Sample', 76, 0.2, 95),
      sub('science', 'Science', 'العلوم', 'Ms. Test', 81, 0.16, 95),
      sub('social-science', 'Social Science', 'العلوم الاجتماعية', 'Mr. Example', 74, 0.1, 85, 3),
      sub('arabic', 'Arabic', 'اللغة العربية', 'Ms. Example', 66, 0.12, 75, 3),
      sub('computer-applications', 'Computer Applications', 'تطبيقات الحاسوب', 'Mr. Demo', 85, 0.12, 95, 3),
    ],
    activities: [
      { id: 'gym', days: [0, 2, 4], minutes: 45, weeklyTargetMinutes: 135, detail: 'School fitness centre', detailAr: 'مركز اللياقة المدرسي',
        metrics: [m('squatKg', 'Squat (5 reps)', 'kg', 'higher', 25, 45), m('plankSec', 'Plank hold', 's', 'higher', 60, 150)] },
      { id: 'robotics', days: [3], minutes: 120, weeklyTargetMinutes: 120, detail: 'Robotics & AI club', detailAr: 'نادي الروبوتات والذكاء الاصطناعي',
        metrics: [m('buildHours', 'Build hours', 'h', 'higher', 1, 2, 1)] },
      { id: 'hackathon', days: [], minutes: 480, weeklyTargetMinutes: 0, eventEveryWeeks: 7, detail: 'Student hackathons', detailAr: 'هاكاثونات الطلاب',
        metrics: [m('projects', 'Projects shipped', 'projects', 'higher', 1, 1), m('placement', 'Placement', 'rank', 'lower', 14, 4)] },
    ],
    goals: [
      { id: 'goal-science-95', title: '95% in Science', titleAr: '95٪ في العلوم', category: 'academic', unit: '%',
        start: 81, target: 95, better: 'higher', dueInDays: 170, source: { kind: 'subject', subject: 'science' } },
      { id: 'goal-hackathon-top3', title: 'Place top 3 at a hackathon', titleAr: 'الوصول إلى المراكز الثلاثة الأولى في هاكاثون', category: 'skill', unit: 'rank',
        start: 14, target: 3, better: 'lower', dueInDays: 200, source: { kind: 'metric', activity: 'hackathon', metric: 'placement' } },
      { id: 'goal-gym-3x', title: 'Train 3× a week', titleAr: 'التمرين 3 مرات أسبوعيًا', category: 'personal', unit: 'sessions/wk',
        start: 0, target: 3, better: 'higher', dueInDays: 90, source: { kind: 'weekly-sessions', activity: 'gym' } },
    ],
    links: { github: 'https://github.com/priya-demo' },
    opportunities: [
      { id: 'opp-g9-hack', title: 'Youth AI Hackathon (Demo)', organizer: 'Example Tech Hub', type: 'hackathon', emirate: 'dubai', deadlineInDays: 12, minGrade: 8, maxGrade: 12, costAed: 0, tags: ['ai', 'coding'], why: 'Your placements keep improving — this one has a junior track.' },
      { id: 'opp-g9-olympiad', title: 'National Science Olympiad (Demo)', organizer: 'Example Science Society', type: 'olympiad', emirate: null, deadlineInDays: 27, minGrade: 8, maxGrade: 10, costAed: 100, tags: ['science', 'maths'], why: 'Fits your Science goal.' },
      { id: 'opp-g9-mun', title: 'Sharjah Junior MUN (Demo)', organizer: 'Example MUN Society', type: 'mun', emirate: 'sharjah', deadlineInDays: 33, minGrade: 8, maxGrade: 12, costAed: 250, tags: ['debate'], why: 'You listed debate as an interest.' },
      { id: 'opp-g9-volunteer', title: 'Coding for Kids Volunteers (Demo)', organizer: 'Example Charity', type: 'volunteering', emirate: 'sharjah', deadlineInDays: 40, minGrade: 9, maxGrade: 12, costAed: 0, tags: ['coding', 'volunteering'], why: 'Teach what you build.' },
    ],
  },
  'demo-g11': {
    id: 'demo-g11', name: 'Zayed Al Mansoori', preferredName: 'Zayed', nameAr: 'زايد المنصوري', grade: 11, band: 'g11-12', age: 16,
    school: 'Demo British School', curriculum: 'british', classLabel: 'Year 12 (Grade 11)', emirate: 'dubai',
    languages: ['English', 'Arabic', 'French'], interests: ['engineering', 'athletics', 'hackathons', 'robotics'], studyStreakDays: 12,
    subjects: [
      sub('maths', 'Mathematics', 'الرياضيات', 'Dr. Demo', 80, 0.14, 90),
      sub('further-maths', 'Further Mathematics', 'الرياضيات المتقدمة', 'Dr. Demo', 70, 0.2, 85, 3),
      sub('physics', 'Physics', 'الفيزياء', 'Ms. Test', 74, 0.22, 90),
      sub('computer-science', 'Computer Science', 'علوم الحاسوب', 'Mr. Sample', 84, 0.1, 92),
      sub('english', 'English Literature', 'الأدب الإنجليزي', 'Ms. Example', 72, 0.06, 80, 3),
    ],
    activities: [
      { id: 'athletics', days: [1, 3, 6], minutes: 60, weeklyTargetMinutes: 180, detail: 'Sprint squad (100m / 200m)', detailAr: 'فريق العدو السريع (100م / 200م)',
        metrics: [m('time100m', '100m time', 's', 'lower', 13.95, 13.38, 2), m('time200m', '200m time', 's', 'lower', 29.1, 27.9, 2)] },
      { id: 'gym', days: [0, 2, 4], minutes: 50, weeklyTargetMinutes: 150, detail: 'Strength & conditioning', detailAr: 'القوة واللياقة',
        metrics: [m('squatKg', 'Back squat (5 reps)', 'kg', 'higher', 40, 62.5, 1), m('benchKg', 'Bench press (5 reps)', 'kg', 'higher', 25, 35, 1)] },
      { id: 'hackathon', days: [], minutes: 600, weeklyTargetMinutes: 0, eventEveryWeeks: 6, detail: 'Hackathons & build weekends', detailAr: 'الهاكاثونات وعطلات البناء',
        metrics: [m('projects', 'Projects shipped', 'projects', 'higher', 1, 1), m('placement', 'Placement', 'rank', 'lower', 11, 2)] },
      { id: 'robotics', days: [5], minutes: 90, weeklyTargetMinutes: 90, detail: 'FIRST Tech Challenge team', detailAr: 'فريق FIRST Tech Challenge',
        metrics: [m('matchScore', 'Practice match score', 'pts', 'higher', 60, 140)] },
    ],
    goals: [
      { id: 'goal-100m', title: 'Run 100m under 13.2s', titleAr: 'الجري 100 متر في أقل من 13.2 ثانية', category: 'sport', unit: 's',
        start: 13.95, target: 13.2, better: 'lower', dueInDays: 140, source: { kind: 'metric', activity: 'athletics', metric: 'time100m' } },
      { id: 'goal-physics-astar', title: 'A* in Physics (90%+)', titleAr: 'A* في الفيزياء (90٪ فأكثر)', category: 'academic', unit: '%',
        start: 74, target: 90, better: 'higher', dueInDays: 250, source: { kind: 'subject', subject: 'physics' } },
      { id: 'goal-ship-3', title: 'Ship 3 hackathon projects this year', titleAr: 'إنجاز 3 مشاريع في الهاكاثونات هذا العام', category: 'skill', unit: 'projects',
        start: 0, target: 3, better: 'higher', dueInDays: 260, source: { kind: 'events', activity: 'hackathon' } },
      { id: 'goal-gym-3x', title: 'Gym 3× a week', titleAr: 'النادي 3 مرات أسبوعيًا', category: 'personal', unit: 'sessions/wk',
        start: 0, target: 3, better: 'higher', dueInDays: 80, source: { kind: 'weekly-sessions', activity: 'gym' } },
    ],
    links: {
      linkedin: 'https://www.linkedin.com/in/zayed-demo',
      github: 'https://github.com/zayed-demo',
      portfolio: 'https://zayed-demo.example.com',
      resumeUrl: 'https://zayed-demo.example.com/cv.pdf',
    },
    opportunities: [
      { id: 'opp-g11-ftc', title: 'UAE Robotics Challenge (Demo)', organizer: 'Example Robotics Org', type: 'competition', emirate: 'dubai', deadlineInDays: 19, minGrade: 9, maxGrade: 12, costAed: 0, tags: ['robotics', 'engineering'], why: 'Your FTC practice scores more than doubled this year.' },
      { id: 'opp-g11-summer', title: 'Summer Engineering Programme (Demo)', organizer: 'Example University', type: 'summer_program', emirate: 'abu_dhabi', deadlineInDays: 55, minGrade: 11, maxGrade: 12, costAed: 4500, tags: ['engineering', 'university'], why: 'Strong fit for an engineering application.' },
      { id: 'opp-g11-hack', title: 'Gulf Student Hackathon (Demo)', organizer: 'Example Tech Hub', type: 'hackathon', emirate: 'dubai', deadlineInDays: 8, minGrade: 9, maxGrade: 12, costAed: 0, tags: ['coding', 'ai'], why: 'Keeps you on track for 3 projects this year.' },
      { id: 'opp-g11-physics', title: 'Youth Physics Olympiad (Demo)', organizer: 'Example Science Society', type: 'olympiad', emirate: null, deadlineInDays: 24, minGrade: 10, maxGrade: 12, costAed: 0, tags: ['physics', 'maths'], why: 'Supports your A* Physics goal.' },
      { id: 'opp-g11-intern', title: 'Engineering Work Shadow (Demo)', organizer: 'Example Energy Co.', type: 'internship', emirate: 'abu_dhabi', deadlineInDays: 38, minGrade: 11, maxGrade: 12, costAed: 0, tags: ['engineering'], why: 'Real-world experience for your personal statement.' },
    ],
  },
};

export const DEMO_PROFILES: Record<DemoStudentId, DemoProfile> = {
  ...(Object.fromEntries(Object.entries(BASE_PROFILES).map(([id, p]) => [id, { ...p, ...DEMO_EXTRAS[id as keyof typeof DEMO_EXTRAS] }])) as Record<Exclude<DemoStudentId, 'demo-ideal'>, DemoProfile>),
  'demo-ideal': IDEAL_PROFILE,
};
