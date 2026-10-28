/**
 * The orchestrator ("the manager"): routes each request to specialist sub-agents (sub-agents.ts), runs them in
 * parallel with their own prompts, tools and model chains, and merges their answers.
 *
 *  1. Safety first: crisis language gets a fixed, safe reply with UAE helplines; no model is consulted.
 *  2. Route: keyword rules; when nothing matches and a model is available, a small model call picks agents.
 *  3. Each sub-agent: prefetch its read tools (real store data) into the prompt, call its model chain with its
 *     tools, execute tool calls (reads, safe writes, UI cards), up to `maxToolRounds` round-trips.
 *  4. Fallback: if the model fails, the agent answers from the tool summaries (rules) and still runs its write
 *     action when the request clearly asks for it (e.g. "plan my week", "make my CV").
 *  5. Merge: one agent's text as-is; several agents become labelled sections under a one-line manager intro.
 *
 * Events are emitted as the work happens (route, agent-start, tool, agent-done) so the API can stream them as SSE.
 */
import type { ChatMessage, ChatProvider, ToolCall } from './provider.js';
import { FREE_MODEL, OPENROUTER_FREE_MODELS } from './provider.js';
import { parseIntent } from './agent-chat.js';
import {
  CRISIS_RE, ORCHESTRATOR_TOOLS, ROUTER_PROMPT, SUB_AGENTS, SUB_AGENT_IDS, agentModelChain, crisisReply, routeByRules,
  toolSpecsToOpenAI, wellbeingSafe, type AgentRouteDecision, type SubAgentId, type SubAgentSpec, type ToolAccess,
} from './sub-agents.js';

export interface AgentToolContext { agent: SubAgentId; message: string }
/** Host-implemented tool. May return `{ summary, ui }`: `ui` is a card for the chat (render_chart etc.). */
export type ToolHandler = (args: Record<string, unknown>, ctx: AgentToolContext) => unknown | Promise<unknown>;
export interface UiCall { name: string; args: Record<string, unknown> }

export interface ToolTrace { name: string; access: ToolAccess; args: Record<string, unknown>; ok: boolean; ms: number; prefetch: boolean; error?: string; /** write tools: what the tool reported it did */ summary?: string }
export interface AgentTrace {
  agent: SubAgentId;
  name: string;
  model: string | null;
  modelsTried: { model: string; ok: boolean; status?: number; ms: number }[];
  ms: number;
  fallback: boolean;
  error?: string;
  rounds: number;
  tools: ToolTrace[];
  text: string;
  /** every model response in this step was a replayed demo response (ModelGuard) */
  cached?: boolean;
}
export type OrchestratorEvent =
  | { type: 'route'; agents: SubAgentId[]; names: string[]; reason: string; router: AgentRouteDecision['router'] }
  | { type: 'agent-start'; agent: SubAgentId; name: string; models: string[] }
  | { type: 'tool'; agent: SubAgentId; tool: ToolTrace }
  | { type: 'agent-done'; agent: SubAgentId; name: string; ms: number; fallback: boolean; model: string | null; error?: string };

export interface OrchestratorResult {
  text: string;
  sections: { agent: SubAgentId; name: string; topic?: string; text: string }[];
  uiCalls: UiCall[];
  route: AgentRouteDecision;
  agents: AgentTrace[];
  generatedBy: 'ai' | 'rules';
  fallback: boolean;
  safety: 'crisis' | null;
  lang: 'en' | 'ar';
  ms: number;
}

export interface OrchestratorOptions {
  provider?: ChatProvider;
  tools: Record<string, ToolHandler>;
  /** configured model chain (defaults to the free OpenRouter models) */
  models?: string[];
  maxToolRounds?: number;
  maxAgents?: number;
  /** use a model to route when keywords find nothing (default true when a provider is set) */
  modelRouter?: boolean;
  maxTokens?: number;
}

export interface OrchestratorInput {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  student: { id: string; name: string; grade: number; today: string; weekday?: string };
  onEvent?: (e: OrchestratorEvent) => void | Promise<void>;
  /** force specific agents (tests, admin tools) */
  agents?: SubAgentId[];
}

const AR = /[\u0600-\u06FF]/;
const MAX_DATA_CHARS = 7000;

function compact(x: unknown, max = MAX_DATA_CHARS): string {
  const s = JSON.stringify(x, (_k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 100) / 100 : v));
  return s.length > max ? `${s.slice(0, max)}…(truncated)` : s;
}
const summaryOf = (x: unknown): string | null =>
  x && typeof x === 'object' && typeof (x as { summary?: unknown }).summary === 'string' ? (x as { summary: string }).summary : null;
const uiOf = (x: unknown): UiCall[] => {
  if (!x || typeof x !== 'object') return [];
  const ui = (x as { ui?: unknown }).ui;
  const list = Array.isArray(ui) ? ui : ui ? [ui] : [];
  return list.filter((u): u is UiCall => Boolean(u && typeof u === 'object' && typeof (u as UiCall).name === 'string'));
};

export class Orchestrator {
  constructor(private opts: OrchestratorOptions) {}

  get chain(): string[] {
    return this.opts.models?.length ? this.opts.models : OPENROUTER_FREE_MODELS;
  }

  /** Decide which sub-agents handle the message. */
  async route(message: string, emitModel = true): Promise<AgentRouteDecision> {
    const rules = routeByRules(message);
    if (rules.agents.length || rules.router === 'safety') return rules;
    const p = this.opts.provider;
    if (p && emitModel && (this.opts.modelRouter ?? true) && message.trim().split(/\s+/).length >= 4) {
      try {
        const res = await p.chat({
          model: this.chain[0]!, models: agentModelChain({ ...SUB_AGENTS.general, prefer: [FREE_MODEL.lightning] }, this.chain),
          messages: [{ role: 'system', content: ROUTER_PROMPT }, { role: 'user', content: message }], max_tokens: 400, temperature: 0,
        });
        const raw = res.choices[0]?.message.content ?? '';
        const json = /\{[\s\S]*\}/.exec(raw)?.[0];
        const ids = (json ? (JSON.parse(json) as { agents?: unknown }).agents : []) as unknown[];
        const agents = (Array.isArray(ids) ? ids : []).map(String).filter((x): x is SubAgentId => (SUB_AGENT_IDS as readonly string[]).includes(x)).slice(0, 3);
        if (agents.length) return { agents, reason: `model router (${res.model})`, router: 'model' };
      } catch { /* fall through to general */ }
    }
    return { agents: ['general'], reason: rules.reason, router: 'rules' };
  }

  async run(input: OrchestratorInput): Promise<OrchestratorResult> {
    const t0 = Date.now();
    const emit = async (e: OrchestratorEvent) => { try { await input.onEvent?.(e); } catch { /* listener errors never break a turn */ } };
    const lang: 'en' | 'ar' = AR.test(input.message) ? 'ar' : 'en';

    if (CRISIS_RE.test(input.message)) {
      const route: AgentRouteDecision = { agents: ['wellbeing'], reason: 'safety: crisis language', router: 'safety' };
      await emit({ type: 'route', agents: route.agents, names: [SUB_AGENTS.wellbeing.name], reason: route.reason, router: route.router });
      const text = crisisReply(input.student.name);
      const trace: AgentTrace = { agent: 'wellbeing', name: SUB_AGENTS.wellbeing.name, model: null, modelsTried: [], ms: 0, fallback: false, rounds: 0, tools: [], text };
      await emit({ type: 'agent-done', agent: 'wellbeing', name: trace.name, ms: 0, fallback: false, model: null });
      return { text, sections: [{ agent: 'wellbeing', name: trace.name, topic: SUB_AGENTS.wellbeing.topic, text }], uiCalls: [], route, agents: [trace], generatedBy: 'rules', fallback: false, safety: 'crisis', lang, ms: Date.now() - t0 };
    }

    const route = input.agents?.length
      ? { agents: input.agents, reason: 'forced', router: 'rules' as const }
      : await this.route(input.message);
    route.agents = route.agents.slice(0, this.opts.maxAgents ?? 3);
    await emit({ type: 'route', agents: route.agents, names: route.agents.map((a) => SUB_AGENTS[a].name), reason: route.reason, router: route.router });

    // compound requests: the first (lead) agent owns any writes; the others advise with read + UI tools only,
    // so one request never creates the same task three times
    const results = await Promise.all(route.agents.map((id, i) => this.runAgent(SUB_AGENTS[id], input, emit, i > 0 ? SUB_AGENTS[route.agents[0]!].name : null)));
    const sections = results.map((r) => ({ agent: r.trace.agent, name: r.trace.name, topic: SUB_AGENTS[r.trace.agent].topic, text: r.trace.text }));
    const uiCalls = dedupeUi(results.flatMap((r) => r.ui));
    const text = sections.length === 1
      ? sections[0]!.text
      : [`Here's what I put together, ${input.student.name}:`, ...sections.map((s) => `**${s.topic}**\n${s.text}`)].join('\n\n');
    const anyAi = results.some((r) => !r.trace.fallback && r.trace.model);
    return {
      text, sections, uiCalls, route, agents: results.map((r) => r.trace),
      generatedBy: anyAi ? 'ai' : 'rules', fallback: results.some((r) => r.trace.fallback), safety: null, lang, ms: Date.now() - t0,
    };
  }

  private async callTool(agent: SubAgentSpec, name: string, args: Record<string, unknown>, input: OrchestratorInput, prefetch: boolean,
    emit: (e: OrchestratorEvent) => Promise<void>): Promise<{ result: unknown; trace: ToolTrace }> {
    const spec = ORCHESTRATOR_TOOLS[name];
    const t0 = Date.now();
    let result: unknown;
    let trace: ToolTrace;
    if (!spec || !agent.tools.includes(name)) {
      result = { error: `tool ${name} is not available to the ${agent.name}` };
      trace = { name, access: spec?.access ?? 'read', args, ok: false, ms: 0, prefetch, error: 'not allowed' };
    } else {
      const handler = this.opts.tools[name];
      try {
        if (!handler) throw new Error(`no handler for ${name}`);
        result = await handler(args, { agent: agent.id, message: input.message });
        trace = { name, access: spec.access, args, ok: true, ms: Date.now() - t0, prefetch };
        const done = spec.access === 'write' ? summaryOf(result) : null;
        if (done) trace.summary = done.slice(0, 240);
      } catch (e) {
        result = { error: (e as Error).message };
        trace = { name, access: spec.access, args, ok: false, ms: Date.now() - t0, prefetch, error: (e as Error).message };
      }
    }
    await emit({ type: 'tool', agent: agent.id, tool: trace });
    return { result, trace };
  }

  private async runAgent(spec: SubAgentSpec, input: OrchestratorInput, emit: (e: OrchestratorEvent) => Promise<void>, leadName: string | null = null): Promise<{ trace: AgentTrace; ui: UiCall[] }> {
    const t0 = Date.now();
    const advisor = leadName !== null;
    const agent: SubAgentSpec = advisor
      ? { ...spec, tools: spec.tools.filter((t) => ORCHESTRATOR_TOOLS[t]?.access !== 'write'), fallbackAction: undefined,
        systemPrompt: `${spec.systemPrompt}\nADVISOR MODE: the ${leadName} owns this request and has already built any plan or schedule. Do NOT write a schedule, timetable or day-by-day plan. Give 2-3 short bullets of ${spec.name.toLowerCase()} advice only, each citing a number or date from DATA. Do not call write tools.` }
      : spec;
    const models = agentModelChain(agent, this.chain);
    await emit({ type: 'agent-start', agent: agent.id, name: agent.name, models: this.opts.provider ? models : [] });
    const tools: ToolTrace[] = [];
    const ui: UiCall[] = [];
    const data: Record<string, unknown> = {};
    const called: Record<string, unknown> = {};
    for (const name of agent.prefetch) {
      const { result, trace } = await this.callTool(agent, name, {}, input, true, emit);
      tools.push(trace);
      data[name] = result;
    }

    const finish = async (text: string, extra: Partial<AgentTrace>): Promise<{ trace: AgentTrace; ui: UiCall[] }> => {
      let out = text.trim();
      if (agent.id === 'wellbeing') out = wellbeingSafe(out).text;
      const trace: AgentTrace = { agent: agent.id, name: agent.name, model: null, modelsTried: [], ms: Date.now() - t0, fallback: false, rounds: 0, tools, text: out, ...extra };
      await emit({ type: 'agent-done', agent: agent.id, name: agent.name, ms: trace.ms, fallback: trace.fallback, model: trace.model, ...(trace.error ? { error: trace.error } : {}) });
      return { trace, ui };
    };

    const provider = this.opts.provider;
    let error: string | undefined;
    let modelsTried: AgentTrace['modelsTried'] = [];
    if (provider) {
      const s = input.student;
      const messages: ChatMessage[] = [
        { role: 'system', content: `${agent.systemPrompt}\n\nSTUDENT: ${s.name} (Grade ${s.grade}). Today is ${s.weekday ? `${s.weekday} ` : ''}${s.today} (Asia/Dubai).\nDATA (already fetched with ${agent.prefetch.join(', ')}; do not call those tools again):\n${compact(data)}` },
        ...(input.history ?? []).slice(-6).map((h) => ({ role: h.role, content: h.content.slice(0, 1500) }) as ChatMessage),
        { role: 'user', content: input.message },
      ];
      const openaiTools = toolSpecsToOpenAI(agent.tools);
      let model: string | null = null;
      let rounds = 0;
      let allCached = true;
      const maxRounds = advisor ? 1 : (this.opts.maxToolRounds ?? 2);
      try {
        for (let round = 0; round <= maxRounds; round++) {
          rounds++;
          const last = round === maxRounds;
          const res = await provider.chat({
            model: models[0]!, models, messages, max_tokens: this.opts.maxTokens ?? 1400, temperature: 0.4,
            ...(last ? { tool_choice: 'none' as const, tools: openaiTools } : { tools: openaiTools, tool_choice: 'auto' as const }),
            user: s.id,
          });
          modelsTried = [...modelsTried, ...(res.attempts ?? [{ model: res.model, ok: true, ms: 0 }])];
          model = res.model;
          if (!res.cached) allCached = false;
          const msg = res.choices[0]?.message;
          let calls: ToolCall[] = (msg?.tool_calls ?? []).filter((c) => c?.function?.name);
          // some models print tool calls as text (<tool_call><function=…>); treat them as real calls
          if (!calls.length && !last && msg?.content) {
            const parsed = parseMarkupToolCalls(msg.content).filter((c) => agent.tools.includes(c.function.name));
            if (parsed.length) { calls = parsed; msg.content = cleanModelText(msg.content); }
          }
          if (!calls.length || last) {
            const text = cleanModelText(msg?.content ?? '');
            if (!text) throw new Error(msg?.content?.includes('<tool_call>') || msg?.content?.includes('<function=') ? 'model returned only tool-call markup' : 'model returned no text');
            // explicit requests are always carried out: if the student clearly asked for an action ("plan my week",
            // "make my CV", "save the best one") and the model answered without doing it, run that tool now
            const must = advisor ? undefined : agent.fallbackAction?.find((a) => a.when.test(input.message));
            if (must && !tools.some((t) => t.name === must.tool && t.ok)) {
              const r = await this.callTool(agent, must.tool, must.tool === 'create_task' || must.tool === 'save_opportunity' ? { fromMessage: true } : {}, input, false, emit);
              tools.push(r.trace);
              ui.push(...uiOf(r.result));
            }
            return finish(text, { model, modelsTried, rounds, ...(allCached ? { cached: true } : {}) });
          }
          messages.push({ role: 'assistant', content: msg?.content ?? '', tool_calls: calls });
          for (const call of calls) {
            let args: Record<string, unknown> = {};
            try { const p = JSON.parse(call.function.arguments || '{}'); if (p && typeof p === 'object') args = p; } catch { /* bad args → empty */ }
            const name = call.function.name;
            const spec = ORCHESTRATOR_TOOLS[name];
            if (spec?.access === 'ui' && agent.tools.includes(name)) {
              ui.push({ name, args });
              const trace: ToolTrace = { name, access: 'ui', args, ok: true, ms: 0, prefetch: false };
              tools.push(trace);
              await emit({ type: 'tool', agent: agent.id, tool: trace });
              messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify({ ok: true, shown: name }) });
              continue;
            }
            const { result, trace } = await this.callTool(agent, name, args, input, false, emit);
            tools.push(trace);
            if (trace.ok) called[name] = result;
            ui.push(...uiOf(result));
            messages.push({ role: 'tool', tool_call_id: call.id, content: compact(result, 4000) });
          }
        }
      } catch (e) {
        error = (e as Error).message.slice(0, 300);
        const failed = (e as { attempts?: AgentTrace['modelsTried'] }).attempts;
        if (failed?.length) modelsTried = [...modelsTried, ...failed];
      }
    }

    // ---------- rule-based fallback (no provider, or every model failed) ----------
    const parts: string[] = [];
    const summaries = agent.prefetch.map((n) => summaryOf(data[n])).filter((x): x is string => Boolean(x));
    const action = agent.fallbackAction?.find((a) => a.when.test(input.message));
    if (action) {
      const tool = action.tool;
      let result = called[tool]; // the model may already have run it before failing: never write twice
      if (result === undefined) {
        // no model to extract arguments: the host reads them from the message (ctx.message)
        const r = await this.callTool(agent, tool, tool === 'create_task' || tool === 'save_opportunity' ? { fromMessage: true } : {}, input, false, emit);
        tools.push(r.trace);
        result = r.result;
        ui.push(...uiOf(result));
      }
      const s = summaryOf(result);
      if (s) parts.push(s);
    }
    parts.push(...summaries);
    if (agent.fallbackChart) {
      const parsed = parseIntent(input.message);
      ui.push({ name: 'render_chart', args: { area: agent.fallbackChart.area, range: parsed.rangeExplicit ? parsed.range : agent.fallbackChart.range } });
    }
    if (agent.id === 'business') {
      const first = (data.get_side_projects as { chartArea?: string } | undefined)?.chartArea;
      if (first) ui.push({ name: 'render_chart', args: { area: first, range: 'year' } });
    }
    if (agent.id === 'opportunities') ui.push({ name: 'show_opportunities', args: { limit: 3 } });
    if (agent.id === 'wellbeing') {
      parts.unshift("That sounds like a lot to carry. Let's make the week lighter.");
      parts.push('Try one small step today: a proper break, a walk, or an earlier night. Talking to a parent or your school counsellor really helps. If things ever feel like too much, the UAE Mental Support Line is 800-HOPE (800 4673).');
    }
    const text = parts.join('\n\n') || "I couldn't reach my models just now, but your data is safe. Try asking about your grades, training, opportunities, plan or business.";
    return finish(text, { fallback: true, modelsTried, ...(error ? { error } : {}) });
  }
}

/** Parse `<tool_call><function=name><parameter=key>value</parameter>…</function></tool_call>` printed as text. */
export function parseMarkupToolCalls(text: string): ToolCall[] {
  const out: ToolCall[] = [];
  for (const m of text.matchAll(/<function=([\w-]+)>([\s\S]*?)<\/function>/g)) {
    const args: Record<string, unknown> = {};
    for (const p of m[2]!.matchAll(/<parameter=([\w-]+)>\s*([\s\S]*?)\s*<\/parameter>/g)) {
      const raw = p[2]!.trim();
      args[p[1]!] = /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw;
    }
    out.push({ id: `markup_${out.length}`, type: 'function', function: { name: m[1]!, arguments: JSON.stringify(args) } });
  }
  return out;
}

/**
 * Clean a model reply for the chat: drop tool-call markup some models print as text (`<tool_call>…`,
 * `<function=…>`), turn markdown tables into bullets, collapse blank lines.
 */
export function cleanModelText(raw: string): string {
  let t = raw
    .replace(/<tool_call>[\s\S]*?(<\/tool_call>|$)/g, '')
    .replace(/<function=[\s\S]*?(<\/function>|$)/g, '')
    .replace(/<\/?(think|reasoning)>[\s\S]*?(<\/(think|reasoning)>|$)/g, '');
  const lines = t.split('\n');
  const out: string[] = [];
  let header: string[] | null = null;
  for (const line of lines) {
    const cells = /^\s*\|(.+)\|\s*$/.exec(line)?.[1]?.split('|').map((c) => c.trim());
    if (!cells) { header = null; out.push(line); continue; }
    if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
    if (!header) { header = cells; continue; } // header row
    out.push(`- ${cells.filter(Boolean).join(' · ')}`);
  }
  t = out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return t;
}

function dedupeUi(xs: UiCall[]): UiCall[] {
  const seen = new Set<string>();
  return xs.filter((u) => { const k = `${u.name}:${JSON.stringify(u.args)}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 4);
}
