import { describe, expect, it } from 'vitest';
import { MicrosoftConnector, microsoftAdminConsentUrl, MS_EDU_SCOPES } from '../src/providers/microsoft/graph';
import { InMemoryTokenVault } from '../src/core/vault';
import { mockFetch, STUDENT, TEST_ENV } from './helpers/mockFetch';

const G = 'https://graph.microsoft.com/v1.0';

describe('Microsoft Teams for Education + Outlook', () => {
  it('flags admin consent and builds tenant URLs', async () => {
    const c = new MicrosoftConnector({ vault: new InMemoryTokenVault(), env: TEST_ENV });
    expect(c.approval.schoolAdminApproval).toBe(true);
    expect(c.approval.required.join(' ')).toMatch(/ADMIN CONSENT/i);
    const u = new URL((await c.authUrl({ state: 's' })).url);
    expect(u.pathname).toBe('/organizations/oauth2/v2.0/authorize');
    expect(u.searchParams.get('scope')).toContain('EduAssignments.ReadBasic');
    expect(u.searchParams.get('scope')).toContain('offline_access');
    const admin = new URL(microsoftAdminConsentUrl(TEST_ENV, 'school-tenant-id', 'x'));
    expect(admin.pathname).toBe('/school-tenant-id/v2.0/adminconsent');
    expect(admin.searchParams.get('scope')).toContain(`https://graph.microsoft.com/${MS_EDU_SCOPES[0]}`);
  });

  it('syncs classes, paginated assignments and calendarView', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch([
      { method: 'POST', match: 'https://login.microsoftonline.com/organizations/oauth2/v2.0/token', fixture: 'microsoft/token.json' },
      { match: `${G}/education/me/classes`, fixture: 'microsoft/classes.json' },
      { match: (u) => u.pathname === '/v1.0/education/me/assignments' && !u.searchParams.has('$skiptoken'), fixture: 'microsoft/assignments-page1.json' },
      { match: (u) => u.pathname === '/v1.0/education/me/assignments' && u.searchParams.get('$skiptoken') === 'ABC', fixture: 'microsoft/assignments-page2.json' },
      { match: (u) => u.pathname === '/v1.0/me/calendarView', fixture: 'microsoft/calendar-view.json' },
    ]);
    const c = new MicrosoftConnector({ vault, env: TEST_ENV, http: { fetch: f } });
    const grant = await c.handleCallback({ kind: 'oauth2', code: 'c', state: 's' });
    const r = await c.sync({ studentId: STUDENT, tokenRef: grant.token_ref, now: new Date('2026-10-10T00:00:00Z') });

    expect(r.courses).toEqual([{ student_id: STUDENT, name: 'Grade 11 Chemistry', teacher: null, source: 'teams', external_id: '72a7baec-c3e9-4213-a850-f62de0adad5f' }]);
    expect(r.materials.map((m) => [m.title, m.kind, m.due_at])).toEqual([
      ['Titration practical write-up', 'assignment', '2026-10-16T19:59:00.000Z'],
      ['Organic chemistry quiz', 'exam', '2026-10-20T05:00:00.000Z'],
    ]);
    expect(r.materials[1]!.body_text).toBe('Chapter 10 only');
    expect(r.events).toEqual([{ student_id: STUDENT, title: 'Parent-teacher meeting', start_at: '2026-10-14T10:00:00.000Z', end_at: '2026-10-14T10:30:00.000Z', source: 'outlook', external_id: 'AAMk-1' }]);
    expect(r.tasks).toHaveLength(2);
    const cal = f.calls.find((x) => x.url.includes('calendarView'))!;
    expect(cal.headers.prefer).toBe('outlook.timezone="UTC"');

    const rv = await c.revoke(grant.token_ref);
    expect(rv.providerRevoked).toBe(false);
    expect(rv.note).toMatch(/myapps/);
  });
});
