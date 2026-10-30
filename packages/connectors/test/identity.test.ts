import { describe, expect, it } from 'vitest';
import { cleanUaePassName, UaePassProvider } from '../src/providers/uaepass';
import { approveDraft, LinkedInProvider, ugcPostBody } from '../src/providers/linkedin';
import { ApprovalRequiredError, ProductionNotAllowedError } from '../src/core/errors';
import { InMemoryTokenVault } from '../src/core/vault';
import { mockFetch, STUDENT, TEST_ENV } from './helpers/mockFetch';

describe('UAE PASS (staging)', () => {
  it('builds staging auth URL with docs parameters', async () => {
    const p = new UaePassProvider({ vault: new InMemoryTokenVault(), env: TEST_ENV });
    const u = new URL((await p.authUrl({ state: 'st' })).url);
    expect(u.origin + u.pathname).toBe('https://stg-id.uaepass.ae/idshub/authorize');
    expect(u.searchParams.get('scope')).toBe('urn:uae:digitalid:profile:general');
    expect(u.searchParams.get('acr_values')).toBe('urn:safelayer:tws:policies:authentication:level:low');
    expect(u.searchParams.get('response_type')).toBe('code');
    expect(p.status).toBe('sandbox_only');
    expect(p.approval.required.join(' ')).toMatch(/trade licence/i);
  });

  it('refuses production without explicit approval', () => {
    expect(() => new UaePassProvider({ vault: new InMemoryTokenVault(), env: { ...TEST_ENV, UAEPASS_ENV: 'production' } })).toThrow(ProductionNotAllowedError);
    expect(() => new UaePassProvider({ vault: new InMemoryTokenVault(), env: { ...TEST_ENV, UAEPASS_ENV: 'production', UAEPASS_PRODUCTION_APPROVED: 'true' } })).not.toThrow();
  });

  it('exchanges code with Basic auth, maps userinfo and drops Emirates ID', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch([
      { method: 'POST', match: (u) => u.href.startsWith('https://stg-id.uaepass.ae/idshub/token'), fixture: 'uaepass/token.json' },
      { method: 'GET', match: 'https://stg-id.uaepass.ae/idshub/userinfo', fixture: 'uaepass/userinfo.json' },
    ]);
    const p = new UaePassProvider({ vault, env: TEST_ENV, http: { fetch: f } });
    const { token_ref, profile } = await p.handleCallback({ code: 'bfe96299', state: 'st' });
    const tokenCall = f.calls[0]!;
    expect(tokenCall.headers.authorization).toBe('Basic ' + Buffer.from('test-uaepass-client:test-uaepass-secret').toString('base64'));
    expect(new URL(tokenCall.url).searchParams.get('grant_type')).toBe('authorization_code');
    expect(profile).toMatchObject({ provider: 'uaepass', subject: '7a05992e-3244-49d3-bcbc-7894c8fca25e', full_name: 'Aisha Test', email: 'aisha.test@example.com' });
    expect(profile.attributes).toEqual({ user_type: 'SOP3', nationality: 'ARE', gender: 'Female', verified: 'true' });
    expect(JSON.stringify(profile)).not.toContain('784000000000000');
    expect(JSON.stringify(profile)).not.toContain('971500000000');
    expect(token_ref).toMatch(/^vault:uaepass:/);
    expect(p.logoutUrl('https://murshid.test/')).toBe('https://stg-id.uaepass.ae/idshub/logout?redirect_uri=https%3A%2F%2Fmurshid.test%2F');
    expect(cleanUaePassName('Ram,,,,ABC,,')).toBe('Ram ABC');
  });
});

describe('LinkedIn', () => {
  const routes = () =>
    mockFetch([
      { method: 'POST', match: 'https://www.linkedin.com/oauth/v2/accessToken', fixture: 'linkedin/token.json' },
      { method: 'GET', match: 'https://api.linkedin.com/v2/userinfo', fixture: 'linkedin/userinfo.json' },
      { method: 'POST', match: 'https://api.linkedin.com/v2/ugcPosts', body: { id: 'urn:li:share:123' }, status: 201, headers: { 'x-restli-id': 'urn:li:share:123' } },
      { method: 'POST', match: 'https://www.linkedin.com/oauth/v2/revoke', body: {} },
    ]);

  it('OIDC sign-in maps profile and stores person URN', async () => {
    const vault = new InMemoryTokenVault();
    const p = new LinkedInProvider({ vault, env: TEST_ENV, http: { fetch: routes() } });
    const start = await p.authUrl({ state: 's' });
    const u = new URL(start.url);
    expect(u.searchParams.get('scope')).toBe('openid profile email w_member_social');
    expect(u.searchParams.get('nonce')).toBe(start.pending.nonce);
    const { token_ref, profile } = await p.handleCallback({ code: 'c', state: 's' });
    expect(profile).toMatchObject({ subject: '782bbtaQ', full_name: 'Rohan Test', email_verified: true });
    expect((await vault.get(token_ref)).meta?.person_urn).toBe('urn:li:person:782bbtaQ');
  });

  it('never posts without explicit, matching, fresh approval', async () => {
    const vault = new InMemoryTokenVault();
    const f = routes();
    const p = new LinkedInProvider({ vault, env: TEST_ENV, http: { fetch: f } });
    const { token_ref } = await p.handleCallback({ code: 'c', state: 's' });
    const draft = { text: 'Proud to share our robotics team placed 2nd at the UAE national finals!' };
    const now = new Date('2026-10-10T10:00:00Z');
    const ctx = { studentId: STUDENT, studentAge: 17, now };

    await expect(p.publishDraft(token_ref, draft, null, ctx)).rejects.toBeInstanceOf(ApprovalRequiredError);
    const approval = approveDraft(draft, STUDENT, now);
    await expect(p.publishDraft(token_ref, { text: draft.text + ' (edited)' }, approval, ctx)).rejects.toThrow(/changed/);
    await expect(p.publishDraft(token_ref, draft, approval, { ...ctx, now: new Date('2026-10-10T11:00:00Z') })).rejects.toThrow(/expired/);
    await expect(p.publishDraft(token_ref, draft, approveDraft(draft, 'someone-else', now), ctx)).rejects.toThrow(/student/);
    await expect(p.publishDraft(token_ref, draft, approval, { ...ctx, studentAge: 15 })).rejects.toThrow(/16\+/);
    expect(f.calls.some((c) => c.url.includes('ugcPosts'))).toBe(false);

    const res = await p.publishDraft(token_ref, draft, approval, ctx);
    expect(res.postUrn).toBe('urn:li:share:123');
    const post = f.calls.find((c) => c.url.includes('ugcPosts'))!;
    expect(post.headers['x-restli-protocol-version']).toBe('2.0.0');
    expect(JSON.parse(post.body!)).toEqual(ugcPostBody('urn:li:person:782bbtaQ', draft));

    await p.revoke(token_ref);
    await expect(vault.get(token_ref)).rejects.toThrow();
  });
});
