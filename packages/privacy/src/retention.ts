/**
 * Retention policy config. Values are proposals for legal review, chosen on
 * PDPL's data-minimisation / storage-limitation principle: keep only as long
 * as needed for the purpose, then delete or anonymise.
 */
import type { StudentDataTable } from './types.js';

export interface RetentionRule {
  /** Days after `trigger` to delete. null = keep while account active. */
  days: number | null;
  trigger: 'created' | 'account_deleted' | 'inactive' | 'completed';
  action: 'delete' | 'anonymise';
  note: string;
}

export const RETENTION_POLICY: Record<StudentDataTable | 'tombstones' | 'guardian_invites' | 'raw_connector_payloads', RetentionRule> = {
  students: { days: null, trigger: 'account_deleted', action: 'delete', note: 'Deleted on account deletion.' },
  guardians: { days: null, trigger: 'account_deleted', action: 'delete', note: 'Deleted with the student.' },
  goals: { days: null, trigger: 'account_deleted', action: 'delete', note: '' },
  milestones: { days: null, trigger: 'account_deleted', action: 'delete', note: '' },
  courses: { days: 365, trigger: 'completed', action: 'delete', note: 'One year after the course/academic year ends.' },
  materials: { days: 180, trigger: 'created', action: 'delete', note: 'LMS copies are re-syncable; keep 6 months.' },
  tasks: { days: 365, trigger: 'completed', action: 'delete', note: '' },
  calendar_events: { days: 90, trigger: 'completed', action: 'delete', note: '' },
  applications: { days: null, trigger: 'account_deleted', action: 'delete', note: 'Student portfolio; kept while account active.' },
  achievements: { days: null, trigger: 'account_deleted', action: 'delete', note: '' },
  cv_versions: { days: null, trigger: 'account_deleted', action: 'delete', note: 'Old versions pruned to latest 10 by documents team.' },
  notifications: { days: 90, trigger: 'created', action: 'delete', note: '' },
  connections: { days: null, trigger: 'account_deleted', action: 'delete', note: 'Tokens revoked at provider on deletion.' },
  consent_records: { days: 365 * 3, trigger: 'account_deleted', action: 'anonymise', note: 'Kept (pseudonymised) as proof of lawful basis. Legal to confirm period.' },
  ai_use_logs: { days: 365 * 2, trigger: 'created', action: 'delete', note: 'Covers two academic years for integrity questions.' },
  audit_logs: { days: 365 * 3, trigger: 'created', action: 'anonymise', note: 'Security/accountability record. Legal to confirm.' },
  tombstones: { days: 365 * 3, trigger: 'created', action: 'delete', note: 'Proof that deletion happened.' },
  guardian_invites: { days: 30, trigger: 'created', action: 'delete', note: 'OTP hashes; short-lived.' },
  raw_connector_payloads: { days: 7, trigger: 'created', action: 'delete', note: 'Staging only.' },
};

/** Accounts inactive this long get a warning, then deletion 30 days later. */
export const INACTIVITY_DELETE_DAYS = 730;

export function isExpired(rule: RetentionRule, triggerAt: Date, now: Date): boolean {
  if (rule.days === null) return false;
  return now.getTime() - triggerAt.getTime() >= rule.days * 86_400_000;
}
