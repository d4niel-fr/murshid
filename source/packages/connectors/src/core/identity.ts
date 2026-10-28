import type { ApprovalInfo, ProviderStatus } from './connector';
import type { ProviderId } from './types';

/** Sign-in providers (UAE PASS, LinkedIn). They prove identity; they do not sync coursework. */
export interface IdentityProfile {
  provider: ProviderId;
  subject: string; // stable provider user id
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  email_verified: boolean | null;
  /** extra non-sensitive attributes (nationality, user type, locale...) */
  attributes: Record<string, string>;
}

export interface IdentityProvider {
  provider: ProviderId;
  displayName: string;
  scopes: string[];
  approval: ApprovalInfo;
  status: ProviderStatus;
  authUrl(input?: { state?: string }): Promise<{ url: string; state: string; pending: Record<string, string> }>;
  /** Exchanges the code, stores tokens in the vault and returns the mapped profile. */
  handleCallback(input: { code: string; state: string; pending?: Record<string, string> }): Promise<{ token_ref: string; profile: IdentityProfile }>;
}
