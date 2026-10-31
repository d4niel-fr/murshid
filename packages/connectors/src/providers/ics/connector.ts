import type { ApprovalInfo, AuthStart, CallbackInput, ConnectionGrant, Connector, ConnectorDeps, SyncContext } from '../../core/connector';
import { ConnectorError } from '../../core/errors';
import { httpRequest } from '../../core/http';
import { classifyKind } from '../../core/normalize';
import { emptySyncResult, type SyncResult } from '../../core/types';
import { parseIcs } from './parse';

const MAX_ICS_BYTES = 5 * 1024 * 1024;

/** Only public https (or webcal) URLs; blocks localhost / private ranges (SSRF guard). */
export function assertSafeIcsUrl(raw: string): string {
  const url = new URL(raw.replace(/^webcals?:\/\//i, 'https://'));
  if (url.protocol !== 'https:') throw new ConnectorError('ICS URL must be https or webcal', 'bad_url');
  const h = url.hostname;
  if (
    h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal') ||
    /^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h === '[::1]' || /^\[?f[cd]/i.test(h)
  ) {
    throw new ConnectorError('ICS URL host not allowed', 'bad_url');
  }
  return url.toString();
}

export function icsToSyncResult(studentId: string, text: string, feedKey: string): SyncResult {
  const out = emptySyncResult();
  const { events, todos } = parseIcs(text);
  for (const e of events) {
    if (e.status === 'CANCELLED') continue;
    out.events.push({ student_id: studentId, title: e.summary, start_at: e.start, end_at: e.end, source: 'ics', external_id: `${feedKey}:${e.uid}` });
    if (e.rrule) out.warnings.push(`Recurring event "${e.summary}" imported once (RRULE not expanded)`);
  }
  for (const t of todos) {
    if (t.status === 'COMPLETED' || t.status === 'CANCELLED') continue;
    const ext = `${feedKey}:${t.uid}`;
    const kind = classifyKind(t.summary, 'assignment');
    out.materials.push({ title: t.summary, kind, body_text: t.description, file_url: null, due_at: t.due, source: 'ics', external_id: ext, course_external_id: null });
  }
  return out;
}

/**
 * ICS import. The "token" stored in the vault is the feed URL itself because
 * school calendar URLs often embed a private key (Google "secret address", Outlook published URL).
 */
export class IcsImportConnector implements Connector {
  readonly provider = 'ics' as const;
  readonly displayName = 'Calendar file / URL (.ics)';
  readonly authKind = 'url_or_file' as const;
  readonly scopes: string[] = [];
  readonly status = 'implemented' as const;
  readonly approval: ApprovalInfo = { required: [], schoolAdminApproval: false, notes: 'Student pastes a subscription URL or uploads a file.' };

  constructor(private readonly deps: ConnectorDeps) {}

  async authUrl(): Promise<AuthStart> {
    throw new ConnectorError('ICS import has no redirect flow; pass the URL via handleCallback({kind:"api_token", token:url})', 'no_redirect_flow');
  }

  async handleCallback(input: CallbackInput): Promise<ConnectionGrant> {
    if (input.kind !== 'api_token') throw new ConnectorError('ICS expects {kind:"api_token", token:<url>}', 'bad_callback');
    const url = assertSafeIcsUrl(input.token);
    const token_ref = await this.deps.vault.put(this.provider, { access_token: url });
    return { provider: this.provider, token_ref, scopes: [], status: 'active' };
  }

  async refresh(): Promise<void> {}

  /** options.icsText imports an uploaded file instead of fetching the URL. */
  async sync(ctx: SyncContext): Promise<SyncResult> {
    if (ctx.options?.icsText) return icsToSyncResult(ctx.studentId, ctx.options.icsText, 'file');
    const { access_token: url } = await this.deps.vault.get(ctx.tokenRef);
    const res = await httpRequest(assertSafeIcsUrl(url), { method: 'GET', headers: { accept: 'text/calendar' } }, this.deps.http);
    const text = await res.text();
    if (text.length > MAX_ICS_BYTES) throw new ConnectorError('ICS feed too large', 'too_large');
    return icsToSyncResult(ctx.studentId, text, ctx.tokenRef.split(':').pop() ?? 'feed');
  }

  async revoke(tokenRef: string) {
    await this.deps.vault.delete(tokenRef);
    return { providerRevoked: false, note: 'Feed URL deleted. If the URL was a private/secret address, the student can reset it at the source.' };
  }
}
