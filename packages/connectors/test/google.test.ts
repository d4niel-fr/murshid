import { describe, expect, it } from 'vitest';
import { classroomDue, GoogleClassroomConnector, normalizeAnnouncement } from '../src/providers/google/classroom';
import { GoogleCalendarConnector, googleTimeToIso } from '../src/providers/google/calendar';
import { InMemoryTokenVault } from '../src/core/vault';
import { mockFetch, STUDENT, TEST_ENV } from './helpers/mockFetch';

const CR = 'https://classroom.googleapis.com/v1';

function classroomRoutes() {
  return [
    { method: 'POST', match: 'https://oauth2.googleapis.com/token', fixture: 'google/token.json' },
    { match: (u: URL) => u.pathname === '/v1/courses' && !u.searchParams.has('pageToken'), fixture: 'google/courses-page1.json' },
    { match: (u: URL) => u.pathname === '/v1/courses' && u.searchParams.get('pageToken') === 'page2token', fixture: 'google/courses-page2.json' },
    { match: `${CR}/courses/601111111111/courseWork`, fixture: 'google/coursework-physics.json' },
    { match: `${CR}/courses/601111111111/courseWorkMaterials`, fixture: 'google/materials-physics.json' },
    { match: `${CR}/courses/601111111111/announcements`, fixture: 'google/announcements-physics.json' },
    { match: /602222222222/, fixture: 'google/empty.json' },
    { method: 'POST', match: 'https://oauth2.googleapis.com/revoke', body: {} },
  ];
}

describe('Google Classroom', () => {
  it('requests only read-only scopes with offline access', async () => {
    const c = new GoogleClassroomConnector({ vault: new InMemoryTokenVault(), env: TEST_ENV });
    const { url, pending } = await c.authUrl({ state: 'st' });
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    const scopes = u.searchParams.get('scope')!.split(' ');
    expect(scopes).toHaveLength(4);
    expect(scopes.every((s) => s.endsWith('.readonly'))).toBe(true);
    expect(u.searchParams.get('access_type')).toBe('offline');
    expect(pending.code_verifier).toBeTruthy();
  });

  it('callback -> vault ref -> paginated sync -> normalized rows -> revoke', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch(classroomRoutes());
    const c = new GoogleClassroomConnector({ vault, env: TEST_ENV, http: { fetch: f } });
    const grant = await c.handleCallback({ kind: 'oauth2', code: 'abc', state: 'st', pending: { code_verifier: 'v' } });
    expect(grant.token_ref).toMatch(/^vault:google_classroom:/);
    expect(grant.scopes).toHaveLength(4);

    const r = await c.sync({ studentId: STUDENT, tokenRef: grant.token_ref });
    expect(r.courses.map((x) => x.name)).toEqual(['Grade 11 Physics (11B)', 'Grade 11 English Literature']);
    const byId = Object.fromEntries(r.materials.map((m) => [m.external_id, m]));
    expect(byId['coursework:701']).toMatchObject({ kind: 'assignment', due_at: '2026-10-15T19:59:00.000Z', file_url: 'https://drive.google.com/file/d/d1/view', course_external_id: '601111111111' });
    expect(byId['coursework:702']).toMatchObject({ kind: 'exam', due_at: '2026-10-22T23:59:00.000Z' });
    expect(byId['material:801']).toMatchObject({ kind: 'note', file_url: 'https://example.edu/kinematics.pdf' });
    expect(byId['announcement:901']).toMatchObject({ kind: 'announcement', title: 'Reminder: bring calculators tomorrow.' });
    expect(r.tasks.map((t) => [t.title, t.kind])).toEqual([
      ['Lab Report 2: Projectile Motion', 'assignment'],
      ['Revise: Unit 3 Test - Kinematics', 'study'],
    ]);
    // auth header sent, studentId=me filter used
    const courseCall = f.calls.find((x) => x.url.includes('/v1/courses?'))!;
    expect(courseCall.headers.authorization).toBe('Bearer ya29.fixture-access');
    expect(new URL(courseCall.url).searchParams.get('studentId')).toBe('me');

    const rv = await c.revoke(grant.token_ref);
    expect(rv.providerRevoked).toBe(true);
    expect(vault.size()).toBe(0);
  });

  it('refreshes expired tokens before syncing', async () => {
    const vault = new InMemoryTokenVault();
    const ref = await vault.put('google_classroom', { access_token: 'old', refresh_token: 'R', expires_at: 1 });
    const f = mockFetch([{ method: 'POST', match: 'https://oauth2.googleapis.com/token', fixture: 'google/refresh.json' }, { match: /classroom/, fixture: 'google/empty.json' }]);
    const c = new GoogleClassroomConnector({ vault, env: TEST_ENV, http: { fetch: f } });
    await c.sync({ studentId: STUDENT, tokenRef: ref });
    expect((await vault.get(ref)).refresh_token).toBe('R');
    expect(f.calls[1]!.headers.authorization).toBe('Bearer ya29.fixture-access-2');
  });

  it('due date helpers', () => {
    expect(classroomDue({ year: 2026, month: 1, day: 5 }, { hours: 6 })).toBe('2026-01-05T06:00:00.000Z');
    expect(classroomDue(undefined)).toBeNull();
    expect(normalizeAnnouncement({ id: '1', courseId: 'c' }).title).toBe('Announcement');
  });
});

describe('Google Calendar', () => {
  it('syncs events (all-day in Dubai time, cancelled dropped) and creates study blocks', async () => {
    const vault = new InMemoryTokenVault();
    const ref = await vault.put('google_calendar', { access_token: 'tok' });
    const f = mockFetch([
      { method: 'GET', match: 'https://www.googleapis.com/calendar/v3/calendars/primary/events', fixture: 'google/calendar-events.json' },
      { method: 'POST', match: 'https://www.googleapis.com/calendar/v3/calendars/primary/events', fixture: 'google/calendar-created.json' },
    ]);
    const c = new GoogleCalendarConnector({ vault, env: TEST_ENV, http: { fetch: f } });
    const r = await c.sync({ studentId: STUDENT, tokenRef: ref, now: new Date('2026-10-10T00:00:00Z') });
    expect(r.events).toEqual([
      { student_id: STUDENT, title: 'Football practice', start_at: '2026-10-12T12:00:00.000Z', end_at: '2026-10-12T13:30:00.000Z', source: 'google_calendar', external_id: 'evt1' },
      { student_id: STUDENT, title: 'National Day holiday', start_at: '2026-12-01T20:00:00.000Z', end_at: '2026-12-02T20:00:00.000Z', source: 'google_calendar', external_id: 'evt2' },
    ]);
    const q = new URL(f.calls[0]!.url).searchParams;
    expect(q.get('singleEvents')).toBe('true');
    expect(q.get('timeMax')).toBe('2026-11-09T00:00:00.000Z');

    const ev = await c.createStudyBlock(ref, STUDENT, { title: 'Study: Physics Lab Report 2', start_at: '2026-10-13T12:00:00Z', end_at: '2026-10-13T13:00:00Z', taskId: 't1' });
    expect(ev.external_id).toBe('created123');
    const sent = JSON.parse(f.calls[1]!.body!);
    expect(sent.extendedProperties.private).toEqual({ murshid: 'study_block', murshid_task_id: 't1' });
    expect(googleTimeToIso({ date: '2026-01-01' }, 0)).toBe('2026-01-01T00:00:00.000Z');
  });
});
