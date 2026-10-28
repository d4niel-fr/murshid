// Local copy of the canonical domain types from docs/CONTRACT.md.
// Swap for `@murshid/core` once packages/core publishes them (see README → Integration notes).

export type UUID = string;
export type ISODate = string; // YYYY-MM-DD or full ISO timestamp

export type Curriculum = 'british' | 'indian_cbse' | 'indian_icse' | 'american' | 'ib' | 'uae_moe' | 'other';
export type Lms = 'google_classroom' | 'teams' | 'phoenix' | 'managebac' | 'toddle' | 'other';
export type Emirate = 'abu_dhabi' | 'dubai' | 'sharjah' | 'ajman' | 'umm_al_quwain' | 'ras_al_khaimah' | 'fujairah';

export interface Student {
  id: UUID;
  auth_user_id: UUID;
  full_name: string;
  preferred_name: string;
  date_of_birth: ISODate;
  grade: number; // 6-13
  school_id: UUID | null;
  curriculum: Curriculum;
  emirate: Emirate | null;
  nationality: string | null;
  languages: string[];
  interests: string[];
  strengths: string[];
  created_at: ISODate;
  // App-side onboarding extra (stored by API as goals); plain-words goals the student typed.
  goals_text?: string;
}

export interface School {
  id: UUID;
  name: string;
  emirate: Emirate;
  curriculum: Curriculum;
  lms: Lms;
  domain: string;
}

export type ConsentStatus = 'pending' | 'granted' | 'revoked';
export interface Guardian {
  id: UUID;
  student_id: UUID;
  name: string;
  email: string;
  phone: string | null;
  relation: string;
  consent_status: ConsentStatus;
  verified_at: ISODate | null;
}

export type GoalCategory = 'academic' | 'university' | 'career' | 'sport' | 'skill' | 'personal';
export interface Goal {
  id: UUID;
  student_id: UUID;
  title: string;
  category: GoalCategory;
  target_date: ISODate | null;
  status: 'active' | 'done' | 'paused';
  parent_goal_id: UUID | null;
  progress: number; // 0-100
}

export interface Milestone {
  id: UUID;
  goal_id: UUID;
  title: string;
  due_date: ISODate | null;
  done: boolean;
}

export type CourseSource = 'google_classroom' | 'teams' | 'manual' | 'phoenix' | 'managebac' | 'toddle';
export interface Course {
  id: UUID;
  student_id: UUID;
  name: string;
  teacher: string | null;
  source: CourseSource;
  external_id: string | null;
}

export type MaterialKind = 'note' | 'assignment' | 'announcement' | 'exam';
export interface Material {
  id: UUID;
  course_id: UUID;
  title: string;
  kind: MaterialKind;
  body_text: string | null;
  file_url: string | null;
  due_at: ISODate | null;
  source: CourseSource;
  external_id: string | null;
  ingested_at: ISODate;
}

export type TaskKind = 'study' | 'assignment' | 'application' | 'activity' | 'habit';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'skipped';
export type AiUseLevel = 'none' | 'support' | 'led';
export interface Task {
  id: UUID;
  student_id: UUID;
  title: string;
  kind: TaskKind;
  due_at: ISODate | null;
  est_minutes: number | null;
  status: TaskStatus;
  linked_goal_id: UUID | null;
  linked_material_id: UUID | null;
  linked_opportunity_id: UUID | null;
  ai_use_level: AiUseLevel;
}

export interface CalendarEvent {
  id: UUID;
  student_id: UUID;
  title: string;
  start_at: ISODate;
  end_at: ISODate;
  source: string;
  external_id: string | null;
}

export type OpportunityType =
  | 'competition'
  | 'internship'
  | 'scholarship'
  | 'summer_program'
  | 'volunteering'
  | 'olympiad'
  | 'mun'
  | 'hackathon'
  | 'course';
export interface Opportunity {
  id: UUID;
  title: string;
  organizer: string;
  type: OpportunityType;
  url: string;
  emirate: string | null;
  country: string;
  min_grade: number | null;
  max_grade: number | null;
  eligibility_text: string;
  nationality_restriction: string | null;
  cost_aed: number;
  deadline: ISODate | null;
  tags: string[];
  source_id: string;
  last_seen_at: ISODate;
  status: 'open' | 'closed' | 'unknown';
}

export type ApplicationStatus = 'saved' | 'preparing' | 'submitted' | 'accepted' | 'rejected';
export interface ChecklistItem {
  item: string;
  done: boolean;
}
export interface Application {
  id: UUID;
  student_id: UUID;
  opportunity_id: UUID;
  status: ApplicationStatus;
  checklist: ChecklistItem[];
  notes: string;
  submitted_at: ISODate | null;
}

export type AchievementCategory =
  | 'academic'
  | 'award'
  | 'sport'
  | 'project'
  | 'volunteering'
  | 'work'
  | 'certificate'
  | 'leadership';
export interface Achievement {
  id: UUID;
  student_id: UUID;
  title: string;
  category: AchievementCategory;
  date: ISODate;
  description: string;
  evidence_url: string | null;
}

export type CvTarget = 'general' | 'university' | 'internship';
export interface CvVersion {
  id: UUID;
  student_id: UUID;
  template: string;
  target: CvTarget;
  json: JsonResume;
  pdf_url: string | null;
  created_at: ISODate;
}

/** Minimal subset of the JSON Resume schema (https://jsonresume.org/schema). */
export interface JsonResume {
  basics: { name: string; label?: string; email?: string; summary?: string; location?: { city?: string; countryCode?: string } };
  education?: { institution: string; studyType?: string; area?: string; endDate?: string }[];
  awards?: { title: string; date?: string; awarder?: string; summary?: string }[];
  projects?: { name: string; description?: string; startDate?: string }[];
  volunteer?: { organization: string; position?: string; summary?: string; startDate?: string }[];
  work?: { name: string; position?: string; summary?: string; startDate?: string }[];
  certificates?: { name: string; date?: string; issuer?: string }[];
  skills?: { name: string; keywords?: string[] }[];
  interests?: { name: string }[];
  languages?: { language: string }[];
}

export type NotificationChannel = 'push' | 'email' | 'whatsapp' | 'in_app';
export interface Notification {
  id: UUID;
  student_id: UUID;
  channel: NotificationChannel;
  template: string;
  payload: Record<string, unknown>;
  scheduled_at: ISODate;
  sent_at: ISODate | null;
  status: string;
}

/** App-side notification preferences (API/notify team to confirm shape). */
export interface NotificationPrefs {
  channels: Record<NotificationChannel, boolean>;
  daily_briefing: boolean;
  briefing_time: string; // HH:MM, Asia/Dubai
  deadline_reminders: boolean;
  new_opportunities: boolean;
  weekly_summary_to_guardian: boolean;
  quiet_hours: { start: string; end: string };
}

export type ConnectionProvider = 'google_classroom' | 'teams' | 'google_calendar' | 'uae_pass' | 'linkedin';
export interface Connection {
  id: UUID;
  student_id: UUID;
  provider: ConnectionProvider;
  scopes: string[];
  status: 'connected' | 'disconnected' | 'error' | 'pending';
  token_ref: string | null; // vault reference only, never a raw token
  last_sync_at: ISODate | null;
}

/** Privacy team defines the canonical AuditLog; this is the subset the app displays. */
export interface AuditLogEntry {
  id: UUID;
  actor: string; // e.g. 'agent', 'connector:google_classroom'
  action: string;
  resource: string;
  at: ISODate;
  ai_use_level?: AiUseLevel;
}

export interface WeekSummary {
  week_start: ISODate;
  tasks: Task[];
  deadlines: { id: UUID; title: string; due_at: ISODate; kind: 'assignment' | 'exam' | 'application' }[];
  new_opportunities: Opportunity[];
  goals: Goal[];
}

export interface OpportunityFilter {
  type?: OpportunityType | 'all';
  query?: string;
  freeOnly?: boolean;
  eligibleOnly?: boolean;
}

export interface UploadFile {
  uri: string;
  name: string;
  mimeType: string | null;
  size?: number | null;
}

export interface DataExport {
  generated_at: ISODate;
  url: string | null; // signed URL once the privacy package produces a file
  payload?: Record<string, unknown>;
}
