/**
 * Grade-band types for Murshid v1 web. See docs/V1-WEB-CONTRACT.md ("Grade bands contract").
 * Pure data + helpers, no runtime dependencies.
 */

export type BandId = 'g5-6' | 'g7-8' | 'g9-10' | 'g11-12';
export const BAND_IDS: readonly BandId[] = ['g5-6', 'g7-8', 'g9-10', 'g11-12'] as const;

export type Locale = 'en' | 'ar';
export type Localized = { en: string; ar: string };

export type WidgetId =
  | 'greeting'
  | 'today'
  | 'progress-rings'
  | 'upcoming'
  | 'streaks'
  | 'goals'
  | 'academics'
  | 'extracurriculars'
  | 'opportunities'
  | 'applications'
  | 'cv'
  | 'social-links'
  | 'ai-chat-entry'
  | 'badges'
  | 'weekly-briefing';

export const WIDGET_IDS: readonly WidgetId[] = [
  'greeting', 'today', 'progress-rings', 'upcoming', 'streaks', 'goals', 'academics',
  'extracurriculars', 'opportunities', 'applications', 'cv', 'social-links', 'ai-chat-entry',
  'badges', 'weekly-briefing',
] as const;

/** Every capability the web app may gate on. All bands define every flag explicitly. */
export type FeatureId =
  | 'aiChat'
  | 'aiCharts'
  | 'badges'
  | 'streaks'
  | 'leaderboards'
  | 'clubs'
  | 'schoolCompetitions'
  | 'externalCompetitions'
  | 'olympiads'
  | 'summerPrograms'
  | 'externalOpportunities'
  | 'studyPlanner'
  | 'subjectChoices'
  | 'careerExplorer'
  | 'portfolio'
  | 'cv'
  | 'applications'
  | 'universityPlanner'
  | 'examCountdowns'
  | 'socialLinks'
  | 'linkedin'
  | 'publicProfile'
  | 'directMessaging'
  | 'weeklyBriefing'
  | 'guardianView'
  | 'pushNotifications'
  | 'darkMode';

export const FEATURE_IDS: readonly FeatureId[] = [
  'aiChat', 'aiCharts', 'badges', 'streaks', 'leaderboards', 'clubs', 'schoolCompetitions',
  'externalCompetitions', 'olympiads', 'summerPrograms', 'externalOpportunities', 'studyPlanner',
  'subjectChoices', 'careerExplorer', 'portfolio', 'cv', 'applications', 'universityPlanner',
  'examCountdowns', 'socialLinks', 'linkedin', 'publicProfile', 'directMessaging', 'weeklyBriefing',
  'guardianView', 'pushNotifications', 'darkMode',
] as const;

export type NavId =
  | 'home'
  | 'today'
  | 'schoolwork'
  | 'activities'
  | 'goals'
  | 'badges'
  | 'clubs'
  | 'competitions'
  | 'planner'
  | 'opportunities'
  | 'subjects'
  | 'careers'
  | 'portfolio'
  | 'applications'
  | 'university'
  | 'cv'
  | 'links'
  | 'chat'
  | 'settings';

export interface NavItem {
  id: NavId;
  href: string;
  /** lucide-react icon name (PascalCase), e.g. "House". */
  icon: string;
  label: Localized;
  /** Feature that must be on for this item to render; checked by tests. */
  requires?: FeatureId;
  /** Show in the compact iPad-portrait rail. */
  primary: boolean;
}

export interface Tone {
  voice: string;
  /** Short description for designers/copywriters. */
  guidance: string;
  emoji: 'often' | 'sometimes' | 'rare' | 'never';
  maxSentenceWords: number;
  formality: 'playful' | 'friendly' | 'warm-direct' | 'professional';
  /** How the student is addressed in Arabic copy. */
  arabicRegister: 'simple-msa' | 'msa';
}

export interface ReadingLevel {
  /** Target Flesch–Kincaid grade for UI copy and AI output. */
  fkGradeTarget: number;
  cefrEnglish: 'A2' | 'B1' | 'B2' | 'C1';
  maxParagraphSentences: number;
  description: string;
}

export type AiTask =
  | 'explain-concept'
  | 'hint-step'
  | 'check-my-answer'
  | 'quiz-me'
  | 'vocabulary'
  | 'reading-buddy'
  | 'plan-my-week'
  | 'summarise-my-notes'
  | 'study-timetable'
  | 'activity-progress-chart'
  | 'find-competitions'
  | 'find-opportunities'
  | 'subject-choice-advice'
  | 'career-explore'
  | 'essay-feedback'
  | 'personal-statement-feedback'
  | 'cv-review'
  | 'interview-practice'
  | 'university-shortlist'
  | 'exam-revision-plan';

export type IntegrityMode =
  | 'explain-dont-answer'
  | 'hints-first'
  | 'scaffolded-feedback'
  | 'coach-with-citations';

export interface AiPolicy {
  mode: 'homework-helper' | 'study-buddy' | 'guide' | 'advisor';
  allowedTasks: AiTask[];
  /** Topics the assistant declines and redirects (to a trusted adult / counsellor for safety ones). */
  refusalTopics: string[];
  integrityMode: IntegrityMode;
  /** Never write graded work in full: essays, homework answers, coursework, IA/EE, personal statements. */
  writesGradedWork: false;
  dailyMessageCap: number;
  maxResponseWords: number;
  /** Tool calls the mock/real agent may emit (contract: render_chart, show_tasks, show_opportunities). */
  tools: Array<'render_chart' | 'show_tasks' | 'show_opportunities'>;
  /** Safety topics (self-harm, abuse, bullying) always surface help lines + trusted-adult prompt. */
  crisisEscalation: true;
  /** Model may not ask for or store extra personal data beyond the task. */
  dataMinimisation: true;
  systemPromptHint: string;
}

export type GuardianLevel = 'full' | 'summary' | 'digest' | 'opt-in';

export interface GuardianPolicy {
  level: GuardianLevel;
  /** Verifiable parental consent required before processing (UAE Decree-Law 26/2025 Art. for under-13s; COPPA-style). */
  verifiableConsentRequired: boolean;
  seesChatTranscripts: boolean;
  seesGrades: boolean;
  seesActivities: boolean;
  seesGoals: boolean;
  seesApplications: boolean;
  approvesExternalOpportunities: boolean;
  approvesProfileLinks: boolean;
  weeklyDigest: boolean;
  canSetDailyLimit: boolean;
  /** Student may mark individual goals/journal items as private from guardian. */
  studentCanMarkPrivate: boolean;
  /** Safety alerts (crisis-escalation events) always go to the guardian regardless of level. */
  safetyAlerts: true;
}

export type ChartType = 'bar' | 'line' | 'area' | 'radial' | 'pie' | 'stacked-bar';
export type ChartRange = '4w' | '12w' | 'term' | 'year';

export interface ChartDefaults {
  preferredTypes: ChartType[];
  maxSeries: number;
  defaultRange: ChartRange;
  allowedRanges: ChartRange[];
  showGrid: boolean;
  showAxisTitles: boolean;
  showDataLabels: boolean;
  animate: boolean;
  insightStyle: 'celebrate' | 'encourage' | 'plain' | 'analytical';
  /** Max characters of the ChartSpec.insight sentence. */
  insightMaxChars: number;
  colors: string[];
}

export interface Badge {
  id: string;
  label: Localized;
  criterion: string;
  icon: string;
}

export interface Rewards {
  badges: boolean;
  streaks: boolean;
  points: boolean;
  /** Always false: no public ranking or peer comparison in any band (ICO AADC nudge standard). */
  leaderboard: false;
  /** Missed days forgiven before a streak resets (soft streaks, no loss-aversion pressure). */
  streakGraceDays: number;
  celebrateMilestones: 'confetti' | 'subtle' | 'toast' | 'none';
  badgeCatalog: Badge[];
}

export interface Wellbeing {
  /** Suggested max minutes of in-app time per day; shown as a gentle nudge, never a hard lock. */
  suggestedDailyMinutes: number;
  breakReminderMinutes: number;
  /** Asia/Dubai, HH:MM. No push or nudges during this window. */
  quietHours: { start: string; end: string };
  /** Infinite feeds / autoplay are never used; listed for clarity. */
  infiniteScroll: false;
}

export interface BandConfig {
  id: BandId;
  label: Localized;
  grades: [number, number];
  /** Typical age range in UAE schools (grade N ≈ age N+5 to N+6 on 31 Aug). */
  typicalAges: [number, number];
  /** ICO AADC developmental stage(s) this band spans. */
  aadcStages: string[];
  tone: Tone;
  readingLevel: ReadingLevel;
  nav: NavItem[];
  dashboardWidgets: WidgetId[];
  features: Record<FeatureId, boolean>;
  aiPolicy: AiPolicy;
  guardian: GuardianPolicy;
  /** Flat map of `en.<key>` and `ar.<key>` strings. Use `t()` / `copyFor()` to read. */
  copy: Record<string, string>;
  chartDefaults: ChartDefaults;
  rewards: Rewards;
  wellbeing: Wellbeing;
  /** Design hook: value for `data-band` attribute. */
  dataBand: BandId;
}

// ---------- demo students ----------

export type CurriculumId = 'british' | 'american' | 'ib' | 'cbse' | 'moe';

export interface DemoSession {
  date: string; // YYYY-MM-DD
  minutes: number;
  metric?: { name: string; value: number; unit: string };
  note?: string;
}

export interface DemoActivity {
  id: string;
  name: string;
  kind: 'sport' | 'music' | 'tech' | 'fitness' | 'club' | 'arts' | 'service';
  area: 'athletics' | 'gym' | 'hackathon' | 'football' | 'piano' | 'coding' | 'debate' | 'art' | 'swimming';
  weeklyTargetMinutes: number;
  sessions: DemoSession[];
}

export interface DemoSubject {
  id: string;
  name: string;
  /** Grading scale: percent (0–100) or IB 1–7. */
  scale: 'percent' | 'ib7';
  current: number;
  target: number;
  trend: number[]; // last 4 assessments, same scale
}

export interface DemoGoal {
  id: string;
  title: string;
  area: 'academics' | 'extracurriculars' | 'wellbeing' | 'future';
  progress: number; // 0..1
  due: string;
  /** concrete milestones in order (progress rounds to the done count) */
  milestones?: string[];
}

export interface DemoUpcoming {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD (Asia/Dubai)
  type: 'test' | 'homework' | 'event' | 'competition' | 'deadline' | 'exam' | 'session';
}

export interface DemoStudent {
  id: 'demo-g5' | 'demo-g7' | 'demo-g9' | 'demo-g11';
  synthetic: true;
  firstName: string;
  lastName: string;
  nameAr: string;
  grade: number;
  band: BandId;
  curriculum: CurriculumId;
  /** Curriculum-native class label, e.g. "Year 6". */
  classLabel: string;
  school: string;
  emirate: 'Dubai' | 'Abu Dhabi' | 'Sharjah';
  subjects: DemoSubject[];
  activities: DemoActivity[];
  goals: DemoGoal[];
  upcoming: DemoUpcoming[];
  streaks: { current: number; best: number };
  badges: string[];
  links?: Partial<Record<'linkedin' | 'github' | 'portfolio', string>>;
}
