// v1 web contract shapes (docs/V1-WEB-CONTRACT.md "API additions"). Plain TS types are the source of
// truth for apps/web and apps/api; the zod schemas (zod v3, like the rest of core) validate them.
import { z } from "zod";

export const CHART_TYPES = ["bar", "line", "area", "radial", "pie", "stacked-bar"] as const;
export const PROGRESS_RANGES = ["4w", "12w", "term", "year"] as const;
export const ACTIVITY_KINDS = ["athletics", "gym", "hackathon", "robotics", "music", "football", "swimming"] as const;
export const ASSESSMENT_KINDS = ["quiz", "test", "assignment", "exam", "project"] as const;
export const CHAT_TOOL_NAMES = ["render_chart", "show_tasks", "show_opportunities", "show_plan", "show_cv"] as const;
export const DEMO_STUDENT_IDS = ["demo-g5", "demo-g7", "demo-g9", "demo-g11", "demo-ideal"] as const;
export const PROFILE_LINK_KEYS = ["linkedin", "github", "instagram", "portfolio", "resumeUrl", "behance", "youtube", "website"] as const;

export type ChartType = (typeof CHART_TYPES)[number];
export type ProgressRange = (typeof PROGRESS_RANGES)[number];
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];
export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];
export type DemoStudentId = (typeof DEMO_STUDENT_IDS)[number];
export type ProfileLinkKey = (typeof PROFILE_LINK_KEYS)[number];
export type V1BandId = "g5-6" | "g7-8" | "g9-10" | "g11-12";

export interface ChartSeries { key: string; label: string; color?: string }
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
  generatedBy: "rules" | "ai";
}

export const ChartSpecSchema = z.object({
  id: z.string().min(1),
  type: z.enum(CHART_TYPES),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  unit: z.string().optional(),
  xKey: z.string().min(1),
  series: z.array(z.object({ key: z.string().min(1), label: z.string(), color: z.string().optional() })).min(1),
  data: z.array(z.record(z.union([z.string(), z.number()]))),
  insight: z.string(),
  generatedBy: z.enum(["rules", "ai"]),
}).superRefine((spec, ctx) => {
  for (const [i, row] of spec.data.entries()) {
    if (!(spec.xKey in row)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["data", i], message: `missing xKey ${spec.xKey}` });
  }
});

export type ProfileLinks = Record<ProfileLinkKey, string | null> & {
  connectedAt: Partial<Record<ProfileLinkKey, string | null>>;
  updatedAt: string | null;
};

export interface ChatToolCall { name: ChatToolName; args: Record<string, unknown> }
export interface ChatResponse {
  text: string;
  toolCalls: ChatToolCall[];
  intent: string;
  lang: "en" | "ar";
  generatedBy: "rules" | "ai";
  threadId: string | null;
  /** orchestrator trace (which sub-agents ran, their tools, models, latency, fallback) */
  agents?: ChatAgentTrace[];
  route?: { agents: string[]; reason: string; router: string };
  fallback?: boolean;
  safety?: "crisis" | "guardrail" | null;
  ms?: number;
  /** which persona answered: the tutor (default) or the optional study buddy */
  persona?: "tutor" | "buddy";
  /** study buddy turn: guardrail flags, what produced the reply, limits and availability */
  buddy?: { action: string; flags: string[]; model: string | null; nudge: string | null; limit: string; available: boolean; reason: string; band: string; turnsToday: number };
  /** "How Murshid worked this out": the real plan behind this reply, built from the orchestrator trace */
  trace?: WorkTrace;
}

/** One tool Murshid used while working something out (built from the real tool calls). */
export interface WorkTraceTool {
  id: string;
  label: string;
  /** read = looked something up, write = changed the student's plan, ui = showed a card */
  access: "read" | "write" | "ui";
  ok: boolean;
  ms: number;
  calls: number;
}

/**
 * Judge-facing explanation of one turn or automated action: goal understood -> steps planned -> tools used ->
 * actions taken -> result. Every field comes from what the code actually did (no model-written rationale).
 */
export interface WorkTrace {
  kind: "chat" | "automation";
  goal: string;
  plan: string[];
  tools: WorkTraceTool[];
  actions: string[];
  result: string;
  engine: {
    /** model = AI models answered; rules = deterministic engine; cached = replayed demo answer; offline = in-browser fallback */
    mode: "model" | "rules" | "cached" | "offline";
    router: string;
    models: string[];
    note?: string;
    ms: number;
  };
  guardrails: string[];
}

export interface ChatAgentTrace {
  agent: string;
  name: string;
  model: string | null;
  modelsTried: { model: string; ok: boolean; status?: number; ms: number }[];
  ms: number;
  fallback: boolean;
  error?: string;
  rounds: number;
  tools: { name: string; access: string; args: Record<string, unknown>; ok: boolean; ms: number; prefetch: boolean; error?: string }[];
  text: string;
}

export interface ActivityMetricDef { key: string; label: string; unit: string; better: "higher" | "lower" }
export interface ActivitySession {
  id: string;
  activityId: string;
  date: string; // YYYY-MM-DD (Asia/Dubai)
  minutes: number;
  metrics: Record<string, number>;
  note: string | null;
  /** training (default), match (team sport fixture) or race (gala / meet) */
  type?: "training" | "match" | "race";
}

export interface AssessmentResult {
  id: string;
  subjectId: string;
  title: string;
  kind: AssessmentKind;
  date: string;
  score: number | null;
  maxScore: number;
  percent: number | null;
  status: "graded" | "upcoming";
}
