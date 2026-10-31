/**
 * Minimal data-access interface. Repositories only talk to this, so the same code
 * runs on Supabase (PostgREST, real RLS) and on the in-memory driver (RLS emulated).
 */
export type FilterOp = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "is" | "contains" | "ilike";

export interface Filter {
  column: string;
  op: FilterOp;
  value: unknown;
}

export interface OrderBy {
  column: string;
  ascending?: boolean;
}

export interface SelectOptions {
  filters?: Filter[];
  orderBy?: OrderBy[];
  limit?: number;
}

export type DbRow = Record<string, unknown>;

export interface DbDriver {
  select(table: string, opts?: SelectOptions): Promise<DbRow[]>;
  /** Returns inserted rows (as the caller can see them). */
  insert(table: string, rows: DbRow[]): Promise<DbRow[]>;
  /** Returns updated rows. Rows hidden by RLS are silently skipped (0 rows), like Postgres. */
  update(table: string, filters: Filter[], patch: DbRow): Promise<DbRow[]>;
  /** Returns number of deleted rows. */
  delete(table: string, filters: Filter[]): Promise<number>;
}

export type DbErrorCode = "permission_denied" | "check_violation" | "unique_violation" | "foreign_key_violation" | "not_found" | "validation" | "unknown";

export class DbError extends Error {
  constructor(
    public readonly code: DbErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "DbError";
  }
}

/** Maps Postgres SQLSTATE codes (as surfaced by PostgREST) to DbErrorCode. */
export function codeFromSqlState(sqlstate: string | undefined): DbErrorCode {
  switch (sqlstate) {
    case "42501":
      return "permission_denied";
    case "23514":
      return "check_violation";
    case "23505":
      return "unique_violation";
    case "23503":
      return "foreign_key_violation";
    case "PGRST116":
      return "not_found";
    default:
      return "unknown";
  }
}

// small filter builders
export const eq = (column: string, value: unknown): Filter => ({ column, op: "eq", value });
export const neq = (column: string, value: unknown): Filter => ({ column, op: "neq", value });
export const gt = (column: string, value: unknown): Filter => ({ column, op: "gt", value });
export const gte = (column: string, value: unknown): Filter => ({ column, op: "gte", value });
export const lt = (column: string, value: unknown): Filter => ({ column, op: "lt", value });
export const lte = (column: string, value: unknown): Filter => ({ column, op: "lte", value });
export const inList = (column: string, value: readonly unknown[]): Filter => ({ column, op: "in", value });
export const isNull = (column: string): Filter => ({ column, op: "is", value: null });
export const contains = (column: string, value: readonly unknown[]): Filter => ({ column, op: "contains", value });
