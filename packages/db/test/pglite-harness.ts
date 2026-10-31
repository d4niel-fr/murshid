import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";

export const SUPABASE_DIR = join(__dirname, "../../../supabase");

/**
 * Minimal stand-in for what Supabase provides before migrations run:
 * roles anon/authenticated/service_role, auth.uid(), default grants.
 */
export const SUPABASE_SHIM = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  const dir = join(SUPABASE_DIR, "migrations");
  return readdirSync(dir).filter((f) => f.endsWith(".sql")).sort().map((f) => join(dir, f));
}

export async function bootDatabase(opts: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite({ extensions: { vector } });
  await db.exec(SUPABASE_SHIM);
  for (const f of migrationFiles()) {
    try {
      await db.exec(readFileSync(f, "utf8"));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${(e as Error).message}`);
    }
  }
  if (opts.seed !== false) await db.exec(readFileSync(join(SUPABASE_DIR, "seed.sql"), "utf8"));
  return db;
}

/** Run `fn` as an authenticated user (or service_role) inside a rolled-back transaction. */
export async function asRole<T>(
  db: PGlite,
  who: { role: "authenticated"; sub: string } | { role: "service_role" } | { role: "anon" },
  fn: (q: <R = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const sub = "sub" in who ? who.sub : "";
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [sub]);
    await tx.exec(`set local role ${who.role}`);
    const q = async <R,>(sql: string, params?: unknown[]) => (await tx.query<R>(sql, params)).rows;
    const result = await fn(q);
    await tx.rollback();
    return result;
  }) as Promise<T>;
}
