import { describe, expect, it } from "vitest";
import { createRepositories, DbError, SupabaseDriver, type PostgrestResult, type SupabaseLike } from "../src/index.js";

/** Records the PostgREST call chain and returns a canned result. */
function fakeClient(result: PostgrestResult) {
  const calls: string[] = [];
  const builder: any = new Proxy(
    {},
    {
      get(_t, prop: string) {
        if (prop === "then") return (res: (v: PostgrestResult) => void) => res(result);
        return (...args: unknown[]) => {
          calls.push(`${prop}(${args.map((a) => JSON.stringify(a)).join(",")})`);
          return builder;
        };
      },
    },
  );
  const client: SupabaseLike = { from: (t: string) => (calls.push(`from(${t})`), builder) };
  return { client, calls };
}

const row = {
  id: "92000000-0000-4000-8000-000000000001", student_id: "b0000000-0000-4000-8000-000000000001", title: "Write up enzyme practical",
  kind: "assignment", due_at: "2026-10-16T16:00:00+00:00", est_minutes: 120, status: "doing", linked_goal_id: null, linked_material_id: null,
  linked_opportunity_id: null, ai_use_level: "support", created_at: "2026-10-10T07:00:00.123456+00:00", updated_at: "2026-10-10T07:00:00+00:00",
};

describe("SupabaseDriver", () => {
  it("translates filters/order/limit into PostgREST calls and parses rows", async () => {
    const { client, calls } = fakeClient({ data: [row], error: null });
    const repos = createRepositories(new SupabaseDriver(client));
    const tasks = await repos.tasks.listForStudent(row.student_id, { status: ["todo", "doing"], dueFrom: "2026-10-10T00:00:00Z" });
    expect(tasks[0]!.title).toBe("Write up enzyme practical");
    expect(calls).toEqual([
      "from(tasks)", `select("*")`, `eq("student_id","${row.student_id}")`, `in("status",["todo","doing"])`,
      `gte("due_at","2026-10-10T00:00:00Z")`, `order("due_at",{"ascending":true})`,
    ]);
  });
  it("maps Postgres errors to DbError codes", async () => {
    const { client } = fakeClient({ data: null, error: { message: "new row violates row-level security policy", code: "42501" } });
    const repos = createRepositories(new SupabaseDriver(client));
    const err = await repos.tasks.create({ student_id: row.student_id, title: "x" }).catch((e) => e);
    expect(err).toBeInstanceOf(DbError);
    expect(err.code).toBe("permission_denied");
  });
  it("parses pgvector strings and numeric strings", async () => {
    const emb = Array.from({ length: 768 }, (_, i) => i / 768);
    const { client } = fakeClient({
      data: [{ id: row.id, material_id: row.id, chunk_index: 0, chunk_text: "t", embedding: JSON.stringify(emb), created_at: row.updated_at, updated_at: row.updated_at }],
      error: null,
    });
    const [c] = await createRepositories(new SupabaseDriver(client)).materialChunks.list();
    expect(c!.embedding).toHaveLength(768);
  });
  it("refuses unfiltered writes", async () => {
    const { client } = fakeClient({ data: [], error: null });
    await expect(new SupabaseDriver(client).delete("tasks", [])).rejects.toMatchObject({ code: "validation" });
  });
});
