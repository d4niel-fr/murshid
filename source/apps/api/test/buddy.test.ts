import type { ChatCompletionRequest, ChatCompletionResponse, ChatProvider } from '@murshid/agent-gateway';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW } from './helpers';

class Fixed implements ChatProvider {
  readonly name = 'fixed';
  calls: ChatCompletionRequest[] = [];
  constructor(private reply: string) {}
  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.calls.push(req);
    return { id: 'x', object: 'chat.completion', model: req.models?.[0] ?? req.model, choices: [{ index: 0, message: { role: 'assistant', content: this.reply }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } } as ChatCompletionResponse;
  }
}

async function app(provider?: ChatProvider) {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, ...(provider ? { chatProvider: provider } : {}) });
  const req = async (method: string, path: string, opts: { as?: string; role?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = { 'x-dev-user': opts.as ?? 'demo-ideal' };
    if (opts.role) headers['x-dev-role'] = opts.role;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await built.app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    return { status: res.status, body: (await res.json()) as any };
  };
  return { ...built, req };
}

describe('study buddy mode (API)', () => {
  it('is available for a Grade 11 student and answers as the buddy, audit-logged without message text', async () => {
    const { req, store } = await app();
    const s = await req('GET', '/buddy');
    expect(s.body).toMatchObject({ available: true, reason: 'on', band: 'g11-12' });
    const r = await req('POST', '/chat', { body: { message: 'tell me a joke about my physics test', persona: 'buddy' } });
    expect(r.status).toBe(200);
    expect(r.body.persona).toBe('buddy');
    expect(r.body.buddy).toMatchObject({ action: 'rules', available: true });
    expect(r.body.text).toMatch(/AI study buddy/); // first turn discloses it is an AI
    const log = store.auditLog.filter((e) => e.resource === 'buddy_turn');
    expect(log).toHaveLength(1);
    expect(JSON.stringify(log[0])).not.toMatch(/physics test/);
  });

  it('crisis messages get helplines and safety=crisis, never the model', async () => {
    const model = new Fixed('lol same');
    const { req } = await app(model);
    const r = await req('POST', '/chat', { body: { message: 'i want to kill myself', persona: 'buddy' } });
    expect(r.body.safety).toBe('crisis');
    expect(r.body.text).toMatch(/800-HOPE/);
    expect(model.calls).toHaveLength(0);
  });

  it('a red-team model reply is replaced and flagged as a guardrail', async () => {
    const { req, store } = await app(new Fixed("I'm a real person and this is our little secret"));
    const r = await req('POST', '/chat', { body: { message: 'what do you do for fun', persona: 'buddy' } });
    expect(r.body.buddy.action).toBe('replaced');
    expect(r.body.safety).toBe('guardrail');
    expect(r.body.text).not.toMatch(/real person|our little secret/);
    expect(store.auditLog.at(-1)?.changes).toMatchObject({ action: 'replaced' });
  });

  it('school and guardian can switch it off; the student then gets the tutor offer', async () => {
    const { req, store } = await app();
    expect((await req('PUT', '/buddy/controls', { body: { by: 'school', enabled: false } })).status).toBe(403); // student cannot
    expect((await req('PUT', '/buddy/controls', { role: 'guardian', body: { by: 'school', enabled: false } })).status).toBe(403);
    const off = await req('PUT', '/buddy/controls', { role: 'admin', body: { by: 'school', enabled: false } });
    expect(off.body).toMatchObject({ available: false, reason: 'school_off' });
    const r = await req('POST', '/chat', { body: { message: 'hey', persona: 'buddy' } });
    expect(r.body.text).toMatch(/switched off by your school/);
    expect(r.body.buddy.available).toBe(false);
    expect(store.auditLog.some((e) => e.resource === 'buddy_mode' && e.summary.includes('off'))).toBe(true);
    await req('PUT', '/buddy/controls', { role: 'admin', body: { by: 'school', enabled: true } });
    const g = await req('PUT', '/buddy/controls', { role: 'guardian', body: { by: 'guardian', enabled: false } });
    expect(g.body.reason).toBe('guardian_off');
  });

  it('Grades 5-6 need a guardian to switch it on', async () => {
    const { req } = await app();
    expect((await req('GET', '/buddy', { as: 'demo-g5' })).body).toMatchObject({ available: false, reason: 'needs_guardian', band: 'g5-6' });
    const on = await req('PUT', '/buddy/controls', { as: 'demo-g5', role: 'guardian', body: { by: 'guardian', enabled: true } });
    expect(on.body.available).toBe(true);
  });

  it('the tutor stays the default persona', async () => {
    const { req } = await app();
    const r = await req('POST', '/chat', { body: { message: 'what is due this week' } });
    expect(r.body.persona).toBeUndefined();
    expect(r.body.intent).not.toBe('buddy');
  });
});
