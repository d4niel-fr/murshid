import type { TableName } from "@murshid/core";

/**
 * Column defaults that are not null, mirroring the SQL migrations.
 * Nullable columns default to null automatically. `NOW` is replaced by the current time.
 */
export const NOW = Symbol("now");

export const COLUMN_DEFAULTS: Record<TableName, Record<string, unknown>> = {
  schools: { lms: "other" },
  students: { languages: [], interests: [], strengths: [] },
  guardians: { relation: "guardian", consent_status: "pending" },
  school_staff: { role: "counsellor" },
  goals: { status: "active", progress: 0 },
  milestones: { done: false },
  courses: { source: "manual" },
  materials: { source: "manual", ingested_at: NOW },
  material_chunks: { chunk_index: 0 },
  tasks: { kind: "study", status: "todo", ai_use_level: "none" },
  calendar_events: { source: "manual" },
  opportunity_sources: { kind: "manual", active: true },
  opportunities: { country: "AE", cost_aed: 0, tags: [], last_seen_at: NOW, status: "unknown" },
  applications: { status: "saved", checklist: [] },
  achievements: {},
  cv_versions: { template: "classic", target: "general", json: {} },
  notifications: { recipient: "student", payload: {}, scheduled_at: NOW, status: "scheduled" },
  connections: { scopes: [], status: "pending" },
  consent_records: { policy_version: "v1", evidence: {} },
  audit_logs: { metadata: {}, at: NOW },
};

/** Unique constraints enforced by the in-memory driver (subset of SQL). */
export const UNIQUE_KEYS: Partial<Record<TableName, string[][]>> = {
  schools: [["domain"]],
  students: [["auth_user_id"]],
  school_staff: [["auth_user_id"]],
  applications: [["student_id", "opportunity_id"]],
  connections: [["student_id", "provider"]],
  material_chunks: [["material_id", "chunk_index"]],
  courses: [["student_id", "source", "external_id"]],
  materials: [["course_id", "source", "external_id"]],
  calendar_events: [["student_id", "source", "external_id"]],
};
