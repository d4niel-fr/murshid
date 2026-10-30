import { describe, expect, it } from 'vitest';
import { mockChatReply, parseChartType, parseIntent, parseRange } from './intent';
import { buildMockWorld } from './mock/data';
import type { ChartSpec } from './types';

const NOW = new Date('2026-10-10T08:00:00Z');

describe('parseIntent', () => {
  it('maps suggestion chips to chart intents', () => {
    expect(parseIntent("How's my gym progress?")).toMatchObject({ kind: 'chart', area: 'gym' });
    expect(parseIntent('Show my hackathon progress')).toMatchObject({ kind: 'chart', area: 'hackathon' });
    expect(parseIntent('Compare my maths and physics')).toMatchObject({ kind: 'chart', area: 'academics', compare: ['maths', 'physics'] });
  });
  it('parses ranges and chart types', () => {
    expect(parseRange('over the last month', '12w')).toBe('4w');
    expect(parseRange('this term', '4w')).toBe('term');
    expect(parseRange('this year', '4w')).toBe('year');
    expect(parseRange('nothing here', '12w')).toBe('12w');
    expect(parseChartType('as a pie chart')).toBe('pie');
    expect(parseChartType('bar chart please')).toBe('bar');
    expect(parseIntent('running progress this year as a bar chart')).toMatchObject({ kind: 'chart', area: 'athletics', range: 'year', type: 'bar' });
  });
  it('detects tasks, opportunities, greetings, help', () => {
    expect(parseIntent('What should I do today?').kind).toBe('tasks');
    expect(parseIntent('Any hackathon competitions coming up?')).toMatchObject({ kind: 'opportunities', topic: 'hackathon' });
    expect(parseIntent('hello').kind).toBe('greeting');
    expect(parseIntent('tell me a joke').kind).toBe('help');
  });
  it('understands Arabic', () => {
    expect(parseIntent('كيف تقدمي في الجيم؟')).toMatchObject({ kind: 'chart', area: 'gym' });
    expect(parseIntent('قارن الرياضيات والفيزياء')).toMatchObject({ kind: 'chart', compare: ['maths', 'physics'] });
    expect(parseIntent('ما هي مهامي اليوم').kind).toBe('tasks');
  });
});

describe('mockChatReply', () => {
  const world = buildMockWorld('g9-10', NOW);
  it('emits render_chart with a valid ChartSpec', () => {
    const r = mockChatReply("How's my gym progress?", world);
    expect(r.toolCalls).toHaveLength(1);
    expect(r.toolCalls[0]!.name).toBe('render_chart');
    const spec = r.toolCalls[0]!.args as unknown as ChartSpec;
    expect(spec.generatedBy).toBe('rules');
    expect(spec.type).toBe('line'); // gym → strength metric trend
    expect(spec.unit).toBe('kg');
    expect(spec.series.length).toBeGreaterThan(0);
    expect(spec.data.length).toBeGreaterThan(1);
    for (const row of spec.data) expect(row).toHaveProperty(spec.xKey);
    expect(spec.insight.length).toBeGreaterThan(10);
  });
  const senior = buildMockWorld('g11-12', NOW);
  it('compares two subjects as two series (resolves ids like math-aa-hl)', () => {
    const spec = mockChatReply('Compare my maths and physics', senior).toolCalls[0]!.args as unknown as ChartSpec;
    expect(spec.series.map((s) => s.key)).toEqual(['math-aa-hl', 'physics-hl']);
    expect(spec.unit).toBe('/7');
  });
  it('hackathon chart counts shipped projects over the year', () => {
    const spec = mockChatReply('Show my hackathon progress this year', senior).toolCalls[0]!.args as unknown as ChartSpec;
    expect(spec.data).toHaveLength(12);
    const projects = spec.data.reduce((m, r) => m + Number(r.projects ?? 0), 0);
    expect(projects).toBeGreaterThanOrEqual(4);
  });
  it('show_tasks and show_opportunities', () => {
    expect(mockChatReply('my tasks', world).toolCalls[0]!.name).toBe('show_tasks');
    expect(mockChatReply('find me opportunities', world).toolCalls[0]!.name).toBe('show_opportunities');
  });
  it('falls back gracefully for an activity the student does not do', () => {
    const young = buildMockWorld('g5-6', NOW);
    const r = mockChatReply("How's my gym progress?", young);
    expect(r.text).toMatch(/don't see/);
    expect((r.toolCalls[0]!.args as unknown as ChartSpec).type).toBe('pie');
  });
});
