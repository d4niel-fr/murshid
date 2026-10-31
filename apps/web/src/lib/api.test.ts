import { describe, expect, it, vi } from 'vitest';
import { BAND_IDS } from './bands';
import { createClient, normaliseReply, parseSSE } from './api';

const NOW = new Date('2026-10-10T08:00:00Z');
const down = vi.fn(async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;

describe('mock client', () => {
  it.each(BAND_IDS)('serves every endpoint for %s in mock mode', async (band) => {
    const c = createClient({ band, mode: 'mock', now: NOW });
    const d = await c.getDashboard();
    expect(d.source).toBe('mock');
    expect(d.data.band).toBe(band);
    expect(d.data.today.length).toBeGreaterThan(0);
    for (const v of Object.values(d.data.progress)) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(100); }
    expect((await c.getAcademics()).data.subjects.length).toBeGreaterThan(2);
    const ex = (await c.getExtracurriculars()).data.activities;
    expect(ex.length).toBeGreaterThan(1);
    expect(ex.every((a) => a.totalHours > 0)).toBe(true);
    const p = await c.getProgress('academics', '12w');
    expect(p.data.data).toHaveLength(12);
    expect((await c.getProfileLinks()).data).toHaveProperty('connectedAt');
  });

  it('falls back to mock when the API is down', async () => {
    const c = createClient({ band: 'g9-10', mode: 'auto', fetchImpl: down, now: NOW });
    const r = await c.getDashboard();
    expect(r.source).toBe('mock');
    expect(down).toHaveBeenCalled();
    const chat = await c.chat('Compare my maths and physics');
    expect(chat.source).toBe('mock');
    expect(chat.data.toolCalls[0]!.name).toBe('render_chart');
  });

  it('falls back when the API returns the wrong shape', async () => {
    const bad = vi.fn(async () => new Response(JSON.stringify({ nope: true }), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const r = await createClient({ band: 'g11-12', fetchImpl: bad, now: NOW }).getAcademics();
    expect(r.source).toBe('mock');
  });

  it('uses the API when it answers with the contract shape', async () => {
    const spec = { id: 'x', type: 'bar', title: 'T', xKey: 'x', series: [{ key: 'v', label: 'V' }], data: [{ x: 'a', v: 1 }], insight: 'i', generatedBy: 'rules' };
    const ok = vi.fn(async () => new Response(JSON.stringify(spec), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;
    const r = await createClient({ band: 'g9-10', fetchImpl: ok, now: NOW }).getProgress('gym', '4w');
    expect(r.source).toBe('api');
    expect(r.data.id).toBe('x');
  });

  it('persists profile links across reads (mock PUT)', async () => {
    const c = createClient({ band: 'g7-8', mode: 'mock', now: NOW });
    const links = (await c.getProfileLinks()).data;
    await c.putProfileLinks({ ...links, github: 'https://github.com/omar-demo' });
    expect((await c.getProfileLinks()).data.github).toBe('https://github.com/omar-demo');
  });
});

describe('chat wire formats', () => {
  it('normalises JSON replies', () => {
    expect(normaliseReply({ reply: 'hi', tool_calls: [{ name: 'show_tasks', arguments: { tasks: [] } }, { name: 'rm_rf', args: {} }] }))
      .toEqual({ text: 'hi', toolCalls: [{ name: 'show_tasks', args: { tasks: [] } }] });
    expect(normaliseReply({ foo: 1 })).toBeNull();
  });
  it('parses SSE frames', () => {
    const body = 'data: {"type":"text","delta":"Hello "}\n\ndata: {"type":"text","delta":"there"}\n\ndata: {"type":"tool","name":"render_chart","args":{"id":"c"}}\n\ndata: [DONE]\n';
    expect(parseSSE(body)).toEqual({ text: 'Hello there', toolCalls: [{ name: 'render_chart', args: { id: 'c' } }] });
  });
});
