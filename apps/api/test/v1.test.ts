import { ChartSpecSchema, DEMO_STUDENT_IDS, PROGRESS_RANGES } from '@murshid/core';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { NOW, setup } from './helpers';

async function v1(now = NOW) {
  const { app, api } = await setup(now);
  const call = async (method: string, path: string, opts: { as?: string; body?: unknown; headers?: Record<string, string> } = {}) => {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.as) headers['x-dev-user'] = opts.as;
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(path, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
    const text = await res.text();
    let body: any = text;
    try { body = text ? JSON.parse(text) : null; } catch { /* SSE */ }
    return { status: res.status, body, headers: res.headers };
  };
  return { app, api, call };
}
const validChart = (spec: unknown) => {
  const r = ChartSpecSchema.safeParse(spec);
  if (!r.success) throw new Error(JSON.stringify(r.error.issues));
  return r.data;
};

describe('v1: demo students + CORS', () => {
  it('lists the five synthetic demo students (incl. the flagship demo-ideal); default is demo-g11', async () => {
    const { call } = await v1();
    const r = await call('GET', '/demo/students');
    expect(r.status).toBe(200);
    expect(r.body.default).toBe('demo-g11');
    expect(r.body.items.map((s: any) => [s.id, s.grade, s.band])).toEqual([
      ['demo-g5', 5, 'g5-6'], ['demo-g7', 7, 'g7-8'], ['demo-g9', 9, 'g9-10'], ['demo-g11', 11, 'g11-12'], ['demo-ideal', 11, 'g11-12'],
    ]);
    expect((await call('GET', '/dashboard')).body.student.id).toBe('demo-g11');
    expect((await call('GET', '/dashboard', { headers: { 'x-dev-user-id': 'demo-g7' } })).body.student.id).toBe('demo-g7');
    const bad = await call('GET', '/dashboard', { as: 'demo-g99' });
    expect(bad.status).toBe(404);
    expect(bad.body.details.available).toEqual([...DEMO_STUDENT_IDS]);
  });

  it('allows the web app origin (http://localhost:3000) with the dev header', async () => {
    const { app } = await v1();
    const res = await app.request('/dashboard', {
      method: 'OPTIONS',
      headers: { origin: 'http://localhost:3000', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'x-dev-user,content-type' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(res.headers.get('access-control-allow-headers')).toContain('x-dev-user');
    expect(res.headers.get('access-control-allow-methods')).toContain('PUT');
    const get = await app.request('/dashboard', { headers: { origin: 'http://localhost:3000' } });
    expect(get.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
  });

  it('requires a token in jwt mode', async () => {
    const { app } = await createSeededApp({ now: () => NOW, config: { authMode: 'jwt', jwtSecret: 'x'.repeat(32) } });
    expect((await app.request('/dashboard', { headers: { 'x-dev-user': 'demo-g5' } })).status).toBe(401);
  });
});

describe('GET /dashboard', () => {
  it.each(DEMO_STUDENT_IDS)('returns the contract shape for %s', async (id) => {
    const { call } = await v1();
    const r = await call('GET', '/dashboard', { as: id });
    expect(r.status).toBe(200);
    const b = r.body;
    expect(Object.keys(b)).toEqual(expect.arrayContaining(['student', 'band', 'today', 'upcoming', 'progress', 'streaks', 'highlights']));
    expect(b.student).toMatchObject({ id, synthetic: true });
    expect(Object.keys(b.progress)).toEqual(['academics', 'extracurriculars', 'goals']);
    expect(b.progress.academics.subjects.length).toBeGreaterThanOrEqual(5);
    expect(b.progress.academics.average).toBeGreaterThan(40);
    expect(b.progress.goals.length).toBeGreaterThanOrEqual(2);
    for (const g of b.progress.goals) expect(g.progress).toBeGreaterThanOrEqual(0);
    expect(b.today.length).toBeGreaterThan(0);
    expect(b.upcoming.every((u: any, i: number, a: any[]) => i === 0 || a[i - 1].date <= u.date)).toBe(true);
    expect(b.upcoming.every((u: any) => u.daysLeft >= 0)).toBe(true);
    expect(b.highlights.length).toBeGreaterThan(1);
    // labels, never raw enums
    expect(b.student.emirateLabel).not.toMatch(/_/);
    for (const o of b.opportunities) expect(o.typeLabel).not.toMatch(/_/);
  });

  it('is deterministic for the same day', async () => {
    const a = (await (await v1()).call('GET', '/dashboard')).body;
    const b = (await (await v1()).call('GET', '/dashboard')).body;
    expect(a).toEqual(b);
  });

  it('marks earlier tasks today as done and keeps an overdue item for older students', async () => {
    const { call } = await v1(new Date(Date.UTC(2026, 9, 12, 19, 0))); // Mon 23:00 Dubai
    const today = (await call('GET', '/dashboard', { as: 'demo-g11' })).body.today;
    expect(today.filter((t: any) => t.date === '2026-10-12').every((t: any) => t.done)).toBe(true);
    expect(today.some((t: any) => t.overdue && !t.done)).toBe(true);
  });
});

describe('GET /progress', () => {
  const areas = ['athletics', 'gym', 'hackathon', 'robotics', 'academics', 'physics', 'further-maths', 'goal-100m', 'extracurriculars', 'goals'];
  it.each(PROGRESS_RANGES)('returns valid ChartSpecs for every area over %s', async (range) => {
    const { call } = await v1();
    for (const area of areas) {
      const r = await call('GET', `/progress?area=${area}&range=${range}`);
      expect(r.status, `${area} ${range}`).toBe(200);
      const spec = validChart(r.body);
      expect(spec.generatedBy).toBe('rules');
      expect(spec.insight.length).toBeGreaterThan(10);
      if (area !== 'goals') {
        expect(spec.data.length).toBe(range === '4w' ? 4 : range === '12w' ? 12 : range === 'year' ? 12 : spec.data.length);
        for (const row of spec.data) for (const s of spec.series) expect(typeof (row[s.key] ?? 0)).toBe('number');
      }
    }
  });

  it('picks chart types per area', async () => {
    const { call } = await v1();
    const type = async (q: string) => (await call('GET', `/progress?${q}`)).body.type;
    expect(await type('area=gym')).toBe('bar');
    expect(await type('area=academics')).toBe('line');
    expect(await type('area=physics')).toBe('area');
    expect(await type('area=extracurriculars')).toBe('stacked-bar');
    expect(await type('area=goals')).toBe('radial');
    expect(await type('area=goal-physics-astar')).toBe('line');
  });

  it('term buckets start at the term start; year buckets are months', async () => {
    const { call } = await v1();
    const term = (await call('GET', '/progress?area=gym&range=term')).body;
    expect(term.data[0].period).toBe('2026-08-24');
    expect(term.data[term.data.length - 1].period).toBe('2026-10-12');
    const year = (await call('GET', '/progress?area=gym&range=year')).body;
    expect(year.data.map((r: any) => r.period)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(year.data[0].label).toBe('Nov');
  });

  it('accepts subject names and aliases, compares several areas, and defaults range to 4w', async () => {
    const { call } = await v1();
    expect((await call('GET', '/progress?area=Physics')).body.id).toBe('physics-4w');
    expect((await call('GET', '/progress?area=hackathons&range=12w')).body.id).toBe('hackathon-12w');
    const cmp = validChart((await call('GET', '/progress?area=athletics,gym&range=12w')).body);
    expect(cmp).toMatchObject({ type: 'bar', unit: 'min' });
    expect(cmp.series.map((s) => s.key)).toEqual(['athletics', 'gym']);
    const subj = validChart((await call('GET', '/progress?area=maths,physics&range=term')).body);
    expect(subj).toMatchObject({ type: 'line', unit: '%' });
    const mixed = validChart((await call('GET', '/progress?area=gym,physics')).body);
    expect(mixed.subtitle).toMatch(/% of your target/);
  });

  it('serves per-student areas (subject and activity ids differ by grade)', async () => {
    const { call } = await v1();
    expect((await call('GET', '/progress?area=music', { as: 'demo-g5' })).status).toBe(200);
    expect((await call('GET', '/progress?area=goal-reading&range=year', { as: 'demo-g5' })).status).toBe(200);
    expect((await call('GET', '/progress?area=islamic-studies', { as: 'demo-g7' })).status).toBe(200);
    expect((await call('GET', '/progress?area=hackathon', { as: 'demo-g9' })).status).toBe(200);
    const miss = await call('GET', '/progress?area=gym', { as: 'demo-g5' });
    expect(miss.status).toBe(404);
    expect(miss.body.details.available).toContain('athletics');
    const areas = await call('GET', '/progress/areas', { as: 'demo-g9' });
    expect(areas.body.items.map((a: any) => a.id)).toEqual(expect.arrayContaining(['academics', 'science', 'gym', 'goal-science-95']));
  });

  it('validates the query', async () => {
    const { call } = await v1();
    expect((await call('GET', '/progress?area=gym&range=2y')).status).toBe(400);
    expect((await call('GET', '/progress')).status).toBe(400);
  });
});

describe('POST /chat', () => {
  const ask = async (message: string, as = 'demo-g11') => (await (await v1()).call('POST', '/chat', { as, body: { message } }));

  it('progress intent → render_chart with a ChartSpec', async () => {
    const r = await ask('How is my gym going this term?');
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ intent: 'progress', lang: 'en', generatedBy: 'rules', threadId: null });
    expect(r.body.toolCalls).toHaveLength(1);
    expect(r.body.toolCalls[0].name).toBe('render_chart');
    expect(validChart(r.body.toolCalls[0].args).id).toBe('gym-term');
    expect(r.body.text).toMatch(/gym/i);
  });

  it('compare intent → comparison chart', async () => {
    const r = await ask('compare athletics and gym over the last 12 weeks');
    expect(r.body.intent).toBe('compare');
    expect(r.body.toolCalls[0].args).toMatchObject({ id: 'compare-athletics-gym-12w', type: 'bar' });
  });

  it('upcoming / tasks / opportunities intents', async () => {
    const up = await ask("what's coming up?");
    expect(up.body.intent).toBe('upcoming');
    expect(up.body.toolCalls[0]).toMatchObject({ name: 'show_tasks', args: { scope: 'upcoming' } });
    expect(up.body.toolCalls[0].args.upcoming.length).toBeGreaterThan(0);
    const today = await ask('what should I do today?');
    expect(today.body.toolCalls[0]).toMatchObject({ name: 'show_tasks', args: { scope: 'today' } });
    expect(today.body.toolCalls[0].args.tasks.length).toBeGreaterThan(0);
    const opp = await ask('any summer programmes for me?');
    expect(opp.body.intent).toBe('opportunities');
    expect(opp.body.toolCalls[0].name).toBe('show_opportunities');
    expect(opp.body.toolCalls[0].args.items[0]).toMatchObject({ type: 'summer_program', typeLabel: 'Summer programme' });
  });

  it('understands simple Arabic and answers in Arabic', async () => {
    const r = await ask('كيف تقدمي في الفيزياء هذا الفصل؟');
    expect(r.body).toMatchObject({ intent: 'progress', lang: 'ar' });
    expect(r.body.text).toContain('الفيزياء');
    expect(r.body.toolCalls[0].args.id).toBe('physics-term');
    const cmp = await ask('قارن بين الجري والنادي');
    expect(cmp.body.toolCalls[0].args.id).toBe('compare-athletics-gym-4w');
  });

  it('falls back politely for unknown areas and small talk', async () => {
    const r = await ask('show my music progress');
    expect(r.body.toolCalls).toEqual([]);
    expect(r.body.text).toMatch(/I can chart/);
    expect((await ask('hello')).body).toMatchObject({ intent: 'greeting', toolCalls: [] });
  });

  it('accepts assistant-ui style messages and validates input', async () => {
    const { call } = await v1();
    const r = await call('POST', '/chat', { body: { messages: [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      { role: 'assistant', content: 'Hi!' },
      { role: 'user', content: [{ type: 'text', text: 'physics over the year' }] },
    ], threadId: 't1' } });
    expect(r.body).toMatchObject({ threadId: 't1', intent: 'progress' });
    expect(r.body.toolCalls[0].args.id).toBe('physics-year');
    expect((await call('POST', '/chat', { body: {} })).status).toBe(400);
  });

  it('streams SSE when asked', async () => {
    const { call } = await v1();
    const r = await call('POST', '/chat', { body: { message: 'gym this term' }, headers: { accept: 'text/event-stream' } });
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toContain('text/event-stream');
    const events = [...String(r.body).matchAll(/event: ([\w-]+)\ndata: (.*)\n/g)].map((m) => ({ event: m[1], data: JSON.parse(m[2]!) }));
    expect(events[0]).toMatchObject({ event: 'meta', data: { intent: 'progress' } });
    expect(events.filter((e) => e.event === 'text-delta').length).toBeGreaterThan(1);
    expect(events.find((e) => e.event === 'tool-call')!.data).toMatchObject({ name: 'render_chart', args: { id: 'gym-term' } });
    const done = events[events.length - 1]!;
    expect(done.event).toBe('done');
    expect(events.filter((e) => e.event === 'text-delta').map((e) => e.data.delta).join('')).toBe(done.data.text);
  });
});

describe('GET/PUT /profile/links', () => {
  it('returns links with connectedAt and age restrictions', async () => {
    const { call } = await v1();
    const g11 = (await call('GET', '/profile/links')).body;
    expect(g11).toMatchObject({ linkedin: 'https://www.linkedin.com/in/zayed-demo', github: 'https://github.com/zayed-demo', instagram: null, restrictions: {} });
    expect(g11.connectedAt.linkedin).toBeTruthy();
    const g5 = (await call('GET', '/profile/links', { as: 'demo-g5' })).body;
    expect(g5.restrictions).toMatchObject({ linkedin: expect.any(String), instagram: expect.any(String) });
  });

  it('normalises handles, clears with null and stamps connectedAt', async () => {
    const { call } = await v1();
    const r = await call('PUT', '/profile/links', { as: 'demo-g9', body: { github: '@priya-dev', instagram: 'priya.codes', portfolio: 'priya.example.com', resumeUrl: null } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ github: 'https://github.com/priya-dev', instagram: 'https://www.instagram.com/priya.codes', portfolio: 'https://priya.example.com' });
    expect(r.body.connectedAt.instagram).toBe(NOW.toISOString());
    expect((await call('GET', '/profile/links', { as: 'demo-g9' })).body.github).toBe('https://github.com/priya-dev');
    const cleared = await call('PUT', '/profile/links', { as: 'demo-g9', body: { github: null } });
    expect(cleared.body).toMatchObject({ github: null, connectedAt: { github: null } });
    // other students untouched
    expect((await call('GET', '/profile/links', { as: 'demo-g11' })).body.github).toBe('https://github.com/zayed-demo');
  });

  it('rejects wrong sites, unknown keys and age-restricted links', async () => {
    const { call } = await v1();
    expect((await call('PUT', '/profile/links', { body: { github: 'https://gitlab.com/sara' } })).body.details).toMatchObject({ code: 'wrong_site' });
    expect((await call('PUT', '/profile/links', { body: { myspace: 'x' } })).status).toBe(400);
    const young = await call('PUT', '/profile/links', { as: 'demo-g7', body: { instagram: '@omar' } });
    expect(young.status).toBe(400);
    expect(young.body.details).toMatchObject({ code: 'age_restricted', field: 'instagram' });
    expect((await call('PUT', '/profile/links', { as: 'demo-g9', body: { linkedin: 'priya' } })).body.details.code).toBe('age_restricted');
  });
});

describe('GET /academics', () => {
  it('returns subjects, grades over time, assessments and a term chart', async () => {
    const { call } = await v1();
    const r = await call('GET', '/academics', { as: 'demo-g9' });
    expect(r.status).toBe(200);
    const b = r.body;
    expect(b.term).toMatchObject({ id: '2026-t1', start: '2026-08-24' });
    expect(b.subjects.map((s: any) => s.id)).toContain('science');
    for (const s of b.subjects) {
      expect(s.grades.length).toBeGreaterThan(5);
      expect(s.grades.every((g: any, i: number, a: any[]) => i === 0 || a[i - 1].date <= g.date)).toBe(true);
      expect(s.current).toBeGreaterThan(30);
    }
    expect(b.assessments[0].date >= b.assessments[b.assessments.length - 1].date).toBe(true);
    expect(b.assessments.every((a: any) => a.status === 'graded' && a.percent !== null)).toBe(true);
    expect(b.upcoming.every((a: any) => a.status === 'upcoming' && a.score === null && a.date > '2026-10-12')).toBe(true);
    expect(validChart(b.chart).id).toBe('academics-term');
  });
});

describe('extracurriculars', () => {
  it('lists activities with sessions, hours and metrics', async () => {
    const { call } = await v1();
    const b = (await call('GET', '/extracurriculars?limit=3')).body;
    expect(b.activities.map((a: any) => a.id)).toEqual(['athletics', 'gym', 'hackathon', 'robotics']);
    const ath = b.activities[0];
    expect(ath.sessions).toHaveLength(3);
    expect(ath.sessions[0].date >= ath.sessions[1].date).toBe(true);
    expect(ath.totals.hours).toBeGreaterThan(10);
    expect(ath.bestMetrics.time100m).toBeLessThan(14);
    expect(b.available.find((a: any) => a.id === 'music')).toMatchObject({ enrolled: false });
    const hack = b.activities.find((a: any) => a.id === 'hackathon');
    expect(hack.nextEvent).toMatchObject({ activityId: 'hackathon' });
  });

  it('logs a session and it shows up in totals and progress', async () => {
    const { call } = await v1();
    const before = (await call('GET', '/progress?area=gym&range=4w')).body;
    const r = await call('POST', '/extracurriculars/gym/sessions', { body: { minutes: 55, metrics: { squatKg: 70 }, note: 'Felt strong' } });
    expect(r.status).toBe(201);
    expect(r.body.session).toMatchObject({ activityId: 'gym', date: '2026-10-12', minutes: 55, metrics: { squatKg: 70 }, note: 'Felt strong' });
    expect(r.body.activity.bestMetrics.squatKg).toBe(70);
    const after = (await call('GET', '/progress?area=gym&range=4w')).body;
    const last = (s: any) => s.data[s.data.length - 1].minutes;
    expect(last(after)).toBe(last(before) + 55);
    const dash = (await call('GET', '/dashboard')).body;
    expect(dash.highlights.some((h: any) => h.kind === 'personal-best')).toBe(true);
  });

  it('validates sessions', async () => {
    const { call } = await v1();
    const post = (body: unknown, path = '/extracurriculars/gym/sessions', as?: string) => call('POST', path, { body, as });
    expect((await post({ minutes: 0 })).status).toBe(400);
    expect((await post({ minutes: 30, date: '2026-12-01' })).status).toBe(400);
    expect((await post({ minutes: 30, metrics: { deadliftKg: 100 } })).body.details.allowed).toEqual(['squatKg', 'benchKg']);
    expect((await post({ minutes: 30 }, '/extracurriculars/music/sessions')).status).toBe(404);
    expect((await post({ minutes: 20 }, '/extracurriculars/music/sessions', 'demo-g5')).status).toBe(201);
  });
});

describe('openapi', () => {
  it('documents the v1 endpoints with response schemas', async () => {
    const { api } = await v1();
    const doc = api.openapi() as any;
    for (const p of ['/dashboard', '/progress', '/chat', '/profile/links', '/academics', '/extracurriculars', '/extracurriculars/{id}/sessions', '/demo/students']) {
      expect(doc.paths[p], p).toBeTruthy();
    }
    expect(doc.paths['/progress'].get.responses['200'].content['application/json'].schema.properties.type.enum).toContain('stacked-bar');
    expect(doc.paths['/chat'].post.responses['200'].content['text/event-stream']).toBeTruthy();
    expect(doc.paths['/profile/links'].put).toBeTruthy();
    expect(doc.components.securitySchemes.demoUser.name).toBe('x-dev-user');
  });
});
