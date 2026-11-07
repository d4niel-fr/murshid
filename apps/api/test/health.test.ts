import { afterEach, describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { HealthStore, unseal } from '../src/health/store';
import { pull, sportOf } from '../src/health/providers';
import { NOW } from './helpers';

const ME = { 'x-dev-user': 'demo-g11' };
const json = (x: unknown, status = 200) => new Response(JSON.stringify(x), { status, headers: { 'content-type': 'application/json' } });

/** A pretend Fitbit / Strava: records every call. */
function fakeServices() {
  const calls: { url: string; init?: RequestInit }[] = [];
  let tokenN = 0;
  const f = async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    if (url === 'https://api.fitbit.com/oauth2/token') { tokenN++; return json({ access_token: `fb-access-${tokenN}`, refresh_token: `fb-refresh-${tokenN}`, expires_in: tokenN === 1 ? -100 : 28800, user_id: 'ABC123', scope: 'activity sleep' }); }
    if (url.startsWith('https://api.fitbit.com/1/user/-/activities/steps/')) return json({ 'activities-steps': [{ dateTime: '2026-10-10', value: '9100' }, { dateTime: '2026-10-11', value: '4200' }] });
    if (url.startsWith('https://api.fitbit.com/1/user/-/activities/minutesVeryActive/')) return json({ 'activities-minutesVeryActive': [{ dateTime: '2026-10-10', value: '40' }] });
    if (url.startsWith('https://api.fitbit.com/1/user/-/activities/minutesFairlyActive/')) return json({ 'activities-minutesFairlyActive': [{ dateTime: '2026-10-10', value: '25' }] });
    if (url.startsWith('https://api.fitbit.com/1.2/user/-/sleep/')) return json({ sleep: [{ dateOfSleep: '2026-10-11', minutesAsleep: 470, isMainSleep: true }, { dateOfSleep: '2026-10-11', minutesAsleep: 30, isMainSleep: false }] });
    if (url.startsWith('https://api.fitbit.com/1/user/-/activities/list.json')) return json({ activities: [{ logId: 77, activityName: 'Soccer', startTime: '2026-10-10T16:00:00.000+04:00', duration: 3_600_000, calories: 500 }] });
    if (url === 'https://api.fitbit.com/oauth2/revoke') return json({});
    if (url === 'https://www.strava.com/oauth/token') return json({ access_token: 'st-a', refresh_token: 'st-r', expires_at: Math.floor(Date.now() / 1000) + 3600, athlete: { id: 9 } });
    return json({ message: 'not found' }, 404);
  };
  return { f, calls };
}

async function setup(env: Record<string, string> = {}) {
  for (const [k, v] of Object.entries(env)) process.env[k] = v;
  const svc = fakeServices();
  const health = new HealthStore();
  const built = await createSeededApp({ now: () => NOW, config: { authMode: 'dev', jwtSecret: '' }, health, healthFetch: svc.f });
  const req = async (method: string, path: string, headers: Record<string, string> = {}, body?: unknown) => {
    const res = await built.app.request(path, { method, redirect: 'manual', headers: { ...headers, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
    const text = await res.text(); let parsed: any = null; try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
    return { status: res.status, body: parsed, location: res.headers.get('location') };
  };
  return { req, health, svc, built };
}
const KEYS = ['FITBIT_CLIENT_ID', 'FITBIT_CLIENT_SECRET', 'STRAVA_CLIENT_ID', 'STRAVA_CLIENT_SECRET', 'HEALTH_TOKEN_KEY', 'PUBLIC_WEB_URL'];
afterEach(() => { for (const k of KEYS) delete process.env[k]; });

describe('health and activity', () => {
  it('lists every source; in the demo, connecting fills a believable fortnight; disconnecting removes it', async () => {
    const { req } = await setup();
    const first = await req('GET', '/me/health', ME);
    expect(first.status).toBe(200);
    expect(first.body.providers.map((p: any) => p.id)).toEqual(expect.arrayContaining(['apple', 'fitbit', 'strava', 'garmin', 'huawei', 'samsung', 'google', 'oura', 'polar']));
    expect(first.body.days).toHaveLength(14);
    expect(first.body.goals.activeMinutes).toBe(60);
    const c = await req('POST', '/me/health/fitbit/connect', ME);
    expect(c.body).toMatchObject({ connected: true, simulated: true });
    const after = await req('GET', '/me/health', ME);
    expect(after.body.summary.steps).toBeGreaterThan(3000);
    expect(after.body.workouts.length).toBeGreaterThan(2);
    expect(after.body.providers.find((p: any) => p.id === 'fitbit')).toMatchObject({ connected: true, demo: true });
    // a service that has no web sign-in cannot be "connected"
    expect((await req('POST', '/me/health/garmin/connect', ME)).body.code).toBe('not_oauth');
    expect((await req('DELETE', '/me/health/fitbit', ME)).status).toBe(200);
    const gone = await req('GET', '/me/health', ME);
    expect(gone.body.workouts).toEqual([]);
    expect(gone.body.summary.steps).toBeNull();
  });

  it('connects Fitbit for real: PKCE, encrypted tokens, refresh when expired, revoke on disconnect', async () => {
    const { req, health, svc } = await setup({ FITBIT_CLIENT_ID: 'fid', FITBIT_CLIENT_SECRET: 'fsecret', HEALTH_TOKEN_KEY: 'k'.repeat(40), PUBLIC_WEB_URL: 'https://murshid.test' });
    const start = await req('POST', '/me/health/fitbit/connect', ME);
    const url = new URL(start.body.url);
    expect(url.origin).toBe('https://www.fitbit.com');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe('https://murshid.test/api/health/callback/fitbit');
    const state = url.searchParams.get('state')!;
    // a made-up state goes nowhere
    expect((await req('GET', '/health/callback/fitbit?code=x&state=forged')).location).toBe('https://murshid.test/app/health?error=expired');
    const back = await req('GET', `/health/callback/fitbit?code=good-code&state=${state}`);
    expect(back.status).toBe(302);
    expect(back.location).toBe('https://murshid.test/app/health?connected=fitbit');
    const tokenCall = svc.calls.find((x) => x.url === 'https://api.fitbit.com/oauth2/token')!;
    expect(String(tokenCall.init!.body)).toContain('code_verifier=');
    expect((tokenCall.init!.headers as Record<string, string>).authorization).toBe(`Basic ${Buffer.from('fid:fsecret').toString('base64')}`);
    // the state works once
    expect((await req('GET', `/health/callback/fitbit?code=good-code&state=${state}`)).location).toContain('error=expired');
    const conn = health.people['demo-g11']!.conns.fitbit!;
    expect(conn.sealed).not.toContain('fb-access');
    const got = await req('GET', '/me/health', ME);
    expect(conn.error, conn.error ?? '').toBeNull();
    const day = got.body.days.find((d: any) => d.date === '2026-10-10');
    expect(day).toMatchObject({ steps: 9100, activeMinutes: 65 });
    expect(got.body.days.find((d: any) => d.date === '2026-10-11').sleepMinutes).toBe(470);
    expect(got.body.workouts[0]).toMatchObject({ sport: 'football', title: 'Soccer', minutes: 60, source: 'fitbit' });
    // the first token had already expired: the pull refreshed it and saved the new one
    expect(unseal(conn.sealed!, 'k'.repeat(40)).access).toBe('fb-access-2');
    expect((await req('DELETE', '/me/health/fitbit', ME)).status).toBe(200);
    expect(svc.calls.some((x) => x.url === 'https://api.fitbit.com/oauth2/revoke')).toBe(true);
  });

  it('refuses Strava without activity access, and real connections need their keys', async () => {
    const { req } = await setup({ STRAVA_CLIENT_ID: 'sid', STRAVA_CLIENT_SECRET: 'ss', HEALTH_TOKEN_KEY: 'k'.repeat(40), PUBLIC_WEB_URL: 'https://murshid.test' });
    const state = new URL((await req('POST', '/me/health/strava/connect', ME)).body.url).searchParams.get('state');
    expect((await req('GET', `/health/callback/strava?code=c&state=${state}&scope=read`)).location).toBe('https://murshid.test/app/health?error=scope&provider=strava');
  });

  it('Apple Health: a private Shortcut link that only works until it is replaced', async () => {
    const { req } = await setup();
    const made = await req('POST', '/me/health/apple/shortcut', ME);
    expect(made.status).toBe(201);
    const path = new URL(made.body.url).pathname.replace(/^\/api/, '');
    const sent = await req('POST', path, {}, { steps: 8123, activeMinutes: 72, workouts: [{ sport: 'HKWorkoutActivityTypeSwimming', start: '2026-11-06T13:00:00Z', minutes: 40 }] });
    expect(sent.status).toBe(200);
    const got = await req('GET', '/me/health', ME);
    expect(got.body.days.at(-1)).toMatchObject({ steps: 8123, activeMinutes: 72 });
    expect(got.body.workouts[0].sport).toBe('swimming');
    expect(got.body.shortcut.lastUsed).not.toBeNull();
    expect((await req('POST', '/health/ingest/not-a-real-link-at-all-1234', {}, { steps: 1 })).status).toBe(401);
    await req('POST', '/me/health/apple/shortcut', ME);
    expect((await req('POST', path, {}, { steps: 1 })).status).toBe(401);
  });

  it('imports workouts and days from files once (a second import adds nothing new)', async () => {
    const { req } = await setup();
    const body = { source: 'garmin', days: [{ date: '2026-11-04', steps: 7000 }], workouts: [{ id: 'g1', sport: 'running', title: 'Evening run', start: '2026-11-04T15:00:00Z', minutes: 32, distanceKm: 5.1 }] };
    expect((await req('POST', '/me/health/import', ME, body)).status).toBe(200);
    await req('POST', '/me/health/import', ME, body);
    const got = await req('GET', '/me/health', ME);
    expect(got.body.workouts.filter((w: any) => w.title === 'Evening run')).toHaveLength(1);
    expect(got.body.providers.find((p: any) => p.id === 'garmin').connected).toBe(true);
    expect((await req('POST', '/me/health/import', ME, { source: 'garmin', days: [], workouts: [] })).status).toBe(400);
    expect((await req('POST', '/me/health/import', ME, { source: 'garmin', days: [{ date: '2026-11-04', steps: -5 }] })).status).toBe(400);
  });

  it('is erased with the account and included in the data download', async () => {
    const { req, built, health } = await setup();
    await req('POST', '/me/health/fitbit/connect', ME);
    const hook = built.deps.personalData!.find((d) => d.name === 'health')!;
    expect(hook.export('demo-g11')).toMatchObject({ connections: [expect.objectContaining({ provider: 'fitbit' })] });
    hook.forget('demo-g11');
    expect(health.people['demo-g11']).toBeUndefined();
  });

  it('names sports the same way whichever service sent them', () => {
    expect(['Run', 'Soccer', 'Ride', 'WeightTraining', 'HKWorkoutActivityTypeSwimming', 'Yoga'].map(sportOf)).toEqual(['running', 'football', 'cycling', 'gym', 'swimming', 'yoga']);
  });

  it('reads Oura and Strava the documented way', async () => {
    const f = async (url: string) => {
      if (url.includes('daily_activity')) return json({ data: [{ day: '2026-11-05', steps: 11000, high_activity_time: 1800, medium_activity_time: 1500 }] });
      if (url.includes('/usercollection/sleep')) return json({ data: [{ day: '2026-11-06', type: 'long_sleep', total_sleep_duration: 30000 }] });
      if (url.includes('/usercollection/workout')) return json({ data: [{ id: 'w1', activity: 'cycling', start_datetime: '2026-11-05T15:00:00+04:00', end_datetime: '2026-11-05T15:45:00+04:00', distance: 15000 }] });
      if (url.includes('strava.com/api/v3/athlete/activities')) return json([{ id: 5, name: 'Lunch Run', sport_type: 'Run', start_date: '2026-11-05T08:00:00Z', start_date_local: '2026-11-05T12:00:00Z', moving_time: 1800, elapsed_time: 2000, distance: 5000 }]);
      return json({}, 404);
    };
    const oura = await pull('oura', 't', 7, NOW, f);
    expect(oura.days['2026-11-05']).toMatchObject({ steps: 11000, activeMinutes: 55 });
    expect(oura.days['2026-11-06']!.sleepMinutes).toBe(500);
    expect(oura.workouts[0]).toMatchObject({ sport: 'cycling', minutes: 45, distanceKm: 15 });
    const strava = await pull('strava', 't', 7, NOW, f);
    expect(strava.workouts[0]).toMatchObject({ sport: 'running', minutes: 30, distanceKm: 5 });
    expect(strava.days['2026-11-05']!.activeMinutes).toBe(30);
  });
});
