/**
 * Live quiz rooms (like a class game show): a host starts a room from a deck, players join with a 6-digit code,
 * everyone answers the same question against the clock and sees the leaderboard after each one.
 * Rooms are short-lived (they end after two hours). With saved state (lib/durable.ts) each room is its own small
 * document, so a host and players reaching different servers see the same room; otherwise they live in memory.
 * The host proves it is the host with a secret key; players with the id they got when joining.
 */
import { randomBytes, randomInt } from 'node:crypto';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Api } from '../lib/router';
import { decode, encode, type StateBackend } from '../lib/durable';
import { safeEqual } from '../lib/security';

const MAX_ROOMS = 300; const MAX_PLAYERS = 80; const TTL = 2 * 3_600_000; const SECONDS = 20;

interface Q { prompt: string; options: string[]; answer: number }
interface Player { id: string; name: string; score: number; streak: number; answers: Record<number, { choice: number; ms: number; points: number }> }
interface Room {
  code: string; hostKey: string; title: string; questions: Q[]; createdAt: number; seconds: number;
  status: 'lobby' | 'question' | 'reveal' | 'done'; index: number; startedAt: number; players: Map<string, Player>;
  /** players the host removed: they cannot rejoin with the same id */
  removed: Set<string>;
}
const key = () => randomBytes(12).toString('base64url');

/** Rooms in memory, or one saved document per room (compare-and-swap, retried on a clash). */
class Rooms {
  private mem = new Map<string, Room>();
  private cache = new Map<string, { room: Room; version: number }>();
  constructor(private backend: StateBackend | null) {}
  private k(code: string) { return `live:${code}`; }
  count(now: number) { for (const [c, r] of this.mem) if (now - r.createdAt > TTL) this.mem.delete(c); return this.mem.size; }
  async get(code: string): Promise<{ room: Room; version: number } | null> {
    // codes are 6 digits: anything else is not a room (and never reaches storage)
    if (!/^\d{6}$/.test(code)) return null;
    if (!this.backend) { const r = this.mem.get(code); return r ? { room: r, version: 0 } : null; }
    const k = this.k(code);
    const v = (await this.backend.versions([k]))[k];
    if (!v) return null;
    const hit = this.cache.get(code);
    if (hit && hit.version === v) return hit;
    const s = (await this.backend.load([k]))[k];
    if (!s) return null;
    const fresh = { room: decode(s.data) as Room, version: s.version };
    this.cache.set(code, fresh);
    return fresh;
  }
  /** false when the code is taken */
  async create(r: Room): Promise<boolean> {
    if (!this.backend) { if (this.mem.has(r.code)) return false; this.mem.set(r.code, r); return true; }
    const res = await this.backend.save(this.k(r.code), encode(r), 0);
    if (res.ok) this.cache.set(r.code, { room: r, version: res.version });
    return res.ok;
  }
  /** Change a room and save it; re-run on fresh data if another server saved it first. */
  async update<T>(code: string, fn: (r: Room) => T): Promise<T> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const got = await this.get(code);
      if (!got || Date.now() - got.room.createdAt > TTL) throw new HTTPException(404, { message: 'no live quiz with that code (it may have ended)' });
      if (!this.backend) return fn(got.room);
      const room = structuredClone(got.room);
      const out = fn(room);
      const res = await this.backend.save(this.k(code), encode(room), got.version);
      if (res.ok) { this.cache.set(code, { room, version: res.version }); return out; }
      this.cache.delete(code);
    }
    throw new HTTPException(503, { message: 'the quiz is busy, try again' });
  }
}

const Create = z.object({
  title: z.string().trim().min(1).max(120),
  questions: z.array(z.object({ prompt: z.string().trim().min(1).max(300), options: z.array(z.string().trim().min(1).max(200)).min(2).max(4), answer: z.number().int().min(0).max(3) })).min(1).max(40),
  /** time per question, in seconds */
  seconds: z.number().int().min(5).max(120).default(SECONDS),
}).refine((b) => b.questions.every((q) => q.answer < q.options.length), 'answer must point at an option');
const Join = z.object({ name: z.string().trim().min(1, 'add your name').max(24) });
const Answer = z.object({ player: z.string().min(1).max(40), choice: z.number().int().min(0).max(3) });
const Host = z.object({ hostKey: z.string().min(1).max(40) });
const Remove = Host.extend({ name: z.string().trim().min(1).max(24) });


/** Past the clock, a question moves to the answer on its own (no host action needed). */
function tick(r: Room, now: number) {
  if (r.status === 'question' && now - r.startedAt > r.seconds * 1000) r.status = 'reveal';
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
    code: r.code, title: r.title, status: r.status, index: r.index, total: r.questions.length, seconds: r.seconds,
    remainingMs: r.status === 'question' ? Math.max(0, r.seconds * 1000 - (now - r.startedAt)) : 0,
    question: showing && q ? { prompt: q.prompt, options: q.options, ...(r.status === 'reveal' ? { answer: q.answer, counts } : {}) } : null,
    players: r.players.size, answered,
    leaderboard: r.status === 'question' && !who.host ? null : board(r).slice(0, who.host ? 20 : 5),
    ...(who.player ? { me: { name: who.player.name, score: who.player.score, rank: board(r).findIndex((b) => b.name === who.player!.name) + 1, answer: mine ? { choice: mine.choice, points: mine.points, correct: r.status === 'question' ? undefined : mine.choice === q?.answer } : null } } : {}),
    ...(who.host ? { lobby: [...r.players.values()].map((p) => p.name) } : {}),
  };
}

export function registerLive(api: Api, backend: StateBackend | null = null) {
  const rooms = new Rooms(backend);
  const find = async (code: string): Promise<Room> => {
    const got = await rooms.get(code);
    if (!got || Date.now() - got.room.createdAt > TTL) throw new HTTPException(404, { message: 'no live quiz with that code (it may have ended)' });
    return got.room;
  };
  api.route({ method: 'post', path: '/live/rooms', tag: 'live', auth: 'none', durable: 'none', body: Create, summary: 'Host a live quiz from questions (returns the join code and the host key)' }, async (c, { body }) => {
    const now = Date.now();
    if (!backend && rooms.count(now) >= MAX_ROOMS) throw new HTTPException(503, { message: 'too many live quizzes right now, try again in a few minutes' });
    const b = body as z.output<typeof Create>;
    let r: Room | null = null;
    for (let i = 0; i < 8 && !r; i++) {
      const code = String(randomInt(100000, 1000000));
      const room: Room = { code, hostKey: key(), title: b.title, questions: b.questions, seconds: b.seconds, createdAt: now, status: 'lobby', index: 0, startedAt: 0, players: new Map(), removed: new Set() };
      if (await rooms.create(room)) r = room;
    }
    if (!r) throw new HTTPException(503, { message: 'could not open a room, try again' });
    return c.json({ code: r.code, hostKey: r.hostKey, state: view(r, now, { host: true }) }, 201);
  });
  api.route({ method: 'post', path: '/live/rooms/:code/join', tag: 'live', auth: 'none', durable: 'none', body: Join, summary: 'Join a live quiz with its code' }, async (c, { body }) => {
    const name = (body as z.output<typeof Join>).name.replace(/\s+/g, ' ');
    const out = await rooms.update(c.req.param('code') ?? '', (r) => {
      if (r.status === 'done') throw new HTTPException(409, { message: 'this quiz has finished' });
      if (r.players.size >= MAX_PLAYERS) throw new HTTPException(409, { message: 'this quiz is full' });
      if ([...r.players.values()].some((p) => p.name.toLowerCase() === name.toLowerCase())) throw new HTTPException(409, { message: 'someone already has that name here, add an initial' });
      const p: Player = { id: key(), name, score: 0, streak: 0, answers: {} };
      r.players.set(p.id, p);
      return { player: p.id, state: view(r, Date.now(), { player: p }) };
    });
    return c.json(out, 201);
  });
  api.route({ method: 'get', path: '/live/rooms/:code', tag: 'live', auth: 'none', summary: 'Live quiz state (pass ?player= or ?host= for your own view)' }, async (c) => {
    const r = await find(c.req.param('code') ?? '');
    const host = safeEqual(c.req.header('x-live-host') ?? c.req.query('host'), r.hostKey); const id = c.req.query('player') ?? '';
    if (r.removed.has(id)) throw new HTTPException(410, { message: 'the host removed you from this quiz' });
    return c.json(view(r, Date.now(), { host, player: r.players.get(id) }));
  });
  const asHost = (r: Room, hostKey: string, what: string) => { if (!safeEqual(hostKey, r.hostKey)) throw new HTTPException(403, { message: `only the host can ${what}` }); };
  api.route({ method: 'post', path: '/live/rooms/:code/next', tag: 'live', auth: 'none', durable: 'none', body: Host, summary: 'Host: start the quiz, show the answer, or go to the next question' }, async (c, { body }) => {
    const b = body as z.output<typeof Host>;
    return c.json(await rooms.update(c.req.param('code') ?? '', (r) => {
      const now = Date.now();
      asHost(r, b.hostKey, 'move the quiz on');
      tick(r, now);
      if (r.status === 'lobby') { r.status = 'question'; r.index = 0; r.startedAt = now; }
      else if (r.status === 'question') r.status = 'reveal';
      else if (r.status === 'reveal') { if (r.index + 1 >= r.questions.length) r.status = 'done'; else { r.index += 1; r.status = 'question'; r.startedAt = now; } }
      return view(r, now, { host: true });
    }));
  });
  api.route({ method: 'post', path: '/live/rooms/:code/remove', tag: 'live', auth: 'none', durable: 'none', body: Remove, summary: 'Host: remove a player (for a name that should not be on the board)' }, async (c, { body }) => {
    const b = body as z.output<typeof Remove>;
    return c.json(await rooms.update(c.req.param('code') ?? '', (r) => {
      asHost(r, b.hostKey, 'remove players');
      const p = [...r.players.values()].find((x) => x.name.toLowerCase() === b.name.toLowerCase());
      if (p) { r.players.delete(p.id); r.removed.add(p.id); }
      return view(r, Date.now(), { host: true });
    }));
  });
  api.route({ method: 'post', path: '/live/rooms/:code/end', tag: 'live', auth: 'none', durable: 'none', body: Host, summary: 'Host: end the quiz now and show the final board' }, async (c, { body }) => {
    const b = body as z.output<typeof Host>;
    return c.json(await rooms.update(c.req.param('code') ?? '', (r) => {
      asHost(r, b.hostKey, 'end the quiz');
      r.status = 'done';
      return view(r, Date.now(), { host: true });
    }));
  });
  api.route({ method: 'post', path: '/live/rooms/:code/answer', tag: 'live', auth: 'none', durable: 'none', body: Answer, summary: 'Player: answer the current question (faster right answers score more)' }, async (c, { body }) => {
    const b = body as z.output<typeof Answer>;
    return c.json(await rooms.update(c.req.param('code') ?? '', (r) => {
      const now = Date.now();
      if (r.removed.has(b.player)) throw new HTTPException(410, { message: 'the host removed you from this quiz' });
      const p = r.players.get(b.player); if (!p) throw new HTTPException(403, { message: 'join the quiz first' });
      tick(r, now);
      if (r.status !== 'question') throw new HTTPException(409, { message: 'this question is closed' });
      if (r.index in p.answers) return view(r, now, { player: p });
      const q = r.questions[r.index]!; const ms = now - r.startedAt; const right = b.choice === q.answer;
      p.streak = right ? p.streak + 1 : 0;
      const points = right ? Math.round(500 + 500 * Math.max(0, 1 - ms / (r.seconds * 1000))) + (p.streak >= 3 ? 100 : 0) : 0;
      p.answers[r.index] = { choice: b.choice, ms, points }; p.score += points;
      return view(r, now, { player: p });
    }));
  });
}
