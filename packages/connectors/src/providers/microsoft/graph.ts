import type { ApprovalInfo, ConnectorDeps, SyncContext } from '../../core/connector';
import { optionalEnv, requireEnv, type Env } from '../../core/env';
import { getJson, withQuery } from '../../core/http';
import { classifyKind, htmlToText, paginate, taskFromMaterial } from '../../core/normalize';
import type { OAuth2ClientConfig } from '../../core/oauth2';
import { OAuthConnector } from '../../core/oauth-connector';
import { emptySyncResult, type NormalizedCalendarEvent, type NormalizedCourse, type NormalizedMaterial, type SyncResult } from '../../core/types';

export const GRAPH_API = 'https://graph.microsoft.com/v1.0';

/**
 * EduAssignments.ReadBasic and EduRoster.ReadBasic are delegated permissions that
 * REQUIRE TENANT ADMIN CONSENT (Graph permissions reference, AdminConsentRequired: Yes).
 * Calendars.Read is user-consentable. offline_access => refresh token.
 */
export const MS_BASE_SCOPES = ['openid', 'profile', 'offline_access', 'User.Read'];
export const MS_EDU_SCOPES = ['EduAssignments.ReadBasic', 'EduRoster.ReadBasic'];
export const MS_CALENDAR_SCOPES = ['Calendars.Read'];

export function microsoftOAuthConfig(env: Env, scopes: string[]): OAuth2ClientConfig {
  // "organizations" = any work/school tenant. Schools may pin their tenant id.
  const tenant = optionalEnv(env, 'MS_TENANT_ID', 'organizations');
  return {
    clientId: requireEnv(env, 'MS_CLIENT_ID'),
    clientSecret: requireEnv(env, 'MS_CLIENT_SECRET'),
    redirectUri: requireEnv(env, 'MS_REDIRECT_URI'),
    authorizeUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`,
    tokenUrl: `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`,
    scopes,
  };
}

/** Admin-consent URL a school IT admin opens once for the whole tenant. */
export function microsoftAdminConsentUrl(env: Env, tenant: string, state: string): string {
  return withQuery(`https://login.microsoftonline.com/${tenant}/v2.0/adminconsent`, {
    client_id: requireEnv(env, 'MS_CLIENT_ID'),
    redirect_uri: requireEnv(env, 'MS_REDIRECT_URI'),
    scope: [...MS_EDU_SCOPES, ...MS_CALENDAR_SCOPES].map((s) => `https://graph.microsoft.com/${s}`).join(' '),
    state,
  });
}

// --- Raw shapes --------------------------------------------------------------
export interface GraphPage<T> { value?: T[]; '@odata.nextLink'?: string }
export interface EduClass { id: string; displayName: string; description?: string | null; externalName?: string | null }
export interface EduAssignment {
  id: string; classId: string; displayName: string; status?: string;
  dueDateTime?: string | null; closeDateTime?: string | null; webUrl?: string | null;
  instructions?: { content?: string; contentType?: 'text' | 'html' } | null;
}
export interface OutlookEvent {
  id: string; subject?: string; isCancelled?: boolean; isAllDay?: boolean;
  start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string };
}

// --- Normalizers -------------------------------------------------------------
export function normalizeEduClass(studentId: string, c: EduClass): NormalizedCourse {
  return { student_id: studentId, name: c.displayName, teacher: null, source: 'teams', external_id: c.id };
}

export function normalizeEduAssignment(a: EduAssignment): NormalizedMaterial | null {
  if (a.status && !['published', 'assigned'].includes(a.status)) return null;
  const instr = a.instructions?.content ?? null;
  return {
    title: a.displayName,
    kind: classifyKind(a.displayName, 'assignment'),
    body_text: instr ? (a.instructions?.contentType === 'html' ? htmlToText(instr) : instr) : null,
    file_url: a.webUrl ?? null,
    due_at: a.dueDateTime ? new Date(a.dueDateTime).toISOString() : null,
    source: 'teams',
    external_id: a.id,
    course_external_id: a.classId,
  };
}

/** We request Prefer: outlook.timezone="UTC", so dateTime is UTC without offset. */
export function graphDateTimeToIso(dt: { dateTime: string; timeZone: string }): string {
  if (dt.timeZone !== 'UTC') throw new Error(`Expected UTC from Graph, got ${dt.timeZone}`);
  return new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(dt.dateTime) ? dt.dateTime : dt.dateTime + 'Z').toISOString();
}

export function normalizeOutlookEvent(studentId: string, e: OutlookEvent): NormalizedCalendarEvent | null {
  if (e.isCancelled) return null;
  return {
    student_id: studentId,
    title: e.subject ?? '(no title)',
    start_at: graphDateTimeToIso(e.start),
    end_at: graphDateTimeToIso(e.end),
    source: 'outlook',
    external_id: e.id,
  };
}

/**
 * Microsoft 365 Education: Teams assignments (+ class names) and Outlook calendar.
 * options.include = "edu,calendar" (default both).
 */
export class MicrosoftConnector extends OAuthConnector {
  readonly provider = 'microsoft' as const;
  readonly displayName = 'Microsoft Teams for Education + Outlook';
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = {
    required: [
      'Microsoft Entra app registration (multi-tenant)',
      'Tenant ADMIN CONSENT for EduAssignments.ReadBasic and EduRoster.ReadBasic (students cannot self-consent)',
      'Publisher verification recommended (many school tenants block unverified multi-tenant apps)',
    ],
    schoolAdminApproval: true,
    notes: 'Calendars.Read is user-consentable unless the tenant disables user consent. No token revocation endpoint: users remove the app at https://myapps.microsoft.com.',
  };

  constructor(deps: ConnectorDeps) {
    const env = deps.env ?? process.env;
    super(microsoftOAuthConfig(env, [...MS_BASE_SCOPES, ...MS_EDU_SCOPES, ...MS_CALENDAR_SCOPES]), deps);
  }

  private pages<T>(url: string, headers: Record<string, string>): Promise<T[]> {
    return paginate<GraphPage<T>, T>(
      (next) => getJson(next ?? url, headers, this.deps.http),
      (p) => p.value,
      (p) => p['@odata.nextLink'],
    );
  }

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const out = emptySyncResult();
    const include = (ctx.options?.include ?? 'edu,calendar').split(',');
    const h = await this.bearer(ctx.tokenRef);

    if (include.includes('edu')) {
      const classes = await this.pages<EduClass>(`${GRAPH_API}/education/me/classes`, h);
      out.courses.push(...classes.map((c) => normalizeEduClass(ctx.studentId, c)));
      const assignments = await this.pages<EduAssignment>(`${GRAPH_API}/education/me/assignments`, h);
      for (const a of assignments) {
        const m = normalizeEduAssignment(a);
        if (!m) continue;
        out.materials.push(m);
        if (m.due_at) out.tasks.push(taskFromMaterial(ctx.studentId, m));
      }
    }

    if (include.includes('calendar')) {
      const now = ctx.now ?? new Date();
      const days = Number(ctx.options?.windowDays ?? 30);
      const url = withQuery(`${GRAPH_API}/me/calendarView`, {
        startDateTime: now.toISOString(),
        endDateTime: new Date(now.getTime() + days * 86_400_000).toISOString(),
        $select: 'id,subject,start,end,isAllDay,isCancelled',
        $top: 100,
      });
      const events = await this.pages<OutlookEvent>(url, { ...h, prefer: 'outlook.timezone="UTC"' });
      for (const e of events) {
        const n = normalizeOutlookEvent(ctx.studentId, e);
        if (n) out.events.push(n);
      }
    }
    return out;
  }

  /** Microsoft identity platform has no per-app refresh-token revocation endpoint for this flow. */
  protected override async providerRevoke() {
    return { providerRevoked: false, note: 'Local tokens deleted. To fully remove access the student (or tenant admin) removes Murshid at https://myapps.microsoft.com.' };
  }
}
