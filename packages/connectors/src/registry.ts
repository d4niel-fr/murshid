import type { ApprovalInfo, ProviderStatus } from './core/connector';
import type { ProviderId } from './core/types';

/** Machine-readable version of the README table (api/app can render it). */
export interface ProviderInfo {
  provider: ProviderId;
  name: string;
  scopes: string[];
  approval: ApprovalInfo['required'];
  schoolAdminApproval: boolean;
  status: ProviderStatus;
}

export const PROVIDERS: ProviderInfo[] = [
  { provider: 'google_classroom', name: 'Google Classroom', scopes: ['classroom.courses.readonly', 'classroom.coursework.me.readonly', 'classroom.courseworkmaterials.readonly', 'classroom.announcements.readonly'], approval: ['Google OAuth verification (sensitive scopes)', 'Workspace for Education admin allow-listing (under-18 users)'], schoolAdminApproval: true, status: 'implemented' },
  { provider: 'google_calendar', name: 'Google Calendar', scopes: ['calendar.events'], approval: ['Google OAuth verification (sensitive scope)'], schoolAdminApproval: false, status: 'implemented' },
  { provider: 'microsoft', name: 'Microsoft Teams for Education + Outlook', scopes: ['EduAssignments.ReadBasic', 'EduRoster.ReadBasic', 'Calendars.Read', 'User.Read', 'offline_access'], approval: ['Tenant admin consent (EduAssignments.ReadBasic, EduRoster.ReadBasic)', 'Publisher verification'], schoolAdminApproval: true, status: 'implemented' },
  { provider: 'managebac', name: 'ManageBac', scopes: ['per-school API token (Classes, Tasks, Memberships read)'], approval: ['School admin issues token', 'DPA with school'], schoolAdminApproval: true, status: 'implemented' },
  { provider: 'ics', name: 'ICS import / Apple Calendar feed', scopes: [], approval: [], schoolAdminApproval: false, status: 'implemented' },
  { provider: 'email_forward', name: 'Email-forward inbox', scopes: [], approval: ['Inbound mail domain (api team)'], schoolAdminApproval: false, status: 'implemented' },
  { provider: 'uaepass', name: 'UAE PASS', scopes: ['urn:uae:digitalid:profile:general'], approval: ['SP onboarding', 'UAE trade licence for production'], schoolAdminApproval: false, status: 'sandbox_only' },
  { provider: 'linkedin', name: 'LinkedIn (Sign In + Share)', scopes: ['openid', 'profile', 'email', 'w_member_social'], approval: ['Self-serve LinkedIn products', 'Member 16+', 'Per-post student approval'], schoolAdminApproval: false, status: 'implemented' },
  { provider: 'phoenix', name: 'GEMS Phoenix', scopes: [], approval: ['GEMS partnership', 'LTI 1.3 registration'], schoolAdminApproval: true, status: 'stub' },
  { provider: 'edlink', name: 'Edlink', scopes: ['(configured in Edlink dashboard)'], approval: ['Edlink agreement', 'Per-school Edlink integration approval'], schoolAdminApproval: true, status: 'skeleton' },
];
