import { describe, expect, it } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';
import { buildLoginRedirect, isLearner, LTI, MemoryNonceStore, staticJwks, validateLaunch, type PlatformRegistration } from '../src/providers/lti/lti13';
import { PhoenixConnector } from '../src/providers/phoenix';
import { NotAvailableError } from '../src/core/errors';
import { STUDENT } from './helpers/mockFetch';

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };

const reg: PlatformRegistration = {
  issuer: 'https://lms.school.example',
  clientId: 'murshid-tool',
  authLoginUrl: 'https://lms.school.example/auth',
  jwksUrl: 'https://lms.school.example/jwks',
  deploymentIds: ['dep-1'],
};

const now = new Date('2026-10-10T08:00:00Z');
const iat = Math.floor(now.getTime() / 1000);

function sign(claims: Record<string, unknown>, header: Record<string, unknown> = { alg: 'RS256', kid: 'k1', typ: 'JWT' }) {
  const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${enc(header)}.${enc(claims)}`;
  const s = createSign('RSA-SHA256').update(data).sign(privateKey).toString('base64url');
  return `${data}.${s}`;
}

const goodClaims = (over: Record<string, unknown> = {}) => ({
  iss: reg.issuer,
  aud: reg.clientId,
  sub: 'lms-user-42',
  iat,
  exp: iat + 300,
  nonce: `n-${Math.random()}`,
  name: 'Aisha Test',
  [LTI.version]: '1.3.0',
  [LTI.messageType]: 'LtiResourceLinkRequest',
  [LTI.deploymentId]: 'dep-1',
  [LTI.resourceLink]: { id: 'rl-1' },
  [LTI.roles]: ['http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'],
  [LTI.context]: { id: 'ctx-1', title: 'Grade 11 Physics' },
  ...over,
});

describe('LTI 1.3 launch validator', () => {
  const opts = () => ({ registration: reg, jwks: staticJwks([jwk]), nonceStore: new MemoryNonceStore(), now });

  it('builds the OIDC login redirect', () => {
    const r = buildLoginRedirect(reg, { iss: reg.issuer, login_hint: 'h', target_link_uri: 'https://murshid.test/lti/launch', lti_message_hint: 'm' }, 'https://murshid.test/lti/launch');
    const u = new URL(r.url);
    expect(u.searchParams.get('response_mode')).toBe('form_post');
    expect(u.searchParams.get('scope')).toBe('openid');
    expect(u.searchParams.get('nonce')).toBe(r.nonce);
    expect(() => buildLoginRedirect(reg, { iss: 'https://evil', login_hint: 'h', target_link_uri: 'x' }, 'y')).toThrow(/issuer/);
  });

  it('accepts a valid launch', async () => {
    const l = await validateLaunch(sign(goodClaims()), opts());
    expect(l).toMatchObject({ subject: 'lms-user-42', deploymentId: 'dep-1', contextTitle: 'Grade 11 Physics', resourceLinkId: 'rl-1' });
    expect(isLearner(l)).toBe(true);
  });

  it.each([
    ['bad signature', () => { const t = sign(goodClaims()); const i = t.lastIndexOf('.') + 10; return t.slice(0, i) + (t[i] === 'A' ? 'B' : 'A') + t.slice(i + 1); }, /signature/],
    ['wrong iss', () => sign(goodClaims({ iss: 'https://other' })), /iss/],
    ['wrong aud', () => sign(goodClaims({ aud: 'x' })), /aud/],
    ['expired', () => sign(goodClaims({ exp: iat - 3600 })), /expired/],
    ['unknown deployment', () => sign(goodClaims({ [LTI.deploymentId]: 'dep-9' })), /deployment/],
    ['wrong version', () => sign(goodClaims({ [LTI.version]: '1.1' })), /version/],
    ['alg none', () => sign(goodClaims(), { alg: 'none' }), /alg/],
    ['missing resource link', () => sign(goodClaims({ [LTI.resourceLink]: undefined })), /resource_link/],
  ])('rejects %s', async (_n, make, err) => {
    await expect(validateLaunch(make(), opts())).rejects.toThrow(err);
  });

  it('rejects nonce replay', async () => {
    const o = opts();
    const t = sign(goodClaims({ nonce: 'same' }));
    await validateLaunch(t, o);
    await expect(validateLaunch(t, o)).rejects.toThrow(/nonce/);
  });
});

describe('GEMS Phoenix stub', () => {
  it('explains the partnership requirement', async () => {
    const p = new PhoenixConnector();
    expect(p.status).toBe('stub');
    await expect(p.sync({ studentId: STUDENT, tokenRef: 'x' })).rejects.toBeInstanceOf(NotAvailableError);
    await expect(p.authUrl()).rejects.toThrow(/partnership.*LTI 1\.3/);
  });
});
