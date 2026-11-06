/**
 * v1 web endpoints (docs/V1-WEB-CONTRACT.md "API additions"), backed by synthetic demo students.
 *
 * Student selection: `x-dev-user: demo-g5|demo-g7|demo-g9|demo-g11` (also accepted in `x-dev-user-id`), default
 * demo-g11. In jwt auth mode a valid bearer token is required and the demo-g11 data is served until real data
 * is wired to these views.
 */
import type { OrchestratorEvent } from '@murshid/agent-gateway';
import { ACTIVITY_KINDS, PROFILE_LINK_KEYS, PROGRESS_RANGES, type DemoStudentId, type ProfileLinkKey } from '@murshid/core';
import { HTTPException } from 'hono/http-exception';
import { streamSSE } from 'hono/streaming';
import { z } from 'zod';
import { authMiddleware } from '../lib/auth';
import { badRequest, type Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { addDays } from '../lib/time';
import { AreaNotFound, buildChart, listAreas } from './charts';
import { createChatEngine, runChat, type ChatEngine } from './chat';
import { registerStudentExtras } from './student-routes';
import { buddyStatus, setBuddyControl } from './buddy';
import { activityLabel, dayDiff } from './data';
import * as S from './schemas';
import { DemoStore, type DemoView } from './store';
import { academics, activitySummaries, dashboard, opportunities, studentCard, tasks, upcoming } from './views';

export const DEFAULT_DEMO_STUDENT: DemoStudentId = 'demo-g11';

export async function demoView(c: Ctx, store: DemoStore): Promise<DemoView> {
  const { config, now } = c.get('deps');
  let id: string = DEFAULT_DEMO_STUDENT;
  if (config.authMode === 'dev') {
    const legacy = c.req.header('x-dev-user-id');
    id = c.req.header('x-dev-user') ?? (legacy?.startsWith('demo-') ? legacy : undefined) ?? DEFAULT_DEMO_STUDENT;
  } else if (c.get('deps').whoami) {
    const me = await c.get('deps').whoami!(c);
    if (me.role === 'student' && me.studentId) id = me.studentId;
    else if (me.role === 'parent') {
      // parents see their child's app (read only); x-child picks one when there are several
      const child = me.children.find((x) => x.id === c.req.header('x-child')) ?? me.children[0];
      if (!child) throw new HTTPException(403, { message: 'link your child first: ask them for the code in their settings', cause: { code: 'no_child' } });
      if (c.req.method !== 'GET') throw new HTTPException(403, { message: 'parents can see their child’s plan but not change it', cause: { code: 'parent_read_only' } });
      id = child.id;
    } else if (!me.role) throw new HTTPException(403, { message: 'finish setting up your account first', cause: { code: 'needs_setup' } });
    else throw new HTTPException(403, { message: 'this is the student app: teachers use the school portal', cause: { code: 'not_a_student' } });
  } else {
    await authMiddleware(c, async () => {});
  }
  if (!store.has(id)) {
    throw new HTTPException(404, { message: `unknown demo student "${id}"`, cause: { available: store.ids() } });
  }
  return store.view(id, now());
}

const areaNotFound = (e: AreaNotFound): never => {
  throw new HTTPException(404, { message: e.message, cause: { available: e.available } });
};

// ---------- profile links ----------
const LINK_RULES: Record<ProfileLinkKey, { hosts?: RegExp; handle?: (h: string) => string; minAge?: number; label: string }> = {
  linkedin: { hosts: /(^|\.)linkedin\.com$/, handle: (h) => `https://www.linkedin.com/in/${h}`, minAge: 16, label: 'LinkedIn' },
  github: { hosts: /(^|\.)github\.com$/, handle: (h) => `https://github.com/${h}`, label: 'GitHub' },
  instagram: { hosts: /(^|\.)instagram\.com$/, handle: (h) => `https://www.instagram.com/${h}`, minAge: 13, label: 'Instagram' },
  behance: { hosts: /(^|\.)behance\.net$/, handle: (h) => `https://www.behance.net/${h}`, label: 'Behance' },
  youtube: { hosts: /(^|\.)(youtube\.com|youtu\.be)$/, handle: (h) => `https://www.youtube.com/@${h}`, minAge: 13, label: 'YouTube' },
  portfolio: { label: 'Portfolio' },
  resumeUrl: { label: 'Résumé' },
  website: { label: 'Website' },
};

export function normalizeLink(key: ProfileLinkKey, raw: string, age: number): string {
  const rule = LINK_RULES[key];
  if (rule.minAge && age < rule.minAge) {
    throw new HTTPException(400, { message: `${rule.label} links are only available from age ${rule.minAge}`, cause: { field: key, code: 'age_restricted' } });
  }
  let s = raw.trim();
  const handle = /^@?([A-Za-z0-9_.-]{1,60})$/.exec(s);
  // "@sara", "sara-dev" or "sara.codes" on a social field is a handle, unless it is that site's own domain
  if (handle && rule.handle && rule.hosts && (s.startsWith('@') || !rule.hosts.test(s.toLowerCase()))) s = rule.handle(handle[1]!);
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  let url: URL;
  try {
    url = new URL(s);
  } catch {
    throw new HTTPException(400, { message: `${rule.label}: not a valid link`, cause: { field: key, code: 'invalid_url' } });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new HTTPException(400, { message: `${rule.label}: not a valid link`, cause: { field: key, code: 'invalid_url' } });
  if (rule.hosts && !rule.hosts.test(url.hostname.toLowerCase())) {
    throw new HTTPException(400, { message: `${rule.label}: expected a ${rule.label} link`, cause: { field: key, code: 'wrong_site' } });
  }
  if (!url.hostname.includes('.')) throw new HTTPException(400, { message: `${rule.label}: not a valid link`, cause: { field: key, code: 'invalid_url' } });
  url.protocol = 'https:';
  return url.toString().replace(/\/$/, '');
}

export function linkRestrictions(age: number) {
  return Object.fromEntries(PROFILE_LINK_KEYS.filter((k) => LINK_RULES[k].minAge && age < LINK_RULES[k].minAge!)
    .map((k) => [k, `available from age ${LINK_RULES[k].minAge}`]));
}

function chunks(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  for (let i = 0; i < words.length; i += 6) out.push(words.slice(i, i + 6).join(''));
  return out.filter(Boolean);
}

export function registerV1(api: Api, store: DemoStore = new DemoStore(), engine: ChatEngine = createChatEngine()) {

  api.route({
    method: 'get', path: '/demo/students', tag: 'v1', auth: 'none', response: S.DemoStudentList,
    summary: 'Synthetic demo students selectable with the x-dev-user header (dev only)',
  }, async (c) => {
    const now = c.get('deps').now();
    return c.json({
      default: DEFAULT_DEMO_STUDENT,
      items: store.ids().map((id) => studentCard(store.view(id, now))),
    });
  });

  api.route({
    method: 'get', path: '/dashboard', tag: 'v1', auth: 'custom', response: S.Dashboard,
    summary: 'Home dashboard: student, band, today, upcoming, progress (academics/extracurriculars/goals), streaks, highlights',
  }, async (c) => c.json(dashboard(await demoView(c, store))));

  api.route({
    method: 'get', path: '/progress', tag: 'v1', auth: 'custom', query: S.ProgressQuery, response: S.ChartSpec,
    summary: 'Progress chart (ChartSpec) for an area over a range',
    description: 'area: athletics | gym | hackathon | robotics | music | academics | extracurriculars | goals | <subject id> | <goal id>. ' +
      'Comma-separate several areas to get a comparison chart (e.g. area=athletics,gym). 404 lists the areas this student has.',
  }, async (c, { query }) => {
    const v = await demoView(c, store);
    try {
      return c.json(buildChart(v, query.area, query.range));
    } catch (e) {
      if (e instanceof AreaNotFound) return areaNotFound(e);
      throw e;
    }
  });

  api.route({
    method: 'get', path: '/progress/areas', tag: 'v1', auth: 'custom', response: S.AreaList,
    summary: 'Areas this student can chart with /progress',
  }, async (c) => c.json({ items: listAreas(await demoView(c, store)), ranges: PROGRESS_RANGES }));

  api.route({
    method: 'post', path: '/chat', tag: 'v1', auth: 'custom', durable: 'late', body: S.ChatInput, response: S.ChatResponse, successStatus: 200,
    summary: 'Chat with Murshid: an orchestrator routes to specialist sub-agents (academics, sports, opportunities, career/CV, planner, business, wellbeing)',
    description: 'JSON by default. With `Accept: text/event-stream` the reply streams as SSE events: ' +
      '`route` {agents, names, reason, router}, `agent-start` {agent, name, models}, `agent-tool` {agent, tool}, `agent-done` {agent, ms, fallback, model} ' +
      '(live, while the sub-agents work), then `meta` {intent, lang, threadId, generatedBy}, `text-delta` {delta}, `tool-call` {name, args}, `done` (full ChatResponse incl. `agents` trace). ' +
      'Accepts {message} or assistant-ui style {messages:[{role, content}]} (content may be a string or text parts). ' +
      'Quick lookups use the deterministic rule agent when no model is configured; every sub-agent falls back to rules if its models fail.',
  }, async (c, { body }) => {
    const v = await demoView(c, store);
    if (!(c.req.header('accept') ?? '').includes('text/event-stream')) return c.json(await runChat(engine, store, v, body), 200);
    return streamSSE(c, async (stream) => {
      let id = 0;
      const send = (event: string, data: unknown) => stream.writeSSE({ event, id: String(id++), data: JSON.stringify(data) });
      const onEvent = async (e: OrchestratorEvent) => {
        if (e.type === 'tool') await send('agent-tool', { agent: e.agent, tool: e.tool });
        else { const { type, ...rest } = e; await send(type, rest); }
      };
      let res;
      try {
        res = await runChat(engine, store, v, body, onEvent);
      } catch (err) {
        await send('error', { error: (err as Error).message });
        return;
      }
      await send('meta', { intent: res.intent, lang: res.lang, threadId: res.threadId, generatedBy: res.generatedBy });
      for (const delta of chunks(res.text)) await send('text-delta', { delta });
      for (const call of res.toolCalls) await send('tool-call', call);
      await send('done', res);
    });
  });

  api.route({
    method: 'get', path: '/buddy', tag: 'v1', auth: 'custom',
    summary: 'Study buddy mode: whether it is available for this student (school / guardian switches, under-13 default), band tone, turns today',
  }, async (c) => c.json(buddyStatus(store, await demoView(c, store))));

  api.route({
    method: 'put', path: '/buddy/controls', tag: 'v1', auth: 'custom', body: S.BuddyControlsIn,
    summary: 'Guardian or school switches study buddy mode on/off for a student (audit-logged). Guardian: x-dev-role: guardian. School: x-dev-role: admin. Both need the admin passcode (x-admin-passcode) when ADMIN_PASSCODE is set (public demo).',
  }, async (c, { body }) => {
    const v = await demoView(c, store);
    const { config } = c.get('deps');
    let role: string | undefined;
    let actor = 'unknown';
    if (config.authMode === 'dev' && !c.req.header('authorization')) {
      role = c.req.header('x-dev-role');
      actor = c.req.header('x-dev-user-id') ?? `dev-${role ?? 'anon'}`;
    } else {
      await authMiddleware(c, async () => {});
      const auth = c.get('auth');
      role = auth.role; actor = auth.userId;
    }
    const needed = body.by === 'school' ? ['admin', 'counsellor'] : ['guardian'];
    if (!role || !needed.includes(role)) throw new HTTPException(403, { message: body.by === 'school' ? 'school staff role required' : 'guardian role required' });
    return c.json(setBuddyControl(store, v, body.by, body.enabled, actor));
  });

  api.route({
    method: 'get', path: '/profile/links', tag: 'v1', auth: 'custom', response: S.ProfileLinksOut,
    summary: 'Social / portfolio links (with connectedAt per link and age-based restrictions)',
  }, async (c) => {
    const v = await demoView(c, store);
    return c.json({ ...store.getLinks(v.profile.id, v.now), restrictions: linkRestrictions(v.profile.age) });
  });

  api.route({
    method: 'put', path: '/profile/links', tag: 'v1', auth: 'custom', body: S.ProfileLinksIn, response: S.ProfileLinksOut,
    summary: 'Update links (partial; null clears). Handles like "@sara" are expanded; host is checked per site.',
  }, async (c, { body }) => {
    const v = await demoView(c, store);
    const cur = store.getLinks(v.profile.id, v.now);
    const at = c.get('deps').now().toISOString();
    for (const key of PROFILE_LINK_KEYS) {
      if (!(key in body)) continue;
      const raw = body[key];
      const next = raw === null || raw === undefined || raw.trim() === '' ? null : normalizeLink(key, raw, v.profile.age);
      if (next !== cur[key]) cur.connectedAt[key] = next ? at : null;
      cur[key] = next;
    }
    cur.updatedAt = at;
    return c.json({ ...store.setLinks(v.profile.id, cur, v.now), restrictions: linkRestrictions(v.profile.age) });
  });

  api.route({
    method: 'get', path: '/academics', tag: 'v1', auth: 'custom', response: S.Academics,
    summary: 'Subjects with current/target/trend and grades over time, graded + upcoming assessments, term chart',
  }, async (c) => c.json(academics(await demoView(c, store))));

  api.route({
    method: 'get', path: '/extracurriculars', tag: 'v1', auth: 'custom', query: S.ExtracurricularsQuery, response: S.Extracurriculars,
    summary: 'Activities (athletics, gym, hackathons, robotics, music) with logged sessions, hours and metrics',
  }, async (c, { query }) => {
    const v = await demoView(c, store);
    const activities = activitySummaries(v, query.limit);
    return c.json({
      student: studentCard(v),
      activities,
      available: ACTIVITY_KINDS.map((k) => ({ id: k, name: activityLabel(k), enrolled: activities.some((a) => a.id === k) })),
      totals: {
        thisWeekMinutes: activities.reduce((s, a) => s + a.totals.thisWeekMinutes, 0),
        last28dMinutes: activities.reduce((s, a) => s + a.totals.last28dMinutes, 0),
        yearHours: Math.round(activities.reduce((s, a) => s + a.totals.minutes, 0) / 6) / 10,
      },
    });
  });

  api.route({
    method: 'post', path: '/extracurriculars/:id/sessions', tag: 'v1', auth: 'custom', body: S.SessionCreate, response: S.SessionCreated,
    summary: 'Log a session (minutes + optional metrics) for one of the student\'s activities',
  }, async (c, { body }) => {
    const v = await demoView(c, store);
    const id = c.req.param('id')!;
    const def = v.profile.activities.find((a) => a.id === id);
    if (!def) {
      throw new HTTPException(404, { message: `activity "${id}" not found for this student`, cause: { available: v.profile.activities.map((a) => a.id) } });
    }
    const today = v.data.today;
    const date = body.date ?? today;
    if (date > addDays(today, 0)) badRequest('date cannot be in the future');
    if (dayDiff(date, today) > 365) badRequest('date must be within the last year');
    const allowed = new Set(def.metrics.map((m) => m.key));
    const unknown = Object.keys(body.metrics).filter((k) => !allowed.has(k));
    if (unknown.length) {
      throw new HTTPException(400, { message: `unknown metric(s): ${unknown.join(', ')}`, cause: { allowed: [...allowed] } });
    }
    const session = store.logSession(v.profile.id, { activityId: def.id, date, minutes: body.minutes, metrics: body.metrics, note: body.note ?? null }, v.now);
    const after = activitySummaries(store.view(v.profile.id, v.now)).find((a) => a.id === def.id)!;
    return c.json({ session, activity: after }, 201);
  });

  registerStudentExtras(api, store, (c) => demoView(c, store));
}
