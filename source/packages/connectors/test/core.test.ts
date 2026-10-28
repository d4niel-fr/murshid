import { describe, expect, it } from 'vitest';
import { EncryptedTokenVault, InMemoryKeyValueStore, InMemoryTokenVault } from '../src/core/vault';
import { buildAuthorizeUrl, createPkce, exchangeCode, refreshTokens } from '../src/core/oauth2';
import { guardedSync, MemoryAuditSink } from '../src/core/guard';
import { ConsentRequiredError } from '../src/core/errors';
import { httpRequest, redact } from '../src/core/http';
import { mockFetch, STUDENT } from './helpers/mockFetch';
import type { Connector } from '../src/core/connector';
import { emptySyncResult } from '../src/core/types';
import { randomBytes, createHash } from 'node:crypto';

describe('token vault', () => {
  it('returns opaque refs, never the token', async () => {
    const v = new InMemoryTokenVault();
    const ref = await v.put('google_classroom', { access_token: 'secret' });
    expect(ref).toMatch(/^vault:google_classroom:[0-9a-f-]{36}$/);
    expect(ref).not.toContain('secret');
    expect((await v.get(ref)).access_token).toBe('secret');
    await v.delete(ref);
    await expect(v.get(ref)).rejects.toThrow();
  });

  it('encrypted vault stores only ciphertext', async () => {
    const kv = new InMemoryKeyValueStore();
    const v = new EncryptedTokenVault(kv, randomBytes(32).toString('base64'));
    const ref = await v.put('microsoft', { access_token: 'super-secret-token', refresh_token: 'r' });
    const stored = [...kv.data.values()][0]!;
    expect(stored).not.toContain('super-secret-token');
    expect((await v.get(ref)).refresh_token).toBe('r');
  });

  it('rejects bad keys', () => {
    expect(() => new EncryptedTokenVault(new InMemoryKeyValueStore(), 'c2hvcnQ=')).toThrow(/32 bytes/);
  });
});

describe('oauth2 helpers', () => {
  const cfg = { clientId: 'cid', clientSecret: 'sec', authorizeUrl: 'https://auth.example/authorize', tokenUrl: 'https://auth.example/token', redirectUri: 'https://app/cb', scopes: ['a', 'b'] };

  it('PKCE challenge is S256 of verifier', () => {
    const p = createPkce();
    expect(p.challenge).toBe(createHash('sha256').update(p.verifier).digest('base64url'));
  });

  it('builds authorize URL', () => {
    const u = new URL(buildAuthorizeUrl(cfg, { state: 's1', pkceChallenge: 'ch' }));
    expect(u.searchParams.get('scope')).toBe('a b');
    expect(u.searchParams.get('code_challenge_method')).toBe('S256');
    expect(u.searchParams.get('state')).toBe('s1');
  });

  it('exchanges and refreshes, keeping old refresh token', async () => {
    const f = mockFetch([
      { method: 'POST', match: 'https://auth.example/token', body: { access_token: 'A1', refresh_token: 'R1', expires_in: 60 } },
    ]);
    const t = await exchangeCode(cfg, 'code123', { fetch: f }, 'verifier', 1000);
    expect(t).toMatchObject({ access_token: 'A1', refresh_token: 'R1', expires_at: 61_000 });
    const body = new URLSearchParams(f.calls[0]!.body);
    expect(body.get('code_verifier')).toBe('verifier');
    expect(body.get('client_secret')).toBe('sec');
    const f2 = mockFetch([{ method: 'POST', match: 'https://auth.example/token', body: { access_token: 'A2', expires_in: 60 } }]);
    const r = await refreshTokens(cfg, t, { fetch: f2 });
    expect(r.access_token).toBe('A2');
    expect(r.refresh_token).toBe('R1');
  });
});

describe('http', () => {
  it('retries 429 then succeeds; redacts secrets', async () => {
    let n = 0;
    const f = (async () => (n++ === 0 ? new Response('', { status: 429, headers: { 'retry-after': '1' } }) : new Response('{"ok":true}'))) as any;
    const res = await httpRequest('https://x.example/a', {}, { fetch: f, sleep: async () => {} });
    expect(await res.json()).toEqual({ ok: true });
    expect(redact('https://x/?code=abc&access_token=zz&a=1')).toBe('https://x/?code=REDACTED&access_token=REDACTED&a=1');
  });
});

describe('guardedSync (consent + audit)', () => {
  const fake: Connector = {
    provider: 'ics', displayName: 'x', authKind: 'none', scopes: [], status: 'implemented',
    approval: { required: [], schoolAdminApproval: false },
    authUrl: async () => ({ url: '', state: '', pending: {} }),
    handleCallback: async () => ({ provider: 'ics', token_ref: 'r', scopes: [], status: 'active' }),
    refresh: async () => {},
    sync: async () => ({ ...emptySyncResult(), events: [{ student_id: STUDENT, title: 't', start_at: 'a', end_at: 'b', source: 'ics', external_id: '1' }] }),
    revoke: async () => ({ providerRevoked: false }),
  };

  it('blocks without guardian consent and audits denial', async () => {
    const audit = new MemoryAuditSink();
    await expect(
      guardedSync(fake, { studentId: STUDENT, tokenRef: 'r' }, { audit, consent: { canUseConnector: async () => ({ allowed: false, reason: 'under 18' }) } }),
    ).rejects.toBeInstanceOf(ConsentRequiredError);
    expect(audit.entries[0]!.action).toBe('sync.denied');
  });

  it('audits each resource read', async () => {
    const audit = new MemoryAuditSink();
    const r = await guardedSync(fake, { studentId: STUDENT, tokenRef: 'r', now: new Date('2026-10-10T00:00:00Z') }, { audit, consent: { canUseConnector: async () => ({ allowed: true }) } });
    expect(r.events).toHaveLength(1);
    expect(audit.entries).toEqual([{ actor: 'connector:ics', action: 'sync.read', resource: `student:${STUDENT}/events?count=1`, at: '2026-10-10T00:00:00.000Z' }]);
  });
});
