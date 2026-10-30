import type { ApprovalInfo, AuthStart, CallbackInput, ConnectionGrant, Connector, ConnectorDeps, SyncContext } from '../core/connector';
import { optionalEnv } from '../core/env';
import { ConnectorError } from '../core/errors';
import { getJson, withQuery } from '../core/http';
import { classifyKind, htmlToText, taskFromMaterial } from '../core/normalize';
import { emptySyncResult, type NormalizedCourse, type NormalizedMaterial, type SyncResult } from '../core/types';

/**
 * ManageBac public REST API (Faria). Stable version path v2p2.
 * Docs: https://guide.fariaedu.com/integrations-portal/managebac/public-rest-apis
 * Auth: per-school token created by a school admin (Settings > Develop > API Manager),
 * sent as the `auth-token` header. The token is SCHOOL-WIDE, so this connector only
 * ever reads the memberships of the one linked student.
 */
export const MANAGEBAC_DEFAULT_BASE = 'https://api.managebac.com';
export const MANAGEBAC_VERSION = 'v2p2';

export interface MbMeta { current_page?: number; total_pages?: number; per_page?: number; total_count?: number }
export interface MbMembershipClass { id: number; uniq_id?: string; name: string; archived?: boolean }
export interface MbClass { id: number; name: string; subject_name?: string; teachers?: { id: number; first_name?: string; last_name?: string; name?: string }[] }
/** Task fields per CoreTaskAttributes (name, due_date, ...). List key `tasks` verified only against fixtures. */
export interface MbTask { id: number; name: string; description?: string | null; due_date?: string | null; task_type?: string | null; assessment_type?: string | null }

export function normalizeMbClass(studentId: string, c: MbMembershipClass, detail?: MbClass): NormalizedCourse {
  const t = detail?.teachers?.[0];
  const teacher = t ? (t.name ?? [t.first_name, t.last_name].filter(Boolean).join(' ')) || null : null;
  return { student_id: studentId, name: detail?.name ?? c.name, teacher, source: 'managebac', external_id: String(c.id) };
}

export function normalizeMbTask(classId: number, t: MbTask): NormalizedMaterial {
  const typeHint = `${t.task_type ?? ''} ${t.assessment_type ?? ''}`;
  const kind = /summative|exam|test|quiz/i.test(typeHint) ? 'exam' : classifyKind(t.name, 'assignment');
  return {
    title: t.name,
    kind,
    body_text: t.description ? htmlToText(t.description) : null,
    file_url: null,
    due_at: t.due_date ? new Date(t.due_date).toISOString() : null,
    source: 'managebac',
    external_id: `task:${t.id}`,
    course_external_id: String(classId),
  };
}

export class ManageBacConnector implements Connector {
  readonly provider = 'managebac' as const;
  readonly displayName = 'ManageBac';
  readonly authKind = 'api_token' as const;
  readonly scopes = ['school-api-token:classes.read', 'school-api-token:tasks.read', 'school-api-token:memberships.read'];
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = {
    required: [
      'School admin creates an API token in ManageBac (Settings > Develop > API Manager) with read access to Classes/Tasks/Memberships',
      'Data-processing agreement with the school (token exposes whole-school data)',
    ],
    schoolAdminApproval: true,
    notes: 'One token per school, stored once in the vault; each student connection references it plus the student\'s ManageBac id.',
  };

  constructor(private readonly deps: ConnectorDeps) {}

  async authUrl(): Promise<AuthStart> {
    throw new ConnectorError('ManageBac uses a per-school API token, not a redirect flow. Call handleCallback({kind:"api_token"}).', 'no_redirect_flow');
  }

  /** meta.host overrides the regional API server (e.g. https://api.us.managebac.com). */
  async handleCallback(input: CallbackInput): Promise<ConnectionGrant> {
    if (input.kind !== 'api_token') throw new ConnectorError('ManageBac expects an api_token', 'bad_callback');
    const host = input.meta?.host ?? optionalEnv(this.deps.env ?? process.env, 'MANAGEBAC_API_HOST', MANAGEBAC_DEFAULT_BASE);
    const token_ref = await this.deps.vault.put(this.provider, { access_token: input.token, meta: { host, ...(input.meta ?? {}) } });
    return { provider: this.provider, token_ref, scopes: this.scopes, status: 'active' };
  }

  async refresh(): Promise<void> {
    /* school tokens do not expire */
  }

  private async ctxFor(tokenRef: string) {
    const t = await this.deps.vault.get(tokenRef);
    return { base: `${t.meta?.host ?? MANAGEBAC_DEFAULT_BASE}/${MANAGEBAC_VERSION}`, headers: { 'auth-token': t.access_token } };
  }

  /** options.managebacStudentId is required (resolved by school admin / SSO mapping). */
  async sync(ctx: SyncContext): Promise<SyncResult> {
    const sid = ctx.options?.managebacStudentId;
    if (!sid) throw new ConnectorError('options.managebacStudentId is required', 'missing_option');
    const { base, headers } = await this.ctxFor(ctx.tokenRef);
    const out = emptySyncResult();
    const mem = await getJson<{ memberships?: { classes?: MbMembershipClass[] } }>(
      `${base}/students/${encodeURIComponent(sid)}/memberships`,
      headers,
      this.deps.http,
    );
    for (const c of (mem.memberships?.classes ?? []).filter((c) => !c.archived)) {
      const detail = await getJson<{ class?: MbClass }>(`${base}/classes/${c.id}`, headers, this.deps.http).then((r) => r.class).catch(() => undefined);
      out.courses.push(normalizeMbClass(ctx.studentId, c, detail));
      // Tasks endpoint: pages via ?page=&per_page= with meta.total_pages
      for (let page = 1; page <= 20; page++) {
        const res = await getJson<{ tasks?: MbTask[]; meta?: MbMeta }>(withQuery(`${base}/classes/${c.id}/tasks`, { page, per_page: 100 }), headers, this.deps.http);
        for (const t of res.tasks ?? []) {
          const m = normalizeMbTask(c.id, t);
          out.materials.push(m);
          if (m.due_at) out.tasks.push(taskFromMaterial(ctx.studentId, m));
        }
        if (!res.meta?.total_pages || page >= res.meta.total_pages) break;
      }
    }
    return out;
  }

  /**
   * A student disconnecting must NOT delete the shared school token: the api layer
   * just drops the student's Connection row. Use revokeSchoolToken() when the school offboards.
   */
  async revoke(_tokenRef: string) {
    return { providerRevoked: false, note: 'Student link removed; shared school token kept. School admins revoke tokens in ManageBac API Manager.' };
  }

  async revokeSchoolToken(tokenRef: string) {
    await this.deps.vault.delete(tokenRef);
    return { providerRevoked: false, note: 'Deleted from vault. Also disable the token in ManageBac API Manager.' };
  }
}
