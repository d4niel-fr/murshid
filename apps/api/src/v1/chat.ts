/**
 * POST /chat: the Murshid manager. Routes through the agent-gateway Orchestrator (specialist sub-agents with
 * store-backed tools) and keeps the deterministic rule agent for quick lookups ("gym this term", "what's due",
 * Arabic questions) when no model is configured, and as the safety net when models fail.
 */
import {
  AgentChat, DEFAULT_AREAS, ModelGuard, demoPromptMatcher, Orchestrator, OPENROUTER_FREE_MODELS, parseIntent, providerFromEnv, routeByRules, type AgentTurn, type AreaVocab,
  type ChatProvider, type OrchestratorEvent, type OrchestratorResult, type UiCall,
} from '@murshid/agent-gateway';
import { PROGRESS_RANGES, type ChartSpec, type ChatResponse, type ChatToolCall } from '@murshid/core';
import type { z } from 'zod';
import { badRequest } from '../lib/context';
import { weekday } from '../lib/time';
import { createAgentTools } from './agent-tools';
import { AreaNotFound, buildChart, listAreas } from './charts';
import type * as S from './schemas';
import type { DemoStore, DemoView } from './store';
import { opportunities, tasks, upcoming } from './views';
import { chatTrace, quickTrace } from './trace';
import { DEMO_CACHE } from './demo-cache';
import { runBuddy } from './buddy';

/** Demo personas and the scripted questions the demo (and the judge landing page) uses. Their model answers can be replayed. */
export const DEMO_PERSONAS = ['demo-ideal', 'demo-g5', 'demo-g7', 'demo-g9', 'demo-g11'];
export const DEMO_PROMPTS = [
  'Plan my week around my mid-term and both sports',
  'Plan my week around my exams and sports',
  'Find opportunities for Tideline and save the best one',
  'Find opportunities that fit me',
  'Generate my LinkedIn CV',
  'What should I do today?',
  'Anything new from my teachers?',
  'How can I grow my business revenue?',
];
const normQ = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const SCRIPTED = new Set(DEMO_PROMPTS.map(normQ));
export const isScriptedDemo = (studentId: string, message: string) => DEMO_PERSONAS.includes(studentId) && SCRIPTED.has(normQ(message));

const WD = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function vocabFor(v: DemoView): AreaVocab[] {
  return [
    ...v.profile.subjects.map((s) => ({ id: s.id, label: s.name, labelAr: s.nameAr, aliases: [s.name, s.id.replace(/-/g, ' '), s.nameAr, ...(s.id === 'maths' ? ['math', 'maths', 'mathematics'] : [])] })),
    ...v.profile.goals.map((g) => ({ id: g.id, label: g.title, labelAr: g.titleAr, aliases: [g.title, g.titleAr] })),
    ...v.profile.activities.filter((a) => a.id === 'football' || a.id === 'swimming').map((a) => ({
      id: a.id, label: a.id === 'football' ? 'Football' : 'Swimming', labelAr: a.id === 'football' ? 'كرة القدم' : 'السباحة',
      aliases: a.id === 'football' ? ['football', 'soccer', 'كرة القدم'] : ['swimming', 'swim', 'swims', 'السباحة'],
    })),
    ...v.record.projects.map((p) => ({ id: p.id, label: p.name, aliases: [p.name] })),
  ];
}

function messageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((p) => (p && typeof p === 'object' && 'text' in p ? String((p as { text: unknown }).text) : '')).join('');
  return '';
}

export interface ChatEngine {
  provider: ChatProvider | undefined;
  models: string[];
  rules: AgentChat;
  /** daily budget + demo replay cache around the provider (when a provider is configured) */
  guard?: ModelGuard;
}

export function createChatEngine(env: Record<string, string | undefined> = process.env, provider?: ChatProvider): ChatEngine {
  const raw = provider ?? providerFromEnv(env);
  const models = (env.OPENROUTER_MODELS ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  if (raw) console.log(`[chat] orchestrator model provider: ${raw.name} (${(models.length ? models : OPENROUTER_FREE_MODELS).join(' > ')})`);
  let guard: ModelGuard | undefined;
  if (raw && env.MODEL_GUARD !== 'off') {
    guard = new ModelGuard(raw, {
      dailyLimit: Number(env.MODEL_DAILY_LIMIT) || 45,
      maxAgeDays: Number(env.DEMO_CACHE_MAX_AGE_DAYS) || 21,
      cacheable: env.DEMO_CACHE === 'off' ? () => false : demoPromptMatcher(DEMO_PERSONAS, DEMO_PROMPTS),
    });
    // shipped replays apply to the env-configured provider only (an injected provider, e.g. in tests, starts empty)
    if (!provider) guard.seed(DEMO_CACHE);
  }
  return { provider: guard ?? raw, models: models.length ? models : OPENROUTER_FREE_MODELS, rules: new AgentChat(), guard };
}

const QUICK_INTENTS = new Set(['progress', 'compare', 'upcoming', 'tasks', 'opportunities', 'greeting']);
const ACTION_RE = /\b(plan|add|save|create|generate|make|write|build|draft|grow|improve|advice|help me)\b/i;

/** Quick lookups the rule agent answers well without sub-agents (always when no model is configured). */
export function useQuickPath(message: string, hasModel: boolean, vocab?: AreaVocab[]): boolean {
  const route = routeByRules(message);
  if (route.router === 'safety') return false;
  const intent = parseIntent(message, vocab ? [...DEFAULT_AREAS.filter((d) => !vocab.some((a) => a.id === d.id)), ...vocab] : undefined).intent;
  if (hasModel) return intent === 'greeting' && route.agents.length === 0;
  if (!QUICK_INTENTS.has(intent) || route.agents.length > 1 || ACTION_RE.test(message)) return false;
  // "anything new / from my school / my teachers set" needs the agents' data summaries, not a canned card
  if (/\b(new|school|teachers?|coach|set by|shared)\b/i.test(message)) return false;
  return !['planner', 'career', 'business', 'wellbeing'].includes(route.agents[0] ?? '');
}

/** Turn agent / rule tool calls into UI payloads (charts resolved to ChartSpecs, task and opportunity lists). */
function resolveUi(v: DemoView, calls: UiCall[], ar: boolean, texts: string[], quick: boolean): ChatToolCall[] {
  const out: ChatToolCall[] = [];
  for (const call of calls) {
    if (call.name === 'render_chart') {
      const areas = Array.isArray(call.args.areas) && (call.args.areas as unknown[]).length ? (call.args.areas as unknown[]).map(String) : [String(call.args.area ?? 'academics')];
      const range = (PROGRESS_RANGES as readonly string[]).includes(String(call.args.range)) ? (call.args.range as (typeof PROGRESS_RANGES)[number]) : '4w';
      try {
        const chart: ChartSpec = buildChart(v, areas, range);
        out.push({ name: 'render_chart', args: chart as unknown as Record<string, unknown> });
      } catch (e) {
        if (!(e instanceof AreaNotFound)) throw e;
        if (quick) {
          const names = listAreas(v).filter((a) => a.kind === 'activity' || a.kind === 'subject').map((a) => a.label).join(', ');
          texts.splice(0, texts.length, ar ? `لا توجد لدي بيانات عن ذلك بعد. يمكنني عرض: ${names}.` : `I don't have data on that yet. I can chart: ${names}.`);
        }
      }
    } else if (call.name === 'show_tasks') {
      if (call.args.scope === 'upcoming') {
        const items = upcoming(v, 14);
        out.push({ name: 'show_tasks', args: { scope: 'upcoming', title: ar ? 'القادم' : 'Next 2 weeks', tasks: [], upcoming: items } });
        const first = items[0];
        const n = items.filter((i) => i.kind === 'assessment').length;
        if (quick && !ar) texts.push(first ? `${n} ${n === 1 ? 'assessment' : 'assessments'} in the next 2 weeks; first up: ${first.title} on ${first.date}.` : 'Nothing scheduled in the next 2 weeks.');
      } else {
        const scope = ['today', 'week', 'overdue'].includes(String(call.args.scope)) ? (call.args.scope as 'today' | 'week' | 'overdue') : 'today';
        const items = tasks(v, scope);
        out.push({ name: 'show_tasks', args: { scope, title: scope === 'today' ? (ar ? 'اليوم' : 'Today') : scope === 'week' ? (ar ? 'الأيام السبعة القادمة' : 'Next 7 days') : (ar ? 'متأخرة' : 'Overdue'), tasks: items } });
        const open = items.filter((t) => !t.done).length;
        if (quick && !ar) texts.push(open ? `${open} still to do${scope === 'today' ? ' today' : ''}.` : 'All done — nice work.');
      }
    } else if (call.name === 'show_opportunities') {
      const type = typeof call.args.type === 'string' && call.args.type ? call.args.type : undefined;
      const limit = typeof call.args.limit === 'number' ? Math.min(10, Math.max(1, call.args.limit)) : 3;
      let items = opportunities(v, type, limit);
      if (!items.length && type) items = opportunities(v, undefined, limit);
      out.push({ name: 'show_opportunities', args: { type: type ?? null, items } });
    } else if (call.name === 'show_plan' || call.name === 'show_cv') {
      out.push({ name: call.name, args: call.args });
    }
  }
  return out;
}

export type ChatBody = z.output<typeof S.ChatInput>;

export async function runChat(engine: ChatEngine, store: DemoStore, v: DemoView, body: ChatBody, onEvent?: (e: OrchestratorEvent) => void | Promise<void>): Promise<ChatResponse> {
  const history = (body.messages ?? []).map((m) => ({ role: m.role, content: messageText(m.content) })).filter((m) => m.content && (m.role === 'user' || m.role === 'assistant')) as { role: 'user' | 'assistant'; content: string }[];
  const message = body.message ?? [...history].reverse().find((m) => m.role === 'user')?.content ?? '';
  if (!message.trim()) badRequest('message is required');
  const prior = (body.message ? history : history.slice(0, history.map((m) => m.role).lastIndexOf('user')));
  const fullHistory = [...(body.history ?? []), ...prior].slice(-10);

  // budget guard: once today's model requests are used, everything runs on the rule engine, except scripted
  // demo prompts, whose saved model answers can still be replayed (any step without one falls back to rules)
  const scripted = isScriptedDemo(v.profile.id, message);
  const budgetLeft = engine.guard ? engine.guard.available() : true;
  const provider = engine.provider && (budgetLeft || scripted) ? engine.provider : undefined;
  const budgetSkipped = Boolean(engine.provider) && !budgetLeft;

  if (body.persona === 'buddy') {
    const b = await runBuddy(store, v, message, fullHistory, { provider, models: engine.models });
    if (b.model === null && engine.provider && budgetLeft && b.action === 'rules') engine.guard?.noteFallback();
    return {
      text: b.text, toolCalls: [], intent: 'buddy', lang: /[\u0600-\u06FF]/.test(message) ? 'ar' : 'en', generatedBy: b.model ? 'ai' : 'rules', threadId: body.threadId ?? null,
      route: { agents: ['buddy'], reason: b.flags.length ? `buddy guardrails: ${b.flags.join(', ')}` : 'study buddy persona', router: b.action === 'crisis' ? 'safety' : 'rules' },
      agents: [], fallback: b.action === 'rules' && Boolean(provider), safety: b.action === 'crisis' ? 'crisis' : b.action === 'safe_reply' || b.action === 'replaced' ? 'guardrail' : null, ms: b.ms,
      persona: 'buddy',
      buddy: { action: b.action, flags: b.flags, model: b.model, nudge: b.nudge, limit: b.limit, available: b.status.available, reason: b.status.reason, band: b.status.band, turnsToday: b.status.turnsToday },
    };
  }

  if (useQuickPath(message, Boolean(provider), vocabFor(v))) {
    const turn: AgentTurn = await engine.rules.turn({ message, history: fullHistory, studentName: v.profile.preferredName, studentKey: v.profile.id, areas: vocabFor(v) });
    const ar = turn.lang === 'ar';
    const texts = [turn.text];
    const toolCalls = resolveUi(v, turn.toolCalls, ar, texts, true);
    if (!texts.some((t) => t.trim()) && toolCalls[0]) texts.push(ar ? 'هذه النتيجة.' : 'Here you go.');
    return { text: texts.filter(Boolean).join(' '), toolCalls, intent: turn.intent, lang: turn.lang, generatedBy: 'rules', threadId: body.threadId ?? null, route: { agents: ['quick'], reason: `rule intent: ${turn.intent}`, router: 'rules' }, agents: [], fallback: false, safety: null, trace: quickTrace(message, turn.intent, toolCalls.map((t) => t.name)) };
  }

  const orchestrator = new Orchestrator({
    provider, models: engine.models,
    tools: createAgentTools({ store, studentId: v.profile.id, now: () => v.now, actor: 'murshid' }),
  });
  const r: OrchestratorResult = await orchestrator.run({
    message, history: fullHistory, onEvent,
    student: { id: v.profile.id, name: v.profile.preferredName, grade: v.profile.grade, today: v.data.today, weekday: WD[weekday(v.data.today)] },
  });
  if (r.fallback && engine.provider) engine.guard?.noteFallback();
  // the view was captured before the agents wrote: re-read so task / plan cards include their changes
  const after = store.view(v.profile.id, v.now);
  const texts = [r.text];
  const toolCalls = resolveUi(after, r.uiCalls, r.lang === 'ar', texts, false);
  return {
    text: texts.join(' '), toolCalls, intent: r.route.agents.join('+'), lang: r.lang, generatedBy: r.generatedBy, threadId: body.threadId ?? null,
    agents: r.agents, route: r.route, fallback: r.fallback, safety: r.safety, ms: r.ms, trace: chatTrace(message, r, { budgetSkipped, dailyLimit: engine.guard?.status().dailyLimit }),
  };
}
