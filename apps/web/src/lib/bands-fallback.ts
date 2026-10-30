/**
 * Local stand-in for @murshid/grade-bands (same exported names and a structural subset of its types).
 * src/lib/bands.ts decides which one the app uses; everything else imports from there.
 * All students here are synthetic demo data.
 */

export type BandId = 'g5-6' | 'g7-8' | 'g9-10' | 'g11-12';
export const BAND_IDS: readonly BandId[] = ['g5-6', 'g7-8', 'g9-10', 'g11-12'];

export type Localized = { en: string; ar: string };

export type WidgetId =
  | 'greeting' | 'today' | 'progress-rings' | 'upcoming' | 'streaks' | 'goals' | 'academics'
  | 'extracurriculars' | 'opportunities' | 'applications' | 'cv' | 'social-links' | 'ai-chat-entry'
  | 'badges' | 'weekly-briefing';

export type FeatureId =
  | 'aiChat' | 'aiCharts' | 'badges' | 'streaks' | 'leaderboards' | 'clubs' | 'schoolCompetitions'
  | 'externalCompetitions' | 'olympiads' | 'summerPrograms' | 'externalOpportunities' | 'studyPlanner'
  | 'subjectChoices' | 'careerExplorer' | 'portfolio' | 'cv' | 'applications' | 'universityPlanner'
  | 'examCountdowns' | 'socialLinks' | 'linkedin' | 'publicProfile' | 'directMessaging' | 'weeklyBriefing'
  | 'guardianView' | 'pushNotifications' | 'darkMode';

type ChartType = 'bar' | 'line' | 'area' | 'radial' | 'pie' | 'stacked-bar';
type ChartRange = '4w' | '12w' | 'term' | 'year';

export type NavId =
  | 'home' | 'today' | 'schoolwork' | 'activities' | 'goals' | 'badges' | 'clubs' | 'competitions' | 'planner'
  | 'opportunities' | 'subjects' | 'careers' | 'portfolio' | 'applications' | 'university' | 'cv' | 'links' | 'chat' | 'settings';

export interface NavItem { id: NavId; href: string; icon: string; label: Localized; requires?: FeatureId; primary: boolean }

/** Subset of the package's BandConfig that the web app reads. */
export interface BandConfig {
  id: BandId;
  label: Localized;
  grades: [number, number];
  nav: NavItem[];
  tone: { formality: 'playful' | 'friendly' | 'warm-direct' | 'professional' };
  dashboardWidgets: WidgetId[];
  features: Record<FeatureId, boolean>;
  copy: Record<string, string>;
  chartDefaults: {
    preferredTypes: ChartType[];
    maxSeries: number;
    defaultRange: ChartRange;
    allowedRanges: ChartRange[];
    insightStyle: 'celebrate' | 'encourage' | 'plain' | 'analytical';
  };
  rewards: { badges: boolean; streaks: boolean; streakGraceDays: number; celebrateMilestones: 'confetti' | 'subtle' | 'toast' | 'none' };
}

export interface DemoSession { date: string; minutes: number; metric?: { name: string; value: number; unit: string }; note?: string }
export interface DemoActivity {
  id: string; name: string;
  kind: 'sport' | 'music' | 'tech' | 'fitness' | 'club' | 'arts' | 'service';
  area: 'athletics' | 'gym' | 'hackathon' | 'football' | 'piano' | 'coding' | 'debate' | 'art' | 'swimming';
  weeklyTargetMinutes: number;
  sessions: DemoSession[];
}
export interface DemoSubject { id: string; name: string; scale?: 'percent' | 'ib7'; current: number; target: number; trend: number[] }
export interface DemoGoal { id: string; title: string; area: 'academics' | 'extracurriculars' | 'wellbeing' | 'future'; progress: number; due: string }
export interface DemoUpcoming { id: string; title: string; date: string; type: 'test' | 'homework' | 'event' | 'competition' | 'deadline' | 'exam' | 'session' }
export interface DemoStudent {
  id: string; synthetic: true;
  firstName: string; lastName: string; nameAr: string;
  grade: number; band: BandId; classLabel: string; school: string;
  subjects: DemoSubject[]; activities: DemoActivity[]; goals: DemoGoal[]; upcoming: DemoUpcoming[];
  streaks: { current: number; best: number };
  badges: string[];
  links?: Partial<Record<'linkedin' | 'github' | 'portfolio', string>>;
}

export function bandForGrade(grade: number): BandId {
  const g = Math.min(12, Math.max(5, Math.round(grade)));
  if (g <= 6) return 'g5-6';
  if (g <= 8) return 'g7-8';
  if (g <= 10) return 'g9-10';
  return 'g11-12';
}

const ALL_OFF: Record<FeatureId, boolean> = {
  aiChat: true, aiCharts: true, badges: false, streaks: true, leaderboards: false, clubs: true,
  schoolCompetitions: true, externalCompetitions: false, olympiads: false, summerPrograms: false,
  externalOpportunities: false, studyPlanner: true, subjectChoices: false, careerExplorer: false,
  portfolio: false, cv: false, applications: false, universityPlanner: false, examCountdowns: false,
  socialLinks: false, linkedin: false, publicProfile: false, directMessaging: false, weeklyBriefing: true,
  guardianView: true, pushNotifications: true, darkMode: true,
};

const copy = (en: Record<string, string>, ar: Record<string, string>) => {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(en)) out[`en.${k}`] = v;
  for (const [k, v] of Object.entries(ar)) out[`ar.${k}`] = v;
  return out;
};


const NAV: Record<NavId, Omit<NavItem, 'id' | 'primary'>> = {
  home: { href: '/app', icon: 'House', label: { en: 'Home', ar: 'الرئيسية' } },
  today: { href: '/app/today', icon: 'CalendarCheck', label: { en: 'Today', ar: 'اليوم' } },
  schoolwork: { href: '/app/academics', icon: 'BookOpen', label: { en: 'Schoolwork', ar: 'الدراسة' } },
  activities: { href: '/app/activities', icon: 'Activity', label: { en: 'Activities', ar: 'الأنشطة' } },
  goals: { href: '/app/goals', icon: 'Target', label: { en: 'Goals', ar: 'الأهداف' } },
  badges: { href: '/app/badges', icon: 'Award', label: { en: 'Badges', ar: 'الشارات' } },
  clubs: { href: '/app/clubs', icon: 'Users', label: { en: 'Clubs', ar: 'النوادي' } },
  competitions: { href: '/app/competitions', icon: 'Trophy', label: { en: 'Competitions', ar: 'المسابقات' } },
  planner: { href: '/app/planner', icon: 'CalendarRange', label: { en: 'Study planner', ar: 'مخطط الدراسة' } },
  opportunities: { href: '/app/opportunities', icon: 'Sparkles', label: { en: 'Opportunities', ar: 'الفرص' } },
  subjects: { href: '/app/subjects', icon: 'ListChecks', label: { en: 'Subject choices', ar: 'اختيار المواد' } },
  careers: { href: '/app/careers', icon: 'Compass', label: { en: 'Career explorer', ar: 'استكشاف المهن' } },
  portfolio: { href: '/app/portfolio', icon: 'FolderOpen', label: { en: 'Portfolio', ar: 'ملف الإنجازات' } },
  applications: { href: '/app/applications', icon: 'Send', label: { en: 'Applications', ar: 'الطلبات' } },
  university: { href: '/app/university', icon: 'GraduationCap', label: { en: 'University planner', ar: 'مخطط الجامعة' } },
  cv: { href: '/app/cv', icon: 'FileText', label: { en: 'CV', ar: 'السيرة الذاتية' } },
  links: { href: '/app/profile/links', icon: 'Link', label: { en: 'Profiles & links', ar: 'الحسابات والروابط' } },
  chat: { href: '/app/chat', icon: 'MessageCircle', label: { en: 'Ask Murshid', ar: 'اسأل مرشد' } },
  settings: { href: '/app/settings', icon: 'Settings', label: { en: 'Settings', ar: 'الإعدادات' } },
};
const nav = (...ids: NavId[]): NavItem[] => ids.map((id) => ({ id, primary: true, ...NAV[id] }));

export const BANDS: Record<BandId, BandConfig> = {
  'g5-6': {
    id: 'g5-6', label: { en: 'Grades 5–6', ar: 'الصفوف ٥–٦' }, grades: [5, 6], tone: { formality: 'playful' }, nav: nav('home', 'today', 'schoolwork', 'activities', 'badges', 'chat', 'settings'),
    dashboardWidgets: ['greeting', 'today', 'progress-rings', 'streaks', 'badges', 'upcoming', 'extracurriculars', 'academics', 'ai-chat-entry'],
    features: { ...ALL_OFF, badges: true },
    copy: copy(
      { 'greeting.morning': 'Good morning', 'greeting.afternoon': 'Hi there', 'greeting.evening': 'Good evening', 'dashboard.subtitle': "Let's make today a great one!", 'chat.placeholder': 'Ask Murshid anything…' },
      { 'greeting.morning': 'صباح الخير', 'greeting.afternoon': 'أهلاً', 'greeting.evening': 'مساء الخير', 'dashboard.subtitle': 'لنجعل اليوم يوماً رائعاً!', 'chat.placeholder': 'اسأل مرشد أي شيء…' },
    ),
    chartDefaults: { preferredTypes: ['bar', 'radial'], maxSeries: 2, defaultRange: '4w', allowedRanges: ['4w', '12w', 'term'], insightStyle: 'celebrate' },
    rewards: { badges: true, streaks: true, streakGraceDays: 2, celebrateMilestones: 'confetti' },
  },
  'g7-8': {
    id: 'g7-8', label: { en: 'Grades 7–8', ar: 'الصفوف ٧–٨' }, grades: [7, 8], tone: { formality: 'friendly' }, nav: nav('home', 'today', 'schoolwork', 'planner', 'activities', 'goals', 'chat', 'settings'),
    dashboardWidgets: ['greeting', 'today', 'progress-rings', 'upcoming', 'academics', 'extracurriculars', 'goals', 'ai-chat-entry', 'opportunities', 'badges'],
    features: { ...ALL_OFF, badges: true, externalCompetitions: true, olympiads: true, externalOpportunities: true },
    copy: copy(
      { 'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon', 'greeting.evening': 'Good evening', 'dashboard.subtitle': "Here's your day at a glance.", 'chat.placeholder': 'Ask Murshid…' },
      { 'greeting.morning': 'صباح الخير', 'greeting.afternoon': 'مساء الخير', 'greeting.evening': 'مساء الخير', 'dashboard.subtitle': 'هذا يومك في لمحة.', 'chat.placeholder': 'اسأل مرشد…' },
    ),
    chartDefaults: { preferredTypes: ['bar', 'line'], maxSeries: 3, defaultRange: '4w', allowedRanges: ['4w', '12w', 'term', 'year'], insightStyle: 'encourage' },
    rewards: { badges: true, streaks: true, streakGraceDays: 1, celebrateMilestones: 'subtle' },
  },
  'g9-10': {
    id: 'g9-10', label: { en: 'Grades 9–10', ar: 'الصفوف ٩–١٠' }, grades: [9, 10], tone: { formality: 'warm-direct' }, nav: nav('home', 'today', 'schoolwork', 'activities', 'opportunities', 'portfolio', 'goals', 'chat', 'settings'),
    dashboardWidgets: ['greeting', 'today', 'progress-rings', 'upcoming', 'academics', 'extracurriculars', 'ai-chat-entry', 'goals', 'opportunities', 'social-links'],
    features: { ...ALL_OFF, externalCompetitions: true, olympiads: true, summerPrograms: true, externalOpportunities: true, subjectChoices: true, careerExplorer: true, portfolio: true, socialLinks: true, examCountdowns: true },
    copy: copy(
      { 'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon', 'greeting.evening': 'Good evening', 'dashboard.subtitle': 'Everything that matters this week, in one place.', 'chat.placeholder': 'Ask Murshid…' },
      { 'greeting.morning': 'صباح الخير', 'greeting.afternoon': 'مساء الخير', 'greeting.evening': 'مساء الخير', 'dashboard.subtitle': 'كل ما يهمك هذا الأسبوع في مكان واحد.', 'chat.placeholder': 'اسأل مرشد…' },
    ),
    chartDefaults: { preferredTypes: ['line', 'bar', 'area'], maxSeries: 4, defaultRange: '12w', allowedRanges: ['4w', '12w', 'term', 'year'], insightStyle: 'plain' },
    rewards: { badges: false, streaks: true, streakGraceDays: 1, celebrateMilestones: 'subtle' },
  },
  'g11-12': {
    id: 'g11-12', label: { en: 'Grades 11–12', ar: 'الصفوف ١١–١٢' }, grades: [11, 12], tone: { formality: 'professional' }, nav: nav('home', 'today', 'schoolwork', 'opportunities', 'applications', 'activities', 'cv', 'goals', 'chat', 'settings'),
    dashboardWidgets: ['greeting', 'today', 'progress-rings', 'upcoming', 'academics', 'extracurriculars', 'ai-chat-entry', 'applications', 'cv', 'opportunities', 'goals'],
    features: { ...ALL_OFF, externalCompetitions: true, olympiads: true, summerPrograms: true, externalOpportunities: true, subjectChoices: true, careerExplorer: true, portfolio: true, cv: true, applications: true, universityPlanner: true, examCountdowns: true, socialLinks: true, linkedin: true, publicProfile: true },
    copy: copy(
      { 'greeting.morning': 'Good morning', 'greeting.afternoon': 'Good afternoon', 'greeting.evening': 'Good evening', 'dashboard.subtitle': 'Your week, your applications, your progress.', 'chat.placeholder': 'Ask Murshid…' },
      { 'greeting.morning': 'صباح الخير', 'greeting.afternoon': 'مساء الخير', 'greeting.evening': 'مساء الخير', 'dashboard.subtitle': 'أسبوعك وطلباتك وتقدمك.', 'chat.placeholder': 'اسأل مرشد…' },
    ),
    chartDefaults: { preferredTypes: ['line', 'area', 'bar', 'stacked-bar'], maxSeries: 5, defaultRange: '12w', allowedRanges: ['4w', '12w', 'term', 'year'], insightStyle: 'analytical' },
    rewards: { badges: false, streaks: true, streakGraceDays: 1, celebrateMilestones: 'toast' },
  },
};

// ---------- synthetic demo students ----------
// Sessions are generated at runtime (see lib/mock/data.ts) relative to "today", so only templates live here.

const act = (id: string, name: string, kind: DemoActivity['kind'], area: DemoActivity['area'], weeklyTargetMinutes: number): DemoActivity =>
  ({ id, name, kind, area, weeklyTargetMinutes, sessions: [] });

export const demoStudents: Record<BandId, DemoStudent> = {
  'g5-6': {
    id: 'demo-g5', synthetic: true, firstName: 'Layla', lastName: 'Haddad', nameAr: 'ليلى حداد', grade: 6, band: 'g5-6',
    classLabel: 'Grade 6', school: 'Al Noor Primary (demo)',
    subjects: [
      { id: 'maths', name: 'Maths', current: 84, target: 90, trend: [76, 79, 82, 84] },
      { id: 'english', name: 'English', current: 88, target: 90, trend: [85, 86, 87, 88] },
      { id: 'science', name: 'Science', current: 79, target: 85, trend: [80, 74, 77, 79] },
      { id: 'arabic', name: 'Arabic', current: 91, target: 92, trend: [88, 90, 89, 91] },
    ],
    activities: [act('swim', 'Swimming squad', 'sport', 'swimming', 120), act('piano', 'Piano', 'music', 'piano', 90), act('code', 'Coding club', 'tech', 'coding', 60)],
    goals: [
      { id: 'g1', title: 'Read 10 books this term', area: 'academics', progress: 0.6, due: '+40' },
      { id: 'g2', title: 'Swim 50m freestyle under 45s', area: 'extracurriculars', progress: 0.45, due: '+60' },
      { id: 'g3', title: 'Learn my times tables to 12', area: 'academics', progress: 0.8, due: '+20' },
    ],
    upcoming: [
      { id: 'u1', title: 'Science quiz: plants', date: '+2', type: 'test' },
      { id: 'u2', title: 'Swimming gala', date: '+5', type: 'event' },
      { id: 'u3', title: 'Book report due', date: '+8', type: 'homework' },
      { id: 'u4', title: 'Piano recital', date: '+16', type: 'event' },
    ],
    streaks: { current: 9, best: 14 }, badges: ['reader', 'early-bird', 'team-player'],
  },
  'g7-8': {
    id: 'demo-g7', synthetic: true, firstName: 'Omar', lastName: 'Al Mansoori', nameAr: 'عمر المنصوري', grade: 8, band: 'g7-8',
    classLabel: 'Grade 8', school: 'Gulf Model School (demo)',
    subjects: [
      { id: 'maths', name: 'Maths', current: 81, target: 88, trend: [74, 77, 80, 81] },
      { id: 'physics', name: 'Physics', current: 76, target: 85, trend: [70, 73, 72, 76] },
      { id: 'english', name: 'English', current: 83, target: 85, trend: [80, 82, 81, 83] },
      { id: 'arabic', name: 'Arabic', current: 87, target: 90, trend: [84, 85, 86, 87] },
      { id: 'cs', name: 'Computing', current: 92, target: 92, trend: [86, 88, 91, 92] },
    ],
    activities: [act('football', 'School football', 'sport', 'football', 180), act('debate', 'Debate club', 'club', 'debate', 60), act('hack', 'Hackathons', 'tech', 'hackathon', 90)],
    goals: [
      { id: 'g1', title: 'Make the U14 first team', area: 'extracurriculars', progress: 0.55, due: '+50' },
      { id: 'g2', title: 'Raise Physics to 85%', area: 'academics', progress: 0.4, due: '+70' },
      { id: 'g3', title: 'Finish a Scratch → Python game', area: 'future', progress: 0.7, due: '+30' },
    ],
    upcoming: [
      { id: 'u1', title: 'Physics test: forces', date: '+3', type: 'test' },
      { id: 'u2', title: 'Inter-school debate', date: '+6', type: 'competition' },
      { id: 'u3', title: 'Junior hackathon (Dubai)', date: '+12', type: 'competition' },
      { id: 'u4', title: 'Maths homework set 6', date: '+1', type: 'homework' },
    ],
    streaks: { current: 12, best: 21 }, badges: ['debater', 'coder'],
  },
  'g9-10': {
    id: 'demo-g9', synthetic: true, firstName: 'Aisha', lastName: 'Rahman', nameAr: 'عائشة رحمن', grade: 10, band: 'g9-10',
    classLabel: 'Year 11 (IGCSE)', school: 'Emirates International Academy (demo)',
    subjects: [
      { id: 'maths', name: 'Maths', current: 86, target: 90, trend: [78, 82, 84, 86] },
      { id: 'physics', name: 'Physics', current: 79, target: 88, trend: [81, 76, 77, 79] },
      { id: 'chemistry', name: 'Chemistry', current: 83, target: 85, trend: [79, 80, 82, 83] },
      { id: 'biology', name: 'Biology', current: 88, target: 88, trend: [84, 86, 87, 88] },
      { id: 'english', name: 'English', current: 82, target: 85, trend: [80, 81, 80, 82] },
      { id: 'arabic', name: 'Arabic', current: 90, target: 90, trend: [87, 88, 90, 90] },
    ],
    activities: [act('athletics', 'Athletics (800m)', 'sport', 'athletics', 180), act('gym', 'Gym training', 'fitness', 'gym', 150), act('hack', 'Hackathons', 'tech', 'hackathon', 120), act('debate', 'MUN & debate', 'club', 'debate', 60)],
    goals: [
      { id: 'g1', title: 'Run 800m under 2:30', area: 'extracurriculars', progress: 0.62, due: '+90' },
      { id: 'g2', title: 'Physics to an A (88%)', area: 'academics', progress: 0.45, due: '+120' },
      { id: 'g3', title: 'Ship a project at 2 hackathons', area: 'future', progress: 0.5, due: '+150' },
      { id: 'g4', title: 'Sleep 8h on school nights', area: 'wellbeing', progress: 0.7, due: '+30' },
    ],
    upcoming: [
      { id: 'u1', title: 'Physics mock paper', date: '+2', type: 'exam' },
      { id: 'u2', title: 'Inter-school athletics meet', date: '+4', type: 'competition' },
      { id: 'u3', title: 'Chemistry lab report', date: '+6', type: 'homework' },
      { id: 'u4', title: 'Youth Hack Dubai', date: '+11', type: 'competition' },
      { id: 'u5', title: 'Summer program early deadline', date: '+19', type: 'deadline' },
    ],
    streaks: { current: 17, best: 23 }, badges: [],
    links: { github: 'https://github.com/aisha-demo' },
  },
  'g11-12': {
    id: 'demo-g11', synthetic: true, firstName: 'Rohan', lastName: 'Mehta', nameAr: 'روهان ميهتا', grade: 12, band: 'g11-12',
    classLabel: 'IB DP Year 2', school: 'Dubai Scholars Academy (demo)',
    subjects: [
      { id: 'maths', name: 'Maths AA HL', current: 87, target: 91, trend: [80, 83, 85, 87] },
      { id: 'physics', name: 'Physics HL', current: 82, target: 86, trend: [84, 79, 80, 82] },
      { id: 'cs', name: 'Computer Science HL', current: 92, target: 92, trend: [88, 90, 91, 92] },
      { id: 'economics', name: 'Economics SL', current: 85, target: 86, trend: [82, 84, 83, 85] },
      { id: 'english', name: 'English B SL', current: 80, target: 84, trend: [78, 79, 80, 80] },
    ],
    activities: [act('gym', 'Gym (strength)', 'fitness', 'gym', 180), act('athletics', 'Athletics (5k)', 'sport', 'athletics', 120), act('hack', 'Hackathons', 'tech', 'hackathon', 180), act('mun', 'Robotics club', 'club', 'coding', 90)],
    goals: [
      { id: 'g1', title: 'Predicted 40+ IB points', area: 'academics', progress: 0.72, due: '+120' },
      { id: 'g2', title: 'Submit 6 university applications', area: 'future', progress: 0.5, due: '+60' },
      { id: 'g3', title: 'Bench press 80kg', area: 'extracurriculars', progress: 0.81, due: '+45' },
      { id: 'g4', title: 'Win a regional hackathon', area: 'extracurriculars', progress: 0.33, due: '+100' },
    ],
    upcoming: [
      { id: 'u1', title: 'Physics IA final draft', date: '+3', type: 'deadline' },
      { id: 'u2', title: 'Maths HL paper 2 mock', date: '+5', type: 'exam' },
      { id: 'u3', title: 'UCAS personal statement review', date: '+7', type: 'deadline' },
      { id: 'u4', title: 'GITEX student hackathon', date: '+10', type: 'competition' },
      { id: 'u5', title: 'Early application deadline', date: '+21', type: 'deadline' },
    ],
    streaks: { current: 23, best: 31 }, badges: [],
    links: { linkedin: 'https://www.linkedin.com/in/rohan-demo', github: 'https://github.com/rohan-demo' },
  },
};

// ---------- helpers (same names/signatures as @murshid/grade-bands) ----------

const WIDGET_REQUIRES: Partial<Record<WidgetId, FeatureId[]>> = {
  streaks: ['streaks'], badges: ['badges'], opportunities: ['schoolCompetitions', 'externalOpportunities'],
  applications: ['applications'], cv: ['cv'], 'social-links': ['socialLinks'], 'ai-chat-entry': ['aiChat'], 'weekly-briefing': ['weeklyBriefing'],
};

export function visibleWidgets(band: BandId): WidgetId[] {
  const b = BANDS[band];
  return b.dashboardWidgets.filter((w) => { const r = WIDGET_REQUIRES[w]; return !r || r.some((f) => b.features[f]); });
}

export function visibleNav(band: BandId): NavItem[] {
  const b = BANDS[band];
  return b.nav.filter((n) => !n.requires || b.features[n.requires]);
}

export function t(band: BandId, key: string, locale: 'en' | 'ar' = 'en', vars: Record<string, string | number> = {}): string {
  const c = BANDS[band].copy;
  const raw = c[`${locale}.${key}`] ?? c[`en.${key}`] ?? key;
  return raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

export function greetingKey(hourDubai: number): 'greeting.morning' | 'greeting.afternoon' | 'greeting.evening' {
  if (hourDubai >= 4 && hourDubai < 12) return 'greeting.morning';
  if (hourDubai >= 12 && hourDubai < 17) return 'greeting.afternoon';
  return 'greeting.evening';
}
