import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";
import { Application, Connection, Opportunity, Student, TABLES, Task } from "../src/index.js";

const id = "b0000000-0000-4000-8000-000000000001";
const ts = "2026-10-10T07:00:00+00:00";

describe("entity schemas", () => {
  it("parses a student row (PostgREST shape)", () => {
    const row = Student.Row.parse({
      id, auth_user_id: null, full_name: "Aisha Test", preferred_name: "Aisha", date_of_birth: "2009-03-14", grade: 12,
      school_id: null, curriculum: "british", emirate: "dubai", nationality: "AE", languages: ["en"], interests: [],
      strengths: [], created_at: ts, updated_at: "2026-10-10T07:00:00.123456+00:00",
    });
    expect(row.full_name).toBe("Aisha Test");
  });
  it("insert schemas make defaulted columns optional; update is partial", () => {
    expect(Task.Insert.parse({ student_id: id, title: "Revise" }).title).toBe("Revise");
    expect(() => Task.Insert.parse({ title: "no student" })).toThrow();
    expect(Task.Update.parse({ status: "done" })).toEqual({ status: "done" });
    expect(() => Task.Update.parse({ status: "finished" })).toThrow();
  });
  it("validates grade range, checklist and vault refs", () => {
    expect(() => Student.Insert.parse({ full_name: "X Test", date_of_birth: "2010-01-01", grade: 5, curriculum: "ib" })).toThrow();
    expect(Application.Insert.parse({ student_id: id, opportunity_id: id, checklist: [{ item: "CV", done: false }] }).checklist).toHaveLength(1);
    expect(() => Application.Insert.parse({ student_id: id, opportunity_id: id, checklist: [{ done: true }] })).toThrow();
    expect(Connection.Insert.parse({ student_id: id, provider: "google", token_ref: "vault:conn/x" }).token_ref).toBe("vault:conn/x");
    expect(() => Connection.Insert.parse({ student_id: id, provider: "google", token_ref: "ya29.rawtoken" })).toThrow();
    expect(() => Opportunity.Insert.parse({ title: "t", organizer: "o", type: "mun", url: "https://example.org/x", min_grade: 14 })).toThrow();
  });
  it("covers every contract entity", () => {
    expect(Object.keys(TABLES).sort()).toEqual([
      "achievements", "applications", "audit_logs", "calendar_events", "connections", "consent_records", "courses",
      "cv_versions", "goals", "guardians", "material_chunks", "materials", "milestones", "notifications",
      "opportunities", "opportunity_sources", "school_staff", "schools", "students", "tasks",
    ]);
  });
});

describe("enums stay in sync with SQL migrations", () => {
  const dir = join(__dirname, "../../../supabase/migrations");
  const sql = readdirSync(dir).filter((f) => f.endsWith(".sql")).map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
  const sqlEnums = new Map<string, string[]>();
  for (const m of sql.matchAll(/create type public\.(\w+) as enum \(([^)]*)\)/g)) {
    sqlEnums.set(m[1]!, [...m[2]!.matchAll(/'([^']+)'/g)].map((x) => x[1]!));
  }
  const pairs: Record<string, readonly string[]> = {
    curriculum: core.CURRICULA, lms: core.LMS_PROVIDERS, emirate: core.EMIRATES, consent_status: core.CONSENT_STATUSES,
    goal_category: core.GOAL_CATEGORIES, goal_status: core.GOAL_STATUSES, data_source: core.DATA_SOURCES,
    material_kind: core.MATERIAL_KINDS, task_kind: core.TASK_KINDS, task_status: core.TASK_STATUSES,
    ai_use_level: core.AI_USE_LEVELS, opportunity_type: core.OPPORTUNITY_TYPES, opportunity_status: core.OPPORTUNITY_STATUSES,
    application_status: core.APPLICATION_STATUSES, achievement_category: core.ACHIEVEMENT_CATEGORIES, cv_target: core.CV_TARGETS,
    notification_channel: core.NOTIFICATION_CHANNELS, notification_status: core.NOTIFICATION_STATUSES,
    notification_recipient: core.NOTIFICATION_RECIPIENTS, connection_status: core.CONNECTION_STATUSES,
    staff_role: core.STAFF_ROLES, audit_actor_type: core.AUDIT_ACTOR_TYPES, consent_actor: core.CONSENT_ACTORS,
  };
  it("has the same enum set", () => {
    expect([...sqlEnums.keys()].sort()).toEqual(Object.keys(pairs).sort());
  });
  for (const [name, values] of Object.entries(pairs)) {
    it(`enum ${name}`, () => expect(sqlEnums.get(name)).toEqual([...values]));
  }
});
