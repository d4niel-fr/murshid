import { createPublicKey, createVerify, randomBytes, type JsonWebKey } from 'node:crypto';
import { getJson, withQuery, type HttpOptions } from '../../core/http';
import { ConnectorError } from '../../core/errors';

/**
 * Generic LTI 1.3 (IMS LTI Core 1.3 + IMS Security Framework) launch skeleton.
 * Murshid acts as the TOOL; the school LMS (e.g. GEMS Phoenix, Moodle, Canvas) is the PLATFORM.
 *   1. Platform hits our OIDC login-initiation URL -> buildLoginRedirect()
 *   2. Platform form_posts id_token to our launch URL -> validateLaunch()
 * Deep linking, AGS (grades) and NRPS (rosters) are out of scope for this skeleton.
 */
export const LTI = {
  messageType: 'https://purl.imsglobal.org/spec/lti/claim/message_type',
  version: 'https://purl.imsglobal.org/spec/lti/claim/version',
  deploymentId: 'https://purl.imsglobal.org/spec/lti/claim/deployment_id',
  targetLinkUri: 'https://purl.imsglobal.org/spec/lti/claim/target_link_uri',
  resourceLink: 'https://purl.imsglobal.org/spec/lti/claim/resource_link',
  roles: 'https://purl.imsglobal.org/spec/lti/claim/roles',
  context: 'https://purl.imsglobal.org/spec/lti/claim/context',
} as const;

export interface PlatformRegistration {
  issuer: string; // iss
  clientId: string; // our client_id at the platform (aud)
  authLoginUrl: string; // platform OIDC auth endpoint
  jwksUrl: string;
  deploymentIds: string[];
}

export interface NonceStore {
  /** returns false if the nonce was already used (replay) */
  consume(nonce: string, expiresAtMs: number, nowMs: number): Promise<boolean>;
}

export class MemoryNonceStore implements NonceStore {
  private readonly used = new Map<string, number>();
  async consume(nonce: string, exp: number, now: number) {
    // prune only nonces whose token could no longer validate anyway
    for (const [k, v] of this.used) if (v < now) this.used.delete(k);
    if (this.used.has(nonce)) return false;
    this.used.set(nonce, exp);
    return true;
  }
}

export interface LoginInitiation {
  iss: string;
  login_hint: string;
  target_link_uri: string;
  lti_message_hint?: string;
  client_id?: string;
  lti_deployment_id?: string;
}

/** Step 1: third-party-initiated login. Persist state+nonce server-side (cookie/session). */
export function buildLoginRedirect(reg: PlatformRegistration, init: LoginInitiation, redirectUri: string) {
  if (init.iss !== reg.issuer) throw new ConnectorError('Unknown LTI issuer', 'lti_bad_iss');
  if (init.client_id && init.client_id !== reg.clientId) throw new ConnectorError('LTI client_id mismatch', 'lti_bad_client');
  const state = randomBytes(16).toString('base64url');
  const nonce = randomBytes(16).toString('base64url');
  const url = withQuery(reg.authLoginUrl, {
    scope: 'openid',
    response_type: 'id_token',
    response_mode: 'form_post',
    prompt: 'none',
    client_id: reg.clientId,
    redirect_uri: redirectUri,
    login_hint: init.login_hint,
    lti_message_hint: init.lti_message_hint,
    state,
    nonce,
  });
  return { url, state, nonce };
}

export interface JwksProvider {
  getKey(kid: string | undefined): Promise<JsonWebKey>;
}

export function remoteJwks(url: string, http: HttpOptions = {}): JwksProvider {
  let cache: { keys: (JsonWebKey & { kid?: string })[] } | null = null;
  return {
    async getKey(kid) {
      for (let attempt = 0; attempt < 2; attempt++) {
        if (!cache || attempt === 1) cache = await getJson(url, {}, http);
        const k = cache!.keys.find((x) => !kid || x.kid === kid);
        if (k) return k;
      }
      throw new ConnectorError(`JWKS key ${kid} not found`, 'lti_no_key');
    },
  };
}

export function staticJwks(keys: (JsonWebKey & { kid?: string })[]): JwksProvider {
  return {
    async getKey(kid) {
      const k = keys.find((x) => !kid || x.kid === kid);
      if (!k) throw new ConnectorError(`JWKS key ${kid} not found`, 'lti_no_key');
      return k;
    },
  };
}

export interface LtiLaunch {
  issuer: string;
  subject: string;
  deploymentId: string;
  messageType: string;
  roles: string[];
  contextId: string | null;
  contextTitle: string | null;
  resourceLinkId: string | null;
  targetLinkUri: string | null;
  name: string | null;
  email: string | null;
  claims: Record<string, unknown>;
}

const b64json = (s: string) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));

/** Step 2: validate the id_token from the platform's form_post. */
export async function validateLaunch(
  idToken: string,
  opts: {
    registration: PlatformRegistration;
    jwks: JwksProvider;
    nonceStore: NonceStore;
    expectedState?: { received: string; stored: string };
    now?: Date;
    clockSkewSec?: number;
  },
): Promise<LtiLaunch> {
  if (opts.expectedState && opts.expectedState.received !== opts.expectedState.stored) throw new ConnectorError('LTI state mismatch', 'lti_bad_state');
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new ConnectorError('Malformed id_token', 'lti_malformed');
  const [h64, p64, s64] = parts as [string, string, string];
  const header = b64json(h64) as { alg?: string; kid?: string };
  if (header.alg !== 'RS256') throw new ConnectorError(`Unsupported alg ${header.alg}`, 'lti_bad_alg');
  const jwk = await opts.jwks.getKey(header.kid);
  const verifier = createVerify('RSA-SHA256');
  verifier.update(`${h64}.${p64}`);
  if (!verifier.verify(createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s64, 'base64url'))) {
    throw new ConnectorError('Invalid id_token signature', 'lti_bad_sig');
  }
  const c = b64json(p64) as Record<string, unknown>;
  const reg = opts.registration;
  const now = Math.floor((opts.now ?? new Date()).getTime() / 1000);
  const skew = opts.clockSkewSec ?? 60;
  if (c.iss !== reg.issuer) throw new ConnectorError('iss mismatch', 'lti_bad_iss');
  const aud = Array.isArray(c.aud) ? (c.aud as string[]) : [c.aud as string];
  if (!aud.includes(reg.clientId)) throw new ConnectorError('aud mismatch', 'lti_bad_aud');
  if (aud.length > 1 && c.azp !== reg.clientId) throw new ConnectorError('azp mismatch', 'lti_bad_azp');
  if (typeof c.exp !== 'number' || c.exp + skew < now) throw new ConnectorError('id_token expired', 'lti_expired');
  if (typeof c.iat !== 'number' || c.iat - skew > now) throw new ConnectorError('id_token iat in future', 'lti_bad_iat');
  if (typeof c.nonce !== 'string' || !(await opts.nonceStore.consume(c.nonce, ((c.exp as number) + skew) * 1000, now * 1000))) {
    throw new ConnectorError('nonce missing or replayed', 'lti_bad_nonce');
  }
  if (c[LTI.version] !== '1.3.0') throw new ConnectorError('LTI version must be 1.3.0', 'lti_bad_version');
  const deploymentId = c[LTI.deploymentId];
  if (typeof deploymentId !== 'string' || !reg.deploymentIds.includes(deploymentId)) throw new ConnectorError('Unknown deployment_id', 'lti_bad_deployment');
  const messageType = c[LTI.messageType];
  if (messageType !== 'LtiResourceLinkRequest' && messageType !== 'LtiDeepLinkingRequest') throw new ConnectorError('Unsupported message_type', 'lti_bad_message');
  const rl = c[LTI.resourceLink] as { id?: string } | undefined;
  if (messageType === 'LtiResourceLinkRequest' && !rl?.id) throw new ConnectorError('resource_link.id required', 'lti_missing_rl');
  if (typeof c.sub !== 'string' || !c.sub) throw new ConnectorError('sub required', 'lti_missing_sub');
  const ctx = c[LTI.context] as { id?: string; title?: string } | undefined;
  return {
    issuer: c.iss as string,
    subject: c.sub,
    deploymentId,
    messageType,
    roles: (c[LTI.roles] as string[] | undefined) ?? [],
    contextId: ctx?.id ?? null,
    contextTitle: ctx?.title ?? null,
    resourceLinkId: rl?.id ?? null,
    targetLinkUri: (c[LTI.targetLinkUri] as string | undefined) ?? null,
    name: (c.name as string | undefined) ?? null,
    email: (c.email as string | undefined) ?? null,
    claims: c,
  };
}

export function isLearner(l: LtiLaunch): boolean {
  return l.roles.some((r) => /membership#Learner$|institution\/person#Student$/.test(r));
}
