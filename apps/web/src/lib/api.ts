/**
 * Typed client for the Murshid API (Logic team) with a bundled mock fallback in identical shapes.
 * Mode 'auto' tries the API (short timeout, shape-checked) and silently falls back to the mock.
 * Mode 'mock' never touches the network. The app is fully usable with the API down.
 */
import { demoStudents, type BandId } from './bands';
import { normalizeToolArgs, toAcademics, toChartSpec, toDashboard, toLinks } from './normalize';
import { mockChatReply, type Intent } from './intent';
import { mockWorld, type MockWorld } from './mock/data';
import { buildChartSpec, type Locale } from './progress';
import type { BuddyStatus, ChartRange, ChartType, ChatAgentRun, ChatProgress, ChatReply, ChatToolCall, ProfileLinks, WorkTrace } from './types';

export type DataMode = 'auto' | 'mock';
export type Source = 'api' | 'mock';

/** The API, on the same domain: the "api" service at /api on Vercel, proxied to localhost:8787 by next.config in local dev. */
export const API_BASE = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_MURSHID_API) || '/api';
/** Dev auth: the v1 API picks the synthetic student from `x-dev-user-id: demo-g5|demo-g7|demo-g9|demo-g11`. */
const DEV_USER_OVERRIDE = typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_MURSHID_DEV_USER : undefined;

export interface ClientOptions {
  band: BandId;
  locale?: Locale;
  mode?: DataMode;
  baseUrl?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Mock world to answer from (e.g. the bundled world merged with sessions the user logged locally). */
  world?: () => MockWorld;
  /** demo student id override (e.g. 'demo-ideal') */
  persona?: string | null;
  /** chat timeout when the API is up (real models can take 20-60 s per sub-agent) */
  chatTimeoutMs?: number;
}

export interface Result<T> { data: T; source: Source }

type Parse<T> = (x: unknown) => T | null;
const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;

/** Per-band mock link overrides (simulates PUT /profile/links persistence while the API is down). */
const linkOverrides = new Map<BandId, ProfileLinks>();

export function createClient(opts: ClientOptions) {
  // generous: a serverless API can take a few seconds to wake up, and giving up early shows demo data instead of live
  const { band, locale = 'en', mode = 'auto', baseUrl = API_BASE, timeoutMs = 8000, now } = opts;
  const f = opts.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined);
  const world = opts.world ?? (() => mockWorld(band, now, opts.persona));

  const devUser = opts.persona || DEV_USER_OVERRIDE || demoStudents[band]?.id || 'demo-g9';
  const chatTimeoutMs = opts.chatTimeoutMs ?? 180_000;

  async function call<T>(path: string, parse: Parse<T>, fallback: () => T, init?: RequestInit): Promise<Result<T>> {
    if (mode === 'mock' || !f) return { data: fallback(), source: 'mock' };
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await f(`${baseUrl}${path}`, {
        ...init,
        signal: ctrl.signal,
        headers: { 'content-type': 'application/json', accept: 'application/json', 'x-dev-user-id': devUser, ...(init?.headers ?? {}) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = parse(await res.json());
      if (parsed === null) throw new Error('shape mismatch');
      return { data: parsed, source: 'api' };
    } catch {
      return { data: fallback(), source: 'mock' };
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    band,
    getDashboard: () => call('/dashboard', (x) => toDashboard(x, locale), () => world().dashboard),
    getProgress: async (area: string, range: ChartRange, type?: ChartType) => {
      const r = await call(`/progress?area=${encodeURIComponent(area)}&range=${range}${type ? `&type=${type}` : ''}`, toChartSpec, () => buildChartSpec(world(), { area, range, type, locale }));
      // the API writes chart sentences in English; in Arabic, draw the same student's chart with Arabic text
      return locale === 'ar' && r.source === 'api' ? { ...r, data: buildChartSpec(world(), { area, range, type, locale }) } : r;
    },
    getAcademics: () => call('/academics', toAcademics, () => world().academics),
    /** Live payload is only used to confirm availability; the web keeps the richer session-level mock for charts. */
    getExtracurriculars: () => call('/extracurriculars', (x) => (isObj(x) && Array.isArray(x.activities) ? world().extracurriculars : null), () => world().extracurriculars),
    getProfileLinks: () => call('/profile/links', toLinks, () => linkOverrides.get(band) ?? world().links),
    putProfileLinks: (links: ProfileLinks) => {
      linkOverrides.set(band, links);
      const body = { linkedin: links.linkedin, github: links.github, instagram: links.instagram, portfolio: links.portfolio };
      return call('/profile/links', toLinks, () => links, { method: 'PUT', body: JSON.stringify(body) });
    },
    /** LinkedIn pack + PDF (student API); null when the API is down. */
    async getLinkedIn(): Promise<Record<string, unknown> | null> {
      if (mode === 'mock' || !f) return null;
      try {
        const res = await f(`${baseUrl}/student/cv/linkedin`, { headers: { 'x-dev-user-id': devUser, 'x-dev-user': devUser } });
        return res.ok ? ((await res.json()) as Record<string, unknown>) : null;
      } catch { return null; }
    },
    cvPdfUrl: () => `${baseUrl}/student/cv/linkedin.pdf`,
    /** Study buddy availability; offline when the API is down (the buddy needs the server's guardrails). */
    getBuddy: () => call<BuddyStatus>('/buddy', toBuddy, () => ({ available: false, reason: 'offline', band, controls: { guardian: null, school: null }, turnsToday: 0 }), { headers: { 'x-dev-user': devUser } }),
    /**
     * Demo: a guardian switches study buddy mode on or off (audit-logged on the server). On the public demo the API
     * asks for the demo passcode (ADMIN_PASSCODE): `needsPasscode` is set when it is missing or wrong.
     */
    async setBuddyGuardian(enabled: boolean, passcode?: string | null): Promise<Result<BuddyStatus> & { needsPasscode?: boolean }> {
      const offline: BuddyStatus = { available: false, reason: 'offline', band, controls: { guardian: enabled, school: null }, turnsToday: 0 };
      if (mode === 'mock' || !f) return { data: offline, source: 'mock' };
      try {
        const res = await f(`${baseUrl}/buddy/controls`, {
          method: 'PUT', body: JSON.stringify({ by: 'guardian', enabled }),
          headers: { 'content-type': 'application/json', accept: 'application/json', 'x-dev-user-id': devUser, 'x-dev-user': devUser, 'x-dev-role': 'guardian', ...(passcode ? { 'x-admin-passcode': passcode } : {}) },
        });
        if (res.status === 401) return { data: offline, source: 'mock', needsPasscode: true };
        const parsed = res.ok ? toBuddy(await res.json()) : null;
        return parsed ? { data: parsed, source: 'api' } : { data: offline, source: 'mock' };
      } catch { return { data: offline, source: 'mock' }; }
    },
    devUser,
    /**
     * POST /chat with SSE. Progress events (which sub-agent is working, which tool) arrive through `onProgress`
     * while the agents run; the final reply comes from the `done` event. Falls back to the bundled rules if the
     * API is unreachable.
     */
    async chat(message: string, signal?: AbortSignal, onProgress?: (p: ChatProgress) => void, opts: { history?: { role: 'user' | 'assistant'; content: string }[]; persona?: 'tutor' | 'buddy' } = {}): Promise<Result<ChatReply>> {
      const buddyOffline = (): ChatReply => ({ text: locale === 'ar' ? 'وضع رفيق الدراسة يحتاج إلى خادم مرشد، وهو غير متاح الآن. يمكن للمعلّم مساعدتك.' : "Study buddy mode needs the Murshid server, which isn't reachable right now. Switch to Tutor and I'll help from your saved data.", toolCalls: [], persona: 'buddy', generatedBy: 'rules' });
      const fallback = () => (opts.persona === 'buddy' ? buddyOffline() : withOfflineTrace(mockChatReply(message, world(), { locale }), message));
      if (mode === 'mock' || !f) return { data: fallback(), source: 'mock' };
      const ctrl = new AbortController();
      // short timeout until the response starts, then the long model timeout
      let timer = setTimeout(() => ctrl.abort(), Math.max(20_000, timeoutMs * 2));
      signal?.addEventListener('abort', () => ctrl.abort());
      try {
        const res = await f(`${baseUrl}/chat`, {
          method: 'POST', signal: ctrl.signal,
          headers: { 'content-type': 'application/json', accept: 'text/event-stream', 'x-dev-user-id': devUser, 'x-dev-user': devUser },
          body: JSON.stringify({ message, band, locale, ...(opts.history?.length ? { history: opts.history.slice(-10).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) })) } : {}), ...(opts.persona === 'buddy' ? { persona: 'buddy' } : {}) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        clearTimeout(timer);
        timer = setTimeout(() => ctrl.abort(), chatTimeoutMs);
        const ct = res.headers.get('content-type') ?? '';
        let reply: ChatReply | null;
        if (ct.includes('text/event-stream') && res.body && typeof res.body.getReader === 'function') {
          reply = await readSSE(res.body, onProgress);
        } else if (ct.includes('text/event-stream')) {
          reply = parseSSE(await res.text(), onProgress);
        } else {
          reply = normaliseReply(await res.json());
        }
        if (!reply) throw new Error('shape mismatch');
        return { data: reply, source: 'api' };
      } catch {
        return { data: fallback(), source: 'mock' };
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

export type MurshidClient = ReturnType<typeof createClient>;

/** The API could not be reached: the in-browser rules answered from bundled demo data. Say so honestly. */
export function withOfflineTrace(reply: ChatReply, message: string): ChatReply {
  const cards = reply.toolCalls.map((t) => t.name.replace(/_/g, ' '));
  return {
    ...reply,
    trace: {
      kind: 'chat',
      goal: `"${message.length > 90 ? `${message.slice(0, 89)}…` : message}": matched to a known question type in the browser.`,
      plan: ['Match the question with keyword rules (no server, no model).', 'Answer from the bundled demo data.'],
      tools: reply.toolCalls.map((t) => ({ id: t.name, label: t.name.replace(/_/g, ' '), access: 'ui' as const, ok: true, ms: 0, calls: 1 })),
      actions: [],
      result: cards.length ? `Showed ${cards.join(', ')}. Nothing was saved.` : 'Answered from the rules. Nothing was saved.',
      engine: { mode: 'offline', router: 'rules', models: [], note: 'The Murshid server was unreachable, so the in-browser fallback answered.', ms: 0 },
      guardrails: ['Nothing left this device.'],
    },
  };
}

function toBuddy(x: unknown): BuddyStatus | null {
  if (!isObj(x) || typeof x.available !== 'boolean' || typeof x.reason !== 'string') return null;
  const c = isObj(x.controls) ? x.controls : {};
  return {
    available: x.available, reason: x.reason as BuddyStatus['reason'], band: String(x.band ?? ''),
    controls: { guardian: typeof c.guardian === 'boolean' ? c.guardian : null, school: typeof c.school === 'boolean' ? c.school : null },
    turnsToday: typeof x.turnsToday === 'number' ? x.turnsToday : 0,
  };
}

const TOOL_NAMES = new Set(['render_chart', 'show_tasks', 'show_opportunities', 'show_plan', 'show_cv']);

export function normaliseReply(x: unknown): ChatReply | null {
  if (!isObj(x)) return null;
  const text = typeof x.text === 'string' ? x.text : typeof x.reply === 'string' ? x.reply : typeof x.message === 'string' ? x.message : null;
  if (text === null) return null;
  const raw = Array.isArray(x.toolCalls) ? x.toolCalls : Array.isArray(x.tool_calls) ? x.tool_calls : Array.isArray(x.tools) ? x.tools : [];
  const toolCalls: ChatToolCall[] = raw
    .filter((t): t is Record<string, unknown> => isObj(t) && typeof t.name === 'string' && TOOL_NAMES.has(t.name))
    .map((t) => {
      const name = t.name as ChatToolCall['name'];
      const args = (isObj(t.args) ? t.args : isObj(t.arguments) ? t.arguments : {}) as Record<string, unknown>;
      return { name, args: name === 'show_plan' || name === 'show_cv' ? args : normalizeToolArgs(name as 'render_chart' | 'show_tasks' | 'show_opportunities', args) };
    });
  const agents = Array.isArray(x.agents) ? (x.agents as ChatAgentRun[]).filter((a) => isObj(a) && typeof a.name === 'string') : undefined;
  const trace = isObj(x.trace) && typeof x.trace.goal === 'string' && Array.isArray(x.trace.plan) ? (x.trace as unknown as WorkTrace) : undefined;
  const buddy = isObj(x.buddy) && typeof x.buddy.action === 'string'
    ? { action: x.buddy.action, flags: Array.isArray(x.buddy.flags) ? (x.buddy.flags as unknown[]).map(String) : [], available: x.buddy.available !== false, reason: String(x.buddy.reason ?? 'on') }
    : undefined;
  return {
    text, toolCalls, ...(agents?.length ? { agents } : {}), ...(x.generatedBy === 'ai' || x.generatedBy === 'rules' ? { generatedBy: x.generatedBy } : {}), ...(trace ? { trace } : {}),
    ...(x.persona === 'buddy' || x.persona === 'tutor' ? { persona: x.persona } : {}),
    ...(x.safety === 'crisis' || x.safety === 'guardrail' ? { safety: x.safety } : {}),
    ...(buddy ? { buddy } : {}),
  };
}

function progressOf(event: string, ev: Record<string, unknown>): ChatProgress | null {
  if (event === 'route' && Array.isArray(ev.names)) return { type: 'route', names: ev.names.map(String) };
  if (event === 'agent-start') return { type: 'agent-start', agent: String(ev.agent), name: String(ev.name) };
  if (event === 'agent-done') return { type: 'agent-done', agent: String(ev.agent), name: String(ev.name), fallback: Boolean(ev.fallback) };
  if (event === 'agent-tool' && isObj(ev.tool)) return { type: 'agent-tool', agent: String(ev.agent), tool: String(ev.tool.name), access: String(ev.tool.access) };
  return null;
}

/** Incremental SSE reader: reports agent progress as frames arrive. */
async function readSSE(stream: ReadableStream<Uint8Array>, onProgress?: (p: ChatProgress) => void): Promise<ChatReply> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let all = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const chunk = dec.decode(value, { stream: true });
    buf += chunk;
    all += chunk;
    let idx: number;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const event = /^event: *(.+)$/m.exec(frame)?.[1]?.trim() ?? '';
      const data = /^data: *(.*)$/m.exec(frame)?.[1];
      if (!data || !onProgress) continue;
      try { const p = progressOf(event, JSON.parse(data)); if (p) onProgress(p); } catch { /* ignore */ }
    }
  }
  return parseSSE(all);
}

/** SSE: contract frames (`data: {type:'text',delta}` / `{type:'tool',name,args}`) or v1 named events (`text-delta`, `tool-call`, `done`). */
export function parseSSE(body: string, onProgress?: (p: ChatProgress) => void): ChatReply {
  let text = '';
  const toolCalls: ChatToolCall[] = [];
  let done: ChatReply | null = null;
  let event = '';
  for (const line of body.split('\n')) {
    if (line.startsWith('event:')) { event = line.slice(6).trim(); continue; }
    if (!line.startsWith('data:')) { if (!line.trim()) event = ''; continue; }
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    try {
      const ev = JSON.parse(payload) as Record<string, unknown>;
      const kind = (typeof ev.type === 'string' ? ev.type : event) || '';
      if (kind === 'done') { done = normaliseReply(ev); continue; }
      if (onProgress) { const p = progressOf(kind, ev); if (p) { onProgress(p); continue; } }
      if ((kind === 'text' || kind === 'text-delta') && typeof ev.delta === 'string') text += ev.delta;
      else if ((kind === 'tool' || kind === 'tool_call' || kind === 'tool-call') && typeof ev.name === 'string' && TOOL_NAMES.has(ev.name)) {
        const args = (isObj(ev.args) ? ev.args : {}) as Record<string, unknown>;
        toolCalls.push({ name: ev.name as ChatToolCall['name'], args: ev.name === 'show_plan' || ev.name === 'show_cv' ? args : normalizeToolArgs(ev.name as 'render_chart' | 'show_tasks' | 'show_opportunities', args) });
      } else if (typeof ev.text === 'string' && kind !== 'meta') text += ev.text;
    } catch { /* ignore malformed frame */ }
  }
  return done ?? { text, toolCalls };
}

export type { Intent };
