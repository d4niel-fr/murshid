import type { ApprovalInfo, AuthStart, CallbackInput, ConnectionGrant, Connector, SyncContext } from '../core/connector';
import { NotAvailableError } from '../core/errors';
import type { SyncResult } from '../core/types';

/**
 * GEMS Phoenix (GEMS Education's in-house LMS/SIS) — STUB.
 * There is no public student API. Real integration needs one of:
 *   (a) a GEMS partnership + LTI 1.3 tool registration (Murshid as tool; see providers/lti/lti13.ts),
 *   (b) a GEMS-provided data feed/API agreement, or
 *   (c) an aggregator (Edlink) if/when it supports Phoenix.
 * Until then students use the email-forward inbox (phoenixRule) or ICS export where available.
 * We do NOT scrape Phoenix or ask for student Phoenix passwords.
 */
export class PhoenixConnector implements Connector {
  readonly provider = 'phoenix' as const;
  readonly displayName = 'GEMS Phoenix';
  readonly authKind = 'lti' as const;
  readonly scopes: string[] = [];
  readonly status = 'stub' as const;
  readonly approval: ApprovalInfo = {
    required: ['GEMS Education partnership / data-sharing agreement', 'LTI 1.3 tool registration in Phoenix (issuer, client_id, deployment_id, JWKS)'],
    schoolAdminApproval: true,
    notes: 'Fallback today: email-forward inbox parser.',
  };

  private fail(): never {
    throw new NotAvailableError('GEMS Phoenix integration requires a GEMS partnership + LTI 1.3 registration. Use email forwarding meanwhile.');
  }
  async authUrl(): Promise<AuthStart> { this.fail(); }
  async handleCallback(_i: CallbackInput): Promise<ConnectionGrant> { this.fail(); }
  async refresh(): Promise<void> { this.fail(); }
  async sync(_c: SyncContext): Promise<SyncResult> { this.fail(); }
  async revoke(): Promise<{ providerRevoked: boolean; note?: string }> {
    return { providerRevoked: false, note: 'Nothing stored for Phoenix.' };
  }
}
