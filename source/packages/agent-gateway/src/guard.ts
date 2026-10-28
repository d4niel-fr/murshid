/**
 * ModelGuard: keeps a live demo working on free models (OpenRouter :free = ~50 requests/day per key).
 *
 *  - Daily budget: counts every model request (each fallback attempt is a request) per Asia/Dubai day and stops
 *    calling models once `dailyLimit` is reached. Callers then run the rule-based engine (`available()` = false).
 *  - Demo replay cache: for whitelisted demo prompts (`cacheable`), a successful model response is stored and
 *    replayed on the same request later, so rehearsed demo questions cost nothing and never hit a rate limit.
 *    Only the model's completion is replayed: the orchestrator still runs the real tools on today's data.
 *    Entries older than `maxAgeDays` are ignored. `seed()` / `export()` persist entries between deployments.
 *  - Status for the admin portal: requests used, remaining, cache hits, fallbacks, last error.
 */
import { createHash } from 'node:crypto';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatProvider } from './provider.js';
import { ProviderError } from './provider.js';

export interface CacheEntry { key: string; savedAt: string; response: ChatCompletionResponse }

export interface ModelGuardOptions {
  /** model requests allowed per Dubai day (default 45: headroom under the 50/day free cap) */
  dailyLimit?: number;
  /** which requests may be replayed from / stored in the demo cache */
  cacheable?: (req: ChatCompletionRequest) => boolean;
  /** ignore cache entries older than this (default 21 days) */
  maxAgeDays?: number;
  now?: () => Date;
  timeZone?: string;
}

export interface GuardStatus {
  provider: string;
  day: string;
  dailyLimit: number;
  used: number;
  remaining: number;
  state: 'live' | 'budget_reached' | 'degraded';
  cache: { entries: number; hitsToday: number; savedToday: number };
  fallbacksToday: number;
  lastError: { at: string; message: string } | null;
  lastSuccessAt: string | null;
}

const dayKey = (at: Date, timeZone: string) => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at);
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();

/** Cache key: who asked, which step (its role prompt, without the data), the question and the tool steps so far. */
export function cacheKey(req: ChatCompletionRequest): string {
  const sys = req.messages.find((m) => m.role === 'system')?.content ?? '';
  const role = sys.split('\n\nSTUDENT:')[0]!.slice(0, 600);
  const user = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const steps = req.messages.filter((m) => m.role === 'assistant' && m.tool_calls?.length).map((m) => m.tool_calls!.map((c) => c.function.name).join('+'));
  const raw = JSON.stringify({ u: req.user ?? '', role, q: norm(user), steps, last: req.tool_choice === 'none' });
  return createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

export class ModelGuard implements ChatProvider {
  readonly name: string;
  private readonly limit: number;
  private readonly tz: string;
  private readonly now: () => Date;
  private readonly maxAgeMs: number;
  private day = '';
  private used = 0;
  private hits = 0;
  private saved = 0;
  private fallbacks = 0;
  private lastError: GuardStatus['lastError'] = null;
  private lastSuccessAt: string | null = null;
  private cache = new Map<string, CacheEntry>();

  constructor(private inner: ChatProvider, private opts: ModelGuardOptions = {}) {
    this.name = inner.name;
    this.limit = opts.dailyLimit ?? 45;
    this.tz = opts.timeZone ?? 'Asia/Dubai';
    this.now = opts.now ?? (() => new Date());
    this.maxAgeMs = (opts.maxAgeDays ?? 21) * 86_400_000;
  }

  private roll() {
    const d = dayKey(this.now(), this.tz);
    if (d !== this.day) { this.day = d; this.used = 0; this.hits = 0; this.saved = 0; this.fallbacks = 0; }
  }

  /** false once today's model budget is used: callers should go straight to the rule-based engine. */
  available(): boolean { this.roll(); return this.used < this.limit; }

  /** Is there a fresh replay for this request? (used to let cached demo prompts through after the budget is spent) */
  hasReplay(req: ChatCompletionRequest): boolean { return Boolean(this.fresh(cacheKey(req))); }

  /** Record that a turn fell back to rules (shown in admin status). */
  noteFallback() { this.roll(); this.fallbacks++; }

  private fresh(key: string): CacheEntry | undefined {
    const e = this.cache.get(key);
    if (!e) return undefined;
    if (this.now().getTime() - Date.parse(e.savedAt) > this.maxAgeMs) return undefined;
    return e;
  }

  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.roll();
    const cacheable = this.opts.cacheable?.(req) ?? false;
    const key = cacheable ? cacheKey(req) : '';
    if (cacheable) {
      const hit = this.fresh(key);
      if (hit) { this.hits++; return { ...structuredClone(hit.response), cached: true, attempts: [{ model: hit.response.model, ok: true, ms: 0 }] }; }
    }
    if (this.used >= this.limit) throw new ProviderError(`daily model budget reached (${this.limit} requests); using the rule-based engine`, false, 429);
    const chainLen = Math.max(1, req.models?.length ?? 1);
    try {
      const res = await this.inner.chat(req);
      this.used += Math.max(1, res.attempts?.length ?? 1);
      this.lastSuccessAt = this.now().toISOString();
      if (cacheable) { this.cache.set(key, { key, savedAt: this.now().toISOString(), response: structuredClone({ ...res, attempts: undefined }) }); this.saved++; }
      return res;
    } catch (e) {
      const attempts = (e as { attempts?: unknown[] }).attempts;
      this.used += Math.max(1, Array.isArray(attempts) ? attempts.length : chainLen);
      this.lastError = { at: this.now().toISOString(), message: (e as Error).message.slice(0, 200) };
      throw e;
    }
  }

  status(): GuardStatus {
    this.roll();
    const recentError = this.lastError && Date.now() - Date.parse(this.lastError.at) < 10 * 60_000 && (!this.lastSuccessAt || this.lastSuccessAt < this.lastError.at);
    return {
      provider: this.inner.name, day: this.day, dailyLimit: this.limit, used: this.used, remaining: Math.max(0, this.limit - this.used),
      state: this.used >= this.limit ? 'budget_reached' : recentError ? 'degraded' : 'live',
      cache: { entries: this.cache.size, hitsToday: this.hits, savedToday: this.saved },
      fallbacksToday: this.fallbacks, lastError: this.lastError, lastSuccessAt: this.lastSuccessAt,
    };
  }

  /** Load persisted replay entries (e.g. a JSON file shipped with the deployment). */
  seed(entries: CacheEntry[]) { for (const e of entries) if (e?.key && e.response) this.cache.set(e.key, e); }
  export(): CacheEntry[] { return [...this.cache.values()]; }
}

/** Demo prompt matcher: the persona ids and the scripted questions (normalised, punctuation-insensitive). */
export function demoPromptMatcher(personas: string[], prompts: string[]): (req: ChatCompletionRequest) => boolean {
  const ids = new Set(personas);
  const qs = new Set(prompts.map(norm));
  return (req) => {
    if (!ids.has(req.user ?? '')) return false;
    const user = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    return qs.has(norm(user));
  };
}
