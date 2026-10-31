/**
 * "How Murshid worked this out": turns the real orchestrator trace (route decision, each step's tool calls,
 * models tried, fallbacks) into a plain goal -> plan -> tools -> actions -> result explanation for judges and
 * curious users. Nothing here is written by a model: every line is derived from what the code actually ran.
 */
import { SUB_AGENTS, type OrchestratorResult, type SubAgentId } from '@murshid/agent-gateway';
import type { WorkTrace, WorkTraceTool } from '@murshid/core';

/** Plain names for each tool (what it touches), shared by chat traces and automated actions. */
export const TOOL_LABELS: Record<string, string> = {
  get_student_overview: 'Student overview (profile, goals, today)',
  get_academics: 'Grades and assessments',
  get_training: 'Training load and fixtures',
  get_tasks: 'Assignments (teacher-posted and Teams-synced)',
  get_upcoming: 'Timetable and calendar (tests, deadlines, fixtures)',
  get_goals: 'Goals',
  find_opportunities: 'Opportunity search',
  get_applications: 'Applications tracker',
  get_side_projects: 'Side-project metrics',
  get_cv_profile: 'CV profile',
  get_wellbeing_signals: 'Workload signals',
  create_task: 'Planner: add task',
  build_week_plan: 'Calendar: write week plan',
  save_opportunity: 'Applications: save opportunity',
  add_project_milestone: 'Project milestone',
  generate_linkedin_cv: 'CV builder (LinkedIn pack + PDF)',
  render_chart: 'Progress chart card',
  show_tasks: 'Task list card',
  show_opportunities: 'Opportunity cards',
  // automated actions (schools)
  read_teacher_post: 'Teacher post (Murshid for Schools / Teams sync)',
  read_timetable: 'Timetable and calendar (tests, fixtures, events)',
  read_workload: 'Workload by day (all subjects, sport, events)',
  schedule_work_session: 'Calendar: schedule work session',
  set_reminder: 'Reminders',
  flag_overload: 'At-risk check',
};

export const GUARDRAILS = [
  "Only this student's own data is read (tenant-scoped; school and family data never mix).",
  'Writes are limited to the student\'s own planner, calendar and saved items, and every write is audit-logged.',
  'Chat tools never send or post anything outside Murshid; publishing (e.g. a LinkedIn post) is blocked in code until the student approves that exact draft.',
  'Crisis language skips the models and returns a fixed safe reply with UAE helplines.',
];

const ROUTER_NAMES: Record<string, string> = {
  rules: 'keyword rules', model: 'a small routing model', safety: 'the safety check', cache: 'demo cache',
};

function toolRows(calls: { name: string; access: string; ok: boolean; ms: number }[]): WorkTraceTool[] {
  const rows = new Map<string, WorkTraceTool>();
  for (const c of calls) {
    const cur = rows.get(c.name);
    const access = (c.access === 'write' || c.access === 'ui' ? c.access : 'read') as WorkTraceTool['access'];
    if (cur) { cur.calls++; cur.ms += c.ms; cur.ok = cur.ok && c.ok; } else rows.set(c.name, { id: c.name, label: TOOL_LABELS[c.name] ?? c.name, access, ok: c.ok, ms: c.ms, calls: 1 });
  }
  return [...rows.values()];
}

const short = (s: string, n = 90) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Trace for an orchestrated chat turn. */
export function chatTrace(message: string, r: Pick<OrchestratorResult, 'route' | 'agents' | 'generatedBy' | 'fallback' | 'safety' | 'ms' | 'uiCalls'>, opts: { budgetSkipped?: boolean; dailyLimit?: number } = {}): WorkTrace {
  const steps = r.route.agents.map((a) => SUB_AGENTS[a as SubAgentId]).filter(Boolean);
  const topics = steps.map((s) => s.topic.toLowerCase());
  const goal = r.safety === 'crisis'
    ? 'Recognised that the student may be in distress: give a safe, supportive reply with helplines.'
    : `"${short(message)}": understood as ${topics.join(' + ') || 'a general question'}.`;
  const plan: string[] = [`Route the request with ${ROUTER_NAMES[r.route.router] ?? r.route.router} (${r.route.reason}).`];
  for (const [i, a] of r.agents.entries()) {
    const spec = SUB_AGENTS[a.agent as SubAgentId];
    const reads = a.tools.filter((t) => t.access === 'read').map((t) => TOOL_LABELS[t.name] ?? t.name);
    const writes = a.tools.filter((t) => t.access === 'write').map((t) => TOOL_LABELS[t.name] ?? t.name);
    const lead = r.agents.length > 1 ? (i === 0 ? ' (leads; owns any changes)' : ' (advises only; no changes)') : '';
    plan.push(`${spec?.topic ?? a.name}${lead}: look up ${[...new Set(reads)].join(', ') || 'nothing'}${writes.length ? `, then ${[...new Set(writes)].join(', ')}` : ''}.`);
  }
  if (r.agents.length > 1) plan.push('Merge the parts into one reply with a heading per topic.');
  const actions = r.agents.flatMap((a) => a.tools.filter((t) => t.access === 'write' && t.ok).map((t) => t.summary ?? `${TOOL_LABELS[t.name] ?? t.name} done.`));
  const cards = r.uiCalls.map((u) => TOOL_LABELS[u.name] ?? u.name);
  const models = [...new Set(r.agents.map((a) => a.model).filter((m): m is string => Boolean(m)))];
  const failedModels = r.agents.flatMap((a) => a.modelsTried.filter((m) => !m.ok).map((m) => m.model));
  const withModel = r.agents.filter((a) => a.model && !a.fallback);
  const replayed = withModel.length > 0 && withModel.every((a) => a.cached);
  const mode: WorkTrace['engine']['mode'] = r.generatedBy === 'ai' ? (replayed ? 'cached' : 'model') : 'rules';
  const note = r.safety === 'crisis' ? 'Safety reply: no model consulted.'
    : replayed ? 'Saved model answer for this rehearsed demo question, replayed to protect the free daily model limit. The tools still ran on today\'s data.'
    : opts.budgetSkipped && r.generatedBy !== 'ai' ? `Today's model budget (${opts.dailyLimit ?? 45} requests) is used up, so the rule-based engine answered from the same data.`
    : r.fallback && models.length ? 'Some steps fell back to the rule-based engine.'
      : r.fallback ? (failedModels.length ? `Models unavailable (${[...new Set(failedModels)].length} tried); the rule-based engine answered from the same data.` : 'Rule-based engine (no model configured or daily model budget used).')
        : undefined;
  return {
    kind: 'chat', goal, plan,
    tools: toolRows(r.agents.flatMap((a) => a.tools)),
    actions,
    result: [actions.length ? `${actions.length} change${actions.length === 1 ? '' : 's'} saved to the student's plan` : 'No changes made (answer only)', cards.length ? `showed ${[...new Set(cards)].join(', ').toLowerCase()}` : null].filter(Boolean).join('; ') + '.',
    engine: { mode, router: r.route.router, models, ...(note ? { note } : {}), ms: r.ms },
    guardrails: GUARDRAILS,
  };
}

/** Trace for a quick lookup answered by the deterministic rule agent. */
export function quickTrace(message: string, intent: string, cards: string[]): WorkTrace {
  return {
    kind: 'chat',
    goal: `"${short(message)}": understood as a quick lookup (${intent}).`,
    plan: ['Match the question to a known lookup with keyword rules.', 'Read the matching data and show it as a card.'],
    tools: cards.map((c) => ({ id: c, label: TOOL_LABELS[c] ?? c, access: 'ui' as const, ok: true, ms: 0, calls: 1 })),
    actions: [],
    result: cards.length ? `Showed ${cards.map((c) => (TOOL_LABELS[c] ?? c).toLowerCase()).join(', ')}.` : 'Answered from the rules.',
    engine: { mode: 'rules', router: 'rules', models: [], note: 'Quick lookups never need a model.', ms: 0 },
    guardrails: GUARDRAILS.slice(0, 1),
  };
}
