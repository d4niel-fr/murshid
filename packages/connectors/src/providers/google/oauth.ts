import type { OAuth2ClientConfig } from '../../core/oauth2';
import { requireEnv, type Env } from '../../core/env';
import { httpRequest, type HttpOptions } from '../../core/http';

export const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke';

export function googleOAuthConfig(env: Env, scopes: string[], redirectEnv = 'GOOGLE_REDIRECT_URI'): OAuth2ClientConfig {
  return {
    clientId: requireEnv(env, 'GOOGLE_CLIENT_ID'),
    clientSecret: requireEnv(env, 'GOOGLE_CLIENT_SECRET'),
    redirectUri: requireEnv(env, redirectEnv),
    authorizeUrl: GOOGLE_AUTHORIZE_URL,
    tokenUrl: GOOGLE_TOKEN_URL,
    scopes,
    // offline + consent => refresh_token; include_granted_scopes => incremental auth
    extraAuthParams: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true' },
  };
}

export async function googleRevoke(token: string, http: HttpOptions = {}): Promise<void> {
  await httpRequest(
    GOOGLE_REVOKE_URL,
    { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token }).toString() },
    http,
  );
}
