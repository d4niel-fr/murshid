import { z } from "zod";

// Shared enums. Values mirror the Postgres enum types in supabase/migrations exactly.

export const CURRICULA = ["british", "indian_cbse", "indian_icse", "american", "ib", "uae_moe", "other"] as const;
export const LMS_PROVIDERS = ["google_classroom", "teams", "phoenix", "managebac", "toddle", "other"] as const;
export const EMIRATES = ["abu_dhabi", "dubai", "sharjah", "ajman", "umm_al_quwain", "ras_al_khaimah", "fujairah"] as const;
export const CONSENT_STATUSES = ["pending", "granted", "revoked"] as const;
export const GOAL_CATEGORIES = ["academic", "university", "career", "sport", "skill", "personal"] as const;
export const GOAL_STATUSES = ["active", "done", "paused"] as const;
/** Where a course / material / calendar event came from (superset of LMS providers). */
export const DATA_SOURCES = [
  "google_classroom", "google_calendar", "teams", "outlook", "phoenix", "managebac", "toddle", "manual", "other",
] as const;
export const MATERIAL_KINDS = ["note", "assignment", "announcement", "exam"] as const;
export const TASK_KINDS = ["study", "assignment", "application", "activity", "habit"] as const;
export const TASK_STATUSES = ["todo", "doing", "done", "skipped"] as const;
export const AI_USE_LEVELS = ["none", "support", "led"] as const;
export const OPPORTUNITY_TYPES = [
  "competition", "internship", "scholarship", "summer_program", "volunteering", "olympiad", "mun", "hackathon", "course",
] as const;
export const OPPORTUNITY_STATUSES = ["open", "closed", "unknown"] as const;
export const APPLICATION_STATUSES = ["saved", "preparing", "submitted", "accepted", "rejected"] as const;
export const ACHIEVEMENT_CATEGORIES = [
  "academic", "award", "sport", "project", "volunteering", "work", "certificate", "leadership",
] as const;
export const CV_TARGETS = ["general", "university", "internship"] as const;
export const NOTIFICATION_CHANNELS = ["push", "email", "whatsapp", "in_app"] as const;
export const NOTIFICATION_STATUSES = ["scheduled", "sent", "failed", "cancelled"] as const;
export const NOTIFICATION_RECIPIENTS = ["student", "guardian", "counsellor"] as const;
export const CONNECTION_STATUSES = ["pending", "active", "error", "revoked"] as const;
export const STAFF_ROLES = ["counsellor", "teacher", "admin"] as const;
export const AUDIT_ACTOR_TYPES = ["student", "guardian", "counsellor", "connector", "agent", "system"] as const;
export const CONSENT_ACTORS = ["student", "guardian"] as const;
/** Well-known consent scopes. consent_records.scope is free text so privacy can add more. */
export const CONSENT_SCOPES = ["account", "connectors", "notifications", "counsellor_access", "ai_processing"] as const;

export const Curriculum = z.enum(CURRICULA);
export const Lms = z.enum(LMS_PROVIDERS);
export const Emirate = z.enum(EMIRATES);
export const ConsentStatus = z.enum(CONSENT_STATUSES);
export const GoalCategory = z.enum(GOAL_CATEGORIES);
export const GoalStatus = z.enum(GOAL_STATUSES);
export const DataSource = z.enum(DATA_SOURCES);
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
export const NotificationStatus = z.enum(NOTIFICATION_STATUSES);
export const NotificationRecipient = z.enum(NOTIFICATION_RECIPIENTS);
export const ConnectionStatus = z.enum(CONNECTION_STATUSES);
export const StaffRole = z.enum(STAFF_ROLES);
export const AuditActorType = z.enum(AUDIT_ACTOR_TYPES);
export const ConsentActor = z.enum(CONSENT_ACTORS);

export type Curriculum = z.infer<typeof Curriculum>;
export type Lms = z.infer<typeof Lms>;
export type Emirate = z.infer<typeof Emirate>;
export type ConsentStatus = z.infer<typeof ConsentStatus>;
export type GoalCategory = z.infer<typeof GoalCategory>;
export type GoalStatus = z.infer<typeof GoalStatus>;
export type DataSource = z.infer<typeof DataSource>;
export type MaterialKind = z.infer<typeof MaterialKind>;
export type TaskKind = z.infer<typeof TaskKind>;
export type TaskStatus = z.infer<typeof TaskStatus>;
export type AiUseLevel = z.infer<typeof AiUseLevel>;
export type OpportunityType = z.infer<typeof OpportunityType>;
export type OpportunityStatus = z.infer<typeof OpportunityStatus>;
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;
export type AchievementCategory = z.infer<typeof AchievementCategory>;
export type CvTarget = z.infer<typeof CvTarget>;
export type NotificationChannel = z.infer<typeof NotificationChannel>;
export type NotificationStatus = z.infer<typeof NotificationStatus>;
export type NotificationRecipient = z.infer<typeof NotificationRecipient>;
export type ConnectionStatus = z.infer<typeof ConnectionStatus>;
export type StaffRole = z.infer<typeof StaffRole>;
export type AuditActorType = z.infer<typeof AuditActorType>;
export type ConsentActor = z.infer<typeof ConsentActor>;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
