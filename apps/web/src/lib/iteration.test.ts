import { describe, expect, it } from 'vitest';
import { createClient, normaliseReply } from './api';
import { mockWorld } from './mock/data';
import { parsePrefs } from './prefs';
import { isPlaceholderUrl } from '@/components/shared/opportunity-card';

describe('iteration 21 Oct: weak-point fixes', () => {
  it('goals have real milestone titles and the ring equals ticked milestones', () => {
    for (const band of ['g5-6', 'g7-8', 'g9-10', 'g11-12'] as const) {
      for (const g of mockWorld(band, new Date('2026-10-21T08:00:00Z')).goals) {
        expect(g.milestones.every((m) => !/^Step \d+$/.test(m.title))).toBe(true);
        expect(g.progress).toBeCloseTo(g.milestones.filter((m) => m.done).length / g.milestones.length, 5);
      }
    }
  });
  it('demo listing URLs are never shown as real links', () => {
    expect(isPlaceholderUrl('https://example.org/opportunities/x')).toBe(true);
    expect(isPlaceholderUrl('mailto:a@murshid.example')).toBe(true);
    expect(isPlaceholderUrl('#')).toBe(true);
    expect(isPlaceholderUrl('https://www.khda.gov.ae/')).toBe(false);
  });
  it('persona preference survives the cookie round trip (tutor by default)', () => {
    expect(parsePrefs(encodeURIComponent(JSON.stringify({ chatPersona: 'buddy' }))).chatPersona).toBe('buddy');
    expect(parsePrefs(encodeURIComponent(JSON.stringify({ chatPersona: 'girlfriend' }))).chatPersona).toBe('tutor');
  });
  it('keeps buddy + safety fields from the API reply', () => {
    const r = normaliseReply({ text: 'hi', toolCalls: [], persona: 'buddy', safety: 'guardrail', buddy: { action: 'safe_reply', flags: ['romance'], available: true, reason: 'on' } });
    expect(r).toMatchObject({ persona: 'buddy', safety: 'guardrail', buddy: { flags: ['romance'] } });
  });
  it('sends history and persona with the chat request; buddy offline says so honestly', async () => {
    let body: any = null;
    const c = createClient({ band: 'g11-12', baseUrl: 'http://api.test', fetchImpl: (async (_u: string, init: RequestInit) => { body = JSON.parse(String(init.body)); return new Response(JSON.stringify({ text: 'ok', toolCalls: [] }), { status: 200, headers: { 'content-type': 'application/json' } }); }) as unknown as typeof fetch });
    await c.chat('and now?', undefined, undefined, { history: [{ role: 'user', content: 'my physics test' }, { role: 'assistant', content: 'good luck' }], persona: 'buddy' });
    expect(body).toMatchObject({ message: 'and now?', persona: 'buddy', history: [{ role: 'user', content: 'my physics test' }, { role: 'assistant', content: 'good luck' }] });
    const off = createClient({ band: 'g11-12', mode: 'mock' });
    expect((await off.chat('hey', undefined, undefined, { persona: 'buddy' })).data.text).toMatch(/needs the Murshid server/);
  });
});
