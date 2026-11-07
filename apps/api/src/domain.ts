/**
 * API-side zod (v4) schemas for the Murshid core domain (docs/CONTRACT.md "Core domain").
 * Enum values come from @murshid/core (the single source of truth, synced with the SQL enums);
 * the object schemas stay here because core is on zod v3 and the API's OpenAPI generator needs
 * zod v4 (`z.toJSONSchema`). Field names are canonical (snake_case) and must match the contract;
 * test/core-sync.test.ts checks the shapes stay assignable to the core types.
 */
import { z } from 'zod';
import {
  ACHIEVEMENT_CATEGORIES, AI_USE_LEVELS, APPLICATION_STATUSES, CONSENT_STATUSES, CURRICULA, CV_TARGETS, GOAL_CATEGORIES,
  GOAL_STATUSES, LMS_PROVIDERS, MATERIAL_KINDS, NOTIFICATION_CHANNELS, OPPORTUNITY_STATUSES, OPPORTUNITY_TYPES, TASK_KINDS,
  TASK_STATUSES,
} from '@murshid/core';

export const uuid = z.string().min(1).max(100);
export const isoDateTime = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), 'invalid date-time');
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const Curriculum = z.enum(CURRICULA);
export const Lms = z.enum(LMS_PROVIDERS);
export const ConsentStatus = z.enum(CONSENT_STATUSES);
export const GoalCategory = z.enum(GOAL_CATEGORIES);
export const GoalStatus = z.enum(GOAL_STATUSES);
export const MaterialKind = z.enum(MATERIAL_KINDS);
export const TaskKind = z.enum(TASK_KINDS);
export const TaskStatus = z.enum(TASK_STATUSES);
export const AiUseLevel = z.enum(AI_USE_LEVELS);
export const OpportunityType = z.enum(OPPORTUNITY_TYPES);
export const OpportunityStatus = z.enum(OPPORTUNITY_STATUSES);
export const ApplicationStatus = z.enum(APPLICATION_STATUSES);
export const AchievementCategory = z.enum(ACHIEVEMENT_CATEGORIES);
export const CvTarget = z.enum(CV_TARGETS);
export const NotificationChannel = z.enum(NOTIFICATION_CHANNELS);

export const Student = z.object({
  id: uuid,
  auth_user_id: z.string(),
  full_name: z.string().min(1),
  preferred_name: z.string().nullable(),
  date_of_birth: isoDate,
  grade: z.number().int().min(6).max(13),
  school_id: uuid.nullable(),
  curriculum: Curriculum,
  emirate: z.string().nullable(),
  nationality: z.string().nullable(),
  languages: z.array(z.string()),
  interests: z.array(z.string()),
  strengths: z.array(z.string()),
  created_at: isoDateTime,
});
export type Student = z.infer<typeof Student>;

export const School = z.object({
  id: uuid, name: z.string(), emirate: z.string(), curriculum: Curriculum, lms: Lms, domain: z.string().nullable(),
});
export type School = z.infer<typeof School>;

export const Guardian = z.object({
  id: uuid, student_id: uuid, name: z.string(), email: z.string().email(), phone: z.string().nullable(),
  relation: z.string(), consent_status: ConsentStatus, verified_at: isoDateTime.nullable(),
});
export type Guardian = z.infer<typeof Guardian>;

export const Goal = z.object({
  id: uuid, student_id: uuid, title: z.string().min(1), category: GoalCategory, target_date: isoDate.nullable(),
  status: GoalStatus, parent_goal_id: uuid.nullable(), progress: z.number().int().min(0).max(100),
});
export type Goal = z.infer<typeof Goal>;

export const Milestone = z.object({
  id: uuid, goal_id: uuid, title: z.string().min(1), due_date: isoDate.nullable(), done: z.boolean(),
});
export type Milestone = z.infer<typeof Milestone>;

export const Course = z.object({
  id: uuid, student_id: uuid, name: z.string().min(1), teacher: z.string().nullable(),
  source: z.string(), external_id: z.string().nullable(),
});
export type Course = z.infer<typeof Course>;

export const Material = z.object({
  id: uuid, course_id: uuid, title: z.string().min(1), kind: MaterialKind, body_text: z.string().nullable(),
  file_url: z.string().nullable(), due_at: isoDateTime.nullable(), source: z.string(),
  external_id: z.string().nullable(), ingested_at: isoDateTime,
});
export type Material = z.infer<typeof Material>;

export const Task = z.object({
  id: uuid, student_id: uuid, title: z.string().min(1), kind: TaskKind, due_at: isoDateTime.nullable(),
  est_minutes: z.number().int().min(0).max(24 * 60).nullable(), status: TaskStatus,
  linked_goal_id: uuid.nullable(), linked_material_id: uuid.nullable(), linked_opportunity_id: uuid.nullable(),
  ai_use_level: AiUseLevel,
});
export type Task = z.infer<typeof Task>;

export const CalendarEvent = z.object({
  id: uuid, student_id: uuid, title: z.string().min(1), start_at: isoDateTime, end_at: isoDateTime,
  source: z.string(), external_id: z.string().nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

export const Opportunity = z.object({
  id: uuid, title: z.string(), organizer: z.string(), type: OpportunityType, url: z.string().nullable(),
  emirate: z.string().nullable(), country: z.string().nullable(),
  min_grade: z.number().int().nullable(), max_grade: z.number().int().nullable(),
  eligibility_text: z.string().nullable(), nationality_restriction: z.array(z.string()).nullable(),
  cost_aed: z.number().nullable(), deadline: isoDateTime.nullable(), tags: z.array(z.string()),
  source_id: z.string().nullable(), last_seen_at: isoDateTime.nullable(), status: OpportunityStatus,
});
export type Opportunity = z.infer<typeof Opportunity>;

export const ChecklistItem = z.object({ item: z.string().min(1).max(200), done: z.boolean() });
export type ChecklistItem = z.infer<typeof ChecklistItem>;

export const Application = z.object({
  id: uuid, student_id: uuid, opportunity_id: uuid, status: ApplicationStatus, checklist: z.array(ChecklistItem),
  notes: z.string().nullable(), submitted_at: isoDateTime.nullable(),
});
export type Application = z.infer<typeof Application>;

export const Achievement = z.object({
  id: uuid, student_id: uuid, title: z.string().min(1), category: AchievementCategory, date: isoDate.nullable(),
  description: z.string().nullable(), evidence_url: z.string().nullable(),
});
export type Achievement = z.infer<typeof Achievement>;

export const CvVersion = z.object({
  id: uuid, student_id: uuid, template: z.string(), target: CvTarget,
  json: z.record(z.string(), z.unknown()), pdf_url: z.string().nullable(), created_at: isoDateTime,
});
export type CvVersion = z.infer<typeof CvVersion>;

export const Connection = z.object({
  id: uuid, student_id: uuid, provider: z.string(), scopes: z.array(z.string()), status: z.string(),
  token_ref: z.string().nullable(), last_sync_at: isoDateTime.nullable(),
});
export type Connection = z.infer<typeof Connection>;

/** Privacy team owns the final shape; minimal local version so the API can write audit rows. */
export const AuditLog = z.object({
  id: uuid, actor: z.string(), action: z.string(), resource: z.string(), at: isoDateTime,
});
export type AuditLog = z.infer<typeof AuditLog>;

// ---------- Input schemas (create = no id/server fields; update = partial) ----------
export const StudentCreate = Student.omit({ id: true, auth_user_id: true, created_at: true }).extend({
  full_name: z.string().min(1).max(120),
  preferred_name: z.string().max(80).nullable().default(null),
  school_id: uuid.nullable().default(null),
  emirate: z.string().max(40).nullable().default(null),
  nationality: z.string().max(60).nullable().default(null),
  languages: z.array(z.string().max(80)).max(30).default([]),
  interests: z.array(z.string().max(80)).max(30).default([]),
  strengths: z.array(z.string().max(80)).max(30).default([]),
});
export const StudentUpdate = StudentCreate.partial();

export const GoalCreate = z.object({
  title: z.string().max(200).min(1), category: GoalCategory, target_date: isoDate.nullable().default(null),
  status: GoalStatus.default('active'), parent_goal_id: uuid.nullable().default(null),
  progress: z.number().int().min(0).max(100).default(0),
});
export const GoalUpdate = GoalCreate.partial();

export const MilestoneCreate = z.object({
  title: z.string().max(200).min(1), due_date: isoDate.nullable().default(null), done: z.boolean().default(false),
});
export const MilestoneUpdate = MilestoneCreate.partial();

export const CourseCreate = z.object({
  name: z.string().max(120).min(1), teacher: z.string().max(120).nullable().default(null), source: z.string().max(40).default('manual'),
  external_id: z.string().max(200).nullable().default(null),
});
export const CourseUpdate = CourseCreate.partial();

export const MaterialCreate = z.object({
  course_id: uuid, title: z.string().max(200).min(1), kind: MaterialKind.default('note'),
  body_text: z.string().max(50000).nullable().default(null), file_url: z.string().max(2000).nullable().default(null),
  due_at: isoDateTime.nullable().default(null), source: z.string().max(40).default('manual'),
  external_id: z.string().max(200).nullable().default(null),
});
export const MaterialUpdate = MaterialCreate.partial();

export const MaterialUpload = z.object({
  course_id: uuid,
  title: z.string().max(200).min(1),
  kind: MaterialKind.default('note'),
  file_url: z.string().max(2000).min(1).describe('Storage URL/path the client uploaded to (e.g. Supabase Storage)'),
  file_name: z.string().max(255).optional(),
  mime_type: z.string().max(100).optional(),
  size_bytes: z.number().int().nonnegative().optional(),
  due_at: isoDateTime.nullable().default(null),
  body_text: z.string().max(50000).nullable().default(null),
  create_task: z.boolean().default(true),
});

export const TaskCreate = z.object({
  title: z.string().max(200).min(1), kind: TaskKind.default('study'), due_at: isoDateTime.nullable().default(null),
  est_minutes: z.number().int().min(0).max(24 * 60).nullable().default(null), status: TaskStatus.default('todo'),
  linked_goal_id: uuid.nullable().default(null), linked_material_id: uuid.nullable().default(null),
  linked_opportunity_id: uuid.nullable().default(null), ai_use_level: AiUseLevel.default('none'),
});
export const TaskUpdate = TaskCreate.partial();

export const CalendarEventCreate = z.object({
  title: z.string().max(200).min(1), start_at: isoDateTime, end_at: isoDateTime, source: z.string().max(40).default('manual'),
  external_id: z.string().max(200).nullable().default(null),
});
export const CalendarEventUpdate = CalendarEventCreate.partial();

export const OpportunityCreate = Opportunity.omit({ id: true }).partial().extend({
  title: z.string().max(200).min(1), organizer: z.string().max(200).min(1), type: OpportunityType,
  url: z.string().max(2000).nullable().optional(), emirate: z.string().max(40).nullable().optional(), country: z.string().max(60).nullable().optional(),
  eligibility_text: z.string().max(4000).nullable().optional(), nationality_restriction: z.array(z.string().max(60)).max(50).nullable().optional(),
  tags: z.array(z.string().max(60)).max(30).optional(), source_id: z.string().max(100).nullable().optional(),
});

export const ApplicationCreate = z.object({
  opportunity_id: uuid, status: ApplicationStatus.default('saved'), notes: z.string().max(4000).nullable().default(null),
  checklist: z.array(ChecklistItem).max(50).optional(),
});
export const ApplicationUpdate = z.object({
  status: ApplicationStatus.optional(), notes: z.string().max(4000).nullable().optional(),
  checklist: z.array(ChecklistItem).max(50).optional(),
});

export const AchievementCreate = z.object({
  title: z.string().max(200).min(1), category: AchievementCategory, date: isoDate.nullable().default(null),
  description: z.string().max(2000).nullable().default(null), evidence_url: z.string().max(2000).nullable().default(null),
});
export const AchievementUpdate = AchievementCreate.partial();

export const CvCreate = z.object({
  target: CvTarget.default('general'), template: z.string().max(40).default('classic'),
  basics: z.object({ email: z.string().max(254).optional(), phone: z.string().max(40).optional(), summary: z.string().max(2000).optional() })
    .optional(),
});

export const InboundEmail = z.object({
  to: z.string().max(320).min(1).describe('Recipient, e.g. inbox+<student_id>@inbox.murshid.local'),
  from: z.string().max(320).default(''),
  subject: z.string().max(500).default(''),
  text: z.string().max(200000).default(''),
  html: z.string().max(500000).optional(),
  date: isoDateTime.optional().describe('Sent date; used to resolve "tomorrow"/weekday names'),
  message_id: z.string().max(500).optional(),
});
export type InboundEmail = z.infer<typeof InboundEmail>;

export const AgentChatInput = z.object({ message: z.string().min(1).max(4000), thread_id: z.string().max(200).optional() });
