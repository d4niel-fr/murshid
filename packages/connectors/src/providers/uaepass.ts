import type { ApprovalInfo, ConnectorDeps } from '../core/connector';
import { optionalEnv, requireEnv, type Env } from '../core/env';
import { ProductionNotAllowedError } from '../core/errors';
import { getJson, httpRequest, withQuery } from '../core/http';
import type { IdentityProfile, IdentityProvider } from '../core/identity';
import { randomState, toTokenSet } from '../core/oauth2';

/**
 * UAE PASS (national digital identity). Endpoints from
 * https://docs.uaepass.ae/feature-guides/authentication/web-application/endpoints
 *
 * REQUIRES A UAE TRADE LICENCE FOR PRODUCTION: production client credentials are
 * issued only to onboarded service providers (government entities or licensed
 * private organisations). This adapter defaults to STAGING and refuses
 * production unless UAEPASS_PRODUCTION_APPROVED=true.
 */
export const UAEPASS_ENDPOINTS = {
  staging: {
    authorize: 'https://stg-id.uaepass.ae/idshub/authorize',
    token: 'https://stg-id.uaepass.ae/idshub/token',
    userinfo: 'https://stg-id.uaepass.ae/idshub/userinfo',
    logout: 'https://stg-id.uaepass.ae/idshub/logout',
  },
  production: {
    authorize: 'https://id.uaepass.ae/idshub/authorize',
    token: 'https://id.uaepass.ae/idshub/token',
    userinfo: 'https://id.uaepass.ae/idshub/userinfo',
    logout: 'https://id.uaepass.ae/idshub/logout',
  },
} as const;

export const UAEPASS_SCOPE = 'urn:uae:digitalid:profile:general';
export const UAEPASS_ACR_LOW = 'urn:safelayer:tws:policies:authentication:level:low';

export interface UaePassUserInfo {
  sub: string;
  uuid?: string;
  userType?: 'SOP1' | 'SOP2' | 'SOP3' | string;
  fullnameEN?: string;
  firstnameEN?: string;
  lastnameEN?: string;
  fullnameAR?: string;
  email?: string;
  mobile?: string;
  gender?: string;
  nationalityEN?: string;
  idn?: string; // Emirates ID number — never persisted
  idType?: string;
  [k: string]: unknown;
}

/** UAE PASS "fullnameEN" uses comma placeholders: "Ram,,,,ABC,,". */
export function cleanUaePassName(n?: string): string | null {
  if (!n) return null;
  const s = n.split(',').map((p) => p.trim()).filter(Boolean).join(' ');
  return s || null;
}

/**
 * Data minimisation: Emirates ID (idn), mobile and Arabic duplicates are dropped.
 * SOP1 = unverified account; SOP2/SOP3 = identity verified (attributes.verified).
 */
export function mapUaePassUser(u: UaePassUserInfo): IdentityProfile {
  const attributes: Record<string, string> = {};
  if (u.userType) attributes.user_type = u.userType;
  if (u.nationalityEN) attributes.nationality = u.nationalityEN;
  if (u.gender) attributes.gender = u.gender;
  attributes.verified = String(u.userType === 'SOP2' || u.userType === 'SOP3');
  return {
    provider: 'uaepass',
    subject: u.uuid ?? u.sub,
    full_name: cleanUaePassName(u.fullnameEN) ?? ([u.firstnameEN, u.lastnameEN].filter(Boolean).join(' ') || null),
    first_name: u.firstnameEN ?? null,
    last_name: u.lastnameEN ?? null,
    email: u.email ?? null,
    email_verified: null,
    attributes,
  };
}

export class UaePassProvider implements IdentityProvider {
  readonly provider = 'uaepass' as const;
  readonly displayName = 'UAE PASS';
  readonly scopes = [UAEPASS_SCOPE];
  readonly status = 'sandbox_only' as const;
  readonly approval: ApprovalInfo = {
    required: ['UAE PASS service-provider onboarding (TDRA/DDA)', 'Valid UAE trade licence for production credentials'],
    schoolAdminApproval: false,
    notes: 'Staging only until onboarding completes. Minors: UAE PASS accounts generally require an Emirates ID; most 13–17 year-olds will sign in another way.',
  };
  private readonly env: Env;
  private readonly ep: { authorize: string; token: string; userinfo: string; logout: string };

  constructor(private readonly deps: ConnectorDeps) {
    this.env = deps.env ?? process.env;
    const mode = optionalEnv(this.env, 'UAEPASS_ENV', 'staging');
    if (mode === 'production' && this.env.UAEPASS_PRODUCTION_APPROVED !== 'true') {
      throw new ProductionNotAllowedError('UAE PASS production requires onboarding + trade licence; set UAEPASS_PRODUCTION_APPROVED=true only after approval.');
    }
    this.ep = mode === 'production' ? UAEPASS_ENDPOINTS.production : UAEPASS_ENDPOINTS.staging;
  }

  async authUrl(input: { state?: string; locale?: 'en' | 'ar' } = {}) {
    const state = input.state ?? randomState();
    const url = withQuery(this.ep.authorize, {
      response_type: 'code',
      client_id: requireEnv(this.env, 'UAEPASS_CLIENT_ID'),
      scope: UAEPASS_SCOPE,
      state,
      redirect_uri: requireEnv(this.env, 'UAEPASS_REDIRECT_URI'),
      acr_values: optionalEnv(this.env, 'UAEPASS_ACR_VALUES', UAEPASS_ACR_LOW),
      ui_locales: input.locale ?? 'en',
    });
    return { url, state, pending: {} };
  }

  /** Token call per docs: POST with query params + HTTP Basic client auth. Codes expire in ~10s: call immediately. */
  async exchangeCode(code: string) {
    const url = withQuery(this.ep.token, { grant_type: 'authorization_code', redirect_uri: requireEnv(this.env, 'UAEPASS_REDIRECT_URI'), code });
    const basic = Buffer.from(`${requireEnv(this.env, 'UAEPASS_CLIENT_ID')}:${requireEnv(this.env, 'UAEPASS_CLIENT_SECRET')}`).toString('base64');
    const res = await httpRequest(url, { method: 'POST', headers: { authorization: `Basic ${basic}`, accept: 'application/json' } }, this.deps.http);
    return toTokenSet(await res.json());
  }

  async userinfo(accessToken: string): Promise<UaePassUserInfo> {
    return getJson<UaePassUserInfo>(this.ep.userinfo, { authorization: `Bearer ${accessToken}` }, this.deps.http);
  }

  async handleCallback(input: { code: string; state: string }) {
    const tokens = await this.exchangeCode(input.code);
    const info = await this.userinfo(tokens.access_token);
    const profile = mapUaePassUser(info);
    const token_ref = await this.deps.vault.put(this.provider, { ...tokens, meta: { subject: profile.subject } });
    return { token_ref, profile };
  }

  /** UAE PASS has no token revocation endpoint; end the SSO session via logout redirect. */
  logoutUrl(redirectUri: string): string {
    return withQuery(this.ep.logout, { redirect_uri: redirectUri });
  }
}
