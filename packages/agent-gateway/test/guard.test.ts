import { describe, expect, it } from 'vitest';
import { ModelGuard, MockProvider, cacheKey, demoPromptMatcher, type ChatCompletionRequest } from '../src/index.js';

const req = (q: string, user = 'demo-ideal', sys = 'ROLE: Planner'): ChatCompletionRequest => ({
  model: 'm1', models: ['m1'], user,
  messages: [{ role: 'system', content: `${sys}\n\nSTUDENT: Ahamed. DATA: {"today":"2026-10-15"}` }, { role: 'user', content: q }],
});

describe('ModelGuard', () => {
  it('stops calling models once the daily budget is used, and resets the next Dubai day', async () => {
    let now = new Date('2026-10-15T08:00:00Z');
    const inner = new MockProvider();
    const g = new ModelGuard(inner, { dailyLimit: 2, now: () => now });
    await g.chat(req('a')); await g.chat(req('b'));
    expect(g.available()).toBe(false);
    await expect(g.chat(req('c'))).rejects.toThrow(/daily model budget/);
    expect(inner.calls.length).toBe(2);
    expect(g.status()).toMatchObject({ used: 2, remaining: 0, state: 'budget_reached' });
    now = new Date('2026-10-15T20:30:00Z'); // 00:30 on the 16th in Dubai
    expect(g.available()).toBe(true);
    expect(g.status().used).toBe(0);
  });

  it('replays saved answers for scripted demo prompts only (no budget used), even after the budget is spent', async () => {
    const inner = new MockProvider([{ reply: 'Here is your week.' }]);
    const g = new ModelGuard(inner, { dailyLimit: 1, cacheable: demoPromptMatcher(['demo-ideal'], ['Plan my week around my mid-term and both sports']) });
    const first = await g.chat(req('Plan my week around my mid-term and both sports'));
    expect(first.cached).toBeUndefined();
    const again = await g.chat(req('plan my week around my mid-term and both sports!'));
    expect(again).toMatchObject({ cached: true, choices: [{ message: { content: 'Here is your week.' } }] });
    expect(inner.calls.length).toBe(1);
    expect(g.status().cache).toMatchObject({ entries: 1, hitsToday: 1 });
    // other students / other questions are never cached
    expect(demoPromptMatcher(['demo-ideal'], ['x'])(req('x', 'real-student'))).toBe(false);
    await expect(g.chat(req('Something else'))).rejects.toThrow(/daily model budget/);
  });

  it('cache keys ignore the data block but not the step role or tool progress', () => {
    const a = req('q'); const b = { ...req('q'), messages: [{ role: 'system' as const, content: 'ROLE: Planner\n\nSTUDENT: Ahamed. DATA: {"today":"2027-01-20"}' }, { role: 'user' as const, content: 'q' }] };
    expect(cacheKey(a)).toBe(cacheKey(b));
    expect(cacheKey(req('q', 'demo-ideal', 'ROLE: Academics'))).not.toBe(cacheKey(a));
  });

  it('expired entries are ignored; seed/export round-trips', async () => {
    let now = new Date('2026-10-15T08:00:00Z');
    const g = new ModelGuard(new MockProvider([{ reply: 'ok' }]), { maxAgeDays: 7, now: () => now, cacheable: () => true });
    await g.chat(req('q'));
    const saved = g.export();
    const g2 = new ModelGuard(new MockProvider([{ reply: 'live' }]), { maxAgeDays: 7, now: () => now, cacheable: () => true });
    g2.seed(saved);
    expect((await g2.chat(req('q'))).cached).toBe(true);
    now = new Date('2026-10-30T08:00:00Z');
    expect((await g2.chat(req('q'))).choices[0]!.message.content).toBe('live');
  });
});

import { Orchestrator } from '../src/index.js';
describe('explicit requests are always carried out', () => {
  it('runs build_week_plan when the model answers "plan my week" without calling it', async () => {
    const ran: string[] = [];
    const tool = (name: string) => () => { ran.push(name); return { summary: `${name} ok` }; };
    const tools = Object.fromEntries(['get_upcoming', 'get_tasks', 'get_training', 'build_week_plan', 'create_task'].map((n) => [n, tool(n)]));
    const o = new Orchestrator({ provider: new MockProvider([{ reply: 'Here is a balanced week.' }]), tools });
    const r = await o.run({ message: 'Plan my week please', student: { id: 's1', name: 'A', grade: 11, today: '2026-10-15' } });
    expect(r.generatedBy).toBe('ai');
    expect(ran).toContain('build_week_plan');
    expect(r.agents[0]!.tools.find((t) => t.name === 'build_week_plan')).toMatchObject({ ok: true, summary: 'build_week_plan ok' });
  });
});
