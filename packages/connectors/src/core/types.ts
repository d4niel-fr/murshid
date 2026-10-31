/**
 * Local copies of the canonical domain types from docs/CONTRACT.md.
 * packages/core (db team) will own the real zod schemas; swap these imports
 * for `@murshid/core` once it is published. See README "Integration notes".
 */

export type Uuid = string;
export type IsoDateTime = string; // always UTC, e.g. 2026-10-15T19:59:00.000Z

export type ProviderId =
  | 'google_classroom'
  | 'google_calendar'
  | 'microsoft'
  | 'managebac'
  | 'ics'
  | 'email_forward'
  | 'uaepass'
  | 'linkedin'
  | 'phoenix'
  | 'edlink';

/** `source` values written onto Course / Material / CalendarEvent rows. */
export type SourceId =
  | 'google_classroom'
  | 'google_calendar'
  | 'teams'
  | 'outlook'
  | 'managebac'
  | 'ics'
  | 'email_forward'
  | 'phoenix'
  | 'edlink'
  | 'manual';

export interface Course {
  id: Uuid;
  student_id: Uuid;
  name: string;
  teacher: string | null;
  source: SourceId;
  external_id: string;
}

export type MaterialKind = 'note' | 'assignment' | 'announcement' | 'exam';

export interface Material {
  id: Uuid;
  course_id: Uuid | null;
  title: string;
  kind: MaterialKind;
  body_text: string | null;
  file_url: string | null;
  due_at: IsoDateTime | null;
  source: SourceId;
  external_id: string;
  ingested_at: IsoDateTime;
}

export type TaskKind = 'study' | 'assignment' | 'application' | 'activity' | 'habit';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped';

export interface Task {
  id: Uuid;
  student_id: Uuid;
  title: string;
  kind: TaskKind;
  due_at: IsoDateTime | null;
  est_minutes: number | null;
  status: TaskStatus;
  linked_goal_id: Uuid | null;
  linked_material_id: Uuid | null;
  linked_opportunity_id: Uuid | null;
  ai_use_level: 'none' | 'support' | 'led';
}

export interface CalendarEvent {
  id: Uuid;
  student_id: Uuid;
  title: string;
  start_at: IsoDateTime;
  end_at: IsoDateTime;
  source: SourceId;
  external_id: string;
}

export interface Connection {
  id: Uuid;
  student_id: Uuid;
  provider: ProviderId;
  scopes: string[];
  status: 'active' | 'expired' | 'revoked' | 'error' | 'pending_admin_consent';
  token_ref: string | null;
  last_sync_at: IsoDateTime | null;
}

export interface AuditLogEntry {
  actor: string; // e.g. "connector:google_classroom"
  action: string; // e.g. "sync.read"
  resource: string; // e.g. "student:<uuid>/courses"
  at: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Normalized shapes emitted by connectors. Connectors never know DB ids, so
// relations are expressed with external ids; the api/db layer upserts on
// (student_id, source, external_id) and resolves the links.
// ---------------------------------------------------------------------------

export type NormalizedCourse = Omit<Course, 'id'>;

export type NormalizedMaterial = Omit<Material, 'id' | 'course_id' | 'ingested_at'> & {
  course_external_id: string | null;
};

export type NormalizedCalendarEvent = Omit<CalendarEvent, 'id'>;

export type NormalizedTask = Omit<Task, 'id' | 'linked_material_id'> & {
  /** external_id of the Material this task was derived from (same source). */
  linked_material_external_id: string | null;
};

export interface SyncResult {
  courses: NormalizedCourse[];
  materials: NormalizedMaterial[];
  events: NormalizedCalendarEvent[];
  tasks: NormalizedTask[];
  warnings: string[];
}

export function emptySyncResult(): SyncResult {
  return { courses: [], materials: [], events: [], tasks: [], warnings: [] };
}
