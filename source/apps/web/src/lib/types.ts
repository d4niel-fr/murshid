/**
 * Shared web types. Shapes mirror docs/V1-WEB-CONTRACT.md ("API additions") so the
 * live API and the bundled mock are interchangeable.
 */
import type { BandId } from './bands';

export type ChartType = 'bar' | 'line' | 'area' | 'radial' | 'pie' | 'stacked-bar';
export type ChartRange = '4w' | '12w' | 'term' | 'year';

export interface ChartSeries {
  key: string;
  label: string;
  color?: string;
}

export interface ChartSpec {
  id: string;
  type: ChartType;
  title: string;
  subtitle?: string;
  unit?: string;
  xKey: string;
  series: ChartSeries[];
  data: Array<Record<string, string | number>>;
  insight: string;
  generatedBy: 'rules' | 'ai';
}

export type TaskArea = 'academics' | 'extracurriculars' | 'goals' | 'wellbeing' | 'applications';

export interface Task {
  id: string;
  title: string;
  area: TaskArea;
  due?: string; // HH:MM or YYYY-MM-DD
  minutes?: number;
  done: boolean;
}

export type UpcomingType = 'test' | 'homework' | 'event' | 'competition' | 'deadline' | 'exam' | 'session';

export interface UpcomingItem {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: UpcomingType;
}

export interface StudentSummary {
  id: string;
  firstName: string;
  lastName: string;
  nameAr: string;
  grade: number;
  classLabel: string;
  school: string;
  band: BandId;
}

export interface Dashboard {
  student: StudentSummary;
  band: BandId;
  today: Task[];
  upcoming: UpcomingItem[];
  progress: { academics: number; extracurriculars: number; goals: number };
  streaks: { current: number; best: number };
  highlights: string[];
}

export type GradeScale = 'percent' | 'ib7';

export interface Subject {
  id: string;
  name: string;
  scale?: GradeScale;
  current: number;
  target: number;
  trend: number[];
  nextAssessment?: { title: string; date: string };
}

export interface Academics {
  term: string;
  average: number;
  scale?: GradeScale;
  subjects: Subject[];
}

export interface Session {
  id: string;
  date: string; // YYYY-MM-DD
  minutes: number;
  metric?: { name: string; value: number; unit: string };
  note?: string;
}

export type ActivityArea =
  | 'athletics' | 'gym' | 'hackathon' | 'football' | 'piano' | 'coding' | 'debate' | 'art' | 'swimming' | 'club';

export interface Activity {
  id: string;
  name: string;
  kind: 'sport' | 'music' | 'tech' | 'fitness' | 'club' | 'arts' | 'service';
  area: ActivityArea;
  weeklyTargetMinutes: number;
  totalHours: number;
  sessions: Session[];
}

export interface Extracurriculars {
  activities: Activity[];
}

export type LinkKey = 'linkedin' | 'github' | 'instagram' | 'portfolio';

export interface ProfileLinks {
  linkedin: string | null;
  github: string | null;
  instagram: string | null;
  portfolio: string | null;
  resumeUrl: string | null;
  resumeName?: string | null;
  connectedAt: Partial<Record<LinkKey | 'resume', string | null>>;
}

export interface Goal {
  id: string;
  title: string;
  area: 'academics' | 'extracurriculars' | 'wellbeing' | 'future';
  progress: number; // 0..1
  due: string;
  milestones: { id: string; title: string; done: boolean }[];
}

export interface Opportunity {
  id: string;
  title: string;
  org: string;
  kind: 'competition' | 'olympiad' | 'summer' | 'internship' | 'hackathon' | 'volunteering' | 'scholarship';
  deadline: string;
  location: string;
  match: number; // 0..100
  tags: string[];
  url: string;
  /** True when the student already tracks this opportunity as an application (set by the API). */
  saved?: boolean;
}

export interface Application {
  id: string;
  opportunityId: string;
  title: string;
  status: 'saved' | 'in-progress' | 'submitted' | 'accepted';
  checklist: { id: string; title: string; done: boolean }[];
  deadline: string;
}

export interface ChatToolCall {
  name: 'render_chart' | 'show_tasks' | 'show_opportunities' | 'show_plan' | 'show_cv';
  args: Record<string, unknown>;
}

/** One sub-agent's run, as reported by the orchestrator (POST /chat `agents`). */
export interface ChatAgentRun {
  agent: string;
  name: string;
  model: string | null;
  ms: number;
  fallback: boolean;
  tools: { name: string; access: string; ok: boolean; prefetch: boolean }[];
}

export interface WorkTraceTool { id: string; label: string; access: 'read' | 'write' | 'ui'; ok: boolean; ms: number; calls: number }
/** "How Murshid worked this out" (mirrors @murshid/core WorkTrace; built by the API from the real trace). */
export interface WorkTrace {
  kind: 'chat' | 'automation';
  goal: string;
  plan: string[];
  tools: WorkTraceTool[];
  actions: string[];
  result: string;
  engine: { mode: 'model' | 'rules' | 'cached' | 'offline'; router: string; models: string[]; note?: string; ms: number };
  guardrails: string[];
}

export interface ChatReply {
  text: string;
  toolCalls: ChatToolCall[];
  agents?: ChatAgentRun[];
  generatedBy?: 'rules' | 'ai';
  trace?: WorkTrace;
  persona?: 'tutor' | 'buddy';
  safety?: 'crisis' | 'guardrail' | null;
  buddy?: { action: string; flags: string[]; available: boolean; reason: string };
}

/** GET /buddy: whether study buddy mode is available for this student. */
export interface BuddyStatus {
  available: boolean;
  reason: 'on' | 'school_off' | 'guardian_off' | 'needs_guardian' | 'offline';
  band: string;
  controls: { guardian: boolean | null; school: boolean | null };
  turnsToday: number;
}

/** Live progress while sub-agents work (SSE). */
export type ChatProgress =
  | { type: 'route'; names: string[] }
  | { type: 'agent-start'; agent: string; name: string }
  | { type: 'agent-tool'; agent: string; tool: string; access: string }
  | { type: 'agent-done'; agent: string; name: string; fallback: boolean };
