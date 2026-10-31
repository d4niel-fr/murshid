import { describe, expect, it } from "vitest";
import { createRepositories, createSeededStore, DbError, eq, FIXTURE_NOW, IDS, type Principal } from "../src/index.js";

const A = IDS.auth;
const S = IDS.students;
const user = (authUserId: string): Principal => ({ role: "authenticated", authUserId });
const setup = (p: Principal) => {
  const store = createSeededStore();
  return { store, repos: createRepositories(store.as(p)), service: createRepositories(store.as({ role: "service" })) };
};

describe("in-memory RLS: student", () => {
  it("sees only own rows across tables", async () => {
    const { repos } = setup(user(A.aisha));
    expect((await repos.students.list()).map((s) => s.id)).toEqual([S.aisha]);
    expect((await repos.tasks.list()).every((t) => t.student_id === S.aisha)).toBe(true);
    expect(await repos.tasks.listForStudent(S.rohan)).toEqual([]);
    expect((await repos.materials.list()).map((m) => m.id)).toEqual([IDS.materials.aishaEnzyme]);
    expect(await repos.materialChunks.list()).toHaveLength(1);
    expect(await repos.milestones.list()).toHaveLength(1);
    expect(await repos.opportunities.list()).toHaveLength(5);
    expect(await repos.opportunitySources.list()).toEqual([]);
    expect(await repos.guardianSummaries.listMine()).toEqual([]);
  });

  it("cannot insert for another student, and updates to hidden rows are no-ops", async () => {
    const { repos, service } = setup(user(A.aisha));
    await expect(repos.tasks.create({ student_id: S.rohan, title: "sneaky" })).rejects.toMatchObject({ code: "permission_denied" });
    const rohanTask = "92000000-0000-4000-8000-000000000005";
    expect(await repos.tasks.update(rohanTask, { title: "hacked" })).toBeNull();
    expect(await repos.tasks.delete(rohanTask)).toBe(false);
    expect((await service.tasks.get(rohanTask))!.title).toBe("Finish Python worksheet Q1-15");
  });

  it("cannot move own row to another student (WITH CHECK on update)", async () => {
    const { repos } = setup(user(A.aisha));
    await expect(repos.tasks.update("92000000-0000-4000-8000-000000000001", { student_id: S.rohan })).rejects.toMatchObject({
      code: "permission_denied",
    });
  });

  it("CRUD on own data with defaults filled", async () => {
    const { repos } = setup(user(A.aisha));
    const t = await repos.tasks.create({ student_id: S.aisha, title: "Revise osmosis", due_at: "2026-10-11T15:00:00.000Z" });
    expect(t).toMatchObject({ status: "todo", kind: "study", ai_use_level: "none", linked_goal_id: null });
    expect((await repos.tasks.complete(t.id))!.status).toBe("done");
    const g = await repos.goals.create({ student_id: S.aisha, title: "Learn Arabic calligraphy", category: "skill" });
    expect(g.progress).toBe(0);
    const m = await repos.milestones.create({ goal_id: g.id, title: "First lesson" });
    expect((await repos.milestones.setDone(m.id, true))!.done).toBe(true);
    expect(await repos.tasks.delete(t.id)).toBe(true);
  });

  it("can update only profile columns of own student row", async () => {
    const { repos } = setup(user(A.aisha));
    expect((await repos.students.update(S.aisha, { preferred_name: "Aish" }))!.preferred_name).toBe("Aish");
    await expect(repos.students.update(S.aisha, { school_id: null })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(repos.students.update(S.aisha, { grade: 13 })).rejects.toThrow(DbError);
  });

  it("read-only tables: notifications, connections, consent, audit", async () => {
    const { repos } = setup(user(A.aisha));
    expect(await repos.notifications.list()).toHaveLength(1);
    expect(await repos.connections.listForStudent(S.aisha)).toHaveLength(1);
    await expect(repos.connections.create({ student_id: S.aisha, provider: "microsoft" })).rejects.toMatchObject({ code: "permission_denied" });
    await expect(repos.auditLogs.record({ actor: "x", actor_type: "student", action: "read", resource: "tasks" })).rejects.toMatchObject({
      code: "permission_denied",
    });
    expect(await repos.auditLogs.listForStudent(S.aisha)).toHaveLength(1);
  });

  it("guardian invites must be pending", async () => {
    const { repos } = setup(user(A.mariam));
    const g = await repos.guardians.create({ student_id: S.mariam, name: "Huda Test", email: "huda.test@example.org" });
    expect(g.consent_status).toBe("pending");
    await expect(
      repos.guardians.create({ student_id: S.mariam, name: "Huda Test", email: "h@example.org", consent_status: "granted" }),
    ).rejects.toMatchObject({ code: "permission_denied" });
  });
});

describe("in-memory RLS: guardian", () => {
  it("gets only the linked student's summary", async () => {
    const { repos } = setup(user(A.fatima));
    const sums = await repos.guardianSummaries.listMine();
    expect(sums).toHaveLength(1);
    expect(sums[0]).toMatchObject({ student_id: S.aisha, display_name: "Aisha", active_goals: 2, avg_goal_progress: 28, tasks_due_next_7_days: 2, achievements_count: 1 });
    expect(sums[0]!.school_name).toBe("Al Noor British Academy (Test)");
    expect(await repos.tasks.list()).toEqual([]);
    expect(await repos.students.list()).toEqual([]);
    expect(await repos.guardians.list()).toHaveLength(1);
  });
});

describe("in-memory RLS: counsellor", () => {
  it("sees consented students of own school, read-only, profile tables only", async () => {
    const helen = setup(user(A.helen)).repos;
    expect((await helen.students.list()).map((s) => s.id)).toEqual([S.aisha]);
    expect(await helen.goals.list()).toHaveLength(2);
    expect(await helen.milestones.list()).toHaveLength(1);
    expect(await helen.tasks.list()).toEqual([]);
    expect(await helen.goals.update(IDS.goals.aishaMed, { progress: 99 })).toBeNull();

    const ravi = setup(user(A.ravi)).repos;
    // Arjun's latest counsellor_access record is 'revoked'
    expect((await ravi.students.list()).map((s) => s.id)).toEqual([S.rohan]);
    expect((await ravi.applications.list()).map((a) => a.student_id)).toEqual([S.rohan]);
  });

  it("loses access when consent is revoked", async () => {
    const { store, service } = setup({ role: "service" });
    await service.consentRecords.create({ student_id: S.rohan, granted_by: "guardian", scope: "counsellor_access", status: "revoked" });
    store.clock = () => new Date(FIXTURE_NOW.getTime() + 1000);
    const ravi = createRepositories(store.as(user(A.ravi)));
    expect(await ravi.students.list()).toEqual([]);
  });
});

describe("in-memory: anon + service", () => {
  it("anon is denied", async () => {
    const { repos } = setup({ role: "anon" });
    await expect(repos.opportunities.list()).rejects.toMatchObject({ code: "permission_denied" });
  });
  it("service sees all", async () => {
    const { service } = setup({ role: "service" });
    expect(await service.students.list()).toHaveLength(5);
    expect(await service.opportunitySources.list()).toEqual([]);
  });
});

describe("in-memory triggers mirror SQL", () => {
  it("13+ age gate", async () => {
    const { service } = setup({ role: "service" });
    await expect(service.students.create({ full_name: "Tiny Test", date_of_birth: "2014-01-01", grade: 7, curriculum: "british" })).rejects.toMatchObject({
      code: "check_violation",
    });
    const ok = await service.students.create({ full_name: "Teen Test", date_of_birth: "2013-10-10", grade: 8, curriculum: "british" });
    expect(ok.languages).toEqual([]);
  });
  it("guardian consent before connectors / non-student notifications", async () => {
    const { service } = setup({ role: "service" });
    const mariamConn = "98000000-0000-4000-8000-000000000003";
    await expect(service.connections.update(mariamConn, { status: "active", token_ref: "vault:conn/m" })).rejects.toMatchObject({
      code: "check_violation",
    });
    await expect(service.notifications.create({ student_id: S.mariam, recipient: "guardian", channel: "email", template: "weekly" })).rejects.toMatchObject({
      code: "check_violation",
    });
    expect((await service.notifications.create({ student_id: S.mariam, channel: "in_app", template: "hi" })).recipient).toBe("student");
    // Aisha (17) has guardian consent
    expect((await service.notifications.create({ student_id: S.aisha, recipient: "guardian", channel: "email", template: "weekly" })).status).toBe("scheduled");
  });
  it("cross-student links, uniques, append-only audit", async () => {
    const { service } = setup({ role: "service" });
    await expect(service.tasks.create({ student_id: S.rohan, title: "x", linked_goal_id: IDS.goals.aishaMed })).rejects.toMatchObject({
      code: "check_violation",
    });
    await expect(service.applications.create({ student_id: S.aisha, opportunity_id: IDS.opportunities.shadowing })).rejects.toMatchObject({
      code: "unique_violation",
    });
    const log = await service.auditLogs.record({ actor: "agent:planner", actor_type: "agent", action: "read", resource: "tasks", student_id: S.aisha });
    expect(log.at).toBe(FIXTURE_NOW.toISOString());
    expect("update" in service.auditLogs).toBe(false);
  });
  it("rejects raw tokens via schema", async () => {
    const { service } = setup({ role: "service" });
    await expect(service.connections.update("98000000-0000-4000-8000-000000000001", { token_ref: "ya29.raw" })).rejects.toMatchObject({ code: "validation" });
  });
});

describe("repository queries", () => {
  it("opportunity search by grade, emirate, open + deadline", async () => {
    const { repos } = setup(user(A.layla)); // grade 9
    const r = await repos.opportunities.search({ grade: 9, emirate: "dubai", openOnly: true, now: FIXTURE_NOW });
    expect(r.map((o) => o.id)).toEqual([IDS.opportunities.informatics, IDS.opportunities.youngScientists, IDS.opportunities.pitch]);
    expect((await repos.opportunities.search({ types: ["internship"], grade: 12 })).map((o) => o.id)).toEqual([IDS.opportunities.shadowing]);
    expect(await repos.opportunities.search({ tagsAny: ["writing"], openOnly: true, now: FIXTURE_NOW })).toEqual([]);
  });
  it("application status sets submitted_at once", async () => {
    const { repos } = setup(user(A.aisha));
    const a = await repos.applications.setStatus("94000000-0000-4000-8000-000000000001", "submitted", FIXTURE_NOW);
    expect(a!.submitted_at).toBe(FIXTURE_NOW.toISOString());
  });
  it("due notifications + consent lookups (service)", async () => {
    const { service } = setup({ role: "service" });
    const due = await service.notifications.listDue(FIXTURE_NOW);
    expect(due.map((n) => n.id)).toEqual(["97000000-0000-4000-8000-000000000001"]);
    expect((await service.notifications.markSent(due[0]!.id, FIXTURE_NOW))!.status).toBe("sent");
    expect(await service.consentRecords.latest(S.arjun, "counsellor_access")).toBe("revoked");
    expect(await service.tasks.list({ filters: [eq("status", "doing")] })).toHaveLength(1);
  });
});
