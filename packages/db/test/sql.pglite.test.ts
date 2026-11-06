/**
 * Runs supabase/migrations/*.sql + supabase/seed.sql in PGlite (real Postgres in WASM,
 * pgvector included) and checks RLS policies by switching roles + JWT subject.
 */
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { IDS } from "../src/testing.js";
import { asRole, bootDatabase } from "./pglite-harness.js";

let db: PGlite;
beforeAll(async () => {
  db = await bootDatabase();
}, 120_000);

const A = IDS.auth;
const S = IDS.students;
const student = (sub: string) => ({ role: "authenticated" as const, sub });
const count = async (q: (s: string) => Promise<{ n: number }[]>, sql: string) => Number((await q(sql))[0]!.n);

describe("schema + seed", () => {
  it("loads the seed counts", async () => {
    const r = await db.query<{ t: string; n: number }>(`
      select 'schools' t, count(*)::int n from schools union all select 'students', count(*)::int from students
      union all select 'opportunities', count(*)::int from opportunities union all select 'material_chunks', count(*)::int from material_chunks`);
    expect(Object.fromEntries(r.rows.map((x) => [x.t, x.n]))).toEqual({ schools: 2, students: 5, opportunities: 25, material_chunks: 3 });
  });

  it("all students are 13-17 and RLS is enabled on every public table", async () => {
    const ages = await db.query<{ a: number }>(`select private.age_years(date_of_birth, date '2026-10-10') a from students`);
    for (const { a } of ages.rows) expect(a).toBeGreaterThanOrEqual(13), expect(a).toBeLessThan(18);
    const noRls = await db.query(`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(noRls.rows).toEqual([]);
  });

  it("pgvector similarity search works", async () => {
    const r = await db.query<{ material_id: string }>(
      `select material_id from match_material_chunks((select embedding from material_chunks where id='f2000000-0000-4000-8000-000000000003'), 1)`);
    expect(r.rows[0]!.material_id).toBe("f1000000-0000-4000-8000-000000000007");
  });
});

describe("RLS: student", () => {
  it("sees only own rows", async () => {
    await asRole(db, student(A.aisha), async (q) => {
      expect(await count(q, `select count(*)::int n from students`)).toBe(1);
      expect(await count(q, `select count(*)::int n from tasks where student_id <> '${S.aisha}'`)).toBe(0);
      expect(await count(q, `select count(*)::int n from tasks`)).toBe(4);
      expect(await count(q, `select count(*)::int n from materials`)).toBe(3);
      expect(await count(q, `select count(*)::int n from material_chunks`)).toBe(2);
      expect(await count(q, `select count(*)::int n from opportunities`)).toBe(25);
      expect(await count(q, `select count(*)::int n from guardian_student_summaries`)).toBe(0);
    });
    // crawler sources are service-only: no rows and no grant at all (migration 7)
    await expect(asRole(db, student(A.aisha), (q) => q(`select count(*) from opportunity_sources`))).rejects.toThrow(/permission denied/);
  });

  it("vector search only returns own chunks", async () => {
    await asRole(db, student(A.rohan), async (q) => {
      const rows = await q(`select * from match_material_chunks((select embedding from material_chunks limit 1), 5)`);
      expect(rows).toEqual([]); // Rohan has no chunks; cannot even read others' embeddings
    });
  });

  it("cannot write another student's rows", async () => {
    await expect(
      asRole(db, student(A.aisha), (q) => q(`insert into tasks (student_id, title) values ('${S.rohan}', 'sneaky')`)),
    ).rejects.toThrow(/row-level security/);
    await asRole(db, student(A.aisha), async (q) => {
      const upd = await q(`update tasks set title='x' where student_id='${S.rohan}' returning id`);
      expect(upd).toEqual([]);
    });
  });

  it("can CRUD own tasks but cannot change identity columns", async () => {
    await asRole(db, student(A.aisha), async (q) => {
      const [t] = await q<{ id: string }>(`insert into tasks (student_id, title) values ('${S.aisha}', 'Revise osmosis') returning id`);
      expect(t!.id).toBeTruthy();
      await q(`update students set preferred_name='Aish' where id='${S.aisha}'`);
    });
    await expect(asRole(db, student(A.aisha), (q) => q(`update students set school_id=null where id='${S.aisha}'`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cannot write notifications, connections or audit logs", async () => {
    await expect(
      asRole(db, student(A.aisha), (q) => q(`insert into audit_logs (actor, actor_type, action, resource) values ('me','student','read','x')`)),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asRole(db, student(A.aisha), (q) => q(`insert into connections (student_id, provider) values ('${S.aisha}', 'teams')`)),
    ).rejects.toThrow(/row-level security/);
  });

  it("can invite a guardian only as pending", async () => {
    await asRole(db, student(A.mariam), (q) =>
      q(`insert into guardians (student_id, name, email) values ('${S.mariam}', 'Huda Test', 'huda.test@example.org')`));
    await expect(
      asRole(db, student(A.mariam), (q) =>
        q(`insert into guardians (student_id, name, email, consent_status) values ('${S.mariam}', 'Huda Test', 'h@example.org', 'granted')`)),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("RLS: guardian", () => {
  it("sees only the linked student's summary, not raw tables", async () => {
    await asRole(db, student(A.fatima), async (q) => {
      const rows = await q<{ student_id: string; active_goals: number; achievements_count: number }>(`select * from guardian_student_summaries`);
      expect(rows.map((r) => r.student_id)).toEqual([S.aisha]);
      expect(rows[0]!.active_goals).toBe(3);
      expect(rows[0]!.achievements_count).toBe(3);
      expect(await count(q, `select count(*)::int n from tasks`)).toBe(0);
      expect(await count(q, `select count(*)::int n from students`)).toBe(0);
      expect(await count(q, `select count(*)::int n from guardians`)).toBe(1); // own row
    });
  });
});

describe("RLS: counsellor", () => {
  it("sees consented students at own school only", async () => {
    await asRole(db, student(A.helen), async (q) => {
      const rows = await q<{ id: string }>(`select id from students order by id`);
      expect(rows.map((r) => r.id)).toEqual([S.aisha]); // Mariam & Layla: no counsellor_access consent
      expect(await count(q, `select count(*)::int n from goals`)).toBe(3);
      expect(await count(q, `select count(*)::int n from tasks`)).toBe(0);
      expect(await count(q, `select count(*)::int n from materials`)).toBe(0);
    });
    await asRole(db, student(A.ravi), async (q) => {
      const rows = await q<{ id: string }>(`select id from students order by id`);
      expect(rows.map((r) => r.id)).toEqual([S.rohan]); // Arjun revoked counsellor_access
    });
  });
});

describe("RLS: anon + service_role", () => {
  it("anon gets nothing", async () => {
    await expect(asRole(db, { role: "anon" }, (q) => q(`select * from opportunities`))).rejects.toThrow(/permission denied/);
  });
  it("service_role sees everything", async () => {
    await asRole(db, { role: "service_role" }, async (q) => {
      expect(await count(q, `select count(*)::int n from tasks`)).toBe(12);
      expect(await count(q, `select count(*)::int n from opportunity_sources`)).toBe(2);
    });
  });
});

describe("triggers", () => {
  const svc = { role: "service_role" as const };
  it("rejects under-13 students", async () => {
    await expect(
      asRole(db, svc, (q) => q(`insert into students (full_name, date_of_birth, grade, curriculum) values ('Tiny Test', current_date - interval '12 years', 7, 'british')`)),
    ).rejects.toThrow(/13\+/);
  });
  it("blocks active connectors and guardian notifications for minors without consent", async () => {
    await expect(
      asRole(db, svc, (q) => q(`update connections set status='active', token_ref='vault:conn/m' where student_id='${S.mariam}'`)),
    ).rejects.toThrow(/guardian consent required/);
    await expect(
      asRole(db, svc, (q) => q(`insert into notifications (student_id, recipient, channel, template) values ('${S.mariam}', 'guardian', 'email', 'weekly')`)),
    ).rejects.toThrow(/guardian consent required/);
    await asRole(db, svc, (q) => q(`insert into notifications (student_id, recipient, channel, template) values ('${S.mariam}', 'student', 'in_app', 'hello')`));
  });
  it("rejects raw tokens, cross-student links and audit edits", async () => {
    await expect(asRole(db, svc, (q) => q(`update connections set token_ref='ya29.raw' where student_id='${S.aisha}'`))).rejects.toThrow(/token_ref/);
    await expect(
      asRole(db, svc, (q) => q(`insert into tasks (student_id, title, linked_goal_id) values ('${S.rohan}', 'x', '${IDS.goals.aishaMed}')`)),
    ).rejects.toThrow(/another student/);
    await expect(asRole(db, svc, (q) => q(`delete from audit_logs`))).rejects.toThrow(/append-only/);
  });
  it("maintains updated_at", async () => {
    await asRole(db, svc, async (q) => {
      const [r] = await q<{ changed: boolean }>(
        `update goals set progress = 36 where id='${IDS.goals.aishaMed}' returning updated_at > created_at as changed`);
      expect(r!.changed).toBe(true);
    });
  });
});
