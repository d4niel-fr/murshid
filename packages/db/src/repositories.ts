import {
  GuardianStudentSummary, TABLES, gradeEligible,
  type ApplicationStatus, type AuditLogInsert, type ConsentStatus, type Emirate, type GoalStatus, type InsertOf,
  type OpportunityType, type RowOf, type TableName, type TaskStatus, type UpdateOf,
} from "@murshid/core";
import type { z } from "zod";
import { DbError, eq, gte, inList, lte, type DbDriver, type DbRow, type Filter, type OrderBy } from "./driver.js";

/** Normalise driver output (Date objects, pgvector strings, numeric strings) to the core Row shape. */
function normalise(table: TableName, row: DbRow): DbRow {
  const out: DbRow = {};
  for (const [k, v] of Object.entries(row)) out[k] = v instanceof Date ? v.toISOString() : v;
  if (table === "material_chunks" && typeof out.embedding === "string") out.embedding = JSON.parse(out.embedding);
  if (table === "opportunities" && typeof out.cost_aed === "string") out.cost_aed = Number(out.cost_aed);
  return out;
}

function parse<S extends z.ZodTypeAny>(schema: S, value: unknown, what: string): z.infer<S> {
  const r = schema.safeParse(value);
  if (!r.success) throw new DbError("validation", `${what}: ${r.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}`, r.error);
  return r.data;
}

export interface ListOptions {
  filters?: Filter[];
  orderBy?: OrderBy[];
  limit?: number;
}

/** Generic typed CRUD over one table, validating input and output with @murshid/core schemas. */
export class Repository<T extends TableName> {
  constructor(
    protected readonly db: DbDriver,
    readonly table: T,
  ) {}

  protected get schemas() {
    return TABLES[this.table];
  }

  protected toRow(raw: DbRow): RowOf<T> {
    return parse(this.schemas.Row, normalise(this.table, raw), `${this.table} row`) as RowOf<T>;
  }

  async list(opts: ListOptions = {}): Promise<RowOf<T>[]> {
    return (await this.db.select(this.table, opts)).map((r) => this.toRow(r));
  }

  async get(id: string): Promise<RowOf<T> | null> {
    const [row] = await this.db.select(this.table, { filters: [eq("id", id)], limit: 1 });
    return row ? this.toRow(row) : null;
  }

  async getOrThrow(id: string): Promise<RowOf<T>> {
    const row = await this.get(id);
    if (!row) throw new DbError("not_found", `${this.table} ${id} not found`);
    return row;
  }

  async create(input: InsertOf<T>): Promise<RowOf<T>> {
    const [row] = await this.createMany([input]);
    return row!;
  }

  async createMany(inputs: InsertOf<T>[]): Promise<RowOf<T>[]> {
    const rows = inputs.map((i) => parse(this.schemas.Insert, i, `${this.table} insert`) as DbRow);
    return (await this.db.insert(this.table, rows)).map((r) => this.toRow(r));
  }

  /** Returns null when the row does not exist or is not visible/writable for the caller (RLS). */
  async update(id: string, patch: UpdateOf<T>): Promise<RowOf<T> | null> {
    const clean = parse(this.schemas.Update, patch, `${this.table} update`) as DbRow;
    const [row] = await this.db.update(this.table, [eq("id", id)], clean);
    return row ? this.toRow(row) : null;
  }

  async delete(id: string): Promise<boolean> {
    return (await this.db.delete(this.table, [eq("id", id)])) > 0;
  }

  protected forStudent(studentId: string, extra: Filter[] = [], orderBy?: OrderBy[]): Promise<RowOf<T>[]> {
    return this.list({ filters: [eq("student_id", studentId), ...extra], orderBy });
  }
}

// ---------- entity repositories ----------
export class StudentsRepo extends Repository<"students"> {
  async getByAuthUserId(authUserId: string) {
    const [row] = await this.list({ filters: [eq("auth_user_id", authUserId)], limit: 1 });
    return row ?? null;
  }
  listBySchool(schoolId: string) {
    return this.list({ filters: [eq("school_id", schoolId)], orderBy: [{ column: "full_name" }] });
  }
}

export class GuardiansRepo extends Repository<"guardians"> {
  listForStudent(studentId: string) {
    return this.forStudent(studentId);
  }
}

export class GoalsRepo extends Repository<"goals"> {
  listForStudent(studentId: string, status?: GoalStatus) {
    return this.forStudent(studentId, status ? [eq("status", status)] : [], [{ column: "target_date" }]);
  }
  listChildren(parentGoalId: string) {
    return this.list({ filters: [eq("parent_goal_id", parentGoalId)] });
  }
}

export class MilestonesRepo extends Repository<"milestones"> {
  listForGoal(goalId: string) {
    return this.list({ filters: [eq("goal_id", goalId)], orderBy: [{ column: "due_date" }] });
  }
  setDone(id: string, done: boolean) {
    return this.update(id, { done });
  }
}

export class CoursesRepo extends Repository<"courses"> {
  listForStudent(studentId: string) {
    return this.forStudent(studentId, [], [{ column: "name" }]);
  }
}

export class MaterialsRepo extends Repository<"materials"> {
  listForCourse(courseId: string) {
    return this.list({ filters: [eq("course_id", courseId)], orderBy: [{ column: "ingested_at", ascending: false }] });
  }
  /** Materials with a due date in [from, to]; RLS limits this to the caller's own courses. */
  listDueBetween(from: string, to: string) {
    return this.list({ filters: [gte("due_at", from), lte("due_at", to)], orderBy: [{ column: "due_at" }] });
  }
}

export class MaterialChunksRepo extends Repository<"material_chunks"> {
  listForMaterial(materialId: string) {
    return this.list({ filters: [eq("material_id", materialId)], orderBy: [{ column: "chunk_index" }] });
  }
}

export class TasksRepo extends Repository<"tasks"> {
  listForStudent(studentId: string, opts: { status?: TaskStatus[]; dueFrom?: string; dueTo?: string } = {}) {
    const f: Filter[] = [];
    if (opts.status?.length) f.push(inList("status", opts.status));
    if (opts.dueFrom) f.push(gte("due_at", opts.dueFrom));
    if (opts.dueTo) f.push(lte("due_at", opts.dueTo));
    return this.forStudent(studentId, f, [{ column: "due_at" }]);
  }
  complete(id: string) {
    return this.update(id, { status: "done" });
  }
}

export class CalendarEventsRepo extends Repository<"calendar_events"> {
  listBetween(studentId: string, from: string, to: string) {
    return this.forStudent(studentId, [gte("start_at", from), lte("start_at", to)], [{ column: "start_at" }]);
  }
}

export interface OpportunitySearch {
  grade?: number;
  types?: OpportunityType[];
  emirate?: Emirate;
  /** status = open and deadline null or >= now */
  openOnly?: boolean;
  /** max cost in AED */
  maxCostAed?: number;
  tagsAny?: string[];
  now?: Date;
  limit?: number;
}

export class OpportunitiesRepo extends Repository<"opportunities"> {
  async search(q: OpportunitySearch = {}) {
    const f: Filter[] = [];
    if (q.types?.length) f.push(inList("type", q.types));
    if (q.openOnly) f.push(eq("status", "open"));
    if (q.maxCostAed !== undefined) f.push(lte("cost_aed", q.maxCostAed));
    const now = (q.now ?? new Date()).getTime();
    const rows = await this.list({ filters: f, orderBy: [{ column: "deadline" }] });
    const out = rows.filter(
      (o) =>
        (q.grade === undefined || gradeEligible(q.grade, o)) &&
        // emirate filter keeps nationwide/online entries (emirate null)
        (q.emirate === undefined || o.emirate === null || o.emirate === q.emirate) &&
        (!q.openOnly || o.deadline === null || Date.parse(o.deadline) >= now) &&
        (!q.tagsAny?.length || o.tags.some((t) => q.tagsAny!.includes(t))),
    );
    return q.limit !== undefined ? out.slice(0, q.limit) : out;
  }
}

export class ApplicationsRepo extends Repository<"applications"> {
  listForStudent(studentId: string, status?: ApplicationStatus[]) {
    return this.forStudent(studentId, status?.length ? [inList("status", status)] : [], [{ column: "updated_at", ascending: false }]);
  }
  /** Sets submitted_at automatically on first move to 'submitted'. */
  async setStatus(id: string, status: ApplicationStatus, now: Date = new Date()) {
    const current = await this.getOrThrow(id);
    const patch: UpdateOf<"applications"> = { status };
    if (status === "submitted" && !current.submitted_at) patch.submitted_at = now.toISOString();
    return this.update(id, patch);
  }
}

export class AchievementsRepo extends Repository<"achievements"> {
  listForStudent(studentId: string) {
    return this.forStudent(studentId, [], [{ column: "date", ascending: false }]);
  }
}

export class CvVersionsRepo extends Repository<"cv_versions"> {
  async latestForStudent(studentId: string) {
    const [row] = await this.list({ filters: [eq("student_id", studentId)], orderBy: [{ column: "created_at", ascending: false }], limit: 1 });
    return row ?? null;
  }
}

export class NotificationsRepo extends Repository<"notifications"> {
  /** Scheduled notifications due at or before `now` (service role use). */
  listDue(now: Date = new Date(), limit = 100) {
    return this.list({ filters: [eq("status", "scheduled"), lte("scheduled_at", now.toISOString())], orderBy: [{ column: "scheduled_at" }], limit });
  }
  markSent(id: string, at: Date = new Date()) {
    return this.update(id, { status: "sent", sent_at: at.toISOString() });
  }
}

export class ConnectionsRepo extends Repository<"connections"> {
  listForStudent(studentId: string) {
    return this.forStudent(studentId);
  }
}

export class ConsentRecordsRepo extends Repository<"consent_records"> {
  listForStudent(studentId: string) {
    return this.forStudent(studentId, [], [{ column: "created_at", ascending: false }]);
  }
  async latest(studentId: string, scope: string): Promise<ConsentStatus | null> {
    const rows = await this.list({ filters: [eq("student_id", studentId), eq("scope", scope)] });
    rows.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id.localeCompare(a.id));
    return rows[0]?.status ?? null;
  }
}

/** Append-only: no update/delete exposed. */
export class AuditLogsRepo {
  private readonly repo: Repository<"audit_logs">;
  constructor(db: DbDriver) {
    this.repo = new Repository(db, "audit_logs");
  }
  record(entry: AuditLogInsert) {
    return this.repo.create(entry);
  }
  listForStudent(studentId: string, limit = 100) {
    return this.repo.list({ filters: [eq("student_id", studentId)], orderBy: [{ column: "at", ascending: false }], limit });
  }
}

export class GuardianSummariesRepo {
  constructor(private readonly db: DbDriver) {}
  /** Summaries of the caller's linked students (empty for non-guardians). */
  async listMine() {
    return (await this.db.select("guardian_student_summaries")).map((r) => parse(GuardianStudentSummary, r, "guardian summary"));
  }
}

export function createRepositories(db: DbDriver) {
  return {
    schools: new Repository(db, "schools"),
    students: new StudentsRepo(db, "students"),
    guardians: new GuardiansRepo(db, "guardians"),
    schoolStaff: new Repository(db, "school_staff"),
    goals: new GoalsRepo(db, "goals"),
    milestones: new MilestonesRepo(db, "milestones"),
    courses: new CoursesRepo(db, "courses"),
    materials: new MaterialsRepo(db, "materials"),
    materialChunks: new MaterialChunksRepo(db, "material_chunks"),
    tasks: new TasksRepo(db, "tasks"),
    calendarEvents: new CalendarEventsRepo(db, "calendar_events"),
    opportunitySources: new Repository(db, "opportunity_sources"),
    opportunities: new OpportunitiesRepo(db, "opportunities"),
    applications: new ApplicationsRepo(db, "applications"),
    achievements: new AchievementsRepo(db, "achievements"),
    cvVersions: new CvVersionsRepo(db, "cv_versions"),
    notifications: new NotificationsRepo(db, "notifications"),
    connections: new ConnectionsRepo(db, "connections"),
    consentRecords: new ConsentRecordsRepo(db, "consent_records"),
    auditLogs: new AuditLogsRepo(db),
    guardianSummaries: new GuardianSummariesRepo(db),
  };
}
export type Repositories = ReturnType<typeof createRepositories>;
