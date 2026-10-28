import { DbError, codeFromSqlState, type DbDriver, type DbRow, type Filter, type SelectOptions } from "./driver.js";

/**
 * Structural subset of @supabase/supabase-js used here, so this package does not
 * depend on supabase-js. A real client works: `new SupabaseDriver(client as unknown as SupabaseLike)`.
 * Use a client built with the *user's* JWT so Postgres RLS applies; use the service-role
 * client only in trusted backend jobs.
 */
export interface PostgrestResult {
  data: unknown;
  error: { message: string; code?: string; details?: string | null } | null;
  count?: number | null;
}

export interface QueryBuilderLike extends PromiseLike<PostgrestResult> {
  select(columns?: string, opts?: { count?: "exact" }): QueryBuilderLike;
  eq(column: string, value: unknown): QueryBuilderLike;
  neq(column: string, value: unknown): QueryBuilderLike;
  gt(column: string, value: unknown): QueryBuilderLike;
  gte(column: string, value: unknown): QueryBuilderLike;
  lt(column: string, value: unknown): QueryBuilderLike;
  lte(column: string, value: unknown): QueryBuilderLike;
  in(column: string, values: readonly unknown[]): QueryBuilderLike;
  is(column: string, value: null | boolean): QueryBuilderLike;
  contains(column: string, value: unknown): QueryBuilderLike;
  ilike(column: string, pattern: string): QueryBuilderLike;
  order(column: string, opts?: { ascending?: boolean }): QueryBuilderLike;
  limit(n: number): QueryBuilderLike;
}

export interface TableBuilderLike {
  select(columns?: string, opts?: { count?: "exact" }): QueryBuilderLike;
  insert(rows: DbRow[]): QueryBuilderLike;
  update(patch: DbRow): QueryBuilderLike;
  delete(opts?: { count?: "exact" }): QueryBuilderLike;
}

export interface SupabaseLike {
  from(table: string): TableBuilderLike;
}

function applyFilters(q: QueryBuilderLike, filters: Filter[] = []): QueryBuilderLike {
  for (const f of filters) {
    switch (f.op) {
      case "in":
        q = q.in(f.column, f.value as unknown[]);
        break;
      case "is":
        q = q.is(f.column, f.value as null | boolean);
        break;
      case "ilike":
        q = q.ilike(f.column, String(f.value));
        break;
      default:
        q = q[f.op](f.column, f.value);
    }
  }
  return q;
}

async function run(q: PromiseLike<PostgrestResult>): Promise<PostgrestResult> {
  const res = await q;
  if (res.error) throw new DbError(codeFromSqlState(res.error.code), res.error.message, res.error);
  return res;
}

export class SupabaseDriver implements DbDriver {
  constructor(private readonly client: SupabaseLike) {}

  async select(table: string, opts: SelectOptions = {}): Promise<DbRow[]> {
    let q = applyFilters(this.client.from(table).select("*"), opts.filters);
    for (const o of opts.orderBy ?? []) q = q.order(o.column, { ascending: o.ascending ?? true });
    if (opts.limit !== undefined) q = q.limit(opts.limit);
    return ((await run(q)).data as DbRow[] | null) ?? [];
  }

  async insert(table: string, rows: DbRow[]): Promise<DbRow[]> {
    const res = await run(this.client.from(table).insert(rows).select("*"));
    return (res.data as DbRow[] | null) ?? [];
  }

  async update(table: string, filters: Filter[], patch: DbRow): Promise<DbRow[]> {
    if (filters.length === 0) throw new DbError("validation", "refusing unfiltered update");
    const res = await run(applyFilters(this.client.from(table).update(patch), filters).select("*"));
    return (res.data as DbRow[] | null) ?? [];
  }

  async delete(table: string, filters: Filter[]): Promise<number> {
    if (filters.length === 0) throw new DbError("validation", "refusing unfiltered delete");
    const res = await run(applyFilters(this.client.from(table).delete({ count: "exact" }), filters));
    return res.count ?? 0;
  }
}
