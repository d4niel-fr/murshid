/** zod (v4) request + response schemas for the v1 endpoints; responses are documentation for openapi.json. */
import { ACTIVITY_KINDS, CHART_TYPES, DEMO_STUDENT_IDS, PROFILE_LINK_KEYS, PROGRESS_RANGES } from '@murshid/core';
import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

// ---------- requests ----------
export const ProgressQuery = z.object({
  area: z.string().min(1).max(200).describe('athletics | gym | hackathon | robotics | music | academics | extracurriculars | goals | <subject id> | <goal id>; comma-separated to compare'),
  range: z.enum(PROGRESS_RANGES).default('4w'),
});

const ChatMessage = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.union([z.string().max(8000), z.array(z.object({ type: z.string().max(40), text: z.string().max(8000).optional() })).max(20)]),
});
export const ChatInput = z.object({
  message: z.string().min(1).max(2000).optional(),
  history: z.array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) })).max(40).optional(),
  messages: z.array(ChatMessage).max(80).optional().describe('assistant-ui style thread; the last user message is answered when `message` is absent'),
  threadId: z.string().max(200).optional(),
  persona: z.enum(['tutor', 'buddy']).optional().describe('tutor (default) or the optional study buddy persona (guardrailed; school/guardian can switch it off)'),
}).refine((b) => b.message !== undefined || (b.messages?.length ?? 0) > 0, { message: 'message or messages is required' });

export const ProfileLinksIn = z.object(Object.fromEntries(
  PROFILE_LINK_KEYS.map((k) => [k, z.string().max(300).nullable().optional()]),
) as Record<(typeof PROFILE_LINK_KEYS)[number], z.ZodOptional<z.ZodNullable<z.ZodString>>>).strict();

export const ExtracurricularsQuery = z.object({
  limit: z.coerce.number().int().min(0).max(500).default(20).describe('sessions returned per activity (newest first)'),
});

export const SessionCreate = z.object({
  date: isoDate.optional().describe('YYYY-MM-DD (Asia/Dubai); default today'),
  minutes: z.number().int().min(1).max(720),
  metrics: z.record(z.string().max(40), z.number().finite()).refine((m) => Object.keys(m).length <= 20, 'at most 20 metrics').default({}),
  note: z.string().max(280).nullable().optional(),
});

// ---------- responses (documentation) ----------
export const ChartSpec = z.object({
  id: z.string(), type: z.enum(CHART_TYPES), title: z.string(), subtitle: z.string().optional(), unit: z.string().optional(),
  xKey: z.string(), series: z.array(z.object({ key: z.string(), label: z.string(), color: z.string().optional() })),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))), insight: z.string(), generatedBy: z.enum(['rules', 'ai']),
});

const StudentCard = z.object({
  id: z.string(), name: z.string(), preferredName: z.string(), nameAr: z.string(), grade: z.number(), band: z.string(),
  age: z.number(), classLabel: z.string(), school: z.string(), curriculum: z.string(), curriculumLabel: z.string(), emirate: z.string(),
  emirateLabel: z.string(), languages: z.array(z.string()), interests: z.array(z.string()), initials: z.string(), synthetic: z.literal(true),
});
export const DemoStudentList = z.object({ default: z.string(), items: z.array(StudentCard) });
export const AreaList = z.object({
  items: z.array(z.object({ kind: z.string(), id: z.string(), label: z.string() })), ranges: z.array(z.enum(PROGRESS_RANGES)),
});

const Task = z.object({
  id: z.string(), title: z.string(), kind: z.string(), kindLabel: z.string(), date: isoDate, time: z.string(), durationMinutes: z.number(),
  status: z.enum(['todo', 'done']), done: z.boolean(), overdue: z.boolean(), subjectId: z.string().nullable(), area: z.string().nullable(),
});
const Opportunity = z.object({
  id: z.string(), title: z.string(), organizer: z.string(), type: z.string(), typeLabel: z.string(), emirate: z.string().nullable(),
  emirateLabel: z.string(), deadline: isoDate, daysLeft: z.number(), grades: z.array(z.number()), costAed: z.number(), tags: z.array(z.string()),
  why: z.string(), url: z.string(), matchScore: z.number(), saved: z.boolean().optional(), synthetic: z.literal(true),
});
const Upcoming = z.object({
  id: z.string(), kind: z.enum(['assessment', 'deadline', 'event']), kindLabel: z.string(), title: z.string(), date: isoDate,
  daysLeft: z.number(), subjectId: z.string().nullable(), subject: z.string().nullable(), area: z.string().nullable(),
});
const SubjectSummary = z.object({
  id: z.string(), name: z.string(), nameAr: z.string(), teacher: z.string(), current: z.number(), target: z.number(),
  delta12w: z.number(), trend: z.enum(['up', 'down', 'flat']), color: z.string(),
});
const Goal = z.object({
  id: z.string(), title: z.string(), titleAr: z.string(), category: z.string(), unit: z.string(), start: z.number(), target: z.number(),
  better: z.enum(['higher', 'lower']), current: z.number(), progress: z.number(), status: z.enum(['active', 'done']), dueDate: isoDate,
  area: z.string().nullable(),
});
export const Dashboard = z.object({
  student: StudentCard, band: z.string(), generatedAt: z.string(), date: isoDate, isSchoolDay: z.boolean(),
  today: z.array(Task), upcoming: z.array(Upcoming),
  progress: z.object({
    academics: z.object({ average: z.number(), target: z.number(), delta12w: z.number(), trend: z.string(), subjects: z.array(SubjectSummary) }),
    extracurriculars: z.object({
      thisWeekMinutes: z.number(), last7dMinutes: z.number(), weeklyTargetMinutes: z.number(),
      activities: z.array(z.object({ id: z.enum(ACTIVITY_KINDS), name: z.string(), thisWeekMinutes: z.number(), last7dMinutes: z.number(), weeklyTargetMinutes: z.number(), sessionsThisWeek: z.number(), streakWeeks: z.number(), lastSessionDate: z.string().nullable() }).passthrough()),
    }),
    goals: z.array(Goal),
  }),
  streaks: z.object({ studyDays: z.number(), longestStudyDays: z.number(), activityWeeks: z.number(), byActivity: z.record(z.string(), z.number()) }),
  highlights: z.array(z.object({ id: z.string(), kind: z.string(), text: z.string(), textAr: z.string(), area: z.string().nullable() })),
  opportunities: z.array(Opportunity),
});

export const ChatResponse = z.object({
  text: z.string(),
  toolCalls: z.array(z.object({ name: z.enum(['render_chart', 'show_tasks', 'show_opportunities', 'show_plan', 'show_cv']), args: z.record(z.string(), z.unknown()) })),
  intent: z.string(), lang: z.enum(['en', 'ar']), generatedBy: z.enum(['rules', 'ai']), threadId: z.string().nullable(),
  route: z.object({ agents: z.array(z.string()), reason: z.string(), router: z.string() }).optional(),
  agents: z.array(z.object({
    agent: z.string(), name: z.string(), model: z.string().nullable(), ms: z.number(), fallback: z.boolean(), rounds: z.number(), error: z.string().optional(),
    modelsTried: z.array(z.object({ model: z.string(), ok: z.boolean(), status: z.number().optional(), ms: z.number() })),
    tools: z.array(z.object({ name: z.string(), access: z.string(), args: z.record(z.string(), z.unknown()), ok: z.boolean(), ms: z.number(), prefetch: z.boolean(), error: z.string().optional() })),
    text: z.string(),
  })).optional().describe('which sub-agents ran, their tools, models tried, latency and whether they fell back to rules'),
  fallback: z.boolean().optional(), safety: z.enum(['crisis', 'guardrail']).nullable().optional(), ms: z.number().optional(),
  persona: z.enum(['tutor', 'buddy']).optional(),
  buddy: z.object({
    action: z.string(), flags: z.array(z.string()), model: z.string().nullable(), nudge: z.string().nullable(), limit: z.string(),
    available: z.boolean(), reason: z.string(), band: z.string(), turnsToday: z.number(),
  }).optional().describe('study buddy turn: which guardrail fired (flags), what produced the reply, limits'),
});

export const BuddyControlsIn = z.object({
  by: z.enum(['guardian', 'school']).describe('guardian (x-dev-role: guardian) or school (x-dev-role: admin + admin passcode)'),
  enabled: z.boolean(),
}).strict();

export const ProfileLinksOut = z.object({
  ...Object.fromEntries(PROFILE_LINK_KEYS.map((k) => [k, z.string().nullable()])),
  connectedAt: z.record(z.string(), z.string().nullable()),
  updatedAt: z.string().nullable(),
  restrictions: z.record(z.string(), z.string()).describe('links the student cannot add yet (age-based)'),
});

const Assessment = z.object({
  id: z.string(), subjectId: z.string(), subject: z.string(), title: z.string(), kind: z.string(), kindLabel: z.string(), date: isoDate,
  score: z.number().nullable(), maxScore: z.number(), percent: z.number().nullable(), status: z.enum(['graded', 'upcoming']),
});
export const Academics = z.object({
  student: StudentCard,
  term: z.object({ id: z.string(), label: z.string(), start: isoDate, end: isoDate, weeksIn: z.number() }),
  average: z.number(), target: z.number(),
  subjects: z.array(SubjectSummary.extend({
    termAverage: z.number().nullable(),
    grades: z.array(z.object({ date: isoDate, percent: z.number(), assessmentId: z.string(), kind: z.string() })),
    monthly: z.array(z.object({ month: z.string(), average: z.number() })),
  })),
  assessments: z.array(Assessment), upcoming: z.array(Assessment), chart: ChartSpec,
});

export const Session = z.object({
  id: z.string(), activityId: z.string(), date: isoDate, minutes: z.number(), metrics: z.record(z.string(), z.number()), note: z.string().nullable(),
});
const Activity = z.object({
  id: z.enum(ACTIVITY_KINDS), kind: z.enum(ACTIVITY_KINDS), name: z.string(), nameAr: z.string(), detail: z.string(), detailAr: z.string(),
  schedule: z.string(), weeklyTargetMinutes: z.number(),
  metricDefs: z.array(z.object({ key: z.string(), label: z.string(), unit: z.string(), better: z.enum(['higher', 'lower']) })),
  totals: z.object({ sessions: z.number(), minutes: z.number(), hours: z.number(), thisWeekMinutes: z.number(), last7dMinutes: z.number(), last28dMinutes: z.number(), streakWeeks: z.number(), sessionsThisWeek: z.number() }),
  latestMetrics: z.record(z.string(), z.number()), bestMetrics: z.record(z.string(), z.number()), lastSessionDate: z.string().nullable(),
  nextEvent: z.object({ id: z.string(), activityId: z.string(), date: isoDate, title: z.string() }).nullable(),
  sessions: z.array(Session).optional(),
});
export const Extracurriculars = z.object({
  student: StudentCard, activities: z.array(Activity),
  available: z.array(z.object({ id: z.enum(ACTIVITY_KINDS), name: z.string(), enrolled: z.boolean() })),
  totals: z.object({ thisWeekMinutes: z.number(), last28dMinutes: z.number(), yearHours: z.number() }),
});
export const SessionCreated = z.object({ session: Session, activity: Activity });
