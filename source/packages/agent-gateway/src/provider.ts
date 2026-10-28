/**
 * Provider interface in the OpenAI-compatible Chat Completions shape, so the
 * same client can later target LiteLLM, OpenRouter or a provider directly.
 *
 * `MockProvider` (tests, no network) and `OpenAICompatibleProvider` (OpenRouter etc.).
 */
import { estimateTokens } from './pricing.js';

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: Role;
  content: string;
  name?: string;
  tool_call_id?: string;
  tool_calls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface OpenAITool {
  type: 'function';
  function: { name: string; description: string; parameters: Record<string, unknown> };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  tools?: OpenAITool[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  response_format?: { type: 'text' | 'json_object' };
  user?: string; // pseudonymous student key, never a name/email
  /** Client-side fallback chain for this request (first = preferred). Not sent to the provider. */
  models?: string[];
}

export interface ChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: { index: number; message: ChatMessage; finish_reason: 'stop' | 'length' | 'tool_calls' | 'content_filter' }[];
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  /** Models tried for this request (client-side fallback chain), in order. */
  attempts?: { model: string; ok: boolean; status?: number; ms: number }[];
  /** true when ModelGuard replayed a saved demo response instead of calling the model */
  cached?: boolean;
}

export interface EmbeddingRequest {
  model: string;
  input: string[];
}
export interface EmbeddingResponse {
  data: { index: number; embedding: number[] }[];
  usage: { prompt_tokens: number; total_tokens: number };
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    public status?: number,
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export interface ChatProvider {
  readonly name: string;
  chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse>;
  embed?(req: EmbeddingRequest): Promise<EmbeddingResponse>;
}

export interface CannedRule {
  /** Match on model id and/or last user message. */
  model?: string | RegExp;
  match?: RegExp;
  reply: string;
}

/**
 * Deterministic mock. Returns canned replies; usage tokens are estimated from
 * text so cost accounting can be exercised. `failModels` simulates outages.
 */
export class MockProvider implements ChatProvider {
  readonly name = 'mock';
  calls: ChatCompletionRequest[] = [];
  failModels = new Set<string>();
  private seq = 0;

  constructor(
    private canned: CannedRule[] = [],
    private fixedOutputTokens?: number,
  ) {}

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.calls.push(req);
    if (this.failModels.has(req.model)) throw new ProviderError(`mock outage for ${req.model}`, true, 503);
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const rule = this.canned.find(
      (r) =>
        (r.model === undefined || (typeof r.model === 'string' ? r.model === req.model : r.model.test(req.model))) &&
        (r.match === undefined || r.match.test(lastUser)),
    );
    const reply = rule?.reply ?? `[mock:${req.model}] I'm Murshid. Let's work through this step by step.`;
    const prompt_tokens = req.messages.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);
    const completion_tokens = this.fixedOutputTokens ?? estimateTokens(reply);
    return {
      id: `mock-${++this.seq}`,
      object: 'chat.completion',
      created: 0,
      model: req.model,
      choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }],
      usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens },
    };
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResponse> {
    if (this.failModels.has(req.model)) throw new ProviderError(`mock outage for ${req.model}`, true, 503);
    // Deterministic 8-dim pseudo-embedding from char codes.
    const data = req.input.map((s, index) => {
      const v = new Array(8).fill(0);
      for (let i = 0; i < s.length; i++) v[i % 8] += s.charCodeAt(i) / 1000;
      return { index, embedding: v };
    });
    const prompt_tokens = req.input.reduce((s, t) => s + estimateTokens(t), 0);
    return { data, usage: { prompt_tokens, total_tokens: prompt_tokens } };
  }
}

/**
 * OpenAI-compatible Chat Completions over fetch: OpenRouter, LiteLLM or a direct provider.
 * `models` is a fallback chain: a retryable failure (429/5xx/network/empty reply) moves to the next model.
 */
export interface OpenAICompatibleOptions {
  baseUrl: string;
  /** Same-model retries on HTTP 429 before moving down the chain (default 0; providerFromEnv uses 1). */
  retries429?: number;
  /** Base backoff for 429 retries in ms (default 2000; Retry-After wins when present, capped at 10s). */
  backoffMs?: number;
  /** Minimum gap between requests in ms, to pace free-tier rate limits (default 0). */
  minIntervalMs?: number;
  /** Injected sleep (tests). */
  sleep?: (ms: number) => Promise<void>;
  apiKey?: string;
  name?: string;
  /** Overrides the request's model with this chain (first = preferred). */
  models?: string[];
  timeoutMs?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
  /** Before the first call, read GET {baseUrl}/models once: drop chain models the provider no longer lists and append
   *  up to `catalogExtras` other free tool-calling models from trusted vendors as a last resort. Off by default (tests). */
  catalog?: boolean;
  catalogExtras?: number;
  /** How long a model that answered 404 / "no endpoints" is skipped (default 6 h). */
  deadModelTtlMs?: number;
}

/** Vendors whose free models may be added automatically as last-resort fallbacks (students are minors: no unknown labs). */
export const TRUSTED_FREE_VENDORS = ['nvidia/', 'google/', 'meta-llama/', 'mistralai/'];

/** Models that recently answered 404 / "no endpoints": skipped until the time stored here. Shared by all providers in the process. */
export const DEAD_MODELS = new Map<string, number>();
export function markModelDead(model: string, ms = 6 * 3600_000, now = Date.now()) { DEAD_MODELS.set(model, now + ms); }
export function isModelDead(model: string, now = Date.now()): boolean {
  const until = DEAD_MODELS.get(model);
  if (until === undefined) return false;
  if (until <= now) { DEAD_MODELS.delete(model); return false; }
  return true;
}
/** A 404, or a 400 that says the model is gone, means "this model id will not work": stop trying it for a while. */
export function isGoneError(status: number | undefined, text: string): boolean {
  if (status === 404) return true;
  return status === 400 && /no endpoints|not a valid model|is not available|deprecated|model .*(not found|does not exist)/i.test(text);
}

/** Order a chain so live models come first; dead ones stay at the end (tried only if every live one fails). */
export function liveFirst(chain: string[], now = Date.now()): string[] {
  const live = chain.filter((m) => !isModelDead(m, now));
  return live.length ? live : [...chain];
}

/** Free tool-calling models from the OpenRouter catalogue (GET /models needs no key and costs no request quota). */
export async function fetchFreeToolModels(baseUrl: string, fetchImpl: typeof fetch = fetch, timeoutMs = 4000): Promise<string[] | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/models`, { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { id?: string; supported_parameters?: string[] }[] };
    return (body.data ?? []).filter((m) => typeof m.id === 'string' && m.id.endsWith(':free') && (m.supported_parameters ?? []).includes('tools')).map((m) => m.id!);
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export class OpenAICompatibleProvider implements ChatProvider {
  readonly name: string;
  constructor(private opts: OpenAICompatibleOptions) {
    this.name = opts.name ?? 'openai-compatible';
  }

  /** Models tried by the last chat() call, in order, with their outcome (for traces). */
  lastAttempts: { model: string; ok: boolean; status?: number; ms: number }[] = [];
  private nextSlot = 0;
  /** Set when the provider reports a daily quota is used up (all free models share it): fail fast until then. */
  exhaustedUntil = 0;

  private catalogDone?: Promise<void>;
  /** Extra free models found in the catalogue (appended to every chain as a last resort). */
  catalogExtras: string[] = [];

  /** One catalogue read per provider: marks listed-no-more models dead, finds trusted extras. Never throws. */
  syncCatalog(): Promise<void> {
    this.catalogDone ??= (async () => {
      const listed = await fetchFreeToolModels(this.opts.baseUrl, this.opts.fetchImpl ?? fetch);
      if (!listed) return;
      const known = new Set(this.opts.models ?? []);
      for (const m of known) if (m.endsWith(':free') && !listed.includes(m)) markModelDead(m, this.opts.deadModelTtlMs);
      const max = this.opts.catalogExtras ?? 2;
      this.catalogExtras = listed.filter((m) => !known.has(m) && TRUSTED_FREE_VENDORS.some((v) => m.startsWith(v))).slice(0, max);
    })();
    return this.catalogDone;
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const { models: reqModels, ...rest } = req;
    if (this.opts.catalog) await this.syncCatalog();
    const base = reqModels?.length ? reqModels : this.opts.models?.length ? this.opts.models : [req.model];
    const chain = liveFirst([...base, ...this.catalogExtras.filter((m) => !base.includes(m))]);
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const attempts: { model: string; ok: boolean; status?: number; ms: number }[] = [];
    this.lastAttempts = attempts;
    if (Date.now() < this.exhaustedUntil) {
      const err = new ProviderError(`daily free-model quota exhausted until ${new Date(this.exhaustedUntil).toISOString()}`, false, 429);
      throw Object.assign(err, { attempts });
    }
    let last: unknown;
    for (const model of chain) {
      for (let attempt = 0; ; attempt++) {
        const gap = this.nextSlot - Date.now();
        this.nextSlot = Math.max(Date.now(), this.nextSlot) + (this.opts.minIntervalMs ?? 0);
        if (gap > 0) await sleep(gap);
        const t0 = Date.now();
        try {
          const res = await this.once({ ...rest, model });
          attempts.push({ model, ok: true, ms: Date.now() - t0 });
          return { ...res, attempts };
        } catch (e) {
          last = e;
          const status = e instanceof ProviderError ? e.status : undefined;
          attempts.push({ model, ok: false, ...(status ? { status } : {}), ms: Date.now() - t0 });
          if ((e as ProviderError & { gone?: boolean }).gone) markModelDead(model, this.opts.deadModelTtlMs);
          if (!(e instanceof ProviderError) || !e.retryable) throw Object.assign(e as Error, { attempts });
          const resetAt = (e as ProviderError & { quotaResetAt?: number }).quotaResetAt;
          if (status === 429 && resetAt && resetAt - Date.now() > 60_000) {
            // a per-day quota (shared by every free model): stop hammering the chain until it resets
            this.exhaustedUntil = resetAt;
            throw Object.assign(e, { attempts });
          }
          if (status === 429 && attempt < (this.opts.retries429 ?? 0)) {
            const ra = (e as ProviderError & { retryAfterMs?: number }).retryAfterMs;
            await sleep(Math.min(10_000, ra ?? (this.opts.backoffMs ?? 2000) * (attempt + 1)));
            continue;
          }
          break; // next model in the chain
        }
      }
    }
    throw Object.assign(last instanceof Error ? last : new ProviderError('all models failed', true), { attempts });
  }

  private async once(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const f = this.opts.fetchImpl ?? fetch;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), this.opts.timeoutMs ?? 45_000);
    let res: Response;
    try {
      res = await f(`${this.opts.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'content-type': 'application/json',
          ...(this.opts.apiKey ? { authorization: `Bearer ${this.opts.apiKey}` } : {}),
          ...this.opts.headers,
        },
        body: JSON.stringify(req),
      });
    } catch (e) {
      throw new ProviderError(`network error: ${(e as Error).message}`, true);
    } finally {
      clearTimeout(t);
    }
    const text = await res.text();
    if (!res.ok) {
      const gone = isGoneError(res.status, text);
      const err = new ProviderError(`${req.model} HTTP ${res.status}: ${text.slice(0, 300)}`, res.status === 429 || res.status >= 500 || gone, res.status);
      if (gone) (err as ProviderError & { gone?: boolean }).gone = true;
      const ra = Number(res.headers?.get?.('retry-after'));
      if (Number.isFinite(ra) && ra > 0) (err as ProviderError & { retryAfterMs?: number }).retryAfterMs = ra * 1000;
      if (res.status === 429 && /per-day|per day|daily/i.test(text)) {
        // OpenRouter: {"error":{"message":"Rate limit exceeded: free-models-per-day…","metadata":{"headers":{"X-RateLimit-Reset":"<ms>"}}}}
        const reset = Number(/"X-RateLimit-Reset"\s*:\s*"?(\d{10,13})/.exec(text)?.[1]);
        if (Number.isFinite(reset) && reset > 0) (err as ProviderError & { quotaResetAt?: number }).quotaResetAt = reset < 1e12 ? reset * 1000 : reset;
      }
      throw err;
    }
    let body: ChatCompletionResponse & { error?: { message?: string; code?: number } };
    try {
      body = JSON.parse(text);
    } catch {
      throw new ProviderError(`${req.model} returned non-JSON`, true, res.status);
    }
    if (body.error) throw new ProviderError(`${req.model}: ${body.error.message ?? 'error'}`, true, body.error.code);
    const msg = body.choices?.[0]?.message;
    if (!msg || (!msg.content && !msg.tool_calls?.length)) throw new ProviderError(`${req.model} returned an empty reply`, true);
    msg.content = msg.content ?? '';
    return { ...body, object: 'chat.completion', model: body.model ?? req.model, usage: body.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } };
  }
}

/** Free OpenRouter models by role. nemotron-3-super answered 404 on 21 Oct 2026 while lightning worked, so lightning leads. */
export const FREE_MODEL = {
  lightning: 'nvidia/nemotron-3.5-lightning:free',
  gemma: 'google/gemma-4-31b-it:free',
  super: 'nvidia/nemotron-3-super-120b-a12b:free',
  gemmaSmall: 'google/gemma-4-26b-a4b-it:free',
} as const;

/** Free OpenRouter models (ids ending in :free) with tool calling, in preference order. Checked 21 Oct 2026
 *  (GET /api/v1/models). Dead models are skipped at runtime (DEAD_MODELS) and the catalogue adds trusted extras. */
export const OPENROUTER_FREE_MODELS: string[] = [FREE_MODEL.lightning, FREE_MODEL.gemma, FREE_MODEL.super, FREE_MODEL.gemmaSmall];

/** Build a provider from env: GATEWAY_MODE=openrouter uses OPENROUTER_API_KEY / OPENROUTER_MODELS. Returns undefined for rules. */
export function providerFromEnv(env: Record<string, string | undefined> = process.env): ChatProvider | undefined {
  if (env.GATEWAY_MODE !== 'openrouter') return undefined;
  const models = (env.OPENROUTER_MODELS ?? '').split(',').map((m) => m.trim()).filter(Boolean);
  return new OpenAICompatibleProvider({
    name: 'openrouter',
    baseUrl: env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
    apiKey: env.OPENROUTER_API_KEY || undefined,
    models: models.length ? models : OPENROUTER_FREE_MODELS,
    headers: { 'HTTP-Referer': 'https://murshid.app', 'X-Title': 'Murshid' },
    timeoutMs: Number(env.OPENROUTER_TIMEOUT_MS) || 90_000,
    minIntervalMs: Number(env.OPENROUTER_MIN_INTERVAL_MS) || 1_000,
    retries429: 1,
    catalog: env.OPENROUTER_CATALOG !== 'off',
  });
}
