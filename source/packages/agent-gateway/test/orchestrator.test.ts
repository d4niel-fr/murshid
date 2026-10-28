import { describe, expect, it } from 'vitest';
import {
  OpenAICompatibleProvider, Orchestrator, ProviderError, cleanModelText, SUB_AGENTS, agentModelChain, routeByRules, wellbeingSafe,
  type ChatCompletionRequest, type ChatCompletionResponse, type ChatProvider, type OrchestratorEvent, type ToolHandler,
} from '../src/index.js';

const student = { id: 'demo-ideal', name: 'Ahamed', grade: 11, today: '2026-10-10', weekday: 'Saturday' };

/** Scripted provider: each call returns the next reply produced by `script(req, n)`. */
class Scripted implements ChatProvider {
  readonly name = 'scripted';
  calls: ChatCompletionRequest[] = [];
  constructor(private script: (req: ChatCompletionRequest, n: number) => Partial<ChatCompletionResponse['choices'][0]['message']> | Error) {}
  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.calls.push(structuredClone(req));
    const out = this.script(req, this.calls.length);
    if (out instanceof Error) throw out;
    const model = req.models?.[0] ?? req.model;
    return {
      id: `s${this.calls.length}`, object: 'chat.completion', created: 0, model,
      choices: [{ index: 0, message: { role: 'assistant', content: '', ...out }, finish_reason: out.tool_calls ? 'tool_calls' : 'stop' }],
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }, attempts: [{ model, ok: true, ms: 1 }],
    };
  }
}

function fakeTools(log: { name: string; args: Record<string, unknown> }[] = []): Record<string, ToolHandler> {
  const reader = (name: string, summary: string, extra: Record<string, unknown> = {}): ToolHandler => (args) => { log.push({ name, args }); return { summary, ...extra }; };
  return {
    get_student_overview: reader('get_student_overview', 'Ahamed is in Year 12.'),
    get_academics: reader('get_academics', 'Average 87%; weakest: Physics 83%. Next: Physics mid-term exam on 2026-10-14.'),
    get_training: reader('get_training', 'Football: 3h last week. Swimming: 5h last week; 100m free PB 55.36s.'),
    get_upcoming: reader('get_upcoming', '3 assessments in the next 14 days.'),
    get_tasks: reader('get_tasks', '2 tasks today.'),
    get_goals: reader('get_goals', '5 goals.'),
    find_opportunities: reader('find_opportunities', 'Best fit: Young Founders Pitch Night (12 days left).'),
    get_applications: reader('get_applications', '6 applications.'),
    get_side_projects: reader('get_side_projects', 'Tideline: AED 18,836 revenue, 75 customers.', { chartArea: 'tideline' }),
    get_cv_profile: reader('get_cv_profile', 'Headline set; 8 skills.'),
    get_wellbeing_signals: reader('get_wellbeing_signals', '3 assessments in 14 days; training at usual level.'),
    create_task: (args) => { log.push({ name: 'create_task', args }); return { summary: `Added "${String(args.title)}".`, task: { id: 't1' } }; },
    build_week_plan: (args) => { log.push({ name: 'build_week_plan', args }); return { summary: 'Saved a 7-day plan with 12 items.', ui: { name: 'show_plan', args: { items: 12 } } }; },
    save_opportunity: (args) => { log.push({ name: 'save_opportunity', args }); return { summary: 'Saved.' }; },
    add_project_milestone: (args) => { log.push({ name: 'add_project_milestone', args }); return { summary: 'Milestone added.' }; },
    generate_linkedin_cv: (args) => { log.push({ name: 'generate_linkedin_cv', args }); return { summary: 'LinkedIn pack and CV PDF generated.', ui: { name: 'show_cv', args: { pdfUrl: '/cv/linkedin.pdf' } } }; },
  };
}

describe('router', () => {
  it('sends a compound request to several specialists, planner first', () => {
    expect(routeByRules('Plan my week around exams and both sports').agents).toEqual(['planner', 'academics', 'sports']);
  });
  it('routes single-domain requests', () => {
    expect(routeByRules('How are my grades in Physics?').agents).toEqual(['academics']);
    expect(routeByRules('Any internships or competitions I should apply to?').agents[0]).toBe('opportunities');
    expect(routeByRules('How can I grow revenue for my business?').agents).toEqual(['business']);
    expect(routeByRules('Make me a LinkedIn CV with my football and business').agents).toEqual(['career']);
    expect(routeByRules("I'm so stressed and can't sleep").agents[0]).toBe('wellbeing');
    expect(routeByRules('hello there').agents).toEqual([]);
  });
  it('lets the lead specialist answer alone when other topics are only context', () => {
    expect(routeByRules('Find me opportunities that fit my business and my sports').agents).toEqual(['opportunities']);
    expect(routeByRules('How can I grow Tideline next month without hurting my grades or training?').agents).toEqual(['business']);
    expect(routeByRules("I'm stressed about the mocks and the gala").agents).toEqual(['wellbeing']);
    expect(routeByRules('Add a task to email my swim coach about the gala tomorrow at 5pm').agents).toEqual(['planner']);
    expect(routeByRules('How am I doing in football and swimming, and how are my grades?').agents.sort()).toEqual(['academics', 'sports']);
    expect(routeByRules('Any exams coming up in business studies?').agents).toEqual(['academics']);
  });
  it('flags crisis language for the safety path', () => {
    expect(routeByRules('sometimes I want to die').router).toBe('safety');
  });
  it('each agent has its own prompt, tools and model chain', () => {
    const ids = Object.keys(SUB_AGENTS);
    expect(ids).toEqual(expect.arrayContaining(['academics', 'sports', 'opportunities', 'career', 'planner', 'business', 'wellbeing']));
    const prompts = new Set(Object.values(SUB_AGENTS).map((a) => a.systemPrompt));
    expect(prompts.size).toBe(ids.length);
    expect(agentModelChain(SUB_AGENTS.opportunities)[0]).toContain('lightning');
    // nemotron-3-super answered 404 on 21 Oct 2026: every agent now leads with lightning and keeps super as a fallback
    expect(agentModelChain(SUB_AGENTS.career)[0]).toContain('lightning');
    expect(agentModelChain(SUB_AGENTS.career)).toContain('nvidia/nemotron-3-super-120b-a12b:free');
    expect(agentModelChain(SUB_AGENTS.career, ['x', 'y'])).toEqual(['x', 'y']);
  });
});

describe('Orchestrator with a mocked provider', () => {
  it('runs one agent: prefetches real data into the prompt, executes a write tool, then answers', async () => {
    const log: { name: string; args: Record<string, unknown> }[] = [];
    const provider = new Scripted((req, n) => n === 1
      ? { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'create_task', arguments: JSON.stringify({ title: 'Physics past paper', date: 'tomorrow', time: '18:00' }) } }] }
      : { content: 'Added a Physics past paper for tomorrow at 6pm.' });
    const events: OrchestratorEvent[] = [];
    const o = new Orchestrator({ provider, tools: fakeTools(log) });
    const r = await o.run({ message: 'Add a physics revision task for tomorrow', student, onEvent: (e) => { events.push(e); } });
    expect(r.route.agents).toEqual(['academics']);
    expect(provider.calls[0]!.messages[0]!.content).toContain('weakest: Physics 83%');
    expect(provider.calls[0]!.tools!.map((t) => t.function.name)).toEqual(['get_academics', 'get_upcoming', 'create_task', 'render_chart', 'show_tasks']);
    expect(provider.calls[1]!.messages.some((m) => m.role === 'tool' && m.content.includes('Physics past paper'))).toBe(true);
    expect(log.find((l) => l.name === 'create_task')?.args).toMatchObject({ title: 'Physics past paper', date: 'tomorrow' });
    expect(r.text).toBe('Added a Physics past paper for tomorrow at 6pm.');
    expect(r.generatedBy).toBe('ai');
    expect(r.agents[0]).toMatchObject({ agent: 'academics', fallback: false, rounds: 2 });
    expect(r.agents[0]!.tools.map((t) => [t.name, t.access, t.prefetch])).toEqual([['get_academics', 'read', true], ['create_task', 'write', false]]);
    expect(events.map((e) => e.type)).toEqual(['route', 'agent-start', 'tool', 'tool', 'agent-done']);
  });

  it('runs a compound request in parallel and merges labelled sections', async () => {
    const provider = new Scripted((req) => {
      const sys = req.messages[0]!.content;
      if (sys.includes('ROLE: Planner')) return { content: 'Plan: revise Mon/Tue, training kept.' };
      if (sys.includes('ROLE: Academics')) return { content: 'Physics is your focus.' };
      return { content: 'Keep swim volume steady before the gala.' };
    });
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: 'Plan my week around exams and both sports', student });
    expect(r.route.agents).toEqual(['planner', 'academics', 'sports']);
    expect(r.sections.map((s) => s.name)).toEqual(['Planner', 'Academics coach', 'Sports & training coach']);
    expect(r.text).toContain('**Your week**');
    expect(r.text).toContain('Physics is your focus.');
    expect(provider.calls).toHaveLength(3);
  });

  it('collects UI tool calls (charts) without executing them as data tools', async () => {
    const provider = new Scripted((_r, n) => n === 1
      ? { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'render_chart', arguments: '{"area":"swimming","range":"year"}' } }] }
      : { content: 'Your swim times dropped all year.' });
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: 'How is my swimming training going this year?', student });
    expect(r.uiCalls).toEqual([{ name: 'render_chart', args: { area: 'swimming', range: 'year' } }]);
  });

  it('refuses tools that are not in the agent\'s toolset', async () => {
    const log: { name: string; args: Record<string, unknown> }[] = [];
    const provider = new Scripted((_r, n) => n === 1
      ? { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'generate_linkedin_cv', arguments: '{}' } }] }
      : { content: 'ok' });
    const r = await new Orchestrator({ provider, tools: fakeTools(log) }).run({ message: 'How are my grades?', student });
    expect(log.some((l) => l.name === 'generate_linkedin_cv')).toBe(false);
    expect(r.agents[0]!.tools.find((t) => t.name === 'generate_linkedin_cv')).toMatchObject({ ok: false, error: 'not allowed' });
  });

  it('falls back to rules when every model fails, still answering from real data and running the asked-for write once', async () => {
    const log: { name: string; args: Record<string, unknown> }[] = [];
    const provider = new Scripted(() => new ProviderError('HTTP 429', true, 429));
    const r = await new Orchestrator({ provider, tools: fakeTools(log) }).run({ message: 'Please plan my week', student });
    expect(r.route.agents).toEqual(['planner']);
    expect(r.fallback).toBe(true);
    expect(r.generatedBy).toBe('rules');
    expect(r.agents[0]!.error).toContain('429');
    expect(r.text).toContain('Saved a 7-day plan');
    expect(r.text).toContain('3 assessments');
    expect(log.filter((l) => l.name === 'build_week_plan')).toHaveLength(1);
    expect(r.uiCalls).toContainEqual({ name: 'show_plan', args: { items: 12 } });
  });

  it('never writes twice when the model fails after already running the write tool', async () => {
    const log: { name: string; args: Record<string, unknown> }[] = [];
    const provider = new Scripted((_r, n) => n === 1
      ? { tool_calls: [{ id: 'c1', type: 'function', function: { name: 'build_week_plan', arguments: '{"focus":"exams"}' } }] }
      : new ProviderError('HTTP 503', true, 503));
    const r = await new Orchestrator({ provider, tools: fakeTools(log) }).run({ message: 'plan my week please', student });
    expect(log.filter((l) => l.name === 'build_week_plan')).toHaveLength(1);
    expect(r.fallback).toBe(true);
    expect(r.text).toContain('Saved a 7-day plan');
  });

  it('works with no provider at all (pure rules) and still shows a chart', async () => {
    const r = await new Orchestrator({ tools: fakeTools() }).run({ message: 'How are my grades this year?', student });
    expect(r.generatedBy).toBe('rules');
    expect(r.text).toContain('Average 87%');
    expect(r.uiCalls).toContainEqual({ name: 'render_chart', args: { area: 'academics', range: 'year' } });
  });

  it('answers crisis messages with helplines and never calls a model', async () => {
    const provider = new Scripted(() => ({ content: 'should not be used' }));
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: "I don't want to live anymore, I want to die", student });
    expect(provider.calls).toHaveLength(0);
    expect(r.safety).toBe('crisis');
    expect(r.text).toContain('800-HOPE (800 4673)');
    expect(r.text).toContain('999');
  });

  it('strips medical advice from wellbeing replies', async () => {
    const provider = new Scripted(() => ({ content: 'Take 5 mg of melatonin every night.' }));
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: "I'm stressed and can't sleep", student });
    expect(r.text).not.toContain('melatonin');
    expect(r.text).toContain('800-HOPE');
    expect(wellbeingSafe('Go for a walk.').replaced).toBe(false);
  });

  it('uses a model router when no keyword matches, else the general agent', async () => {
    const provider = new Scripted((req) => req.messages[0]!.content.startsWith('You route')
      ? { content: '{"agents":["business"]}' }
      : { content: 'Here is a growth idea.' });
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: 'what should I do about the caps thing lately', student });
    expect(r.route).toMatchObject({ agents: ['business'], router: 'model' });
    const g = await new Orchestrator({ tools: fakeTools() }).run({ message: 'hi', student });
    expect(g.route.agents).toEqual(['general']);
  });
});

describe('compound safety + text hygiene', () => {
  it('only the lead agent may write in a compound request; advisors get read/UI tools and one round', async () => {
    const provider = new Scripted((req) => ({ content: req.tools?.some((t) => t.function.name === 'build_week_plan') ? 'Lead plan.' : 'Advice.' }));
    await new Orchestrator({ provider, tools: fakeTools() }).run({ message: 'Plan my week around exams and both sports', student });
    const byRole = (role: string) => provider.calls.find((c) => c.messages[0]!.content.includes(role))!;
    expect(byRole('ROLE: Planner').tools!.map((t) => t.function.name)).toContain('build_week_plan');
    const adv = byRole('ROLE: Academics');
    expect(adv.tools!.map((t) => t.function.name)).not.toContain('create_task');
    expect(adv.messages[0]!.content).toContain('ADVISOR MODE');
  });
  it('executes tool calls a model printed as markup instead of structured tool_calls', async () => {
    const log: { name: string; args: Record<string, unknown> }[] = [];
    const provider = new Scripted((_r, n) => n === 1
      ? { content: '<tool_call>\n<function=create_task>\n<parameter=title>\nPhysics past paper\n</parameter>\n<parameter=date>\n2026-10-13\n</parameter>\n<parameter=durationMinutes>\n45\n</parameter>\n</function>\n</tool_call>' }
      : { content: 'Added it.' });
    const r = await new Orchestrator({ provider, tools: fakeTools(log) }).run({ message: 'Add a physics revision task for tomorrow', student });
    expect(log.find((l) => l.name === 'create_task')?.args).toEqual({ title: 'Physics past paper', date: '2026-10-13', durationMinutes: 45 });
    expect(r).toMatchObject({ fallback: false, text: 'Added it.' });
  });
  it('strips raw tool-call markup and markdown tables from replies', async () => {
    expect(cleanModelText('Hi\n<tool_call>\n<function=create_task>\n<parameter=title>x</parameter>\n</function>\n</tool_call>')).toBe('Hi');
    expect(cleanModelText('Top picks:\n| Name | Days |\n|---|---|\n| Pitch Night | 12 |\n| Essay Prize | 26 |')).toBe('Top picks:\n- Pitch Night · 12\n- Essay Prize · 26');
    const provider = new Scripted(() => ({ content: '<tool_call><function=create_task></function></tool_call>' }));
    const r = await new Orchestrator({ provider, tools: fakeTools() }).run({ message: 'How are my grades?', student });
    expect(r.fallback).toBe(true);
    expect(r.agents[0]!.error).toContain('tool-call markup');
    expect(r.text).not.toContain('<tool_call>');
  });
});

describe('OpenAICompatibleProvider 429 handling', () => {
  it('retries the same model after a backoff on 429, then moves down the chain; records attempts', async () => {
    const tried: string[] = [];
    const slept: number[] = [];
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['a', 'b'], retries429: 1, backoffMs: 50, sleep: async (ms) => { slept.push(ms); },
      fetchImpl: (async (_u: string, init: RequestInit) => {
        const m = JSON.parse(String(init.body)).model as string;
        tried.push(m);
        if (m === 'a') return new Response('rate limited', { status: 429, headers: { 'retry-after': '1' } });
        return new Response(JSON.stringify({ id: 'x', model: m, choices: [{ index: 0, message: { role: 'assistant', content: 'hi' }, finish_reason: 'stop' }] }), { status: 200 });
      }) as unknown as typeof fetch,
    });
    const r = await p.chat({ model: 'auto', messages: [{ role: 'user', content: 'x' }] });
    expect(tried).toEqual(['a', 'a', 'b']);
    expect(p.exhaustedUntil).toBe(0);
    expect(slept).toContain(1000);
    expect(r.attempts?.map((a) => [a.model, a.ok, a.status])).toEqual([['a', false, 429], ['a', false, 429], ['b', true, undefined]]);
  });

  it('stops calling every model once the shared daily free quota is used up (fail fast until reset)', async () => {
    let n = 0;
    const reset = Date.now() + 3 * 3600_000;
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['a', 'b', 'c'], retries429: 1, sleep: async () => {},
      fetchImpl: (async () => { n++; return new Response(JSON.stringify({ error: { message: 'Rate limit exceeded: free-models-per-day.', code: 429, metadata: { headers: { 'X-RateLimit-Reset': String(reset) } } } }), { status: 429 }); }) as unknown as typeof fetch,
    });
    await expect(p.chat({ model: 'auto', messages: [] })).rejects.toMatchObject({ status: 429 });
    expect(n).toBe(1);
    expect(p.exhaustedUntil).toBe(reset);
    await expect(p.chat({ model: 'auto', messages: [] })).rejects.toThrow(/quota exhausted/);
    expect(n).toBe(1);
  });

  it('uses the per-request models chain when given, and does not send it upstream', async () => {
    const bodies: Record<string, unknown>[] = [];
    const p = new OpenAICompatibleProvider({
      baseUrl: 'https://or.test', models: ['default'],
      fetchImpl: (async (_u: string, init: RequestInit) => {
        const b = JSON.parse(String(init.body)); bodies.push(b);
        return new Response(JSON.stringify({ id: 'x', model: b.model, choices: [{ index: 0, message: { role: 'assistant', content: 'ok' }, finish_reason: 'stop' }] }));
      }) as unknown as typeof fetch,
    });
    await p.chat({ model: 'auto', models: ['pref'], messages: [] });
    expect(bodies[0]).toMatchObject({ model: 'pref' });
    expect('models' in bodies[0]!).toBe(false);
  });
});
