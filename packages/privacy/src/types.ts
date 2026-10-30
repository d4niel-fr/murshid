/**
 * Local copies of the contract types this package needs (docs/CONTRACT.md).
 * Replace with imports from @murshid/core once that package publishes them.
 */

export type Uuid = string;
export type IsoDateTime = string; // ISO-8601 with offset
export type IsoDate = string; // YYYY-MM-DD

export type AiUseLevel = 'none' | 'support' | 'led';
export type ConsentStatus = 'pending' | 'granted' | 'revoked';

export interface Student {
  id: Uuid;
  auth_user_id: Uuid;
  full_name: string;
  preferred_name?: string;
  date_of_birth: IsoDate;
  grade: number;
  school_id: Uuid;
  emirate?: string;
  created_at: IsoDateTime;
}

export interface Guardian {
  id: Uuid;
  student_id: Uuid;
  name: string;
  email: string;
  phone?: string;
  relation: string;
  consent_status: ConsentStatus;
  verified_at: IsoDateTime | null;
}

export interface Task {
  id: Uuid;
  student_id: Uuid;
  title: string;
  kind: 'study' | 'assignment' | 'application' | 'activity' | 'habit';
  ai_use_level: AiUseLevel;
}

/** Tables that hold student data (snake_case plurals per contract). */
export const STUDENT_DATA_TABLES = [
  'students',
  'guardians',
  'goals',
  'milestones',
  'courses',
  'materials',
  'tasks',
  'calendar_events',
  'applications',
  'achievements',
  'cv_versions',
  'notifications',
  'connections',
  'consent_records',
  'ai_use_logs',
  'audit_logs',
] as const;
export type StudentDataTable = (typeof STUDENT_DATA_TABLES)[number];

/** Injectable clock so tests are deterministic. */
export type Clock = () => Date;
export const systemClock: Clock = () => new Date();
