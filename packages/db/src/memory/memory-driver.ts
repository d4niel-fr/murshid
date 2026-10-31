import { ageFromDob, TABLES, type TableName } from "@murshid/core";
import { DbError, type DbDriver, type DbRow, type Filter, type SelectOptions } from "../driver.js";
import { COLUMN_DEFAULTS, NOW, UNIQUE_KEYS } from "./defaults.js";
import { PolicyContext, type Principal } from "./policies.js";

const VIEWS = new Set(["guardian_student_summaries"]);

/** Shared in-memory "database". Create one store, then one driver per principal. */
export class InMemoryStore {
  private readonly tables = new Map<string, DbRow[]>();
  constructor(public clock: () => Date = () => new Date()) {
    for (const t of Object.keys(TABLES)) this.tables.set(t, []);
  }
  rows(table: string): DbRow[] {
    const r = this.tables.get(table);
    if (!r) throw new DbError("unknown", `relation "${table}" does not exist`);
    return r;
  }
  /** Raw load bypassing policies/defaults (like running seed.sql as postgres). */
  load(table: TableName, rows: DbRow[]): void {
    const now = this.clock().toISOString();
    for (const row of rows) this.rows(table).push({ created_at: now, updated_at: now, ...structuredClone(row) });
  }
  /** Driver acting as a principal (RLS applies unless role = service). */
  as(principal: Principal): InMemoryDriver {
    return new InMemoryDriver(this, principal);
  }
}

function cmp(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1; // nulls last (Postgres default for ASC)
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  const sa = String(a);
  const sb = String(b);
  const ta = Date.parse(sa);
  const tb = Date.parse(sb);
  if (/^\d{4}-\d{2}-\d{2}/.test(sa) && /^\d{4}-\d{2}-\d{2}/.test(sb) && !Number.isNaN(ta) && !Number.isNaN(tb)) return ta - tb;
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

export function matches(row: DbRow, f: Filter): boolean {
  const v = row[f.column];
  switch (f.op) {
    case "eq":
      return v != null && cmp(v, f.value) === 0;
    case "neq":
      return v != null && cmp(v, f.value) !== 0;
    case "gt":
      return v != null && cmp(v, f.value) > 0;
    case "gte":
      return v != null && cmp(v, f.value) >= 0;
    case "lt":
      return v != null && cmp(v, f.value) < 0;
    case "lte":
      return v != null && cmp(v, f.value) <= 0;
    case "in":
      return v != null && (f.value as unknown[]).some((x) => cmp(v, x) === 0);
    case "is":
      return v === f.value || (f.value === null && v === undefined);
    case "contains":
      return Array.isArray(v) && (f.value as unknown[]).every((x) => v.includes(x));
    case "ilike": {
      const re = new RegExp(
        "^" + String(f.value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".") + "$",
        "i",
      );
      return typeof v === "string" && re.test(v);
    }
  }
}

export class InMemoryDriver implements DbDriver {
  private readonly policy: PolicyContext;
  constructor(
    private readonly store: InMemoryStore,
    private readonly principal: Principal,
  ) {
    this.policy = new PolicyContext(store, principal);
  }

  private visible(table: string): DbRow[] {
    if (VIEWS.has(table)) {
      if (this.principal.role === "anon") throw new DbError("permission_denied", `permission denied for view ${table}`);
      return this.policy.guardianSummaries(this.store.clock());
    }
    if (this.principal.role === "anon") throw new DbError("permission_denied", `permission denied for table ${table}`);
    return this.store.rows(table).filter((r) => this.policy.canSelect(table, r));
  }

  async select(table: string, opts: SelectOptions = {}): Promise<DbRow[]> {
    let rows = this.visible(table).filter((r) => (opts.filters ?? []).every((f) => matches(r, f)));
    for (const o of [...(opts.orderBy ?? [])].reverse()) {
      rows = [...rows].sort((a, b) => cmp(a[o.column], b[o.column]) * (o.ascending === false ? -1 : 1));
    }
    if (opts.limit !== undefined) rows = rows.slice(0, opts.limit);
    return structuredClone(rows);
  }

  async insert(table: string, input: DbRow[]): Promise<DbRow[]> {
    this.assertTable(table);
    const out: DbRow[] = [];
    for (const raw of input) {
      const row = this.withDefaults(table as TableName, raw);
      if (!this.policy.canInsert(table, row)) {
        throw new DbError("permission_denied", `new row violates row-level security policy for table "${table}"`);
      }
      this.runTriggers(table, row, null);
      this.checkUnique(table, row, null);
      this.store.rows(table).push(row);
      out.push(structuredClone(row));
    }
    return out;
  }

  async update(table: string, filters: Filter[], patch: DbRow): Promise<DbRow[]> {
    this.assertTable(table);
    if (filters.length === 0) throw new DbError("validation", "refusing unfiltered update");
    const allowed = this.policy.updatableColumns(table);
    if (allowed !== "all") {
      const bad = Object.keys(patch).filter((c) => !allowed.includes(c));
      if (bad.length) throw new DbError("permission_denied", `permission denied for columns ${bad.join(", ")} of ${table}`);
    }
    if ("id" in patch) throw new DbError("validation", "id is immutable");
    if (table === "audit_logs") throw new DbError("permission_denied", "audit_logs is append-only");
    const targets = this.store
      .rows(table)
      .filter((r) => this.policy.canSelect(table, r) && this.policy.canModify(table, r, "update"))
      .filter((r) => filters.every((f) => matches(r, f)));
    const out: DbRow[] = [];
    for (const r of targets) {
      const next = { ...r, ...structuredClone(patch), updated_at: this.store.clock().toISOString() };
      if (!this.policy.updateCheck(table, next)) {
        throw new DbError("permission_denied", `new row violates row-level security policy for table "${table}"`);
      }
      this.runTriggers(table, next, r);
      this.checkUnique(table, next, r);
      Object.assign(r, next);
      out.push(structuredClone(r));
    }
    return out;
  }

  async delete(table: string, filters: Filter[]): Promise<number> {
    this.assertTable(table);
    if (filters.length === 0) throw new DbError("validation", "refusing unfiltered delete");
    if (table === "audit_logs") throw new DbError("permission_denied", "audit_logs is append-only");
    const rows = this.store.rows(table);
    const doomed = rows.filter(
      (r) => this.policy.canSelect(table, r) && this.policy.canModify(table, r, "delete") && filters.every((f) => matches(r, f)),
    );
    for (const d of doomed) rows.splice(rows.indexOf(d), 1);
    return doomed.length;
  }

  // ---------- internals ----------
  private assertTable(table: string): void {
    if (VIEWS.has(table)) throw new DbError("permission_denied", `cannot write to view ${table}`);
    if (this.principal.role === "anon") throw new DbError("permission_denied", `permission denied for table ${table}`);
    this.store.rows(table);
  }

  private withDefaults(table: TableName, raw: DbRow): DbRow {
    const now = this.store.clock().toISOString();
    const shape = TABLES[table].Row.shape as Record<string, { safeParse(v: unknown): { success: boolean } }>;
    const row: DbRow = {};
    for (const [col, schema] of Object.entries(shape)) {
      if (raw[col] !== undefined) row[col] = structuredClone(raw[col]);
      else if (col === "id") row[col] = crypto.randomUUID();
      else if (col === "created_at" || col === "updated_at") row[col] = now;
      else if (col in COLUMN_DEFAULTS[table]) {
        const d = COLUMN_DEFAULTS[table][col];
        row[col] = d === NOW ? now : structuredClone(d);
      } else if (schema.safeParse(null).success) row[col] = null;
      else throw new DbError("check_violation", `null value in column "${col}" of relation "${table}" violates not-null constraint`);
    }
    const unknown = Object.keys(raw).filter((k) => !(k in shape));
    if (unknown.length) throw new DbError("validation", `unknown column(s) ${unknown.join(", ")} for ${table}`);
    return row;
  }

  private checkUnique(table: string, row: DbRow, self: DbRow | null): void {
    for (const key of UNIQUE_KEYS[table as TableName] ?? []) {
      if (key.some((k) => row[k] == null)) continue;
      const clash = this.store.rows(table).some((r) => r !== self && key.every((k) => r[k] === row[k]));
      if (clash) throw new DbError("unique_violation", `duplicate key value violates unique constraint on ${table}(${key.join(", ")})`);
    }
    if (this.store.rows(table).some((r) => r !== self && r.id === row.id)) {
      throw new DbError("unique_violation", `duplicate key value violates ${table}_pkey`);
    }
  }

  /** Mirrors the SQL triggers in 20261010000003_functions_triggers.sql. */
  private runTriggers(table: string, row: DbRow, old: DbRow | null): void {
    const today = this.store.clock();
    const fail = (msg: string) => {
      throw new DbError("check_violation", msg);
    };
    if (table === "students" && (old === null || old.date_of_birth !== row.date_of_birth)) {
      if (ageFromDob(String(row.date_of_birth), today) < 13) fail("Murshid is for students aged 13+");
    }
    if (table === "connections" && row.status === "active" && (old === null || old.status !== row.status)) {
      if (this.policy.blockedByMissingConsent(row.student_id, today)) fail("guardian consent required before activating a connector for a minor");
    }
    if (table === "notifications" && row.recipient !== "student" && (old === null || old.recipient !== row.recipient)) {
      if (this.policy.blockedByMissingConsent(row.student_id, today)) fail(`guardian consent required before notifying ${String(row.recipient)} for a minor`);
    }
    if (table === "tasks") {
      if (row.linked_goal_id != null && this.policy.goalStudentId(row.linked_goal_id) !== row.student_id) fail("linked_goal_id belongs to another student");
      if (row.linked_material_id != null && this.policy.materialStudentId(row.linked_material_id) !== row.student_id) {
        fail("linked_material_id belongs to another student");
      }
    }
    if (table === "goals" && row.parent_goal_id != null) {
      if (row.parent_goal_id === row.id) fail("goal cannot be its own parent");
      if (this.policy.goalStudentId(row.parent_goal_id) !== row.student_id) fail("parent_goal_id belongs to another student");
    }
    if (table === "students" && typeof row.grade === "number" && (row.grade < 6 || row.grade > 13)) fail("grade out of range");
    if (table === "goals" && typeof row.progress === "number" && (row.progress < 0 || row.progress > 100)) fail("progress out of range");
  }
}
