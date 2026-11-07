import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verify, verifyWithJwks } from 'hono/jwt';
import type { AppEnv, AuthInfo, Config, Role } from './context';

const ROLES: Role[] = ['student', 'guardian', 'counsellor', 'admin'];

function roleFrom(v: unknown): Role {
  return typeof v === 'string' && (ROLES as string[]).includes(v) ? (v as Role) : 'student';
}

/** Clock difference allowed between Supabase and this server, in seconds. */
export const CLOCK_SKEW_S = 30;
const MAX_TOKEN = 8192;

/* ------------------------------------------------------------------ public keys (asymmetric projects) */

type Jwk = { kid?: string; alg?: string; kty?: string; [k: string]: unknown };
let jwks: { url: string; keys: Jwk[]; at: number } | null = null;
let lastFetch = 0;

/** The project's public keys, cached for 10 minutes; refetched (at most every 30 s) when a token names an unknown key. */
async function keysFor(url: string, kid: string | undefined): Promise<Jwk[]> {
  const now = Date.now();
  const fresh = jwks && jwks.url === url && now - jwks.at < 600_000;
  const known = fresh && jwks!.keys.some((k) => k.kid === kid);
  if (fresh && (known || now - lastFetch < 30_000)) return jwks!.keys;
  lastFetch = now;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
  if (!res.ok) throw new Error(`jwks ${res.status}`);
  const data = (await res.json()) as { keys?: unknown };
  if (!Array.isArray(data.keys)) throw new Error('jwks: no keys');
  jwks = { url, keys: data.keys as Jwk[], at: now };
  return jwks.keys;
}
/** Test hook: forget cached keys. */
export function resetJwksCache() { jwks = null; lastFetch = 0; }

function kidOf(token: string): string | undefined {
  try { return (JSON.parse(Buffer.from(token.split('.')[0] ?? '', 'base64url').toString('utf8')) as { kid?: string }).kid; } catch { return undefined; }
}

/**
 * Checks the claims after the signature: exp is required, nbf / iat may not be in the future (30 s of clock skew),
 * the audience must match, the issuer too when SUPABASE_JWT_ISSUER is set. Only end-user tokens are accepted: a signed
 * anon or service-role key, or an anonymous sign-in (no verified email to link an account to), is refused.
 */
export function checkClaims(p: Record<string, unknown>, config: Pick<Config, 'jwtAudience' | 'jwtIssuer'>, nowS = Math.floor(Date.now() / 1000)): string | null {
  if (typeof p.exp !== 'number' || !Number.isFinite(p.exp)) return 'token has no expiry';
  if (p.exp + CLOCK_SKEW_S <= nowS) return 'invalid or expired token';
  if (p.nbf !== undefined && (typeof p.nbf !== 'number' || p.nbf - CLOCK_SKEW_S > nowS)) return 'token not valid yet';
  if (p.iat !== undefined && (typeof p.iat !== 'number' || p.iat - CLOCK_SKEW_S > nowS)) return 'token issued in the future';
  const aud = p.aud;
  if (!(Array.isArray(aud) ? aud.includes(config.jwtAudience) : aud === config.jwtAudience)) return 'invalid token audience';
  if (config.jwtIssuer && p.iss !== config.jwtIssuer) return 'invalid token issuer';
  if (typeof p.sub !== 'string' || !p.sub || p.sub.length > 200) return 'token missing sub';
  if (p.role !== undefined && p.role !== 'authenticated') return 'not a user token';
  if (p.is_anonymous === true) return 'anonymous sign-ins are not accepted';
  return null;
}

/** Verify a Supabase access token: HS256 with the shared secret, or ES256/RS256 with the project's public keys. */
export async function verifyToken(token: string, config: Config): Promise<Record<string, unknown>> {
  if (!token || token.length > MAX_TOKEN || token.split('.').length !== 3) throw new HTTPException(401, { message: 'invalid or expired token' });
  let payload: Record<string, unknown>;
  // time claims are checked below with a small allowance for clock skew
  const timing = { exp: false, nbf: false, iat: false } as const;
  try {
    payload = (config.jwtSecret
      ? await verify(token, config.jwtSecret, { alg: 'HS256', ...timing })
      : await verifyWithJwks(token, { keys: (await keysFor(config.jwksUrl, kidOf(token))) as never, allowedAlgorithms: ['ES256', 'RS256'], verification: timing })) as Record<string, unknown>;
  } catch {
    throw new HTTPException(401, { message: 'invalid or expired token' });
  }
  const why = checkClaims(payload, config);
  if (why) throw new HTTPException(401, { message: why });
  return payload;
}

/**
 * Verifies Supabase access tokens from `Authorization: Bearer`: HS256 with SUPABASE_JWT_SECRET (legacy projects), or
 * the project's public keys (ES256/RS256 from SUPABASE_URL's JWKS) for projects with asymmetric signing keys.
 * Murshid role is read from `app_metadata.murshid_role` (set server-side by the db/privacy teams; users cannot edit
 * app_metadata), defaulting to 'student'.
 *
 * Dev mode (AUTH_MODE=dev, or no secret outside production) additionally accepts:
 *   x-dev-user-id: <auth user id>   (seed: dev-aisha, dev-rohan)
 *   x-dev-role:    student|guardian|counsellor|admin (default student)
 *   x-dev-email:   email (guardians are matched by email)
 *   x-dev-school-id: school id (counsellors)
 * A Bearer token is still verified in dev mode if a secret is configured. In jwt mode the dev headers are ignored.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { config } = c.get('deps');
  const header = c.req.header('authorization');
  let auth: AuthInfo | null = null;

  if (header?.toLowerCase().startsWith('bearer ') && (config.jwtSecret || config.jwksUrl)) {
    const payload = await verifyToken(header.slice(7).trim(), config);
    const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const name = [userMeta.full_name, userMeta.name].find((x): x is string => typeof x === 'string' && x.trim().length > 0)?.slice(0, 120) ?? null;
    auth = {
      userId: payload.sub as string,
      email: typeof payload.email === 'string' ? payload.email.slice(0, 254) : null,
      name,
      role: roleFrom(appMeta.murshid_role),
      via: 'jwt',
      schoolId: typeof appMeta.school_id === 'string' ? appMeta.school_id : null,
    };
  } else if (config.authMode === 'dev') {
    const userId = c.req.header('x-dev-user-id');
    if (userId) {
      auth = { userId, email: c.req.header('x-dev-email') ?? null, role: roleFrom(c.req.header('x-dev-role')), via: 'dev',
        schoolId: c.req.header('x-dev-school-id') ?? null };
    }
  }

  if (!auth) throw new HTTPException(401, { message: 'authentication required' });
  c.set('auth', auth);
  // per-person rate limits, now that we know who it is (verified tokens only; dev headers are charged by the limiter)
  if (auth.via === 'jwt') {
    const over = c.get('chargeUser')?.(`u:${auth.userId}`);
    if (over) {
      c.header('Retry-After', String(over.wait));
      throw new HTTPException(429, { message: over.error, cause: { code: over.code, retryAfter: over.wait } });
    }
  }
  await next();
};
