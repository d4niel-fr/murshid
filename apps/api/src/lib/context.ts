import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { Repository } from '../repo/types';
import type { Student } from '../domain';
import { ageOn } from './time';

export interface Config {
  authMode: 'jwt' | 'dev';
  jwtSecret: string;
  jwtAudience: string;
  inboxSecret: string;
  inboxDomain: string;
  publicApiUrl: string;
  /** Supabase's public signing keys (projects with asymmetric JWT keys); used when there is no shared secret */
  jwksUrl: string;
  /** emails that are Murshid platform admins in production (PLATFORM_ADMIN_EMAILS, comma-separated) */
  platformAdmins: string[];
}

export type Role = 'student' | 'guardian' | 'counsellor' | 'admin';

export interface AuthInfo {
  userId: string;
  email: string | null;
  role: Role;
  /** display name from the sign-in provider (user_metadata.full_name / name) */
  name?: string | null;
  /** 'jwt' for verified Supabase tokens, 'dev' for header auth, 'webhook' for inbox secret */
  via: 'jwt' | 'dev' | 'webhook';
  /** counsellors: the school they belong to (app_metadata.school_id / x-dev-school-id) */
  schoolId?: string | null;
}

export interface Deps {
  repo: Repository;
  config: Config;
  now: () => Date;
  /** production sign-in: who the signed-in person is in Murshid (set by buildApi; see schools/accounts.ts) */
  whoami?: (c: Ctx) => Promise<import('../schools/accounts').Me>;
  /** notifications (inbox, push, email): see notify/hub.ts */
  notify?: import('../notify/hub').NotificationHub;
}

export type AppEnv = { Variables: { auth: AuthInfo; deps: Deps; requestId: string; /** set by /student/me/* routes: the signed-in student */ self?: { id: string } } };
export type Ctx = Context<AppEnv>;

export function readConfig(env: Record<string, string | undefined>): Config {
  const jwtSecret = env.SUPABASE_JWT_SECRET ?? '';
  const explicit = env.AUTH_MODE;
  const authMode: Config['authMode'] =
    explicit === 'jwt' || explicit === 'dev' ? explicit : jwtSecret || env.NODE_ENV === 'production' ? 'jwt' : 'dev';
  return {
    authMode,
    jwtSecret,
    jwtAudience: env.SUPABASE_JWT_AUDIENCE ?? 'authenticated',
    // dev default matches .env.example so the webhook works out of the box; never defaulted in jwt mode
    inboxSecret: env.INBOX_WEBHOOK_SECRET ?? (authMode === 'dev' ? 'change-me-dev-only' : ''),
    inboxDomain: env.INBOX_DOMAIN ?? 'inbox.murshid.local',
    // on Vercel the API is the "api" service at /api on the project's production domain
    publicApiUrl: env.PUBLIC_API_URL ?? (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}/api` : 'http://localhost:8787'),
    jwksUrl: env.SUPABASE_JWKS_URL?.trim() || (env.SUPABASE_URL?.trim() ? `${env.SUPABASE_URL.trim().replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json` : ''),
    platformAdmins: (env.PLATFORM_ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
  };
}

export const notFound = (what = 'resource'): never => {
  throw new HTTPException(404, { message: `${what} not found` });
};
export const forbidden = (msg = 'forbidden'): never => {
  throw new HTTPException(403, { message: msg });
};
export const badRequest = (msg: string): never => {
  throw new HTTPException(400, { message: msg });
};

/** The student profile owned by the caller. 404 with a hint when the caller has no profile yet. */
export async function currentStudent(c: Ctx): Promise<Student> {
  const auth = c.get('auth');
  const { repo } = c.get('deps');
  if (auth.role !== 'student' && auth.role !== 'admin') forbidden('student role required');
  const s = await repo.students.findOne({ auth_user_id: auth.userId });
  if (!s) {
    throw new HTTPException(404, { message: 'no student profile for this user; create one with POST /students' });
  }
  return s;
}

export interface ConsentState {
  age: number;
  minor: boolean;
  guardian_consent: 'granted' | 'pending' | 'revoked' | 'none';
  /** connectors / notifications to anyone but the student are allowed */
  can_connect: boolean;
}

/** Contract: 13+ only; under 18 needs guardian consent before connectors or third-party notifications. */
export async function consentState(c: Ctx, student: Student): Promise<ConsentState> {
  const { repo, now } = c.get('deps');
  const age = ageOn(student.date_of_birth, now());
  const guardians = await repo.guardians.list({ student_id: student.id });
  const guardian_consent = guardians.some((g) => g.consent_status === 'granted')
    ? 'granted'
    : guardians.some((g) => g.consent_status === 'pending')
      ? 'pending'
      : guardians.some((g) => g.consent_status === 'revoked') ? 'revoked' : 'none';
  const minor = age < 18;
  return { age, minor, guardian_consent, can_connect: !minor || guardian_consent === 'granted' };
}

/** Audit every read of student data by the agent/connectors (contract rule). */
export async function audit(c: Ctx, action: string, resource: string): Promise<void> {
  const { repo, now } = c.get('deps');
  const auth = c.get('auth');
  await repo.auditLogs.create({ actor: `${auth.role}:${auth.userId}`, action, resource, at: now().toISOString() });
}
