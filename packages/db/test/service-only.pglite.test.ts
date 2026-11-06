/**
 * Tables only the API uses (saved state, billing, idempotency, school assignments) are closed to the browser keys
 * twice: row level security with no policies, and no table grants. The survey's results need a real admin code.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, bootDatabase, SUPABASE_DIR } from "./pglite-harness.js";

let db: PGlite;
beforeAll(async () => {
  db = await bootDatabase();
  await db.exec(readFileSync(join(SUPABASE_DIR, "survey.sql"), "utf8"));
}, 120_000);

const SERVICE_ONLY = ["murshid_state", "subscriptions", "idempotency_keys", "school_assignments", "assignment_responses", "opportunity_sources"];
const user = { role: "authenticated" as const, sub: "a0000000-0000-4000-8000-000000000001" };

describe("service-only tables", () => {
  it("have RLS on and no grants for anon or authenticated", async () => {
    const r = await db.query<{ relname: string; rls: boolean }>(
      `select relname, relrowsecurity rls from pg_class where relnamespace = 'public'::regnamespace and relname = any($1)`, [SERVICE_ONLY]);
    expect(r.rows.map((x) => x.relname).sort()).toEqual([...SERVICE_ONLY].sort());
    expect(r.rows.every((x) => x.rls)).toBe(true);
    const grants = await db.query(`select table_name, grantee, privilege_type from information_schema.role_table_grants
      where table_schema = 'public' and table_name = any($1) and grantee in ('anon', 'authenticated')`, [SERVICE_ONLY]);
    expect(grants.rows).toEqual([]);
  });

  it("refuse the browser keys, even for the saved-state documents", async () => {
    for (const who of [{ role: "anon" as const }, user]) {
      for (const t of SERVICE_ONLY) {
        await expect(asRole(db, who, (q) => q(`select * from public.${t} limit 1`)), `${who.role} ${t}`).rejects.toThrow(/permission denied/);
      }
      await expect(asRole(db, who, (q) => q(`insert into public.murshid_state (key, data) values ('demo', '{}')`))).rejects.toThrow(/permission denied/);
    }
  });

  it("stay open to the service role (the API)", async () => {
    await asRole(db, { role: "service_role" }, async (q) => {
      await q(`insert into public.murshid_state (key, data, version) values ('user:x:study', '{"a":1}', 1)`);
      const [row] = await q<{ version: number }>(`update public.murshid_state set version = version + 1 where key = 'user:x:study' and version = 1 returning version`);
      expect(Number(row!.version)).toBe(2);
    });
  });
});

describe("survey", () => {
  it("anyone may insert one consented answer, nobody may read them directly", async () => {
    await asRole(db, { role: "anon" }, (q) => q(`insert into public.survey_responses (version, answers, consent) values ('student', '{"q1":"a"}', true)`));
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from public.survey_responses`))).rejects.toThrow(/permission denied/);
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from public.survey_config`))).rejects.toThrow(/permission denied/);
  });

  it("results need the real admin code: never the placeholder, never a short one", async () => {
    await db.exec(`grant usage on schema public to anon`);
    // the placeholder from the file is refused even when sent back exactly
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from public.survey_results('REPLACE_WITH_SURVEY_ADMIN_CODE')`))).rejects.toThrow(/not allowed/);
    await db.exec(`update public.survey_config set v = 'short' where k = 'admin_code'`);
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from public.survey_results('short')`))).rejects.toThrow(/not allowed/);
    const good = "a-long-random-survey-admin-code-0123456789";
    await db.exec(`update public.survey_config set v = '${good}' where k = 'admin_code'`);
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from public.survey_results('${good}x')`))).rejects.toThrow(/not allowed/);
    // (each asRole call is rolled back at the end, so insert and read in one go)
    const rows = await asRole(db, { role: "anon" }, async (q) => {
      await q(`insert into public.survey_responses (version, answers, consent) values ('teacher', '{"q1":"b"}', true)`);
      return q(`select * from public.survey_results('${good}')`);
    });
    expect(rows.length).toBe(1);
  });
});
