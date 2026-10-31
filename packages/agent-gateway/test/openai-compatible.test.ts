import { describe, expect, it } from 'vitest';
import { OpenAICompatibleProvider, ProviderError, providerFromEnv } from '../src/provider';

const ok = (model: string, content = 'hi') =>
  new Response(JSON.stringify({ id: 'x', model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } }), { status: 200 });

describe('OpenAICompatibleProvider', () => {
  it('posts to /chat/completions with the key and returns the reply', async () => {
    const seen: { url: string; init: RequestInit }[] = [];
    const p = new OpenAICompatibleProvider({ baseUrl: 'https://or.test/api/v1/', apiKey: 'k', fetchImpl: (async (url: string, init: RequestInit) => { seen.push({ url, init }); return ok('m1'); }) as unknown as typeof fetch });
    const r = await p.chat({ model: 'm1', messages: [{ role: 'user', content: 'yo' }] });
    expect(r.choices[0]?.message.content).toBe('hi');
    expect(seen[0]?.url).toBe('https://or.test/api/v1/chat/completions');
    expect((seen[0]?.init.headers as Record<string, string>).authorization).toBe('Bearer k');
  });

  it('falls through the model chain on 429 / empty replies', async () => {
    const tried: string[] = [];
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['a:free', 'b:free', 'c:free'],
      fetchImpl: (async (_u: string, init: RequestInit) => {
        const m = JSON.parse(String(init.body)).model as string; tried.push(m);
        if (m === 'a:free') return new Response('rate limited', { status: 429 });
        if (m === 'b:free') return ok(m, '');
        return ok(m, 'from c');
      }) as unknown as typeof fetch,
    });
    const r = await p.chat({ model: 'auto', messages: [{ role: 'user', content: 'x' }] });
    expect(tried).toEqual(['a:free', 'b:free', 'c:free']);
    expect(r.choices[0]?.message.content).toBe('from c');
  });

  it('does not retry on 401', async () => {
    let n = 0;
    const p = new OpenAICompatibleProvider({ baseUrl: 'https://or.test', models: ['a', 'b'], fetchImpl: (async () => { n++; return new Response('nope', { status: 401 }); }) as unknown as typeof fetch });
    await expect(p.chat({ model: 'a', messages: [] })).rejects.toBeInstanceOf(ProviderError);
    expect(n).toBe(1);
  });

  it('providerFromEnv is off unless GATEWAY_MODE=openrouter', () => {
    expect(providerFromEnv({})).toBeUndefined();
    expect(providerFromEnv({ GATEWAY_MODE: 'openrouter' })?.name).toBe('openrouter');
  });
});

describe('model fallback chain (robustness)', () => {
  it('a 404 model is skipped on later calls; the next model answers', async () => {
    const { DEAD_MODELS } = await import('../src/provider');
    DEAD_MODELS.clear();
    const tried: string[] = [];
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['gone:free', 'ok:free'],
      fetchImpl: (async (_u: string, init: RequestInit) => {
        const m = JSON.parse(String(init.body)).model as string; tried.push(m);
        return m === 'gone:free' ? new Response('{"error":{"message":"No endpoints found"}}', { status: 404 }) : ok(m, 'ok');
      }) as unknown as typeof fetch,
    });
    await p.chat({ model: 'auto', messages: [{ role: 'user', content: 'x' }] });
    await p.chat({ model: 'auto', messages: [{ role: 'user', content: 'y' }] });
    expect(tried).toEqual(['gone:free', 'ok:free', 'ok:free']);
    DEAD_MODELS.clear();
  });

  it('a 400 "no endpoints" counts as gone; a plain 400 does not', async () => {
    const { isGoneError } = await import('../src/provider');
    expect(isGoneError(400, 'No endpoints found for nvidia/x:free')).toBe(true);
    expect(isGoneError(400, 'messages: invalid')).toBe(false);
    expect(isGoneError(404, '')).toBe(true);
  });

  it('when every model is marked dead it still tries them (never an empty chain)', async () => {
    const { DEAD_MODELS, markModelDead, liveFirst } = await import('../src/provider');
    DEAD_MODELS.clear();
    markModelDead('a'); markModelDead('b');
    expect(liveFirst(['a', 'b'])).toEqual(['a', 'b']);
    expect(liveFirst(['a', 'c', 'b'])).toEqual(['c']);
    DEAD_MODELS.clear();
  });

  it('catalogue sync drops unlisted models and appends trusted free extras only', async () => {
    const { DEAD_MODELS } = await import('../src/provider');
    DEAD_MODELS.clear();
    const tried: string[] = [];
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['nvidia/retired:free', 'nvidia/live:free'], catalog: true,
      fetchImpl: (async (u: string, init?: RequestInit) => {
        if (String(u).endsWith('/models')) return new Response(JSON.stringify({ data: [
          { id: 'nvidia/live:free', supported_parameters: ['tools'] },
          { id: 'google/extra:free', supported_parameters: ['tools'] },
          { id: 'unknownlab/extra:free', supported_parameters: ['tools'] },
          { id: 'google/notools:free', supported_parameters: [] },
        ] }), { status: 200 });
        const m = JSON.parse(String(init!.body)).model as string; tried.push(m);
        return new Response('busy', { status: 503 });
      }) as unknown as typeof fetch,
    });
    await expect(p.chat({ model: 'auto', messages: [] })).rejects.toBeInstanceOf(ProviderError);
    expect(tried).toEqual(['nvidia/live:free', 'google/extra:free']);
    DEAD_MODELS.clear();
  });

  it('catalogue failure is harmless (chain unchanged)', async () => {
    const { DEAD_MODELS } = await import('../src/provider');
    DEAD_MODELS.clear();
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['a:free'], catalog: true,
      fetchImpl: (async (u: string) => (String(u).endsWith('/models') ? new Response('down', { status: 500 }) : ok('a:free', 'fine'))) as unknown as typeof fetch,
    });
    const r = await p.chat({ model: 'auto', messages: [] });
    expect(r.choices[0]?.message.content).toBe('fine');
  });
});
