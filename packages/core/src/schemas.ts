import { z } from "zod";
import {
  AchievementCategory, AiUseLevel, ApplicationStatus, AuditActorType, ConnectionStatus, ConsentActor, ConsentStatus,
  Curriculum, CvTarget, DataSource, Emirate, GoalCategory, GoalStatus, Lms, MaterialKind, NotificationChannel,
  NotificationRecipient, NotificationStatus, OpportunityStatus, OpportunityType, StaffRole, TaskKind, TaskStatus,
} from "./enums.js";

// ---------- primitives ----------
export const Uuid = z.string().uuid();
/** ISO-8601 timestamp with offset or Z, as returned by PostgREST for timestamptz. */
export const Timestamp = z.string().datetime({ offset: true });
/** Calendar date YYYY-MM-DD (Postgres `date`). */
export const IsoDate = z.string().date();
export const Grade = z.number().int().min(6).max(13);
export const Json = z.record(z.unknown());
/** Raw OAuth tokens never enter the DB: only a vault reference ("vault:..." or a vault secret uuid). */
export const VaultRef = z
  .string()
  .regex(/^(vault:.+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$/, "token_ref must be a vault reference");

const timestamps = { created_at: Timestamp, updated_at: Timestamp };

/**
 * Builds Row / Insert / Update schemas for a table.
 * - Insert: id + timestamps optional, plus any column the DB defaults.
 * - Update: every non-id column optional.
 */
function entity<S extends z.ZodRawShape, D extends keyof S & string>(shape: S, defaulted: readonly D[]) {
  const Row = z.object({ id: Uuid, ...shape, ...timestamps });
  const optionalKeys = Object.fromEntries(defaulted.map((k) => [k, true])) as { [K in D]: true };
  const Insert = z
    .object({ id: Uuid, ...shape })
    .partial({ id: true, ...optionalKeys } as { id: true } & { [K in D]: true });
  const Update = z.object(shape).partial();
  return { Row, Insert, Update };
}

// ---------- entities ----------
export const School = entity(
  { name: z.string().min(1), emirate: Emirate, curriculum: Curriculum, lms: Lms, domain: z.string().nullable() },
  ["lms", "domain"],
);

export const Student = entity(
  {
    auth_user_id: Uuid.nullable(),
    full_name: z.string().min(1),
    preferred_name: z.string().nullable(),
    date_of_birth: IsoDate,
    grade: Grade,
    school_id: Uuid.nullable(),
    curriculum: Curriculum,
    emirate: Emirate.nullable(),
    nationality: z.string().nullable(),
    languages: z.array(z.string()),
    interests: z.array(z.string()),
    strengths: z.array(z.string()),
  },
  ["auth_user_id", "preferred_name", "school_id", "emirate", "nationality", "languages", "interests", "strengths"],
);

export const Guardian = entity(
  {
    student_id: Uuid,
    auth_user_id: Uuid.nullable(),
    name: z.string().min(1),
    email: z.string().email().nullable(),
    phone: z.string().nullable(),
    relation: z.string(),
    consent_status: ConsentStatus,
    verified_at: Timestamp.nullable(),
  },
  ["auth_user_id", "email", "phone", "relation", "consent_status", "verified_at"],
);

export const SchoolStaff = entity(
  {
    auth_user_id: Uuid.nullable(),
    school_id: Uuid,
    full_name: z.string().min(1),
    email: z.string().nullable(),
    role: StaffRole,
  },
  ["auth_user_id", "email", "role"],
);

export const Goal = entity(
  {
    student_id: Uuid,
    title: z.string().min(1),
    category: GoalCategory,
    target_date: IsoDate.nullable(),
    status: GoalStatus,
    parent_goal_id: Uuid.nullable(),
    progress: z.number().int().min(0).max(100),
  },
  ["target_date", "status", "parent_goal_id", "progress"],
);

export const Milestone = entity(
  { goal_id: Uuid, title: z.string().min(1), due_date: IsoDate.nullable(), done: z.boolean() },
  ["due_date", "done"],
);

export const Course = entity(
  {
    student_id: Uuid,
    name: z.string().min(1),
    teacher: z.string().nullable(),
    source: DataSource,
    external_id: z.string().nullable(),
  },
  ["teacher", "source", "external_id"],
);

export const Material = entity(
  {
    course_id: Uuid,
    title: z.string().min(1),
    kind: MaterialKind,
    body_text: z.string().nullable(),
    file_url: z.string().url().nullable(),
    due_at: Timestamp.nullable(),
    source: DataSource,
    external_id: z.string().nullable(),
    ingested_at: Timestamp,
  },
  ["body_text", "file_url", "due_at", "source", "external_id", "ingested_at"],
);

export const EMBEDDING_DIMENSIONS = 768;
export const MaterialChunk = entity(
  {
    material_id: Uuid,
    chunk_index: z.number().int().min(0),
    chunk_text: z.string().min(1),
    embedding: z.array(z.number()).length(EMBEDDING_DIMENSIONS).nullable(),
  },
  ["chunk_index", "embedding"],
);

export const Task = entity(
  {
    student_id: Uuid,
    title: z.string().min(1),
    kind: TaskKind,
    due_at: Timestamp.nullable(),
    est_minutes: z.number().int().positive().nullable(),
    status: TaskStatus,
    linked_goal_id: Uuid.nullable(),
    linked_material_id: Uuid.nullable(),
    linked_opportunity_id: Uuid.nullable(),
    ai_use_level: AiUseLevel,
  },
  ["kind", "due_at", "est_minutes", "status", "linked_goal_id", "linked_material_id", "linked_opportunity_id", "ai_use_level"],
);

export const CalendarEvent = entity(
  {
    student_id: Uuid,
    title: z.string().min(1),
    start_at: Timestamp,
    end_at: Timestamp,
    source: DataSource,
    external_id: z.string().nullable(),
  },
  ["source", "external_id"],
);

export const OpportunitySource = entity(
  {
    name: z.string().min(1),
    url: z.string().url().nullable(),
    kind: z.string(),
    active: z.boolean(),
    last_crawled_at: Timestamp.nullable(),
  },
  ["url", "kind", "active", "last_crawled_at"],
);

export const Opportunity = entity(
  {
    title: z.string().min(1),
    organizer: z.string().min(1),
    type: OpportunityType,
    url: z.string().url(),
    emirate: Emirate.nullable(),
    /** ISO 3166-1 alpha-2; "XX" = online / global. */
    country: z.string().length(2),
    min_grade: Grade.nullable(),
    max_grade: Grade.nullable(),
    eligibility_text: z.string().nullable(),
    nationality_restriction: z.string().nullable(),
    cost_aed: z.number().min(0),
    deadline: Timestamp.nullable(),
    tags: z.array(z.string()),
    source_id: Uuid.nullable(),
    last_seen_at: Timestamp,
    status: OpportunityStatus,
  },
  ["emirate", "country", "min_grade", "max_grade", "eligibility_text", "nationality_restriction", "cost_aed", "deadline", "tags", "source_id", "last_seen_at", "status"],
);

export const ChecklistItem = z.object({ item: z.string().min(1), done: z.boolean() });
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const Application = entity(
  {
    student_id: Uuid,
    opportunity_id: Uuid,
    status: ApplicationStatus,
    checklist: z.array(ChecklistItem),
    notes: z.string().nullable(),
    submitted_at: Timestamp.nullable(),
  },
  ["status", "checklist", "notes", "submitted_at"],
);

export const Achievement = entity(
  {
    student_id: Uuid,
    title: z.string().min(1),
    category: AchievementCategory,
    date: IsoDate.nullable(),
    description: z.string().nullable(),
    evidence_url: z.string().url().nullable(),
  },
  ["date", "description", "evidence_url"],
);

export const CvVersion = entity(
  {
    student_id: Uuid,
    template: z.string(),
    target: CvTarget,
    /** JSON Resume schema (https://jsonresume.org/schema). Kept loose here; documents team validates. */
    json: Json,
    pdf_url: z.string().url().nullable(),
  },
  ["template", "target", "json", "pdf_url"],
);

export const Notification = entity(
  {
    student_id: Uuid,
    recipient: NotificationRecipient,
    channel: NotificationChannel,
    template: z.string().min(1),
    payload: Json,
    scheduled_at: Timestamp,
    sent_at: Timestamp.nullable(),
    status: NotificationStatus,
  },
  ["recipient", "payload", "scheduled_at", "sent_at", "status"],
);

export const Connection = entity(
  {
    student_id: Uuid,
    provider: z.string().min(1),
    scopes: z.array(z.string()),
    status: ConnectionStatus,
    token_ref: VaultRef.nullable(),
    last_sync_at: Timestamp.nullable(),
  },
  ["scopes", "status", "token_ref", "last_sync_at"],
);

export const ConsentRecord = entity(
  {
    student_id: Uuid,
    guardian_id: Uuid.nullable(),
    granted_by: ConsentActor,
    scope: z.string().min(1),
    status: ConsentStatus,
    policy_version: z.string(),
    method: z.string().nullable(),
    evidence: Json,
    granted_at: Timestamp.nullable(),
    revoked_at: Timestamp.nullable(),
  },
  ["guardian_id", "policy_version", "method", "evidence", "granted_at", "revoked_at"],
);

export const AuditLog = entity(
  {
    actor: z.string().min(1),
    actor_type: AuditActorType,
    action: z.string().min(1),
    resource: z.string().min(1),
    resource_id: Uuid.nullable(),
    student_id: Uuid.nullable(),
    metadata: Json,
    at: Timestamp,
  },
  ["resource_id", "student_id", "metadata", "at"],
);

/** Aggregate-only view a guardian can read (public.guardian_student_summaries). */
export const GuardianStudentSummary = z.object({
  student_id: Uuid,
  display_name: z.string(),
  grade: Grade,
  school_name: z.string().nullable(),
  active_goals: z.number().int(),
  avg_goal_progress: z.number().int(),
  tasks_due_next_7_days: z.number().int(),
  tasks_overdue: z.number().int(),
  tasks_done_last_7_days: z.number().int(),
  applications_submitted: z.number().int(),
  application_deadlines_next_30_days: z.number().int(),
  achievements_count: z.number().int(),
});

// ---------- inferred types ----------
type Rows<E extends { Row: z.ZodTypeAny }> = z.infer<E["Row"]>;
type Ins<E extends { Insert: z.ZodTypeAny }> = z.input<E["Insert"]>;
type Upd<E extends { Update: z.ZodTypeAny }> = z.input<E["Update"]>;

export type School = Rows<typeof School>;
export type SchoolInsert = Ins<typeof School>;
export type SchoolUpdate = Upd<typeof School>;
export type Student = Rows<typeof Student>;
export type StudentInsert = Ins<typeof Student>;
export type StudentUpdate = Upd<typeof Student>;
export type Guardian = Rows<typeof Guardian>;
export type GuardianInsert = Ins<typeof Guardian>;
export type GuardianUpdate = Upd<typeof Guardian>;
export type SchoolStaff = Rows<typeof SchoolStaff>;
export type SchoolStaffInsert = Ins<typeof SchoolStaff>;
export type Goal = Rows<typeof Goal>;
export type GoalInsert = Ins<typeof Goal>;
export type GoalUpdate = Upd<typeof Goal>;
export type Milestone = Rows<typeof Milestone>;
export type MilestoneInsert = Ins<typeof Milestone>;
export type MilestoneUpdate = Upd<typeof Milestone>;
export type Course = Rows<typeof Course>;
export type CourseInsert = Ins<typeof Course>;
export type Material = Rows<typeof Material>;
export type MaterialInsert = Ins<typeof Material>;
export type MaterialChunk = Rows<typeof MaterialChunk>;
export type MaterialChunkInsert = Ins<typeof MaterialChunk>;
export type Task = Rows<typeof Task>;
export type TaskInsert = Ins<typeof Task>;
export type TaskUpdate = Upd<typeof Task>;
export type CalendarEvent = Rows<typeof CalendarEvent>;
export type CalendarEventInsert = Ins<typeof CalendarEvent>;
export type OpportunitySource = Rows<typeof OpportunitySource>;
export type Opportunity = Rows<typeof Opportunity>;
export type OpportunityInsert = Ins<typeof Opportunity>;
export type OpportunityUpdate = Upd<typeof Opportunity>;
export type Application = Rows<typeof Application>;
export type ApplicationInsert = Ins<typeof Application>;
export type ApplicationUpdate = Upd<typeof Application>;
export type Achievement = Rows<typeof Achievement>;
export type AchievementInsert = Ins<typeof Achievement>;
export type CvVersion = Rows<typeof CvVersion>;
export type CvVersionInsert = Ins<typeof CvVersion>;
export type Notification = Rows<typeof Notification>;
export type NotificationInsert = Ins<typeof Notification>;
export type NotificationUpdate = Upd<typeof Notification>;
export type Connection = Rows<typeof Connection>;
export type ConnectionInsert = Ins<typeof Connection>;
export type ConnectionUpdate = Upd<typeof Connection>;
export type ConsentRecord = Rows<typeof ConsentRecord>;
export type ConsentRecordInsert = Ins<typeof ConsentRecord>;
export type AuditLog = Rows<typeof AuditLog>;
export type AuditLogInsert = Ins<typeof AuditLog>;
export type GuardianStudentSummary = z.infer<typeof GuardianStudentSummary>;

/** Table name -> schemas. Table names are the DB's snake_case plurals. */
export const TABLES = {
  schools: School,
  students: Student,
  guardians: Guardian,
  school_staff: SchoolStaff,
  goals: Goal,
  milestones: Milestone,
  courses: Course,
  materials: Material,
  material_chunks: MaterialChunk,
  tasks: Task,
  calendar_events: CalendarEvent,
  opportunity_sources: OpportunitySource,
  opportunities: Opportunity,
  applications: Application,
  achievements: Achievement,
  cv_versions: CvVersion,
  notifications: Notification,
  connections: Connection,
  consent_records: ConsentRecord,
  audit_logs: AuditLog,
} as const;
export type TableName = keyof typeof TABLES;
export type RowOf<T extends TableName> = z.infer<(typeof TABLES)[T]["Row"]>;
export type InsertOf<T extends TableName> = z.input<(typeof TABLES)[T]["Insert"]>;
export type UpdateOf<T extends TableName> = z.input<(typeof TABLES)[T]["Update"]>;
