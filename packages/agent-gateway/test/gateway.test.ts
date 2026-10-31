import { describe, expect, it } from 'vitest';
import {
  defaultConfig as cfg,
  buildConfig,
  ConfigError,
  costUsd,
  inUtcWindow,
  preRoute,
  selectModels,
  BudgetLedger,
  InMemoryUsageStore,
  monthKey,
  Gateway,
  MockProvider,
  InMemoryToolRegistry,
  registerStubTools,
  ToolError,
  renderPrompt,
  loadTemplate,
  TASK_TYPES,
  type TaskType,
} from '../src/index.js';
import modelsJson from '../config/models.json' with { type: 'json' };
import routingJson from '../config/routing.json' with { type: 'json' };

const AISHA = 'aisha-test';
const NOW = new Date('2026-10-10T08:00:00Z'); // 12:00 Dubai, DeepSeek peak

describe('model registry', () => {
  it('has the brief prices per 1M tokens', () => {
    const p = (id: string) => [cfg.models[id]!.price.input_per_m, cfg.models[id]!.price.output_per_m];
    expect(p('gpt-6-luna')).toEqual([0.1, 0.5]);
    expect(p('deepseek-v4.1-flash')).toEqual([0.3, 1.2]);
    expect(cfg.models['deepseek-v4.1-flash']!.off_peak?.multiplier).toBe(0.5);
    expect(p('deepseek-v4-pro')).toEqual([1.32, 3.96]);
    expect(p('gemini-3.1-flash-lite')).toEqual([0.25, 1.5]);
    expect(p('claude-haiku-5.5')).toEqual([0.1, 0.5]);
    expect(p('claude-sonnet-5.5')).toEqual([2, 10]);
    expect(cfg.models['falcon-h1-arabic']!.tier).toBe('self_hosted');
  });

  it('rejects routing to unknown models or models lacking capabilities', () => {
    const bad = structuredClone(routingJson) as any;
    bad.tasks.ocr.fallbacks = ['deepseek-v4-pro']; // no vision
    expect(() => buildConfig(modelsJson, bad)).toThrow(ConfigError);
    bad.tasks.ocr.fallbacks = ['nope'];
    expect(() => buildConfig(modelsJson, bad)).toThrow(/unknown model/);
  });
});

describe('pricing', () => {
  it('computes cost and DeepSeek off-peak discount', () => {
    expect(costUsd(cfg.models['claude-sonnet-5.5']!, { input_tokens: 1e6, output_tokens: 1e6 }, NOW)).toBe(12);
    const flash = cfg.models['deepseek-v4.1-flash']!;
    expect(costUsd(flash, { input_tokens: 1e6, output_tokens: 1e6 }, NOW)).toBe(1.5);
    expect(costUsd(flash, { input_tokens: 1e6, output_tokens: 1e6 }, new Date('2026-10-10T17:00:00Z'))).toBe(0.75);
    expect(inUtcWindow(new Date('2026-10-10T00:15:00Z'), ['16:30', '00:30'])).toBe(true);
    expect(inUtcWindow(new Date('2026-10-10T00:45:00Z'), ['16:30', '00:30'])).toBe(false);
  });
});

describe('rule-based pre-router', () => {
  const r = (text: string, extra = {}) => preRoute({ text, ...extra });
  it('answers greetings without a model', () => {
    expect(r('hello!').kind).toBe('canned');
    expect(r('السلام عليكم').kind).toBe('canned');
  });
  it('routes to tools before models', () => {
    expect(r("what's due this week?")).toMatchObject({ kind: 'tool', tool: 'connectors.list_upcoming' });
    expect(r('remind me to revise chemistry at 7')).toMatchObject({ kind: 'tool', tool: 'notify.create_reminder' });
    expect(r('find me robotics competitions in Dubai')).toMatchObject({ kind: 'tool', tool: 'opportunities.search' });
  });
  it('picks model task types by rule', () => {
    expect(r('read this', { attachments: [{ kind: 'image', id: 'i' }] })).toMatchObject({ task: 'ocr' });
    expect(r('summarise my biology notes for chapter 3')).toMatchObject({ task: 'notes_reading' });
    expect(r('can you give feedback on my personal statement')).toMatchObject({ task: 'cv_essay' });
    expect(r('make me a revision plan for mocks')).toMatchObject({ task: 'planning' });
    expect(r('كيف أذاكر للفيزياء بشكل أفضل؟')).toMatchObject({ task: 'arabic' });
    expect(r('why is the sky blue')).toMatchObject({ task: 'chat', ruleId: 'R-DEFAULT' });
  });
});

describe('router: task → model', () => {
  const expected: Record<TaskType, string> = {
    router: 'gpt-6-luna',
    chat: 'claude-haiku-5.5',
    planning: 'claude-sonnet-5.5',
    notes_reading: 'gemini-3.1-flash-lite',
    ocr: 'gemini-3.1-flash-lite',
    cv_essay: 'claude-sonnet-5.5',
    arabic: 'falcon-h1-arabic',
    embeddings: 'murshid-embed',
  };
  it.each(TASK_TYPES)('normal tier primary for %s', (task) => {
    expect(selectModels(cfg, task, { tier: 'normal' }).candidates[0]).toBe(expected[task]);
  });

  it('economy tier downgrades to cheaper models', () => {
    expect(selectModels(cfg, 'planning', { tier: 'economy' }).candidates[0]).toBe('claude-haiku-5.5');
    expect(selectModels(cfg, 'cv_essay', { tier: 'economy' }).candidates[0]).toBe('claude-haiku-5.5');
    expect(selectModels(cfg, 'chat', { tier: 'economy' }).candidates[0]).toBe('gpt-6-luna');
    expect(selectModels(cfg, 'planning', { tier: 'economy' }).candidates).not.toContain('claude-sonnet-5.5');
  });

  it('capped tier allows only self-hosted or nothing', () => {
    expect(selectModels(cfg, 'chat', { tier: 'capped' }).candidates).toEqual(['falcon-h1-arabic']);
    expect(selectModels(cfg, 'planning', { tier: 'capped' }).candidates).toEqual([]);
    expect(selectModels(cfg, 'arabic', { tier: 'capped' }).candidates).toEqual(['falcon-h1-arabic']);
  });

  it('never sends PII to pii_allowed=false models', () => {
    const d = selectModels(cfg, 'notes_reading', { tier: 'normal', containsPii: true });
    expect(d.candidates).not.toContain('deepseek-v4.1-flash');
    expect(d.excluded).toContainEqual({ model: 'deepseek-v4.1-flash', reason: 'pii_not_allowed' });
    expect(selectModels(cfg, 'notes_reading', { tier: 'normal' }).candidates).toContain('deepseek-v4.1-flash');
    expect(selectModels(cfg, 'planning', { tier: 'normal' }).candidates).not.toContain('deepseek-v4-pro');
  });

  it('skips unhealthy models and too-small context windows', () => {
    expect(selectModels(cfg, 'chat', { tier: 'normal', unhealthy: new Set(['claude-haiku-5.5']) }).candidates[0]).toBe('gpt-6-luna');
    const big = selectModels(cfg, 'notes_reading', { tier: 'normal', estimatedInputTokens: 500_000 });
    expect(big.candidates).toEqual(['gemini-3.1-flash-lite']);
  });
});

describe('budget caps', () => {
  it('uses Asia/Dubai months', () => {
    expect(monthKey(new Date('2026-10-31T21:00:00Z'), 'Asia/Dubai')).toBe('2026-11');
  });

  async function ledgerWithSpend(usd: number) {
    const ledger = new BudgetLedger(cfg.budget, new InMemoryUsageStore());
    if (usd > 0) await ledger.record({ student_id: AISHA, at: NOW.toISOString(), task: 'chat', model_id: 'claude-haiku-5.5', input_tokens: 0, output_tokens: 0, cost_usd: usd }, NOW);
    return ledger;
  }

  it('moves through normal → economy → capped tiers', async () => {
    expect((await (await ledgerWithSpend(0.5)).state(AISHA, NOW)).tier).toBe('normal');
    expect((await (await ledgerWithSpend(0.8)).state(AISHA, NOW)).tier).toBe('economy');
    expect((await (await ledgerWithSpend(1.0)).state(AISHA, NOW)).tier).toBe('capped');
    // new month resets
    expect((await (await ledgerWithSpend(1.0)).state(AISHA, new Date('2026-11-01T00:00:00Z'))).tier).toBe('normal');
  });

  it('gateway downgrades planning to economy model after 80% spend', async () => {
    const ledger = await ledgerWithSpend(0.85);
    const gw = new Gateway({ config: cfg, provider: new MockProvider(), budget: ledger, clock: () => NOW });
    const res = await gw.complete({ studentId: AISHA, text: 'make me a study plan for this week' });
    expect(res).toMatchObject({ kind: 'model', task: 'planning', model: 'claude-haiku-5.5', tier: 'economy' });
  });

  it('gateway at cap: planning has no model, chat falls to self-hosted', async () => {
    const ledger = await ledgerWithSpend(1.0);
    const gw = new Gateway({ config: cfg, provider: new MockProvider(), budget: ledger, clock: () => NOW });
    expect((await gw.complete({ studentId: AISHA, text: 'plan my week' })).kind).toBe('budget_exhausted');
    const chat = await gw.complete({ studentId: AISHA, text: 'why is the sky blue' });
    expect(chat).toMatchObject({ kind: 'model', model: 'falcon-h1-arabic', tier: 'capped', costUsd: 0 });
  });

  it('pre-flight downgrade when one expensive call would cross the threshold', async () => {
    const ledger = await ledgerWithSpend(0.79);
    const gw = new Gateway({ config: cfg, provider: new MockProvider(), budget: ledger, clock: () => NOW });
    const res = await gw.complete({ studentId: AISHA, text: 'plan my revision ' + 'x'.repeat(20_000) });
    expect(res).toMatchObject({ kind: 'model', model: 'claude-haiku-5.5', tier: 'economy' });
  });

  it('per-student cap override and cost accounting report', async () => {
    const ledger = new BudgetLedger(cfg.budget);
    ledger.setCap(AISHA, 5);
    const provider = new MockProvider([], 1000);
    const gw = new Gateway({ config: cfg, provider, budget: ledger, clock: () => NOW });
    const res = await gw.complete({ studentId: AISHA, text: 'help me with my essay structure' });
    expect(res.kind).toBe('model');
    const rep = await ledger.report(AISHA, NOW);
    expect(rep.calls).toBe(1);
    expect(rep.capUsd).toBe(5);
    expect(rep.byModel['claude-sonnet-5.5']).toBeGreaterThan(0.01); // 1000 output tokens × $10/M
  });
});

describe('gateway orchestration', () => {
  it('falls back when the primary provider fails and marks it unhealthy', async () => {
    const provider = new MockProvider([{ model: 'gpt-6-luna', reply: 'luna here' }]);
    provider.failModels.add('claude-haiku-5.5');
    const gw = new Gateway({ config: cfg, provider, budget: new BudgetLedger(cfg.budget), clock: () => NOW });
    const res = await gw.complete({ studentId: AISHA, text: 'why is the sky blue' });
    expect(res).toMatchObject({ kind: 'model', model: 'gpt-6-luna', reply: 'luna here', tried: ['claude-haiku-5.5', 'gpt-6-luna'] });
    expect(gw.unhealthy.has('claude-haiku-5.5')).toBe(true);
  });

  it('canned and tool routes make no provider call', async () => {
    const provider = new MockProvider();
    const gw = new Gateway({ config: cfg, provider, budget: new BudgetLedger(cfg.budget), clock: () => NOW });
    expect((await gw.complete({ studentId: AISHA, text: 'hi' })).kind).toBe('canned');
    expect((await gw.complete({ studentId: AISHA, text: "what's due tomorrow" })).kind).toBe('tool');
    expect(provider.calls).toHaveLength(0);
  });

  it('integrity hook blocks before any model call; never sends student id to provider', async () => {
    const provider = new MockProvider();
    const gw = new Gateway({
      config: cfg,
      provider,
      budget: new BudgetLedger(cfg.budget),
      clock: () => NOW,
      integrity: async ({ text }) => (/write my essay/i.test(text) ? { decision: 'block', coachMessage: 'coach not ghostwriter' } : { decision: 'allow' }),
    });
    expect(await gw.complete({ studentId: AISHA, taskId: 't1', text: 'write my essay please' })).toMatchObject({ kind: 'blocked', reply: 'coach not ghostwriter' });
    expect(provider.calls).toHaveLength(0);
    await gw.complete({ studentId: AISHA, taskId: 't1', text: 'explain inflation' });
    expect(provider.calls[0]!.user).not.toContain(AISHA);
  });
});

describe('tool registry', () => {
  const reg = new InMemoryToolRegistry();
  registerStubTools(reg);

  it('exposes only consented tools in OpenAI format', () => {
    const names = reg.available({ consent: { core_service: true } }).map((t) => t.function.name);
    expect(names).toContain('opportunities__search');
    expect(names).not.toContain('connectors__list_upcoming');
    expect(names).not.toContain('notify__create_reminder');
  });

  it('enforces consent, args and confirmation; audits', async () => {
    const audits: unknown[] = [];
    const ctx = { studentId: AISHA, consent: { core_service: true, notifications: true }, audit: async (e: unknown) => void audits.push(e) };
    await expect(reg.invoke('connectors.list_upcoming', { days: 7 }, ctx)).rejects.toMatchObject({ code: 'consent_missing' });
    await expect(reg.invoke('notify.create_reminder', {}, ctx)).rejects.toMatchObject({ code: 'invalid_args' });
    await expect(reg.invoke('notify.create_reminder', { text: 'x' }, ctx)).rejects.toBeInstanceOf(ToolError);
    expect(await reg.invoke('notify__create_reminder', { text: 'x' }, ctx, { confirmed: true })).toMatchObject({ stub: true });
    expect(audits.length).toBeGreaterThanOrEqual(2);
  });
});

describe('prompts', () => {
  it('renders the persona system prompt (coach, not ghostwriter)', () => {
    const p = renderPrompt('system.murshid', { preferred_name: 'Aisha', grade: 11, curriculum: 'british', language: 'English', ai_use_level: 'support', today: '2026-10-10' });
    expect(p).toContain('A coach, not a ghostwriter');
    expect(p).toContain('Grade 11');
    expect(p).not.toMatch(/\{\{/);
  });
  it('throws on missing variables and bad names', () => {
    expect(() => renderPrompt('tasks/planning', { preferred_name: 'A' })).toThrow(/Missing template variables/);
    expect(() => loadTemplate('../package')).toThrow();
  });
});
