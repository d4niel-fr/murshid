import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import type { AppEnv } from '../src/lib/context';
import { bucketOf, requestId, timeout } from '../src/lib/middleware';
import { NOW } from './helpers';

const THOMAS = { 'x-dev-role': 'teacher', 'x-dev-user-id': 't-thomas' };
const AHAMED = { 'x-dev-user': 'demo-ideal' };

async function setup(opts: Parameters<typeof createSeededApp>[0] = {}) {
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, ...opts });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text();
    return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : null };
  };
  return { ...built, req };
}

const buyer = { plan: 'single', billing: 'yearly', name: 'Nadia Karim', email: 'nadia@example.com', who: 'parent', studentName: 'Sami Karim', grade: 8 };

describe('errors: one shape, traceable', () => {
  it('404s carry a code and a request id (echoing a sane incoming one)', async () => {
    const { req } = await setup();
    const r = await req('GET', '/nope', { 'x-request-id': 'trace-123456' });
    expect(r.status).toBe(404);
    expect(r.body).toMatchObject({ code: 'not_found', requestId: 'trace-123456' });
    expect(r.headers.get('x-request-id')).toBe('trace-123456');
  });
  it('validation errors list the fields', async () => {
    const { req } = await setup();
    const r = await req('POST', '/billing/checkout', {}, { plan: 'single', name: 'x', email: 'not-an-email', grade: 30 });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('bad_request');
    expect(r.body.details.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(['name', 'email', 'grade']));
  });
});

describe('rate limiting', () => {
  it('answers 429 with Retry-After once a bucket is used up', async () => {
    const { req } = await setup({ rateLimit: { read: 3, windowMs: 60_000 } });
    for (let i = 0; i < 3; i++) expect((await req('GET', '/plans')).status).toBe(200);
    const r = await req('GET', '/plans');
    expect(r.status).toBe(429);
    expect(r.body.code).toBe('rate_limited');
    expect(Number(r.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(r.headers.get('ratelimit-remaining')).toBe('0');
  });
  it('keeps clients apart and puts chat, writes and sign-in in their own buckets', async () => {
    const { req } = await setup({ rateLimit: { read: 1, windowMs: 60_000 } });
    expect((await req('GET', '/plans', { 'x-forwarded-for': '10.0.0.1' })).status).toBe(200);
    expect((await req('GET', '/plans', { 'x-forwarded-for': '10.0.0.2' })).status).toBe(200);
    expect((await req('GET', '/plans', { 'x-forwarded-for': '10.0.0.1' })).status).toBe(429);
    expect(bucketOf('POST', '/v1/chat')).toBe('chat');
    // billing has its own, tighter bucket (was shared with sign-in)
    expect(bucketOf('POST', '/billing/checkout')).toBe('billing');
    expect(bucketOf('POST', '/teacher/classes/x/assignments')).toBe('write');
    expect(bucketOf('GET', '/teacher/me')).toBe('read');
  });
});

describe('billing: only the Single plan, never twice', () => {
  it('sells the Single plan and refuses the School plan online', async () => {
    const { req } = await setup();
    const ok = await req('POST', '/billing/checkout', {}, buyer);
    expect(ok.status).toBe(201);
    expect(ok.body).toMatchObject({ plan: 'single', billing: 'yearly', amountAed: 249, status: 'active' });
    const school = await req('POST', '/billing/checkout', {}, { ...buyer, plan: 'school', email: 'head@school.ae' });
    expect(school.status).toBe(403);
    expect(school.body.code).toBe('school_plan_offline');
  });
  it('replays a retried request with the same Idempotency-Key instead of buying twice', async () => {
    const { req } = await setup();
    const key = { 'idempotency-key': 'checkout-abc-123456' };
    const a = await req('POST', '/billing/checkout', key, buyer);
    const b = await req('POST', '/billing/checkout', key, buyer);
    expect(a.status).toBe(201); expect(b.status).toBe(201);
    expect(b.body.orderId).toBe(a.body.orderId);
    expect(b.headers.get('idempotent-replayed')).toBe('true');
    const changed = await req('POST', '/billing/checkout', key, { ...buyer, billing: 'monthly' });
    expect(changed.status).toBe(422);
    expect(changed.body.code).toBe('idempotency_mismatch');
  });
  it('refuses a second active plan for the same email (any case), then allows one after cancelling', async () => {
    const { req } = await setup();
    const first = await req('POST', '/billing/checkout', {}, buyer);
    const dup = await req('POST', '/billing/checkout', {}, { ...buyer, email: 'NADIA@example.com' });
    expect(dup.status).toBe(409);
    expect(dup.body).toMatchObject({ code: 'already_subscribed' });
    // the order id (which cancels the plan with the email) is never handed to whoever types the email
    expect(JSON.stringify(dup.body)).not.toContain(first.body.orderId);
    expect(first.body.orderId).toMatch(/^MS-[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect((await req('POST', '/billing/cancel', {}, { orderId: first.body.orderId, email: 'nadia@example.com' })).body.status).toBe('canceled');
    expect((await req('POST', '/billing/checkout', {}, buyer)).status).toBe(201);
  });
});

describe('timeouts', () => {
  it('answers 504 when a handler is too slow, and leaves streams alone', async () => {
    const app = new Hono<AppEnv>();
    app.use('*', requestId()); app.use('*', timeout(30));
    app.get('/slow', async (c) => { await new Promise((r) => setTimeout(r, 120)); return c.json({ ok: true }); });
    app.get('/v1/chat', async (c) => { await new Promise((r) => setTimeout(r, 60)); return c.json({ ok: true }); });
    const slow = await app.request('/slow');
    expect(slow.status).toBe(504);
    expect((await slow.json()).code).toBe('timeout');
    expect((await app.request('/v1/chat')).status).toBe(200);
  });
});

describe('form assignments', () => {
  const base = { title: 'Reading check: chapter 3', dueDate: '2026-10-22' };   // set today, so students see it now
  it('accepts Google and Microsoft Forms links only from their real hosts', async () => {
    const { req } = await setup();
    const bad = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { ...base, format: 'google_form', formUrl: 'https://evil.example.com/forms/abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.details[0].path).toBe('formUrl');
    const g = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { ...base, format: 'google_form', formUrl: 'https://docs.google.com/forms/d/e/abc123/viewform' });
    expect(g.status).toBe(201);
    expect(g.body.assignment).toMatchObject({ format: 'google_form', formUrl: 'https://docs.google.com/forms/d/e/abc123/viewform' });
    const m = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { ...base, title: 'Exit ticket', format: 'microsoft_form', formUrl: 'https://forms.office.com/r/AbCdEf123' });
    expect(m.status).toBe(201);
    const school = (await req('GET', '/student/school', AHAMED)).body.school.assignments;
    expect(school.find((a: { id: string }) => a.id === g.body.assignment.id)).toMatchObject({ format: 'google_form', formUrl: expect.stringContaining('docs.google.com') });
  });
  it('runs a built-in form end to end: post, answer once, update, teacher sees it', async () => {
    const { req } = await setup();
    const questions = [
      { id: 'q1', type: 'short', prompt: 'Who is the narrator?' },
      { id: 'q2', type: 'choice', prompt: 'What is the tone?', options: ['Calm', 'Angry', 'Joyful'] },
      { id: 'q3', type: 'long', prompt: 'Any questions for class?', required: false },
    ];
    expect((await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { ...base, format: 'form' })).status).toBe(400);
    const post = await req('POST', '/teacher/classes/cls-eng-11ab/assignments', THOMAS, { ...base, format: 'form', questions });
    expect(post.status).toBe(201);
    const id = post.body.assignment.id;
    const path = `/student/assignments/${id}/responses`;
    expect((await req('POST', path, AHAMED, { answers: { q1: 'The poet' } })).status).toBe(400);           // q2 missing
    expect((await req('POST', path, AHAMED, { answers: { q1: 'The poet', q2: 'Sleepy' } })).status).toBe(400); // not an option
    const first = await req('POST', path, AHAMED, { answers: { q1: 'The poet', q2: 'Calm' } });
    expect(first.status).toBe(201);
    const again = await req('POST', path, AHAMED, { answers: { q1: 'The poet, speaking to us', q2: 'Calm' } });
    expect(again.status).toBe(200);
    expect(again.body.updated).toBe(true);
    const mine = (await req('GET', '/student/school', AHAMED)).body.school.assignments.find((a: { id: string }) => a.id === id);
    expect(mine).toMatchObject({ format: 'form', status: 'submitted', response: { answers: { q1: 'The poet, speaking to us' } } });
    const rows = (await req('GET', `/teacher/classes/cls-eng-11ab/assignments/${id}/responses`, THOMAS)).body;
    expect(rows.responded).toBe(1);
    const list = (await req('GET', '/teacher/classes/cls-eng-11ab/assignments', THOMAS)).body.items.find((x: { id: string }) => x.id === id);
    expect(list).toMatchObject({ format: 'form', responses: 1 });
  });
});
