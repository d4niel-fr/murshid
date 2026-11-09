import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { readConfig, type AppEnv, type Config, type Deps } from './lib/context';
import { Api } from './lib/router';
import { createMemoryRepository } from './repo/memory';
import { seedRepository } from './repo/seed';
import type { Repository } from './repo/types';
import { registerStudents } from './routes/students';
import { registerGoals } from './routes/goals';
import { registerCourses } from './routes/courses';
import { registerAchievements, registerCalendar, registerTasks } from './routes/simple';
import { registerApplications, registerOpportunities } from './routes/opportunities';
import { registerAgent, registerConnections, registerCv, registerGuardian, registerPlanner } from './routes/misc';
import { demoView, registerV1 } from './v1/routes';
import { registerAdmin, requireAdmin } from './admin/routes';
import { registerSurvey, surveySinkFromEnv, type SurveySink } from './survey/routes';
import { seedDemoSchool } from './schools/demo-seed';
import { registerSchools } from './schools/routes';
import { registerAccounts, signedIn } from './schools/accounts';
import { SchoolStore } from './schools/store';
import { DemoStore } from './v1/store';
import { createChatEngine, type ChatEngine } from './v1/chat';
import { registerStudy } from './v1/study';
import { registerLive } from './v1/live';
import { registerSync } from './v1/sync';
import { HealthStore } from './health/store';
import { registerHealth } from './health/routes';
import { healthFromEnv } from './health/providers';
import type { ChatProvider } from '@murshid/agent-gateway';
import { concurrency, idempotency, limitsWith, rateLimit, requestId, timeout, type Limits } from './lib/middleware';
import { safeEqual, securityHeaders, trustFromEnv } from './lib/security';
import { turnstile } from './lib/turnstile';
import { BillingStore, registerBilling } from './billing/routes';
import { Stripe, stripeFromEnv } from './billing/stripe';
import { backendFromEnv, blobsFromEnv, Durable, type BlobStore, type StateBackend } from './lib/durable';
import { billingUnit, classroomUnit, demoUnit, healthUnit, lifeUnit, notifyUnit, repoUnit, schoolsUnit } from './lib/units';
import { NotificationHub, notifyFromEnv } from './notify/hub';
import { registerNotifications } from './notify/routes';
import { registerIntegrations } from './admin/integrations';

export interface CreateAppOptions {
  repo?: Repository;
  config?: Partial<Config>;
  now?: () => Date;
  /** shared store for the student API, the admin portal and Murshid's agents (default: fresh) */
  store?: DemoStore;
  /** tenancy + school state (licences, roster, teacher portal; default: fresh) */
  schools?: SchoolStore;
  /** model provider for the chat orchestrator (default: from env GATEWAY_MODE) */
  chatProvider?: ChatProvider;
  /** where survey responses go (default: Supabase when configured, else memory) */
  surveySink?: SurveySink;
  /** Single-plan subscriptions (default: fresh, in memory) */
  billing?: BillingStore;
  /** per-IP and per-person rate limits and lockouts; false turns them off (default: on, except under the test runner unless passed) */
  rateLimit?: Partial<Limits> | false;
  /** request timeout in ms for non-streaming routes (default 15 s) */
  timeoutMs?: number;
  /** where saved state lives (default: Supabase when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set, a folder with
   * STATE_DIR, else memory only). Passing one turns saving on even for a memory backend (tests: two "servers"). */
  stateBackend?: StateBackend;
  /** where uploaded file bytes go (default: Supabase Storage when configured, else memory) */
  blobs?: BlobStore;
  /** health and activity data (default: fresh) and the fetch used to call Fitbit, Strava and Oura (tests pass a fake) */
  health?: HealthStore;
  healthFetch?: (url: string, init?: RequestInit) => Promise<Response>;
  /** fill the demo school and demo students with example activity (default: on, except under the test runner) */
  demoExtras?: boolean;
  /** real payments (default: Stripe when STRIPE_SECRET_KEY is set; null = the demo checkout) */
  stripe?: Stripe | null;
}

export function buildApi(opts: CreateAppOptions = {}) {
  const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
  const deps: Deps = {
    repo: opts.repo ?? createMemoryRepository(),
    config: { ...readConfig(env), ...opts.config },
    now: opts.now ?? (() => new Date()),
  };
  const app = new Hono<AppEnv>();
  // The v1 web app runs on http://localhost:3000 (Next.js); Expo web on :8081. Extra origins: CORS_ORIGINS (comma-separated).
  const allowed = new Set([
    'http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001', 'http://localhost:8081',
    ...(env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  ]);
  app.use('*', cors({
    // only listed origins (the apps themselves are same-origin); anything else gets no CORS header at all
    origin: (origin) => (origin && allowed.has(origin) ? origin : null),
    allowHeaders: ['authorization', 'content-type', 'accept', 'last-event-id', 'x-dev-user', 'x-dev-user-id', 'x-dev-role', 'x-dev-email', 'x-dev-school-id', 'x-inbox-secret', 'x-admin-passcode', 'idempotency-key', 'x-request-id', 'x-live-host', 'x-child', 'cf-turnstile-response'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['x-request-id', 'retry-after', 'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset', 'idempotent-replayed'],
    maxAge: 600,
  }));
  // request ids first, so every later response (and error) can be traced
  app.use('*', requestId());
  // nosniff, no-referrer, a CSP that loads nothing, no framing, no caching of personal data; HSTS in production
  app.use('*', securityHeaders({ hsts: env.NODE_ENV === 'production' || env.VERCEL_ENV === 'production' }));
  const trust = trustFromEnv(env);
  const limitsOn = opts.rateLimit !== false && (opts.rateLimit !== undefined || (env.NODE_ENV !== 'test' && env.RATE_LIMIT !== 'off'));
  if (limitsOn) {
    const limits = limitsWith(opts.rateLimit || {});
    app.use('*', concurrency(Number(env.MAX_IN_FLIGHT) || limits.maxInFlight));
    app.use('*', rateLimit(limits, { trust, devHeaders: deps.config.authMode === 'dev' }));
  }
  // request bodies: 5 MB at most (a 3 MB file upload is ~4.2 MB of base64); bigger is a clear 413
  app.use('*', bodyLimit({ maxSize: 5 * 1024 * 1024, onError: (c) => c.json({ error: 'That upload is too big. Files can be up to 3 MB.', code: 'too_large', requestId: c.get('requestId') }, 413) }));
  // optional bot check on sign-up style forms (TURNSTILE_SECRET_KEY); after the rate limits, before any work
  if (env.TURNSTILE_SECRET_KEY?.trim()) app.use('*', turnstile(env.TURNSTILE_SECRET_KEY.trim(), trust));
  app.use('*', idempotency(undefined, undefined, undefined, trust));
  app.use('*', timeout(opts.timeoutMs ?? Number(env.REQUEST_TIMEOUT_MS ?? 15_000)));
  app.use('*', async (c, next) => { c.set('deps', deps); await next(); });
  // Public demo deployments: when ADMIN_PASSCODE is set, admin data (platform admin, school admin, survey results,
  // AI status) and the study buddy guardian/school switch need the passcode in x-admin-passcode, so random visitors
  // to the demo cannot read or change them. Students and teachers (synthetic personas) stay one-click.
  const adminPasscode = (env.ADMIN_PASSCODE ?? '').trim();
  if (adminPasscode) {
    app.use('*', async (c, next) => {
      if (c.req.method === 'OPTIONS') return next();
      const path = new URL(c.req.url).pathname;
      const adminish = c.req.header('x-dev-role') === 'admin' || c.req.header('x-dev-role') === 'counsellor'
        || path.startsWith('/admin') || path.startsWith('/licensing') || /^\/orgs\/[^/]+(\/|$)/.test(path)
        // study buddy switches (guardian and school): visitors to the public demo can see the buddy, not flip it
        || (c.req.method === 'PUT' && path === '/buddy/controls');
      if (adminish && !safeEqual(c.req.header('x-admin-passcode'), adminPasscode)) {
        return c.json({ error: 'admin passcode required', code: 'admin_passcode' }, 401);
      }
      return next();
    });
  }

  // one error shape everywhere: { error (plain words), code, details?, requestId }
  const CODES: Record<number, string> = { 400: 'bad_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 409: 'conflict', 413: 'too_large', 422: 'unprocessable', 429: 'rate_limited' };
  app.onError((err, c) => {
    const requestId = c.get('requestId');
    if (err instanceof HTTPException) {
      const cause = err.cause as { code?: string } | unknown[] | undefined;
      const code = cause && !Array.isArray(cause) && typeof cause === 'object' && 'code' in cause ? String(cause.code) : CODES[err.status] ?? 'error';
      return c.json({ error: err.message, code, ...(cause ? { details: cause } : {}), requestId }, err.status);
    }
    if (err instanceof SyntaxError) return c.json({ error: 'request body must be JSON', code: 'bad_request', requestId }, 400);
    console.error(`[${requestId}]`, err);
    return c.json({ error: 'Something went wrong on our side. Please try again.', code: 'internal', requestId }, 500);
  });
  // a known path with the wrong method is a 405 (with the methods it does take), not "route not found"
  let known: { method: string; re: RegExp }[] | null = null;
  app.notFound((c) => {
    known ??= api.routes.map((r) => ({ method: r.method.toUpperCase(), re: new RegExp(`^${r.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/:[A-Za-z]+/g, '[^/]+')}/?$`) }));
    const path = new URL(c.req.url).pathname;
    const allow = [...new Set(known.filter((r) => r.re.test(path)).map((r) => r.method))];
    if (allow.length && c.req.method !== 'OPTIONS') {
      c.header('Allow', allow.join(', '));
      return c.json({ error: `this route takes ${allow.join(' or ')}, not ${c.req.method}`, code: 'method_not_allowed', allow, requestId: c.get('requestId') }, 405);
    }
    return c.json({ error: 'route not found', code: 'not_found', requestId: c.get('requestId') }, 404);
  });

  const api = new Api(app);
  const store = opts.store ?? new DemoStore();
  const schools = opts.schools ?? new SchoolStore();
  const billing = opts.billing ?? new BillingStore();
  // production sign-in: who is asking, resolved from their account (dev mode keeps the demo headers)
  if (deps.config.authMode === 'jwt') deps.whoami = (c) => signedIn(c, schools, store);
  // saved state shared by every server copy (see lib/durable.ts)
  const backend = opts.stateBackend ?? backendFromEnv(env);
  const persistent = Boolean(opts.stateBackend) || backend.name !== 'memory';
  schools.classroom.blobs = opts.blobs ?? blobsFromEnv(env);
  const hub = new NotificationHub(notifyFromEnv(env), deps.now);
  const health = opts.health ?? new HealthStore();
  // example data in the demo (off under the test runner, where tests set up exactly what they check)
  const demoExtras = opts.demoExtras ?? env.NODE_ENV !== 'test';
  // what else we keep about a student: in "download my data", and erased with the account
  deps.personalData = [
    { name: 'health', export: (id) => { const p = health.people[id]; return p ? { connections: Object.values(p.conns).map((x) => ({ provider: x!.provider, connectedAt: x!.connectedAt, lastSync: x!.lastSync })), days: p.days, workouts: p.workouts } : null; }, forget: (id) => health.forget(id) },
    { name: 'checkIns', export: (id) => schools.roster.filter((r) => r.appId === id).flatMap((r) => schools.life.feelings[r.id] ?? []), forget: (id) => { for (const r of schools.roster) if (r.appId === id) delete schools.life.feelings[r.id]; } },
  ];
  deps.notify = hub;
  if (persistent) {
    const durable = new Durable(backend, [demoUnit(store), schoolsUnit(schools), classroomUnit(schools), lifeUnit(schools), healthUnit(health), billingUnit(billing), repoUnit(deps.repo), notifyUnit(hub)], { checkEveryMs: Number(env.STATE_CHECK_MS ?? 0) });
    api.durable = durable;
    api.ready = durable.init();
    // push and email go out only once the change that caused them is saved
    hub.later = (fn) => durable.afterCommit(fn);
  }
  const engine: ChatEngine = opts.chatProvider ? createChatEngine({}, opts.chatProvider) : createChatEngine(env);
  api.route({ method: 'get', path: '/health', tag: 'meta', summary: 'Health check (auth mode, chat engine)', auth: 'none' }, (c) =>
    c.json({ ok: true, auth_mode: deps.config.authMode, state: persistent ? backend.name : 'memory', files: schools.classroom.blobs.name, chat: { provider: engine.provider?.name ?? null, models: engine.provider ? engine.models : [], mode: engine.provider ? 'orchestrator+models' : 'orchestrator+rules', budget: engine.guard ? (({ used, dailyLimit, state }) => ({ used, dailyLimit, state }))(engine.guard.status()) : null } }));
  api.route({ method: 'get', path: '/admin/ai-status', tag: 'admin', auth: 'custom', summary: 'AI engine status: models vs rules, today\'s model requests vs the daily budget, demo replay cache' }, async (c) => {
    await requireAdmin(c);
    const g = engine.guard?.status() ?? null;
    return c.json({
      mode: !engine.provider ? 'rules_only' : g?.state === 'budget_reached' ? 'rules_budget' : g?.state === 'degraded' ? 'degraded' : 'live',
      provider: engine.provider?.name ?? null, models: engine.provider ? engine.models : [], guard: g,
      note: !engine.provider ? 'No model key configured: every reply uses the rule-based engine.'
        : 'Free OpenRouter models allow ~50 requests a day per key. ~US$10 of credit raises that to 1,000 a day (needs approval before buying).',
    });
  });
  registerStudents(api);
  registerGoals(api);
  registerCourses(api);
  registerTasks(api);
  registerCalendar(api);
  registerOpportunities(api);
  registerApplications(api);
  registerAchievements(api);
  registerCv(api);
  registerConnections(api);
  registerGuardian(api);
  registerPlanner(api);
  registerAgent(api);
  registerV1(api, store, engine);
  registerStudy(api, store, engine);
  registerLive(api, persistent ? backend : null);
  registerSync(api, persistent ? backend : null);
  registerHealth(api, health, { view: (c) => demoView(c, store), cfg: healthFromEnv(env, deps.config.authMode === 'dev'), fetch: opts.healthFetch, demo: demoExtras });
  registerNotifications(api, hub, schools, store, env);
  registerIntegrations(api, env, () => ({ state: persistent ? backend.name : 'memory', files: schools.classroom.blobs.name, chat: engine.provider?.name ?? null, authMode: deps.config.authMode }));
  registerAdmin(api, store, (id) => schools.licenceOf(id), (c) => demoView(c, store));
  const sch = registerSchools(api, schools, store, (c) => demoView(c, store));
  // the demo school looks lived-in (posted work, hand-ins, announcements, reports...); real schools start empty
  if (demoExtras) seedDemoSchool(schools, hub, deps.now(), sch.averages);
  registerAccounts(api, schools, store);
  registerSurvey(api, opts.surveySink ?? surveySinkFromEnv(env), deps.now);
  registerBilling(api, billing, deps.now, opts.stripe !== undefined ? opts.stripe : stripeFromEnv(env) ? new Stripe(stripeFromEnv(env)!) : null, {
    who: deps.whoami ? async (c) => (c.req.header('authorization') ? deps.whoami!(c) : null) : undefined,
    // a paid plan turns the buyer's family licence on; when it ends it goes back to the free trial
    onChange: (sub) => {
      const acc = schools.accounts.find((a) => (sub.reference && a.authUserId === sub.reference) || a.email.toLowerCase() === sub.email);
      const org = acc ? schools.org(acc.orgId) : undefined;
      if (!org?.licence || org.licence.type !== 'family') return;
      org.licence.status = sub.status === 'canceled' ? 'trial' : 'active';
      org.licence.note = sub.status === 'canceled' ? 'Plan ended' : sub.status === 'past_due' ? 'Payment failed: update the card' : `Single plan (${sub.billing})`;
      org.licence.endDate = sub.renewsAt.slice(0, 10);
    },
  });
  api.route({ method: 'get', path: '/openapi.json', tag: 'meta', summary: 'This OpenAPI document', auth: 'none' }, (c) => c.json(api.openapi()));

  return { app, api, deps, store, schools, billing, ready: api.ready };
}

export function createApp(opts: CreateAppOptions = {}) {
  return buildApi(opts).app;
}

/** App with a seeded in-memory repository (dev, demo, edge deploy without a DB). */
export async function createSeededApp(opts: Omit<CreateAppOptions, 'repo'> = {}) {
  const repo = createMemoryRepository();
  await seedRepository(repo, opts.now?.() ?? new Date());
  const built = buildApi({ ...opts, repo });
  await built.ready;
  return built;
}
