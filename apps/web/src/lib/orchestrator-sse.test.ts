import { describe, expect, it } from 'vitest';
import { normaliseReply, parseSSE } from './api';
import type { ChatProgress } from './types';

const frame = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\nid: 0\n\n`;

describe('orchestrator SSE in the web client', () => {
  it('reports sub-agent progress and keeps plan / CV cards and the agent trace', () => {
    const done = {
      text: 'Here is your plan.', toolCalls: [{ name: 'show_plan', args: { days: [{ date: '2026-10-12', weekday: 'Mon', items: [] }] } }, { name: 'show_cv', args: { headline: 'Founder' } }],
      agents: [{ agent: 'planner', name: 'Planner', model: 'nvidia/x:free', ms: 1200, fallback: false, tools: [{ name: 'build_week_plan', access: 'write', ok: true, prefetch: false }] }],
      generatedBy: 'ai',
    };
    const body = frame('route', { agents: ['planner'], names: ['Planner'] }) + frame('agent-start', { agent: 'planner', name: 'Planner' })
      + frame('agent-tool', { agent: 'planner', tool: { name: 'build_week_plan', access: 'write' } }) + frame('agent-done', { agent: 'planner', name: 'Planner', fallback: false })
      + frame('meta', { intent: 'planner' }) + frame('text-delta', { delta: 'Here is your plan.' }) + frame('done', done);
    const seen: ChatProgress[] = [];
    const r = parseSSE(body, (p) => seen.push(p));
    expect(seen.map((p) => p.type)).toEqual(['route', 'agent-start', 'agent-tool', 'agent-done']);
    expect(r.toolCalls.map((t) => t.name)).toEqual(['show_plan', 'show_cv']);
    expect(r.agents?.[0]?.name).toBe('Planner');
    expect(r.generatedBy).toBe('ai');
  });
  it('drops unknown tool names', () => {
    expect(normaliseReply({ text: 'x', toolCalls: [{ name: 'rm_rf', args: {} }] })?.toolCalls).toEqual([]);
  });
});
