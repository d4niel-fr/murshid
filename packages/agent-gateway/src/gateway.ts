/**
 * Gateway orchestration skeleton:
 *   pre-router → (integrity hook) → budget tier → model selection → provider call
 *   with fallbacks → cost accounting.
 *
 * Uses whatever `ChatProvider` it is given; in this phase that is MockProvider.
 */
import { createHash } from 'node:crypto';
import { BudgetLedger, type BudgetTier } from './budget.js';
import { preRoute, type GatewayInput, type PreRoute } from './pre-router.js';
import { costUsd, estimateTokens } from './pricing.js';
import { ProviderError, type ChatMessage, type ChatProvider } from './provider.js';
import type { GatewayConfig, TaskType } from './registry.js';
import { selectModels, type RouteDecision } from './router.js';

/** Adapter for @murshid/privacy AiUseLogger.check — kept as an interface to avoid a hard dependency. */
export type IntegrityHook = (req: { studentId: string; taskId: string; text: string; modelId: string | null }) => Promise<{
  decision: 'allow' | 'allow_with_guidance' | 'block';
  coachMessage?: string;
}>;

export interface GatewayRequest extends GatewayInput {
  studentId: string;
  /** If the request is about a Task, its id (enables integrity check + AI-use log). */
  taskId?: string;
  system?: string;
  history?: ChatMessage[];
  /** Override the routing table's PII default (e.g. a generic, anonymised request). */
  containsPii?: boolean;
  /** Force a task type (skips model-task pre-routing, still honours canned/tool rules). */
  forceTask?: TaskType;
}

export type GatewayResult =
  | { kind: 'canned'; ruleId: string; reply: string }
  | { kind: 'tool'; ruleId: string; tool: string; args: Record<string, unknown> }
  | { kind: 'blocked'; reason: 'integrity'; reply: string }
  | { kind: 'budget_exhausted'; reply: string; tier: BudgetTier }
  | { kind: 'unavailable'; reply: string; tried: string[] }
  | {
      kind: 'model';
      task: TaskType;
      model: string;
      tier: BudgetTier;
      reply: string;
      guidance?: string;
      costUsd: number;
      usage: { input_tokens: number; output_tokens: number };
      tried: string[];
      route: RouteDecision;
    };

export interface GatewayDeps {
  config: GatewayConfig;
  provider: ChatProvider;
  budget: BudgetLedger;
  clock?: () => Date;
  integrity?: IntegrityHook;
}

const BUDGET_MSG =
  "You've used this month's Murshid AI allowance. Your plans, tasks and reminders still work, and the allowance resets on the 1st.";

export class Gateway {
  private clock: () => Date;
  /** Models marked unhealthy after a retryable failure (simple circuit breaker; resets via markHealthy). */
  readonly unhealthy = new Set<string>();

  constructor(private deps: GatewayDeps) {
    this.clock = deps.clock ?? (() => new Date());
  }

  markHealthy(modelId: string) {
    this.unhealthy.delete(modelId);
  }

  async complete(req: GatewayRequest): Promise<GatewayResult> {
    const { config, provider, budget } = this.deps;
    const pre: PreRoute = preRoute(req);
    if (pre.kind === 'canned') return pre;
    if (pre.kind === 'tool') return pre;
    const task = req.forceTask ?? pre.task;

    // Integrity gate before any model sees a task-linked request.
    let guidance: string | undefined;
    if (req.taskId && this.deps.integrity) {
      const res = await this.deps.integrity({ studentId: req.studentId, taskId: req.taskId, text: req.text, modelId: null });
      if (res.decision === 'block') return { kind: 'blocked', reason: 'integrity', reply: res.coachMessage ?? 'I can’t help with that part of this task.' };
      if (res.decision === 'allow_with_guidance') guidance = res.coachMessage;
    }

    const now = this.clock();
    const state = await budget.state(req.studentId, now);
    const route = config.tasks[task];
    const messages: ChatMessage[] = [
      ...(req.system ? [{ role: 'system' as const, content: req.system }] : []),
      ...(guidance ? [{ role: 'system' as const, content: `Coaching constraint: ${guidance}` }] : []),
      ...(req.history ?? []),
      { role: 'user', content: req.text },
    ];
    const inputTokens = messages.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);

    // Pre-flight: if the worst-case cost of the primary pick would push past a threshold, downgrade now.
    let tier = state.tier;
    if (tier !== 'capped') {
      const firstPick = selectModels(config, task, { tier, containsPii: req.containsPii, unhealthy: this.unhealthy, estimatedInputTokens: inputTokens }).candidates[0];
      if (firstPick) {
        const projected = costUsd(config.models[firstPick]!, { input_tokens: inputTokens, output_tokens: route.max_output_tokens }, now);
        const after = budget.tierAfter(state, projected);
        // Step down one tier at most per call.
        if (rank(after) > rank(tier)) tier = tier === 'normal' ? 'economy' : 'capped';
      }
    }

    const decision = selectModels(config, task, { tier, containsPii: req.containsPii, unhealthy: this.unhealthy, estimatedInputTokens: inputTokens });
    if (decision.candidates.length === 0) {
      if (tier === 'capped') return { kind: 'budget_exhausted', reply: BUDGET_MSG, tier };
      return { kind: 'unavailable', reply: 'Murshid is having trouble right now. Please try again in a few minutes.', tried: [] };
    }

    const tried: string[] = [];
    for (const modelId of decision.candidates) {
      tried.push(modelId);
      try {
        const res = await provider.chat({
          model: modelId,
          messages,
          max_tokens: route.max_output_tokens,
          user: pseudonym(req.studentId),
        });
        const usage = { input_tokens: res.usage.prompt_tokens, output_tokens: res.usage.completion_tokens };
        const cost = costUsd(config.models[modelId]!, usage, now);
        await budget.record({ student_id: req.studentId, at: now.toISOString(), task, model_id: modelId, ...usage, cost_usd: cost }, now);
        return {
          kind: 'model',
          task,
          model: modelId,
          tier,
          reply: res.choices[0]?.message.content ?? '',
          ...(guidance ? { guidance } : {}),
          costUsd: cost,
          usage,
          tried,
          route: decision,
        };
      } catch (e) {
        if (e instanceof ProviderError && e.retryable) {
          this.unhealthy.add(modelId);
          continue;
        }
        throw e;
      }
    }
    return { kind: 'unavailable', reply: 'Murshid is having trouble right now. Please try again in a few minutes.', tried };
  }
}

function rank(t: BudgetTier) {
  return t === 'normal' ? 0 : t === 'economy' ? 1 : 2;
}

/** Stable non-reversible key for provider abuse monitoring (`user` field). */
function pseudonym(studentId: string) {
  return createHash('sha256').update(`murshid:${studentId}`).digest('hex').slice(0, 24);
}
