/**
 * Live quiz rooms (like a class game show): a host starts a room from a deck, players join with a 6-digit code,
 * everyone answers the same question against the clock and sees the leaderboard after each one.
 * In memory: rooms are short-lived (they end after two hours) and capped, so nothing piles up.
 * The host proves it is the host with a secret key; players with the id they got when joining.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Api } from '../lib/router';

const MAX_ROOMS = 300; const MAX_PLAYERS = 80; const TTL = 2 * 3_600_000; const SECONDS = 20;

interface Q { prompt: string; options: string[]; answer: number }
interface Player { id: string; name: string; score: number; streak: number; answers: Record<number, { choice: number; ms: number; points: number }> }
interface Room {
  code: string; hostKey: string; title: string; questions: Q[]; createdAt: number;
  status: 'lobby' | 'question' | 'reveal' | 'done'; index: number; startedAt: number; players: Map<string, Player>;
}
const rooms = new Map<string, Room>();
const tidy = (now: number) => { for (const [k, r] of rooms) if (now - r.createdAt > TTL) rooms.delete(k); };
const key = () => randomBytes(12).toString('base64url');

const Create = z.object({
  title: z.string().trim().min(1).max(120),
  questions: z.array(z.object({ prompt: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(200)).min(2).max(4), answer: z.number().int().min(0).max(3) })).min(1).max(40),
}).refine((b) => b.questions.every((q) => q.answer < q.options.length), 'answer must point at an option');
const Join = z.object({ name: z.string().trim().min(1, 'add your name').max(24) });
const Answer = z.object({ player: z.string().min(1).max(40), choice: z.number().int().min(0).max(3) });
const Host = z.object({ hostKey: z.string().min(1).max(40) });

function find(code: string): Room {
  const r = rooms.get(code);
  if (!r) throw new HTTPException(404, { message: 'no live quiz with that code (it may have ended)' });
  return r;
}
/** Past the clock, a question moves to the answer on its own (no host action needed). */
function tick(r: Room, now: number) {
  if (r.status === 'question' && now - r.startedAt > SECONDS * 1000) r.status = 'reveal';
  if (r.status === 'question' && r.players.size && [...r.players.values()].every((p) => r.index in p.answers)) r.status = 'reveal';
}
function board(r: Room) {
  return [...r.players.values()].sort((a, b) => b.score - a.score).map((p, i) => ({ rank: i + 1, name: p.name, score: p.score }));
}
function view(r: Room, now: number, who: { host?: boolean; player?: Player }) {
  tick(r, now);
  const q = r.questions[r.index];
  const showing = r.status === 'question' || r.status === 'reveal';
  const answered = q ? [...r.players.values()].filter((p) => r.index in p.answers).length : 0;
  const counts = q && r.status !== 'question' ? q.options.map((_, i) => [...r.players.values()].filter((p) => p.answers[r.index]?.choice === i).length) : null;
  const mine = who.player?.answers[r.index];
  return {
    code: r.code, title: r.title, status: r.status, index: r.index, total: r.questions.length, seconds: SECONDS,
    remainingMs: r.status === 'question' ? Math.max(0, SECONDS * 1000 - (now - r.startedAt)) : 0,
    question: showing && q ? { prompt: q.prompt, options: q.options, ...(r.status === 'reveal' ? { answer: q.answer, counts } : {}) } : null,
    players: r.players.size, answered,
    leaderboard: r.status === 'question' && !who.host ? null : board(r).slice(0, who.host ? 20 : 5),
    ...(who.player ? { me: { name: who.player.name, score: who.player.score, rank: board(r).findIndex((b) => b.name === who.player!.name) + 1, answer: mine ? { choice: mine.choice, points: mine.points, correct: r.status === 'question' ? undefined : mine.choice === q?.answer } : null } } : {}),
    ...(who.host ? { lobby: [...r.players.values()].map((p) => p.name) } : {}),
  };
}

export function registerLive(api: Api) {
  api.route({ method: 'post', path: '/live/rooms', tag: 'live', auth: 'none', body: Create, summary: 'Host a live quiz from questions (returns the join code and the host key)' }, async (c, { body }) => {
    const now = Date.now(); tidy(now);
    if (rooms.size >= MAX_ROOMS) throw new HTTPException(503, { message: 'too many live quizzes right now, try again in a few minutes' });
    let code = ''; do code = String(randomInt(100000, 1000000)); while (rooms.has(code));
    const b = body as z.output<typeof Create>;
    const r: Room = { code, hostKey: key(), title: b.title, questions: b.questions, createdAt: now, status: 'lobby', index: 0, startedAt: 0, players: new Map() };
    rooms.set(code, r);
    return c.json({ code, hostKey: r.hostKey, state: view(r, now, { host: true }) }, 201);
  });
  api.route({ method: 'post', path: '/live/rooms/:code/join', tag: 'live', auth: 'none', body: Join, summary: 'Join a live quiz with its code' }, async (c, { body }) => {
    const r = find(c.req.param('code') ?? ''); const name = (body as z.output<typeof Join>).name.replace(/\s+/g, ' ');
    if (r.status === 'done') throw new HTTPException(409, { message: 'this quiz has finished' });
    if (r.players.size >= MAX_PLAYERS) throw new HTTPException(409, { message: 'this quiz is full' });
    if ([...r.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new HTTPException(409, { message: 'someone already has that name here, add an initial' });
    const p: Player = { id: key(), name, score: 0, streak: 0, answers: {} };
    r.players.set(p.id, p);
    return c.json({ player: p.id, state: view(r, Date.now(), { player: p }) }, 201);
  });
  api.route({ method: 'get', path: '/live/rooms/:code', tag: 'live', auth: 'none', summary: 'Live quiz state (pass ?player= or ?host= for your own view)' }, async (c) => {
    const r = find(c.req.param('code') ?? '');
    const host = c.req.query('host') === r.hostKey; const player = r.players.get(c.req.query('player') ?? '');
    return c.json(view(r, Date.now(), { host, player }));
  });
  api.route({ method: 'post', path: '/live/rooms/:code/next', tag: 'live', auth: 'none', body: Host, summary: 'Host: start the quiz, show the answer, or go to the next question' }, async (c, { body }) => {
    const r = find(c.req.param('code') ?? ''); const now = Date.now();
    if ((body as z.output<typeof Host>).hostKey !== r.hostKey) throw new HTTPException(403, { message: 'only the host can move the quiz on' });
    tick(r, now);
    if (r.status === 'lobby') { r.status = 'question'; r.index = 0; r.startedAt = now; }
    else if (r.status === 'question') r.status = 'reveal';
    else if (r.status === 'reveal') { if (r.index + 1 >= r.questions.length) r.status = 'done'; else { r.index += 1; r.status = 'question'; r.startedAt = now; } }
    return c.json(view(r, now, { host: true }));
  });
  api.route({ method: 'post', path: '/live/rooms/:code/answer', tag: 'live', auth: 'none', body: Answer, summary: 'Player: answer the current question (faster right answers score more)' }, async (c, { body }) => {
    const r = find(c.req.param('code') ?? ''); const now = Date.now(); const b = body as z.output<typeof Answer>;
    const p = r.players.get(b.player); if (!p) throw new HTTPException(403, { message: 'join the quiz first' });
    tick(r, now);
    if (r.status !== 'question') throw new HTTPException(409, { message: 'this question is closed' });
    if (r.index in p.answers) return c.json(view(r, now, { player: p }));
    const q = r.questions[r.index]!; const ms = now - r.startedAt; const right = b.choice === q.answer;
    p.streak = right ? p.streak + 1 : 0;
    const points = right ? Math.round(500 + 500 * Math.max(0, 1 - ms / (SECONDS * 1000))) + (p.streak >= 3 ? 100 : 0) : 0;
    p.answers[r.index] = { choice: b.choice, ms, points }; p.score += points;
    return c.json(view(r, now, { player: p }));
  });
}
