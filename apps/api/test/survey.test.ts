import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { MemorySurveySink, SupabaseSurveySink } from '../src/survey/routes';
import { NOW } from './helpers';

const answers = { workload: 4, missed: '1', clustering: 'Most weeks', tracking: ['Teams / school portal'], activities: 'Often', would_use: 5, family_pay: 'Not sure' };

describe('validation survey', () => {
  it('accepts anonymous responses with consent and shows counts to admins only', async () => {
    const sink = new MemorySurveySink();
    const { app } = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, surveySink: sink });
    const post = (body: unknown) => app.request('/survey', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect((await post({ version: 'student', answers, consent: true })).status).toBe(201);
    expect((await post({ version: 'student', answers: { ...answers, workload: 2 }, consent: true })).status).toBe(201);
    expect((await post({ version: 'student', answers })).status).toBe(400); // no consent
    expect((await post({ version: 'parent', answers, consent: true })).status).toBe(400);
    expect(sink.rows).toHaveLength(2);
    expect((await app.request('/admin/survey', { headers: { 'x-dev-user-id': 'demo-g9' } })).status).toBe(401);
    const r = await (await app.request('/admin/survey', { headers: { 'x-dev-role': 'admin', 'x-dev-user-id': 'dev-admin' } })).json();
    expect(r).toMatchObject({ store: 'memory', total: 2, byVersion: { student: 2, teacher: 0 } });
    expect(r.versions.student.find((q: any) => q.id === 'workload').mean).toBe(3);
    expect((await (await app.request('/survey/questions')).json()).surveys.teacher.questions.length).toBeGreaterThanOrEqual(8);
  });

  it('Supabase sink: insert via the public key, results via the admin-code RPC', async () => {
    const calls: { url: string; body: any }[] = [];
    const f = (async (url: string, init: RequestInit) => { calls.push({ url, body: JSON.parse(String(init.body)) }); return new Response(url.includes('rpc') ? '[]' : '', { status: url.includes('rpc') ? 200 : 201 }); }) as unknown as typeof fetch;
    const s = new SupabaseSurveySink('https://x.supabase.co', 'anon', 'code123', f);
    await s.insert({ version: 'teacher', answers: { would_use: 4 }, created_at: '' });
    expect(await s.list()).toEqual([]);
    expect(calls[0]).toMatchObject({ url: 'https://x.supabase.co/rest/v1/survey_responses', body: { version: 'teacher', consent: true } });
    expect(calls[1]).toMatchObject({ url: 'https://x.supabase.co/rest/v1/rpc/survey_results', body: { code: 'code123' } });
  });
});
