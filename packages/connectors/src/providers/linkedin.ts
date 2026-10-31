import { createHash } from 'node:crypto';
import type { ApprovalInfo, ConnectorDeps } from '../core/connector';
import { requireEnv, type Env } from '../core/env';
import { ApprovalRequiredError, ConnectorError } from '../core/errors';
import { getJson, httpRequest, sendJson } from '../core/http';
import type { IdentityProfile, IdentityProvider } from '../core/identity';
import { buildAuthorizeUrl, exchangeCode, randomState, type OAuth2ClientConfig } from '../core/oauth2';

/**
 * Sign In with LinkedIn using OpenID Connect + Share on LinkedIn (both self-serve products).
 * Docs: https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/sign-in-with-linkedin-v2
 *       https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin
 */
export const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
export const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
export const LINKEDIN_REVOKE_URL = 'https://www.linkedin.com/oauth/v2/revoke';
export const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
export const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';

export const LINKEDIN_SIGNIN_SCOPES = ['openid', 'profile', 'email'];
export const LINKEDIN_SHARE_SCOPES = ['w_member_social'];
/** LinkedIn User Agreement minimum age. */
export const LINKEDIN_MIN_AGE = 16;

export interface LinkedInUserInfo {
  sub: string; name?: string; given_name?: string; family_name?: string; picture?: string; locale?: string | { country?: string; language?: string };
  email?: string; email_verified?: boolean;
}

export function mapLinkedInUser(u: LinkedInUserInfo): IdentityProfile {
  const attributes: Record<string, string> = {};
  if (u.picture) attributes.picture = u.picture;
  if (typeof u.locale === 'string') attributes.locale = u.locale;
  else if (u.locale?.language) attributes.locale = `${u.locale.language}_${u.locale.country ?? ''}`;
  attributes.person_urn = `urn:li:person:${u.sub}`;
  return {
    provider: 'linkedin',
    subject: u.sub,
    full_name: u.name ?? null,
    first_name: u.given_name ?? null,
    last_name: u.family_name ?? null,
    email: u.email ?? null,
    email_verified: u.email_verified ?? null,
    attributes,
  };
}

export interface LinkedInDraft {
  text: string;
  /** optional article link to attach */
  url?: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS';
}

/**
 * Explicit approval captured in the UI when the student taps "Post" on the exact
 * draft. draftHash binds approval to the text: edit the draft => approval void.
 */
export interface PostApproval {
  approved: true;
  approvedBy: string; // student id
  approvedAt: string; // ISO
  draftHash: string;
}

export function hashDraft(d: LinkedInDraft): string {
  return createHash('sha256').update(JSON.stringify({ text: d.text, url: d.url ?? null, visibility: d.visibility ?? 'PUBLIC' })).digest('hex');
}

export function approveDraft(d: LinkedInDraft, studentId: string, now = new Date()): PostApproval {
  return { approved: true, approvedBy: studentId, approvedAt: now.toISOString(), draftHash: hashDraft(d) };
}

/** Throws unless the approval is explicit, fresh (default 15 min), and for this exact draft. */
export function assertApproved(d: LinkedInDraft, a: PostApproval | undefined | null, studentId: string, now = new Date(), maxAgeMs = 15 * 60_000): void {
  if (!a || a.approved !== true) throw new ApprovalRequiredError('LinkedIn post requires explicit student approval');
  if (a.approvedBy !== studentId) throw new ApprovalRequiredError('Approval must come from the student who owns the account');
  if (a.draftHash !== hashDraft(d)) throw new ApprovalRequiredError('Draft changed after approval; re-approve');
  const age = now.getTime() - new Date(a.approvedAt).getTime();
  if (!(age >= 0 && age <= maxAgeMs)) throw new ApprovalRequiredError('Approval expired; re-approve');
}

export function ugcPostBody(personUrn: string, d: LinkedInDraft) {
  return {
    author: personUrn,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text: d.text },
        shareMediaCategory: d.url ? 'ARTICLE' : 'NONE',
        ...(d.url ? { media: [{ status: 'READY', originalUrl: d.url }] } : {}),
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': d.visibility ?? 'PUBLIC' },
  };
}

export class LinkedInProvider implements IdentityProvider {
  readonly provider = 'linkedin' as const;
  readonly displayName = 'LinkedIn';
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = {
    required: ['LinkedIn developer app with "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn" products (self-serve)'],
    schoolAdminApproval: false,
    notes: `LinkedIn requires members to be ${LINKEDIN_MIN_AGE}+. Posting happens only with an explicit, draft-bound approval.`,
  };
  private readonly oauth: OAuth2ClientConfig;

  constructor(private readonly deps: ConnectorDeps, opts: { share?: boolean } = {}) {
    const env: Env = deps.env ?? process.env;
    this.oauth = {
      clientId: requireEnv(env, 'LINKEDIN_CLIENT_ID'),
      clientSecret: requireEnv(env, 'LINKEDIN_CLIENT_SECRET'),
      redirectUri: requireEnv(env, 'LINKEDIN_REDIRECT_URI'),
      authorizeUrl: LINKEDIN_AUTHORIZE_URL,
      tokenUrl: LINKEDIN_TOKEN_URL,
      scopes: [...LINKEDIN_SIGNIN_SCOPES, ...(opts.share === false ? [] : LINKEDIN_SHARE_SCOPES)],
    };
  }

  get scopes() {
    return this.oauth.scopes;
  }

  async authUrl(input: { state?: string } = {}) {
    const state = input.state ?? randomState();
    const nonce = randomState();
    return { url: buildAuthorizeUrl(this.oauth, { state, nonce }), state, pending: { nonce } };
  }

  async handleCallback(input: { code: string; state: string }) {
    const tokens = await exchangeCode(this.oauth, input.code, this.deps.http);
    const info = await getJson<LinkedInUserInfo>(LINKEDIN_USERINFO_URL, { authorization: `Bearer ${tokens.access_token}` }, this.deps.http);
    const profile = mapLinkedInUser(info);
    const token_ref = await this.deps.vault.put(this.provider, { ...tokens, meta: { person_urn: profile.attributes.person_urn! } });
    return { token_ref, profile };
  }

  /**
   * Publish a post. Never called by the agent autonomously: requires a PostApproval
   * produced by the UI for this exact draft. Also enforces LinkedIn's 16+ rule.
   */
  async publishDraft(
    tokenRef: string,
    draft: LinkedInDraft,
    approval: PostApproval | null | undefined,
    ctx: { studentId: string; studentAge: number; now?: Date },
  ): Promise<{ postUrn: string | null }> {
    if (ctx.studentAge < LINKEDIN_MIN_AGE) throw new ApprovalRequiredError(`LinkedIn posting requires age ${LINKEDIN_MIN_AGE}+`);
    assertApproved(draft, approval, ctx.studentId, ctx.now ?? new Date());
    if (!draft.text.trim() || draft.text.length > 3000) throw new ConnectorError('Post text must be 1-3000 characters', 'bad_draft');
    const t = await this.deps.vault.get(tokenRef);
    if (!t.scope?.includes('w_member_social') && t.scope !== undefined) throw new ConnectorError('Token lacks w_member_social; reconnect with sharing enabled', 'missing_scope');
    const urn = t.meta?.person_urn;
    if (!urn) throw new ConnectorError('Missing person URN; reconnect LinkedIn', 'missing_meta');
    const { data, response } = await sendJson<{ id?: string }>(
      'POST',
      LINKEDIN_UGC_POSTS_URL,
      ugcPostBody(urn, draft),
      { authorization: `Bearer ${t.access_token}`, 'x-restli-protocol-version': '2.0.0' },
      this.deps.http,
    );
    return { postUrn: response.headers.get('x-restli-id') ?? data.id ?? null };
  }

  async revoke(tokenRef: string) {
    try {
      const t = await this.deps.vault.get(tokenRef);
      await httpRequest(
        LINKEDIN_REVOKE_URL,
        {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token: t.access_token, client_id: this.oauth.clientId, client_secret: this.oauth.clientSecret ?? '' }).toString(),
        },
        this.deps.http,
      );
      return { providerRevoked: true };
    } finally {
      await this.deps.vault.delete(tokenRef);
    }
  }
}
