import type { ChatCompletionRequest, ChatCompletionResponse, ChatProvider } from '@murshid/agent-gateway';
import { DEMO_STUDENT_IDS } from '@murshid/core';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { bucketsFor } from '../src/v1/charts';
import { DemoStore } from '../src/v1/store';
import { buildLinkedInPack, renderLinkedInCvPdf } from '../src/v1/linkedin';
import { createAgentTools, parseDay, parseTime, taskFromMessage } from '../src/v1/agent-tools';
import { createChatEngine, runChat } from '../src/v1/chat';
import { NOW } from './helpers';

/** Scripted model: `script` sees each request and returns content or tool calls. */
class Scripted implements ChatProvider {
  readonly name = 'scripted';
  calls: ChatCompletionRequest[] = [];
  constructor(private script: (req: ChatCompletionRequest, n: number) => { content?: string; tool?: { name: string; args: Record<string, unknown> } } | Error) {}
  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    this.calls.push(structuredClone(req));
    const out = this.script(req, this.calls.length);
    if (out instanceof Error) throw out;
    const model = req.models?.[0] ?? req.model;
    const tool_calls = out.tool ? [{ id: `c${this.calls.length}`, type: 'function' as const, function: { name: out.tool.name, arguments: JSON.stringify(out.tool.args) } }] : undefined;
    return { id: 'x', object: 'chat.completion', created: 0, model, choices: [{ index: 0, message: { role: 'assistant', content: out.content ?? '', ...(tool_calls ? { tool_calls } : {}) }, finish_reason: tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }, attempts: [{ model, ok: true, ms: 1 }] };
  }
}

async function app(provider?: ChatProvider) {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, ...(provider ? { chatProvider: provider } : {}) });
  const req = async (method: string, path: string, opts: { as?: string; admin?: boolean; body?: unknown; sse?: boolean } = {}) => {
    const headers: Record<string, string> = {};
    if (opts.admin) headers['x-dev-role'] = 'admin';
    headers['x-dev-user'] = opts.as ?? 'demo-ideal';
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.sse) headers.accept = 'text/event-stream';
    const res = await built.app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const buf = Buffer.from(await res.arrayBuffer());
    let body: any = buf.toString('utf8');
    try { body = JSON.parse(body); } catch { /* raw */ }
    return { status: res.status, body, buf, headers: res.headers };
  };
  return { ...built, req };
}

describe('mock data: at least 12 months of history for every student', () => {
  it('fills every month of the year range (sessions, assessments) for all students', async () => {
    const store = new DemoStore();
    for (const id of DEMO_STUDENT_IDS) {
      const v = store.view(id, NOW);
      const buckets = bucketsFor('year', v.data.today);
      for (const b of buckets) {
        if (b.start.slice(5, 7) === '08') continue; // summer break: training continues, no school assessments
        expect(v.sessions.some((s) => s.date >= b.start && s.date <= b.end), `${id} sessions in ${b.key}`).toBe(true);
      }
      const graded = v.data.assessments.filter((a) => a.status === 'graded');
      expect(graded[0]!.date <= '2025-10-12').toBe(true);
      expect(new Set(graded.map((a) => a.date.slice(0, 7))).size).toBeGreaterThanOrEqual(10);
      expect(v.data.assessments.some((a) => a.title.includes('mid-term'))).toBe(true);
      expect(v.data.assessments.some((a) => a.title.includes('end-of-term'))).toBe(true);
      expect(v.record.applications.some((a) => a.outcome)).toBe(true);
      expect(v.record.projects[0]!.milestones.length).toBeGreaterThan(2);
      expect(v.record.achievements.length).toBeGreaterThan(1);
    }
  });

  it('is deterministic for a given day', () => {
    const a = new DemoStore().view('demo-ideal', NOW);
    const b = new DemoStore().view('demo-ideal', NOW);
    expect(JSON.stringify(a.sessions)).toBe(JSON.stringify(b.sessions));
    expect(JSON.stringify(a.data.projectSeries)).toBe(JSON.stringify(b.data.projectSeries));
  });
});

describe('the ideal student persona (demo-ideal)', () => {
  it('two serious sports with matches, races and PBs; a side hustle with revenue; strong academics', async () => {
    const { req } = await app();
    const d = (await req('GET', '/dashboard')).body;
    expect(d.student).toMatchObject({ id: 'demo-ideal', name: 'Ahamed Mehta', grade: 11, age: 16, curriculum: 'indian_cbse', emirate: 'dubai', synthetic: true });
    expect(d.progress.academics.average).toBeGreaterThan(80);
    const t = (await req('GET', '/student/training')).body.items;
    const football = t.find((x: any) => x.id === 'football');
    const swim = t.find((x: any) => x.id === 'swimming');
    expect(football.role).toMatch(/Vice-captain/);
    expect(football.recentFixtures[0].type).toBe('match');
    expect(football.recentFixtures[0].note).toMatch(/vs .*: [WDL] \d-\d/);
    expect(swim.recentFixtures[0].type).toBe('race');
    expect(swim.personalBests.free100.value).toBeLessThan(57);
    const p = (await req('GET', '/student/projects')).body.items[0];
    expect(p).toMatchObject({ name: 'Tideline', kind: 'business', role: 'Founder' });
    expect(p.metrics.length).toBeGreaterThanOrEqual(10);
    expect(p.totals.customers).toBeGreaterThan(30);
    const chart = (await req('GET', '/progress?area=tideline&range=year')).body;
    expect(chart).toMatchObject({ unit: 'AED', type: 'bar' });
    expect((await req('GET', '/progress?area=swimming&range=year')).body.data).toHaveLength(12);
    const apps = (await req('GET', '/student/applications')).body.items;
    expect(apps.map((a: any) => a.status)).toEqual(expect.arrayContaining(['accepted', 'rejected', 'submitted']));
  });

  it('LinkedIn pack + PDF from the student API and the career tool', async () => {
    const { req } = await app();
    const pack = (await req('GET', '/student/cv/linkedin')).body;
    expect(pack.headline.length).toBeLessThanOrEqual(220);
    expect(pack.about).toMatch(/Tideline/);
    expect(pack.experience.map((e: any) => e.type)).toEqual(expect.arrayContaining(['Self-employed', 'Leadership', 'Sport']));
    expect(pack.experience[0].bullets[0]).toMatch(/AED [\d,]+ in revenue/);
    expect(pack.skills.length).toBeGreaterThan(5);
    expect(pack.featured.length).toBeGreaterThan(0);
    expect(pack.synthetic).toBe(true);
    expect(pack.education[0]).toMatchObject({ start: '2026-09', end: '2028-06' });
    const pdf = await req('GET', '/student/cv/linkedin.pdf');
    expect(pdf.status).toBe(200);
    expect(pdf.headers.get('content-type')).toBe('application/pdf');
    expect(pdf.buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.buf.length).toBeGreaterThan(3000);
  });

  it('PDF renders straight from the store helpers', async () => {
    const v = new DemoStore().view('demo-ideal', NOW);
    const pdf = await renderLinkedInCvPdf(v, buildLinkedInPack(v));
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});

describe('agent tools (store-backed)', () => {
  it('parses relative dates and loose times', () => {
    expect(parseDay('tomorrow', '2026-10-12')).toBe('2026-10-13');
    expect(parseDay('Thursday', '2026-10-12')).toBe('2026-10-15');
    expect(parseDay('next monday', '2026-10-12')).toBe('2026-10-19');
    expect(parseDay('in 3 days', '2026-10-12')).toBe('2026-10-15');
    expect(() => parseDay('someday', '2026-10-12')).toThrow();
    expect(parseTime('6pm')).toBe('18:00');
    expect(parseTime('6:30 am')).toBe('06:30');
    expect(parseTime('19:15')).toBe('19:15');
    expect(taskFromMessage('Add a task to email my swim coach about the gala tomorrow at 5pm.', '2026-10-12')).toEqual({ title: 'Email my swim coach about the gala', date: '2026-10-13', time: '17:00' });
    expect(taskFromMessage('remind me to pack kit on Thursday', '2026-10-12')).toMatchObject({ title: 'Pack kit', date: '2026-10-15' });
  });

  it('build_week_plan saves items once per week (re-plan replaces) and audits as the agent', async () => {
    const store = new DemoStore();
    const tools = createAgentTools({ store, studentId: 'demo-ideal', now: () => NOW, actor: 'murshid' });
    const r1 = await tools.build_week_plan!({ focus: 'exams and both sports' }, { agent: 'planner', message: '' }) as any;
    expect(r1.savedItems).toBeGreaterThan(3);
    expect(r1.plan).toHaveLength(7);
    const n = store.view('demo-ideal', NOW).record.customTasks.length;
    await tools.build_week_plan!({}, { agent: 'planner', message: '' });
    expect(store.view('demo-ideal', NOW).record.customTasks.length).toBe(n);
    expect(store.auditLog.filter((e) => e.actorRole === 'agent' && e.resource === 'plan')).toHaveLength(2);
    const s = await tools.get_side_projects!({}, { agent: 'business', message: '' }) as any;
    expect(s.summary).toMatch(/Tideline: AED [\d,]+ revenue/);
    await expect(Promise.resolve().then(() => tools.create_task!({ title: 'x', date: '2020-01-01' }, { agent: 'planner', message: '' }))).rejects.toThrow(/past/);
  });
});

describe('POST /chat through the orchestrator (mocked provider, no network)', () => {
  it('compound request runs three sub-agents in parallel; SSE streams which agent is working', async () => {
    const provider = new Scripted((req) => {
      const sys = req.messages[0]!.content;
      if (sys.includes('ROLE: Planner') && !req.messages.some((m) => m.role === 'tool')) return { tool: { name: 'build_week_plan', args: { focus: 'exams, football, swimming' } } };
      if (sys.includes('ROLE: Planner')) return { content: 'Saved your week: revision before the Physics mid-term, both sports kept, Friday off.' };
      if (sys.includes('ROLE: Academics')) return { content: 'Physics is furthest from target; do a past paper Tuesday.' };
      return { content: 'Training load is steady; keep Saturday race prep light.' };
    });
    const { req, store } = await app(provider);
    const r = await req('POST', '/chat', { body: { message: 'Plan my week around exams and both sports' }, sse: true });
    expect(r.status).toBe(200);
    const events = [...String(r.body).matchAll(/event: ([\w-]+)\ndata: (.*)\n/g)].map((m) => ({ event: m[1]!, data: JSON.parse(m[2]!) }));
    expect(events[0]).toMatchObject({ event: 'route', data: { agents: ['planner', 'academics', 'sports'] } });
    expect(events.filter((e) => e.event === 'agent-start')).toHaveLength(3);
    expect(events.some((e) => e.event === 'agent-tool' && e.data.tool.name === 'build_week_plan' && e.data.tool.access === 'write')).toBe(true);
    const done = events[events.length - 1]!.data;
    expect(done.generatedBy).toBe('ai');
    expect(done.agents.map((a: any) => a.agent)).toEqual(['planner', 'academics', 'sports']);
    expect(done.toolCalls.some((t: any) => t.name === 'show_plan')).toBe(true);
    expect(done.text).toContain('**Your week**');
    // the plan the agent saved is visible to the student and to staff (audit)
    expect(store.view('demo-ideal', NOW).record.customTasks.some((t) => t.source === 'murshid')).toBe(true);
    const audit = (await req('GET', '/admin/audit?studentId=demo-ideal', { admin: true })).body.items;
    expect(audit[0]).toMatchObject({ actor: 'murshid', actorRole: 'agent', resource: 'plan' });
  });

  it('the agent sees what an admin just added (assessment, task, opportunity)', async () => {
    const seen: string[] = [];
    const provider = new Scripted((req) => { seen.push(req.messages[0]!.content); return { content: 'Noted.' }; });
    const { req } = await app(provider);
    await req('POST', '/admin/students/demo-ideal/assessments', { admin: true, body: { subjectId: 'business', title: 'Business case study test', kind: 'test', date: '2026-10-14', maxScore: 50 } });
    await req('POST', '/admin/opportunities', { admin: true, body: { title: 'Gulf Teen Founders Cup (Demo)', organizer: 'Example Chamber', type: 'competition', deadline: '2026-10-30', minGrade: 11, maxGrade: 12, why: 'For student founders.' } });
    await req('POST', '/chat', { body: { message: 'Any exams coming up in business studies?' } });
    await req('POST', '/chat', { body: { message: 'Which competitions should I apply to?' } });
    expect(seen.some((s) => s.includes('Business case study test'))).toBe(true);
    expect(seen.some((s) => s.includes('Gulf Teen Founders Cup (Demo)') && s.includes('publishedByStaff'))).toBe(true);
  });

  it('career agent generates the LinkedIn pack via its tool; the CV card links the PDF', async () => {
    const provider = new Scripted((req) => req.messages.some((m) => m.role === 'tool')
      ? { content: 'Done: your LinkedIn pack and CV are ready.' }
      : { tool: { name: 'generate_linkedin_cv', args: { headline: 'Founder @ Tideline | U18 football vice-captain | Swimmer', about: 'I run Tideline, a small kit business, while playing football and swimming.' } } });
    const { req } = await app(provider);
    const r = (await req('POST', '/chat', { body: { message: 'Generate my LinkedIn CV' } })).body;
    expect(r.route.agents).toEqual(['career']);
    const cv = r.toolCalls.find((t: any) => t.name === 'show_cv');
    expect(cv.args).toMatchObject({ pdfUrl: '/student/cv/linkedin.pdf', headline: 'Founder @ Tideline | U18 football vice-captain | Swimmer' });
    expect((await req('GET', '/student/cv/linkedin')).body).toMatchObject({ headline: 'Founder @ Tideline | U18 football vice-captain | Swimmer', generatedBy: 'ai' });
  });

  it('"How Murshid worked this out": the reply carries the real plan (goal, steps, tools, actions, result)', async () => {
    const provider = new Scripted((req) => req.messages.some((m) => m.role === 'tool')
      ? { content: 'Done: your LinkedIn pack and CV are ready.' }
      : { tool: { name: 'generate_linkedin_cv', args: { headline: 'Founder @ Tideline', about: 'I run Tideline.' } } });
    const { req } = await app(provider);
    const r = (await req('POST', '/chat', { body: { message: 'Generate my LinkedIn CV' } })).body;
    expect(r.trace).toMatchObject({ kind: 'chat', engine: { mode: 'model', router: 'rules' } });
    expect(r.trace.goal).toMatch(/Generate my LinkedIn CV/);
    expect(r.trace.plan[0]).toMatch(/^Route the request/);
    expect(r.trace.tools.map((t: any) => t.id)).toEqual(expect.arrayContaining(['get_cv_profile', 'generate_linkedin_cv']));
    expect(r.trace.tools.find((t: any) => t.id === 'generate_linkedin_cv').label).toBe('CV builder (LinkedIn pack + PDF)');
    expect(r.trace.actions.length).toBe(1);
    expect(r.trace.engine.models.length).toBe(1);
    // rules-only engine: still a truthful trace, marked as rules
    const rules = (await (await app()).req('POST', '/chat', { body: { message: 'Find opportunities for my business Tideline and save the best one to my applications.' } })).body;
    expect(rules.trace.engine.mode).toBe('rules');
    expect(rules.trace.actions[0]).toMatch(/Saved/);
  });

  it('rules fallback: "save the best one" saves the top opportunity once, with a prep task', async () => {
    const { req } = await app();
    const r = (await req('POST', '/chat', { body: { message: 'Find opportunities for my business Tideline and save the best one to my applications.' } })).body;
    expect(r.route.agents).toEqual(['opportunities']);
    expect(r.text).toMatch(/Saved .+ \(deadline/);
    const again = (await req('POST', '/chat', { body: { message: 'Save the best opportunity for Tideline.' } })).body;
    expect(again.text).toMatch(/already in your applications/);
  });

  it('falls back to rules when the model fails, and crisis messages never reach the model', async () => {
    const provider = new Scripted(() => new Error('HTTP 429 rate limited'));
    const { req } = await app(provider);
    const r = (await req('POST', '/chat', { body: { message: 'How can I grow my business revenue?' } })).body;
    expect(r).toMatchObject({ generatedBy: 'rules', fallback: true });
    expect(r.text).toMatch(/Tideline: AED/);
    expect(r.toolCalls[0]).toMatchObject({ name: 'render_chart' });
    const n = provider.calls.length;
    const c = (await req('POST', '/chat', { body: { message: 'I want to die' } })).body;
    expect(provider.calls.length).toBe(n);
    expect(c).toMatchObject({ safety: 'crisis' });
    expect(c.text).toContain('800-HOPE');
  });
});

describe('reliability: daily model budget + demo replay cache', () => {
  it('replays a scripted demo answer (tools still run), and switches to rules once the budget is used', async () => {
    let calls = 0;
    const provider = new Scripted(() => { calls++; return { content: 'Your week is planned: revision Mon-Wed, training Tue/Thu.' }; });
    const engine = createChatEngine({ MODEL_DAILY_LIMIT: '1' }, provider);
    const store = new DemoStore();
    const ask = (message: string) => runChat(engine, store, store.view('demo-ideal', NOW), { message } as never);
    const first = await ask('Plan my week around my mid-term and both sports');
    expect(first.trace?.engine.mode).toBe('model');
    const used = calls;
    const replay = await ask('Plan my week around my mid-term and both sports');
    expect(calls).toBe(used); // no new model calls
    expect(replay.trace?.engine.mode).toBe('cached');
    expect(replay.trace?.engine.note).toMatch(/replayed/);
    expect(replay.trace?.tools.some((t) => t.access === 'read')).toBe(true);
    // budget (1) is spent by the first turn: an unscripted question goes to the rule engine with an honest note
    expect(engine.guard!.available()).toBe(false);
    const other = await ask('How are my grades in maths looking compared to last term and what should I focus on?');
    expect(calls).toBe(used);
    expect(other.generatedBy).toBe('rules');
    expect(engine.guard!.status()).toMatchObject({ state: 'budget_reached', dailyLimit: 1 });
  });
});
