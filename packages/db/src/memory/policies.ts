import { ageFromDob, latestConsentStatus, type ConsentStatus } from "@murshid/core";
import type { DbRow } from "../driver.js";

/**
 * Who is calling. Mirrors Supabase: `service` = service_role (bypasses RLS),
 * `authenticated` = a signed-in user whose role (student / guardian / counsellor)
 * is resolved by looking up auth_user_id, exactly like the private.* SQL helpers.
 */
export type Principal = { role: "anon" } | { role: "service" } | { role: "authenticated"; authUserId: string };

export interface RowSource {
  rows(table: string): DbRow[];
}

// Tables whose rows a student fully owns via a student_id column.
const STUDENT_CRUD = new Set(["goals", "courses", "tasks", "calendar_events", "applications", "achievements", "cv_versions"]);
// Student may read but not write (written by backend / connectors / privacy).
const STUDENT_READONLY = new Set(["notifications", "connections", "consent_records", "audit_logs"]);
// Counsellors (consented students at their school) may read.
const COUNSELLOR_READ = new Set(["students", "goals", "milestones", "applications", "achievements", "cv_versions"]);
// Columns a student may update on their own students row (column-level GRANT in SQL).
export const STUDENT_UPDATABLE_COLUMNS = ["preferred_name", "emirate", "nationality", "languages", "interests", "strengths"];

export class PolicyContext {
  constructor(
    private readonly src: RowSource,
    private readonly p: Principal,
  ) {}

  private get uid(): string | null {
    return this.p.role === "authenticated" ? this.p.authUserId : null;
  }

  private find(table: string, id: unknown): DbRow | undefined {
    return this.src.rows(table).find((r) => r.id === id);
  }

  isOwnStudent(sid: unknown): boolean {
    const uid = this.uid;
    return uid !== null && this.src.rows("students").some((s) => s.id === sid && s.auth_user_id === uid);
  }

  isGuardianOf(sid: unknown): boolean {
    const uid = this.uid;
    return uid !== null && this.src.rows("guardians").some((g) => g.student_id === sid && g.auth_user_id === uid);
  }

  counsellorCanView(sid: unknown): boolean {
    const uid = this.uid;
    if (uid === null) return false;
    const student = this.find("students", sid);
    if (!student || student.school_id == null) return false;
    const isCounsellor = this.src
      .rows("school_staff")
      .some((st) => st.auth_user_id === uid && st.school_id === student.school_id && st.role === "counsellor");
    if (!isCounsellor) return false;
    const records = this.src
      .rows("consent_records")
      .filter((r) => r.student_id === sid)
      .map((r) => ({ id: String(r.id), scope: String(r.scope), status: r.status as ConsentStatus, created_at: String(r.created_at) }));
    return latestConsentStatus(records, "counsellor_access") === "granted";
  }

  goalStudentId(gid: unknown): unknown {
    return this.find("goals", gid)?.student_id;
  }
  courseStudentId(cid: unknown): unknown {
    return this.find("courses", cid)?.student_id;
  }
  materialStudentId(mid: unknown): unknown {
    const m = this.find("materials", mid);
    return m ? this.courseStudentId(m.course_id) : undefined;
  }

  /** Owning student of a row, or undefined for global tables. */
  ownerOf(table: string, row: DbRow): unknown {
    switch (table) {
      case "students":
        return row.id;
      case "milestones":
        return this.goalStudentId(row.goal_id);
      case "materials":
        return this.courseStudentId(row.course_id);
      case "material_chunks":
        return this.materialStudentId(row.material_id);
      default:
        return row.student_id;
    }
  }

  // ---------- policy decisions (USING / WITH CHECK) ----------
  canSelect(table: string, row: DbRow): boolean {
    if (this.p.role === "service") return true;
    if (this.p.role === "anon") return false;
    const uid = this.p.authUserId;
    switch (table) {
      case "schools":
      case "opportunities":
        return true;
      case "opportunity_sources":
        return false;
      case "school_staff":
        return row.auth_user_id === uid;
      case "students":
        return row.auth_user_id === uid || this.counsellorCanView(row.id);
      case "guardians":
        return this.isOwnStudent(row.student_id) || row.auth_user_id === uid;
      case "material_chunks":
        return this.isOwnStudent(this.ownerOf(table, row));
    }
    const owner = this.ownerOf(table, row);
    if ((STUDENT_CRUD.has(table) || STUDENT_READONLY.has(table) || table === "milestones" || table === "materials") && this.isOwnStudent(owner)) {
      return true;
    }
    return COUNSELLOR_READ.has(table) && this.counsellorCanView(owner);
  }

  /** WITH CHECK for INSERT. */
  canInsert(table: string, row: DbRow): boolean {
    if (this.p.role === "service") return true;
    if (this.p.role === "anon") return false;
    if (table === "guardians") {
      return this.isOwnStudent(row.student_id) && row.consent_status === "pending" && row.verified_at == null && row.auth_user_id == null;
    }
    return this.isStudentWritable(table) && this.isOwnStudent(this.ownerOf(table, row));
  }

  /** USING for UPDATE/DELETE: rows failing this are invisible to the statement. */
  canModify(table: string, row: DbRow, op: "update" | "delete"): boolean {
    if (this.p.role === "service") return true;
    if (this.p.role === "anon") return false;
    if (table === "students") return op === "update" && row.auth_user_id === this.p.authUserId;
    return this.isStudentWritable(table) && this.isOwnStudent(this.ownerOf(table, row));
  }

  /** WITH CHECK for UPDATE (new row). */
  updateCheck(table: string, row: DbRow): boolean {
    if (this.p.role === "service") return true;
    if (table === "students") return this.p.role === "authenticated" && row.auth_user_id === this.p.authUserId;
    return this.canInsert(table, row);
  }

  /** Column-level privilege check (SQL: grant update (cols) on students). */
  updatableColumns(table: string): string[] | "all" {
    if (this.p.role !== "service" && table === "students") return STUDENT_UPDATABLE_COLUMNS;
    return "all";
  }

  private isStudentWritable(table: string): boolean {
    return STUDENT_CRUD.has(table) || table === "milestones" || table === "materials";
  }

  /** public.guardian_student_summaries */
  guardianSummaries(now: Date): DbRow[] {
    const t = now.getTime();
    const day = 86_400_000;
    const ms = (v: unknown) => (v == null ? NaN : Date.parse(String(v)));
    return this.src
      .rows("students")
      .filter((s) => this.isGuardianOf(s.id))
      .map((s) => {
        const goals = this.src.rows("goals").filter((g) => g.student_id === s.id && g.status === "active");
        const tasks = this.src.rows("tasks").filter((x) => x.student_id === s.id);
        const open = tasks.filter((x) => x.status === "todo" || x.status === "doing");
        const apps = this.src.rows("applications").filter((a) => a.student_id === s.id);
        const opps = this.src.rows("opportunities");
        const school = this.find("schools", s.school_id);
        return {
          student_id: s.id,
          display_name: (s.preferred_name as string | null) ?? s.full_name,
          grade: s.grade,
          school_name: school?.name ?? null,
          active_goals: goals.length,
          avg_goal_progress: goals.length ? Math.round(goals.reduce((a, g) => a + Number(g.progress), 0) / goals.length) : 0,
          tasks_due_next_7_days: open.filter((x) => ms(x.due_at) >= t && ms(x.due_at) <= t + 7 * day).length,
          tasks_overdue: open.filter((x) => ms(x.due_at) < t).length,
          tasks_done_last_7_days: tasks.filter((x) => x.status === "done" && ms(x.updated_at) > t - 7 * day).length,
          applications_submitted: apps.filter((a) => ["submitted", "accepted", "rejected"].includes(String(a.status))).length,
          application_deadlines_next_30_days: apps.filter((a) => {
            if (a.status !== "saved" && a.status !== "preparing") return false;
            const d = ms(opps.find((o) => o.id === a.opportunity_id)?.deadline);
            return d >= t && d <= t + 30 * day;
          }).length,
          achievements_count: this.src.rows("achievements").filter((a) => a.student_id === s.id).length,
        };
      });
  }

  // ---------- trigger emulation ----------
  /** Mirrors private.blocked_by_missing_consent(). */
  blockedByMissingConsent(sid: unknown, today: Date): boolean {
    const s = this.find("students", sid);
    if (!s) return true;
    const minor = ageFromDob(String(s.date_of_birth), today) < 18;
    const consent = this.src.rows("guardians").some((g) => g.student_id === sid && g.consent_status === "granted");
    return minor && !consent;
  }
}
