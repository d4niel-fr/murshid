import { createHash, randomBytes } from 'node:crypto';
import { httpRequest, type HttpOptions } from './http';
import type { TokenSet } from './vault';

export interface OAuth2ClientConfig {
  clientId: string;
  clientSecret?: string;
  authorizeUrl: string;
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
  /** joiner for scope param (space for most, some use comma) */
  scopeSeparator?: string;
  /** how the client authenticates at the token endpoint */
  tokenAuth?: 'body' | 'basic';
  extraAuthParams?: Record<string, string>;
}

export interface Pkce {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' };
}

export function randomState(): string {
  return randomBytes(16).toString('base64url');
}

export function buildAuthorizeUrl(
  cfg: OAuth2ClientConfig,
  p: { state: string; pkceChallenge?: string; nonce?: string; extra?: Record<string, string> },
): string {
  const u = new URL(cfg.authorizeUrl);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('scope', cfg.scopes.join(cfg.scopeSeparator ?? ' '));
  u.searchParams.set('state', p.state);
  if (p.pkceChallenge) {
    u.searchParams.set('code_challenge', p.pkceChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
  }
  if (p.nonce) u.searchParams.set('nonce', p.nonce);
  for (const [k, v] of Object.entries({ ...cfg.extraAuthParams, ...p.extra })) u.searchParams.set(k, v);
  return u.toString();
}

interface RawTokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  id_token?: string;
  expires_in?: number | string;
}

export function toTokenSet(raw: RawTokenResponse, now = Date.now()): TokenSet {
  if (!raw.access_token) throw new Error('Token response missing access_token');
  const t: TokenSet = { access_token: raw.access_token };
  if (raw.refresh_token) t.refresh_token = raw.refresh_token;
  if (raw.token_type) t.token_type = raw.token_type;
  if (raw.scope) t.scope = raw.scope;
  if (raw.id_token) t.id_token = raw.id_token;
  if (raw.expires_in !== undefined) t.expires_at = now + Number(raw.expires_in) * 1000;
  return t;
}

async function postToken(cfg: OAuth2ClientConfig, params: Record<string, string>, http: HttpOptions): Promise<RawTokenResponse> {
  const body = new URLSearchParams(params);
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
    accept: 'application/json',
  };
  if (cfg.tokenAuth === 'basic' && cfg.clientSecret) {
    headers.authorization = 'Basic ' + Buffer.from(`${cfg.clientId}:${cfg.clientSecret}`).toString('base64');
  } else {
    body.set('client_id', cfg.clientId);
    if (cfg.clientSecret) body.set('client_secret', cfg.clientSecret);
  }
  const res = await httpRequest(cfg.tokenUrl, { method: 'POST', headers, body: body.toString() }, http);
  const json = (await res.json()) as RawTokenResponse | { $data: RawTokenResponse };
  // Edlink wraps responses in { $data }
  return '$data' in json ? json.$data : json;
}

export async function exchangeCode(
  cfg: OAuth2ClientConfig,
  code: string,
  http: HttpOptions = {},
  codeVerifier?: string,
  now = Date.now(),
): Promise<TokenSet> {
  const params: Record<string, string> = { grant_type: 'authorization_code', code, redirect_uri: cfg.redirectUri };
  if (codeVerifier) params.code_verifier = codeVerifier;
  return toTokenSet(await postToken(cfg, params, http), now);
}

export async function refreshTokens(cfg: OAuth2ClientConfig, current: TokenSet, http: HttpOptions = {}, now = Date.now()): Promise<TokenSet> {
  if (!current.refresh_token) throw new Error('No refresh_token stored; user must reconnect');
  const fresh = toTokenSet(await postToken(cfg, { grant_type: 'refresh_token', refresh_token: current.refresh_token }, http), now);
  // Providers often omit refresh_token on refresh: keep the old one.
  return { ...current, ...fresh, refresh_token: fresh.refresh_token ?? current.refresh_token };
}

export function isExpired(t: TokenSet, now = Date.now(), skewMs = 60_000): boolean {
  return t.expires_at !== undefined && t.expires_at - skewMs <= now;
}
