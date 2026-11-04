import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';

const J = { 'content-type': 'application/json' };
describe('live quiz rooms', () => {
  it('runs a quiz: join, answer, reveal, leaderboard, finish', async () => {
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const post = async (path: string, body: unknown) => { const r = await app.request(path, { method: 'POST', headers: J, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
    const get = async (path: string) => (await (await app.request(path)).json()) as any;
    const made = await post('/live/rooms', { title: 'Forces', questions: [{ prompt: 'p = ?', options: ['mv', 'ma', 'mg'], answer: 0 }, { prompt: 'F = ?', options: ['mv', 'ma'], answer: 1 }] });
    expect(made.status).toBe(201);
    const { code, hostKey } = made.body;
    expect(code).toMatch(/^\d{6}$/);
    const a = await post(`/live/rooms/${code}/join`, { name: 'Aisha' });
    const k = await post(`/live/rooms/${code}/join`, { name: 'Krish' });
    expect((await post(`/live/rooms/${code}/join`, { name: 'aisha' })).status).toBe(409);
    expect((await get(`/live/rooms/${code}?host=${hostKey}`)).lobby).toEqual(['Aisha', 'Krish']);
    expect((await post(`/live/rooms/${code}/next`, { hostKey: 'nope' })).status).toBe(403);
    const q1 = await post(`/live/rooms/${code}/next`, { hostKey });
    expect(q1.body).toMatchObject({ status: 'question', index: 0 });
    expect(q1.body.question.answer).toBeUndefined(); // the answer stays hidden while it is open
    await post(`/live/rooms/${code}/answer`, { player: a.body.player, choice: 0 });
    const last = await post(`/live/rooms/${code}/answer`, { player: k.body.player, choice: 2 });
    // everyone answered: it reveals on its own
    expect(last.body.status).toBe('reveal');
    expect(last.body.question).toMatchObject({ answer: 0, counts: [1, 0, 1] });
    expect(last.body.me).toMatchObject({ score: 0, answer: { correct: false } });
    const st = await get(`/live/rooms/${code}?player=${a.body.player}`);
    expect(st.me.score).toBeGreaterThan(900);
    expect(st.leaderboard[0]).toMatchObject({ rank: 1, name: 'Aisha' });
    await post(`/live/rooms/${code}/next`, { hostKey });
    const done = await post(`/live/rooms/${code}/next`, { hostKey });
    expect(done.body.status).toBe('reveal');
    expect((await post(`/live/rooms/${code}/next`, { hostKey })).body.status).toBe('done');
    expect((await post(`/live/rooms/${code}/answer`, { player: a.body.player, choice: 1 })).status).toBe(409);
    expect((await app.request('/live/rooms/000000')).status).toBe(404);
  });

  it('sets the time per question, removes players and ends early', async () => {
    const { app } = await createSeededApp({ config: { authMode: 'dev', jwtSecret: '' } });
    const post = async (path: string, body: unknown) => { const r = await app.request(path, { method: 'POST', headers: J, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() as any }; };
    const questions = [{ prompt: 'p = ?', options: ['mv', 'ma'], answer: 0 }];
    expect((await post('/live/rooms', { title: 'Forces', questions })).body.state.seconds).toBe(20);
    expect((await post('/live/rooms', { title: 'Forces', questions, seconds: 2 })).status).toBe(400);
    const made = await post('/live/rooms', { title: 'Forces', questions, seconds: 10 });
    const { code, hostKey } = made.body;
    expect(made.body.state.seconds).toBe(10);
    const rude = await post(`/live/rooms/${code}/join`, { name: 'Rude name' });
    await post(`/live/rooms/${code}/join`, { name: 'Aisha' });
    expect((await post(`/live/rooms/${code}/remove`, { hostKey: 'nope', name: 'Rude name' })).status).toBe(403);
    const after = await post(`/live/rooms/${code}/remove`, { hostKey, name: 'rude NAME' });
    expect(after.body.lobby).toEqual(['Aisha']);
    expect((await app.request(`/live/rooms/${code}?player=${rude.body.player}`)).status).toBe(410);
    const q = await post(`/live/rooms/${code}/next`, { hostKey });
    expect(q.body.remainingMs).toBeLessThanOrEqual(10_000);
    expect((await post(`/live/rooms/${code}/answer`, { player: rude.body.player, choice: 0 })).status).toBe(410);
    expect((await post(`/live/rooms/${code}/end`, { hostKey })).body.status).toBe('done');
  });
});
