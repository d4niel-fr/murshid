/**
 * Health and fitness sources a student can connect, and how each one works:
 *
 *   oauth       Fitbit, Strava, Oura: the student signs in to the service and approves Murshid (OAuth 2.0; Fitbit with
 *               PKCE). Murshid keeps the tokens encrypted and pulls steps, active minutes, sleep and workouts.
 *   shortcut    Apple Health: Apple only lets apps on the iPhone read Health, so an iPhone Shortcut sends each day's
 *               numbers to a private link; the Health export file can also be uploaded (it is read on the device).
 *   via-strava  Garmin, Huawei Health, Samsung Health, Polar, COROS: none of them offer an open web connection for an
 *               app like Murshid, but all of them can share workouts to Strava (and export GPX/TCX files).
 *   file        Google Fit / Health Connect: Google is closing the Fit web API; Google Takeout files can be uploaded.
 *
 * Every number here is the student's own and is never shown to teachers or parents.
 */
import { createHash, randomBytes } from 'node:crypto';

export type ProviderId = 'fitbit' | 'strava' | 'oura' | 'apple' | 'garmin' | 'huawei' | 'samsung' | 'polar' | 'coros' | 'google';
export type OAuthId = 'fitbit' | 'strava' | 'oura';
export type Metric = 'steps' | 'active' | 'sleep' | 'workouts';
export interface ProviderInfo { id: ProviderId; name: string; how: 'oauth' | 'shortcut' | 'via-strava' | 'file'; metrics: Metric[]; files?: string[] }

export const PROVIDERS: ProviderInfo[] = [
  { id: 'apple', name: 'Apple Health', how: 'shortcut', metrics: ['steps', 'active', 'sleep', 'workouts'], files: ['Health export (export.zip or export.xml)'] },
  { id: 'fitbit', name: 'Fitbit', how: 'oauth', metrics: ['steps', 'active', 'sleep', 'workouts'] },
  { id: 'strava', name: 'Strava', how: 'oauth', metrics: ['active', 'workouts'] },
  { id: 'garmin', name: 'Garmin Connect', how: 'via-strava', metrics: ['active', 'workouts'], files: ['GPX, TCX or CSV from Garmin Connect'] },
  { id: 'huawei', name: 'Huawei Health', how: 'via-strava', metrics: ['active', 'workouts'], files: ['GPX or TCX workouts'] },
  { id: 'samsung', name: 'Samsung Health', how: 'via-strava', metrics: ['active', 'workouts'], files: ['CSV from “Download personal data”'] },
  { id: 'google', name: 'Google Fit / Health Connect', how: 'file', metrics: ['steps', 'active', 'workouts'], files: ['Google Takeout “Fit” daily metrics CSV'] },
  { id: 'oura', name: 'Oura', how: 'oauth', metrics: ['steps', 'active', 'sleep', 'workouts'] },
  { id: 'polar', name: 'Polar Flow', how: 'via-strava', metrics: ['active', 'workouts'], files: ['GPX, TCX or CSV from Polar Flow'] },
  { id: 'coros', name: 'COROS', how: 'via-strava', metrics: ['active', 'workouts'], files: ['GPX or TCX workouts'] },
];
export const PROVIDER_IDS = PROVIDERS.map((p) => p.id) as [ProviderId, ...ProviderId[]];
export const OAUTH_IDS: OAuthId[] = ['fitbit', 'strava', 'oura'];

export interface DayData { steps?: number; activeMinutes?: number; sleepMinutes?: number }
export interface WorkoutData { externalId: string; sport: string; title: string; start: string; minutes: number; distanceKm: number | null; calories: number | null }
export interface Pulled { days: Record<string, DayData>; workouts: WorkoutData[] }
export interface Tokens { access: string; refresh: string | null; expiresAt: number; account: string | null; scope: string | null }

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;
export interface OAuthConfig { clientId: string; clientSecret: string }
export interface HealthConfig { apiUrl: string; webUrl: string; tokenKey: string | null; oauth: Partial<Record<OAuthId, OAuthConfig>> }

export function healthFromEnv(env: Record<string, string | undefined>, dev: boolean): HealthConfig {
  const get = (k: string) => env[k]?.trim() || '';
  const pair = (id: string): OAuthConfig | undefined => (get(`${id}_CLIENT_ID`) && get(`${id}_CLIENT_SECRET`) ? { clientId: get(`${id}_CLIENT_ID`), clientSecret: get(`${id}_CLIENT_SECRET`) } : undefined);
  const web = (get('PUBLIC_WEB_URL') || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/+$/, '');
  return {
    apiUrl: (get('PUBLIC_API_URL') || `${web}/api`).replace(/\/+$/, ''), webUrl: web,
    // tokens are encrypted with this key; the demo uses a fixed key so it works without setup
    tokenKey: get('HEALTH_TOKEN_KEY') || (dev ? 'murshid-demo-health-key' : null),
    oauth: { fitbit: pair('FITBIT'), strava: pair('STRAVA'), oura: pair('OURA') },
  };
}

export const redirectUri = (cfg: HealthConfig, id: OAuthId) => `${cfg.apiUrl}/health/callback/${id}`;
const b64url = (b: Buffer) => b.toString('base64url');
export function pkce() { const verifier = b64url(randomBytes(48)); return { verifier, challenge: b64url(createHash('sha256').update(verifier).digest()) }; }

/** Where to send the student to approve Murshid. */
export function authorizeUrl(cfg: HealthConfig, id: OAuthId, state: string, challenge: string): string {
  const c = cfg.oauth[id]!;
  const redirect = redirectUri(cfg, id);
  if (id === 'fitbit') return `https://www.fitbit.com/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: redirect, scope: 'activity sleep', code_challenge: challenge, code_challenge_method: 'S256', state })}`;
  if (id === 'strava') return `https://www.strava.com/oauth/authorize?${new URLSearchParams({ client_id: c.clientId, redirect_uri: redirect, response_type: 'code', approval_prompt: 'auto', scope: 'read,activity:read', state })}`;
  return `https://cloud.ouraring.com/oauth/authorize?${new URLSearchParams({ response_type: 'code', client_id: c.clientId, redirect_uri: redirect, scope: 'daily workout', state })}`;
}

const form = (o: Record<string, string>) => new URLSearchParams(o).toString();
async function json(res: Response, what: string): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${what} failed (${res.status}${j?.errors?.[0]?.message ? `: ${String(j.errors[0].message).slice(0, 120)}` : j?.message ? `: ${String(j.message).slice(0, 120)}` : ''})`);
  return j;
}

/** Swap the code from the callback (or a refresh token) for tokens. */
export async function exchange(cfg: HealthConfig, id: OAuthId, grant: { code: string; verifier?: string } | { refresh: string }, f: FetchLike = fetch, now = Date.now()): Promise<Tokens> {
  const c = cfg.oauth[id]!;
  const body: Record<string, string> = 'code' in grant
    ? { grant_type: 'authorization_code', code: grant.code, redirect_uri: redirectUri(cfg, id), client_id: c.clientId, ...(grant.verifier && id === 'fitbit' ? { code_verifier: grant.verifier } : {}) }
    : { grant_type: 'refresh_token', refresh_token: grant.refresh, client_id: c.clientId };
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' };
  if (id === 'fitbit') headers.authorization = `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`;
  else body.client_secret = c.clientSecret;
  const url = id === 'fitbit' ? 'https://api.fitbit.com/oauth2/token' : id === 'strava' ? 'https://www.strava.com/oauth/token' : 'https://api.ouraring.com/oauth/token';
  const j = await json(await f(url, { method: 'POST', headers, body: form(body) }), `${id} sign-in`);
  if (!j.access_token) throw new Error(`${id} sign-in returned no token`);
  const expiresAt = typeof j.expires_at === 'number' ? j.expires_at * 1000 : now + (Number(j.expires_in) || 3600) * 1000;
  return { access: j.access_token, refresh: j.refresh_token ?? null, expiresAt, account: j.user_id ?? (j.athlete?.id ? String(j.athlete.id) : null), scope: j.scope ?? null };
}

/** Tell the service to forget Murshid's access (best effort: the tokens are deleted here either way). */
export async function revoke(cfg: HealthConfig, id: OAuthId, t: Tokens, f: FetchLike = fetch) {
  const c = cfg.oauth[id]; if (!c) return;
  if (id === 'fitbit') await f('https://api.fitbit.com/oauth2/revoke', { method: 'POST', headers: { authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64')}`, 'content-type': 'application/x-www-form-urlencoded' }, body: form({ token: t.refresh ?? t.access }) });
  else if (id === 'strava') await f('https://www.strava.com/oauth/deauthorize', { method: 'POST', headers: { authorization: `Bearer ${t.access}` } });
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : undefined; };

/** Pull the last `days` days. Dates are the service's own calendar days (the student's local days). */
export async function pull(id: OAuthId, access: string, days: number, today: Date, f: FetchLike = fetch): Promise<Pulled> {
  const auth = { headers: { authorization: `Bearer ${access}`, accept: 'application/json' } };
  const end = ymd(today); const start = ymd(new Date(today.getTime() - (days - 1) * 86_400_000));
  const out: Pulled = { days: {}, workouts: [] };
  const day = (d: string) => (out.days[d] ??= {});
  if (id === 'fitbit') {
    const series = async (res: string) => ((await json(await f(`https://api.fitbit.com/1/user/-/activities/${res}/date/${end}/${days}d.json`, auth), 'Fitbit'))[`activities-${res}`] ?? []) as { dateTime: string; value: string }[];
    const [steps, very, fairly] = await Promise.all([series('steps'), series('minutesVeryActive'), series('minutesFairlyActive')]);
    for (const s of steps) { const n = num(s.value); if (n) day(s.dateTime).steps = Math.round(n); }
    for (const list of [very, fairly]) for (const s of list) { const n = num(s.value); if (n) day(s.dateTime).activeMinutes = (day(s.dateTime).activeMinutes ?? 0) + Math.round(n); }
    const sleep = (await json(await f(`https://api.fitbit.com/1.2/user/-/sleep/date/${start}/${end}.json`, auth), 'Fitbit sleep')).sleep ?? [];
    for (const s of sleep as { dateOfSleep: string; minutesAsleep: number; isMainSleep: boolean }[]) if (s.isMainSleep && num(s.minutesAsleep)) day(s.dateOfSleep).sleepMinutes = Math.round(s.minutesAsleep);
    const acts = (await json(await f(`https://api.fitbit.com/1/user/-/activities/list.json?afterDate=${start}&sort=asc&offset=0&limit=100`, auth), 'Fitbit workouts')).activities ?? [];
    for (const a of acts as { logId: number; activityName: string; startTime: string; duration: number; distance?: number; distanceUnit?: string; calories?: number }[]) {
      out.workouts.push({ externalId: String(a.logId), sport: sportOf(a.activityName), title: a.activityName, start: new Date(a.startTime).toISOString(), minutes: Math.round((a.duration ?? 0) / 60_000), distanceKm: a.distance && (!a.distanceUnit || /kilo/i.test(a.distanceUnit)) ? Math.round(a.distance * 100) / 100 : null, calories: num(a.calories) ?? null });
    }
  } else if (id === 'strava') {
    const after = Math.floor((today.getTime() - days * 86_400_000) / 1000);
    const acts = await json(await f(`https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100&page=1`, auth), 'Strava');
    for (const a of acts as { id: number; name: string; sport_type?: string; type?: string; start_date: string; start_date_local?: string; moving_time: number; elapsed_time: number; distance: number; calories?: number }[]) {
      const minutes = Math.round((a.moving_time || a.elapsed_time || 0) / 60);
      out.workouts.push({ externalId: String(a.id), sport: sportOf(a.sport_type ?? a.type ?? ''), title: a.name, start: a.start_date, minutes, distanceKm: a.distance ? Math.round(a.distance / 10) / 100 : null, calories: num(a.calories) ?? null });
      // Strava has no step count: workout time counts as active time on the day it happened
      const d = (a.start_date_local ?? a.start_date).slice(0, 10); day(d).activeMinutes = (day(d).activeMinutes ?? 0) + minutes;
    }
  } else {
    const q = `start_date=${start}&end_date=${end}`;
    const [act, sleep, work] = await Promise.all([
      json(await f(`https://api.ouraring.com/v2/usercollection/daily_activity?${q}`, auth), 'Oura'),
      json(await f(`https://api.ouraring.com/v2/usercollection/sleep?${q}`, auth), 'Oura sleep'),
      json(await f(`https://api.ouraring.com/v2/usercollection/workout?${q}`, auth), 'Oura workouts'),
    ]);
    for (const a of (act.data ?? []) as { day: string; steps?: number; high_activity_time?: number; medium_activity_time?: number }[]) {
      day(a.day).steps = num(a.steps); day(a.day).activeMinutes = Math.round(((num(a.high_activity_time) ?? 0) + (num(a.medium_activity_time) ?? 0)) / 60);
    }
    for (const s of (sleep.data ?? []) as { day: string; type?: string; total_sleep_duration?: number }[]) if ((s.type ?? 'long_sleep') === 'long_sleep' && num(s.total_sleep_duration)) day(s.day).sleepMinutes = Math.round(s.total_sleep_duration! / 60);
    for (const w of (work.data ?? []) as { id: string; activity: string; start_datetime: string; end_datetime: string; distance?: number; calories?: number }[]) {
      out.workouts.push({ externalId: w.id, sport: sportOf(w.activity), title: w.activity.replace(/[_-]/g, ' ').replace(/^\w/, (c) => c.toUpperCase()), start: new Date(w.start_datetime).toISOString(), minutes: Math.round((Date.parse(w.end_datetime) - Date.parse(w.start_datetime)) / 60_000), distanceKm: w.distance ? Math.round(w.distance / 10) / 100 : null, calories: num(w.calories) ?? null });
    }
  }
  out.workouts = out.workouts.filter((w) => w.minutes > 0 && w.minutes < 24 * 60 && !Number.isNaN(Date.parse(w.start)));
  return out;
}

/** One word for the kind of exercise, from whatever the service calls it. */
export function sportOf(name: string): string {
  const n = name.toLowerCase();
  const pairs: [RegExp, string][] = [
    [/run|jog/, 'running'], [/walk|hike|step/, 'walking'], [/ride|cycl|bik/, 'cycling'], [/swim/, 'swimming'], [/soccer|football/, 'football'],
    [/basket/, 'basketball'], [/tennis|padel|squash|badminton/, 'racket'], [/yoga|pilates|stretch/, 'yoga'], [/weight|strength|gym|crossfit|hiit|workout|training/, 'gym'],
    [/row/, 'rowing'], [/martial|karate|taekwondo|judo|box/, 'martial arts'], [/danc/, 'dance'], [/climb/, 'climbing'], [/cricket/, 'cricket'],
  ];
  return pairs.find(([re]) => re.test(n))?.[1] ?? 'other';
}

/** A believable fortnight for the demo (fixed per student and service), so the page can be tried without keys. */
export function simulated(id: ProviderId, who: string, today: Date, days = 21): Pulled {
  let s = 0; for (const ch of `${who}|${id}`) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
  const r = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 10_000) / 10_000; };
  const out: Pulled = { days: {}, workouts: [] };
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86_400_000); const date = ymd(d); const wd = d.getUTCDay();
    const training = wd === 2 || wd === 4 || wd === 6;
    const steps = Math.round(5200 + r() * 6500 + (training ? 2500 : 0));
    const active = Math.round(18 + r() * 35 + (training ? 45 : 0));
    out.days[date] = id === 'strava' ? (training ? { activeMinutes: 50 + Math.round(r() * 30) } : {}) : { steps, activeMinutes: active, ...(id !== 'oura' && id !== 'fitbit' && id !== 'apple' ? {} : { sleepMinutes: Math.round(400 + r() * 140 - (wd === 0 ? 30 : 0)) }) };
    if (training) {
      const sport = wd === 6 ? 'running' : 'football';
      out.workouts.push({ externalId: `sim-${date}`, sport, title: sport === 'running' ? 'Morning run' : 'Football training', start: `${date}T${sport === 'running' ? '03:30' : '13:00'}:00.000Z`, minutes: sport === 'running' ? 30 + Math.round(r() * 15) : 75, distanceKm: sport === 'running' ? Math.round((4 + r() * 3) * 10) / 10 : null, calories: null });
    }
  }
  return out;
}
