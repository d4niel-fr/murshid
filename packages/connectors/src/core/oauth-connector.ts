import type { ApprovalInfo, AuthStart, CallbackInput, ConnectionGrant, Connector, ConnectorDeps, ProviderStatus, SyncContext } from './connector';
import { ConnectorError } from './errors';
import { buildAuthorizeUrl, createPkce, exchangeCode, isExpired, randomState, refreshTokens, type OAuth2ClientConfig } from './oauth2';
import type { ProviderId, SyncResult } from './types';
import type { TokenSet } from './vault';

/** Shared plumbing for OAuth2 authorization-code connectors. */
export abstract class OAuthConnector implements Connector {
  abstract readonly provider: ProviderId;
  abstract readonly displayName: string;
  abstract readonly approval: ApprovalInfo;
  abstract readonly status: ProviderStatus;
  readonly authKind = 'oauth2' as const;
  protected usePkce = true;

  constructor(protected readonly oauth: OAuth2ClientConfig, protected readonly deps: ConnectorDeps) {}

  get scopes(): string[] {
    return this.oauth.scopes;
  }

  async authUrl(input: { state?: string } = {}): Promise<AuthStart> {
    const state = input.state ?? randomState();
    const pending: Record<string, string> = {};
    let challenge: string | undefined;
    if (this.usePkce) {
      const pkce = createPkce();
      pending.code_verifier = pkce.verifier;
      challenge = pkce.challenge;
    }
    const url = buildAuthorizeUrl(this.oauth, { state, ...(challenge ? { pkceChallenge: challenge } : {}) });
    return { url, state, pending };
  }

  async handleCallback(input: CallbackInput): Promise<ConnectionGrant> {
    if (input.kind !== 'oauth2') throw new ConnectorError(`${this.provider} expects an oauth2 callback`, 'bad_callback');
    const tokens = await exchangeCode(this.oauth, input.code, this.deps.http, input.pending?.code_verifier);
    const enriched = await this.afterTokenExchange(tokens);
    const token_ref = await this.deps.vault.put(this.provider, enriched);
    return {
      provider: this.provider,
      token_ref,
      scopes: enriched.scope ? enriched.scope.split(/[ ,]+/).filter(Boolean) : this.scopes,
      status: 'active',
    };
  }

  /** Hook: add non-secret meta (user id, tenant) after exchange. */
  protected async afterTokenExchange(tokens: TokenSet): Promise<TokenSet> {
    return tokens;
  }

  async refresh(tokenRef: string): Promise<void> {
    const current = await this.deps.vault.get(tokenRef);
    const fresh = await refreshTokens(this.oauth, current, this.deps.http);
    await this.deps.vault.update(tokenRef, fresh);
  }

  /** Returns a valid access token, refreshing first when it is (about to be) expired. */
  protected async accessToken(tokenRef: string, now = Date.now()): Promise<string> {
    let t = await this.deps.vault.get(tokenRef);
    if (isExpired(t, now) && t.refresh_token) {
      await this.refresh(tokenRef);
      t = await this.deps.vault.get(tokenRef);
    }
    return t.access_token;
  }

  protected async bearer(tokenRef: string): Promise<Record<string, string>> {
    return { authorization: `Bearer ${await this.accessToken(tokenRef)}` };
  }

  abstract sync(ctx: SyncContext): Promise<SyncResult>;

  /** Override to call the provider's revocation endpoint. */
  protected async providerRevoke(_tokens: TokenSet): Promise<{ providerRevoked: boolean; note?: string }> {
    return { providerRevoked: false, note: 'Provider has no token revocation endpoint; local token deleted.' };
  }

  async revoke(tokenRef: string): Promise<{ providerRevoked: boolean; note?: string }> {
    let result: { providerRevoked: boolean; note?: string } = { providerRevoked: false };
    try {
      const tokens = await this.deps.vault.get(tokenRef);
      result = await this.providerRevoke(tokens);
    } finally {
      await this.deps.vault.delete(tokenRef);
    }
    return result;
  }
}
