import type { HttpOptions } from './http';
import type { TokenVault } from './vault';
import type { ProviderId, SyncResult } from './types';

export type AuthKind = 'oauth2' | 'api_token' | 'url_or_file' | 'email_forward' | 'lti' | 'none';

export type ProviderStatus = 'implemented' | 'sandbox_only' | 'skeleton' | 'stub';

/** What has to happen outside code before this connector can be used for real. */
export interface ApprovalInfo {
  /** e.g. "Google OAuth app verification (sensitive scopes)" */
  required: string[];
  /** true when a school / tenant admin must approve before a student can connect */
  schoolAdminApproval: boolean;
  notes?: string;
}

export interface ConnectorDescriptor {
  provider: ProviderId;
  displayName: string;
  authKind: AuthKind;
  scopes: string[];
  approval: ApprovalInfo;
  status: ProviderStatus;
}

export interface AuthStart {
  url: string;
  state: string;
  /** keep server-side, keyed by state (PKCE verifier, nonce). Never send to client. */
  pending: Record<string, string>;
}

export type CallbackInput =
  | { kind: 'oauth2'; code: string; state: string; pending?: Record<string, string> }
  | { kind: 'api_token'; token: string; meta?: Record<string, string> };

export interface ConnectionGrant {
  provider: ProviderId;
  token_ref: string;
  scopes: string[];
  status: 'active' | 'pending_admin_consent';
}

export interface SyncContext {
  studentId: string;
  tokenRef: string;
  /** ISO timestamp of the last successful sync; connectors may use it for delta queries */
  since?: string | null;
  /** clock for deterministic tests */
  now?: Date;
  /** provider specific options (ics url, managebac student id, window size...) */
  options?: Record<string, string>;
}

export interface ConnectorDeps {
  vault: TokenVault;
  http?: HttpOptions;
  env?: Record<string, string | undefined>;
}

/** Common interface every data connector implements. */
export interface Connector extends ConnectorDescriptor {
  authUrl(input: { state?: string }): Promise<AuthStart>;
  handleCallback(input: CallbackInput): Promise<ConnectionGrant>;
  /** Refresh the access token if needed. No-op for non-expiring credentials. */
  refresh(tokenRef: string): Promise<void>;
  sync(ctx: SyncContext): Promise<SyncResult>;
  /** Revoke at the provider (where supported) and always delete from the vault. */
  revoke(tokenRef: string): Promise<{ providerRevoked: boolean; note?: string }>;
}
