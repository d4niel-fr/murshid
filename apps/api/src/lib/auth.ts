import type { MiddlewareHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { verify, verifyWithJwks } from 'hono/jwt';
import type { AppEnv, AuthInfo, Role } from './context';

const ROLES: Role[] = ['student', 'guardian', 'counsellor', 'admin'];

function roleFrom(v: unknown): Role {
  return typeof v === 'string' && (ROLES as string[]).includes(v) ? (v as Role) : 'student';
}

/**
 * Verifies Supabase access tokens from `Authorization: Bearer`: HS256 with SUPABASE_JWT_SECRET (legacy projects), or
 * the project's public keys (ES256/RS256 from SUPABASE_URL's JWKS) for projects with asymmetric signing keys.
 * Murshid role is read from `app_metadata.murshid_role` (set server-side by the db/privacy teams),
 * defaulting to 'student'.
 *
 * Dev mode (AUTH_MODE=dev, or no secret outside production) additionally accepts:
 *   x-dev-user-id: <auth user id>   (seed: dev-aisha, dev-rohan)
 *   x-dev-role:    student|guardian|counsellor|admin (default student)
 *   x-dev-email:   email (guardians are matched by email)
 *   x-dev-school-id: school id (counsellors)
 * A Bearer token is still verified in dev mode if a secret is configured.
 */
export const authMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const { config } = c.get('deps');
  const header = c.req.header('authorization');
  let auth: AuthInfo | null = null;

  if (header?.toLowerCase().startsWith('bearer ') && (config.jwtSecret || config.jwksUrl)) {
    const token = header.slice(7).trim();
    let payload: Record<string, unknown>;
    try {
      payload = (config.jwtSecret
        ? await verify(token, config.jwtSecret, 'HS256')
        : await verifyWithJwks(token, { jwks_uri: config.jwksUrl, allowedAlgorithms: ['ES256', 'RS256'] })) as Record<string, unknown>;
    } catch {
      throw new HTTPException(401, { message: 'invalid or expired token' });
    }
    const aud = payload.aud;
    const audOk = Array.isArray(aud) ? aud.includes(config.jwtAudience) : aud === config.jwtAudience;
    if (!audOk) throw new HTTPException(401, { message: 'invalid token audience' });
    if (typeof payload.sub !== 'string') throw new HTTPException(401, { message: 'token missing sub' });
    const appMeta = (payload.app_metadata ?? {}) as Record<string, unknown>;
    const userMeta = (payload.user_metadata ?? {}) as Record<string, unknown>;
    const name = [userMeta.full_name, userMeta.name].find((x): x is string => typeof x === 'string' && x.trim().length > 0) ?? null;
    auth = {
      userId: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : null,
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
  await next();
};
