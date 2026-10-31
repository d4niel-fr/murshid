import type { ApprovalInfo, ConnectorDeps, SyncContext } from '../core/connector';
import { requireEnv } from '../core/env';
import { getJson } from '../core/http';
import { classifyKind, htmlToText, paginate, taskFromMaterial } from '../core/normalize';
import { OAuthConnector } from '../core/oauth-connector';
import { emptySyncResult, type NormalizedCourse, type NormalizedMaterial, type SyncResult } from '../core/types';

/**
 * Edlink unified API (User API, scoped to the signed-in student) — SKELETON.
 * Docs: https://ed.link/docs/api/v2.0/introduction
 *   SSO:   https://ed.link/sso/login  (code flow)
 *   Token: https://ed.link/api/authentication/token  (response wrapped in {$data})
 *   Data:  https://ed.link/api/v2/my/classes, /my/classes/:id/assignments  (paging via $next)
 * Edlink fronts many LMSs (Google, Microsoft, Canvas, Moodle, ManageBac, Toddle, ...).
 */
export const EDLINK_API = 'https://ed.link/api/v2';

export interface EdPage<T> { $data?: T[]; $next?: string }
export interface EdClass { id: string; name: string; state?: string }
export interface EdAssignment { id: string; title: string; description?: string | null; due_date?: string | null; state?: string; url?: string | null }

export function normalizeEdClass(studentId: string, c: EdClass): NormalizedCourse {
  return { student_id: studentId, name: c.name, teacher: null, source: 'edlink', external_id: c.id };
}

export function normalizeEdAssignment(classId: string, a: EdAssignment): NormalizedMaterial {
  return {
    title: a.title,
    kind: classifyKind(a.title, 'assignment'),
    body_text: a.description ? htmlToText(a.description) : null,
    file_url: a.url ?? null,
    due_at: a.due_date ? new Date(a.due_date).toISOString() : null,
    source: 'edlink',
    external_id: a.id,
    course_external_id: classId,
  };
}

export class EdlinkConnector extends OAuthConnector {
  readonly provider = 'edlink' as const;
  readonly displayName = 'Edlink (unified LMS API)';
  readonly status = 'skeleton' as const;
  readonly approval: ApprovalInfo = {
    required: ['Edlink developer account + commercial agreement', 'Each school/district must connect its LMS to Edlink and approve Murshid (Edlink integration request)'],
    schoolAdminApproval: true,
  };
  protected override usePkce = false;

  constructor(deps: ConnectorDeps) {
    const env = deps.env ?? process.env;
    super(
      {
        clientId: requireEnv(env, 'EDLINK_CLIENT_ID'),
        clientSecret: requireEnv(env, 'EDLINK_CLIENT_SECRET'),
        redirectUri: requireEnv(env, 'EDLINK_REDIRECT_URI'),
        authorizeUrl: 'https://ed.link/sso/login',
        tokenUrl: 'https://ed.link/api/authentication/token',
        scopes: [], // Edlink permissions are configured per-application in the dashboard
      },
      deps,
    );
  }

  private pages<T>(url: string, h: Record<string, string>) {
    return paginate<EdPage<T>, T>((next) => getJson(next ?? url, h, this.deps.http), (p) => p.$data, (p) => p.$next);
  }

  async sync(ctx: SyncContext): Promise<SyncResult> {
    const out = emptySyncResult();
    const h = await this.bearer(ctx.tokenRef);
    const classes = await this.pages<EdClass>(`${EDLINK_API}/my/classes`, h);
    for (const c of classes.filter((c) => c.state !== 'completed' && c.state !== 'inactive')) {
      out.courses.push(normalizeEdClass(ctx.studentId, c));
      const assignments = await this.pages<EdAssignment>(`${EDLINK_API}/my/classes/${encodeURIComponent(c.id)}/assignments`, h);
      for (const a of assignments) {
        const m = normalizeEdAssignment(c.id, a);
        out.materials.push(m);
        if (m.due_at) out.tasks.push(taskFromMaterial(ctx.studentId, m));
      }
    }
    // TODO-LATER: announcements (/my/classes/:id/announcements), events, people/profile.
    return out;
  }
}
