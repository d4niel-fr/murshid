import { MockProvider } from '@murshid/agent-gateway';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';

const ME = { 'x-dev-user': 'demo-ideal', 'content-type': 'application/json' };
const TEXT = 'Momentum is the product of mass and velocity. Momentum: p = mv\nThe constant speed reached when drag equals weight is called terminal velocity.\nImpulse is the change in momentum.';

async function call(app: { request: (p: string, i: RequestInit) => Response | Promise<Response> }, path: string, body: unknown, headers: Record<string, string> = ME) {
  const r = await app.request(path, { method: 'POST', headers, body: JSON.stringify(body) });
  return { status: r.status, body: await r.json() as any };
}

describe('study tools without a model', () => {
  it('makes cards and notes with the rule engine', async () => {
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const r = await call(app, '/study/generate', { text: TEXT });
    expect(r.status).toBe(200);
    expect(r.body.engine).toBe('rules');
    expect(r.body.cards.map((c: { front: string }) => c.front)).toEqual(expect.arrayContaining(['Momentum', 'Terminal velocity']));
    expect(r.body.notes.body).toContain('## Flashcards');
  });
  it('explains a card and refuses too-short material or no student', async () => {
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const e = await call(app, '/study/explain', { front: 'Momentum', back: 'The product of mass and velocity', context: TEXT });
    expect(e.body).toMatchObject({ engine: 'rules' });
    expect(e.body.text).toMatch(/Momentum, in short/);
    expect((await call(app, '/study/generate', { text: 'too short' })).status).toBe(400);
  });
});

describe('study tools with a model', () => {
  it('uses the model when it answers with valid JSON, and falls back when it does not', async () => {
    const good = new MockProvider([{ reply: '```json\n{"cards":[{"front":"What is momentum?","back":"Mass times velocity."}],"notes":{"title":"Momentum","markdown":"## Summary\\n- p = mv"}}\n```' }]);
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' }, chatProvider: good });
    const r = await call(app, '/study/generate', { text: TEXT });
    expect(r.body).toMatchObject({ engine: 'model', cards: [{ front: 'What is momentum?', back: 'Mass times velocity.' }], notes: { title: 'Momentum' } });

    const bad = new MockProvider([{ reply: 'Sorry, I cannot help with that.' }]);
    const b = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' }, chatProvider: bad });
    const r2 = await call(b.app, '/study/generate', { text: TEXT });
    expect(r2.body.engine).toBe('rules');
    expect(r2.body.cards.length).toBeGreaterThan(0);
  });
});
