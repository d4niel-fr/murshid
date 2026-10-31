import { InMemoryStore } from "./memory/memory-driver.js";

/**
 * Synthetic fixture for tests, a subset of supabase/seed.sql with the SAME ids,
 * so tests written against the in-memory store line up with the real seed.
 */
export const IDS = {
  schools: { alNoor: "a0000000-0000-4000-8000-000000000001", desertRose: "a0000000-0000-4000-8000-000000000002" },
  students: {
    aisha: "b0000000-0000-4000-8000-000000000001",
    rohan: "b0000000-0000-4000-8000-000000000002",
    mariam: "b0000000-0000-4000-8000-000000000003",
    arjun: "b0000000-0000-4000-8000-000000000004",
    layla: "b0000000-0000-4000-8000-000000000005",
  },
  auth: {
    aisha: "0a000000-0000-4000-8000-000000000001",
    rohan: "0a000000-0000-4000-8000-000000000002",
    mariam: "0a000000-0000-4000-8000-000000000003",
    arjun: "0a000000-0000-4000-8000-000000000004",
    layla: "0a000000-0000-4000-8000-000000000005",
    fatima: "0b000000-0000-4000-8000-000000000001", // Aisha's guardian
    suresh: "0b000000-0000-4000-8000-000000000002", // Rohan's guardian
    priya: "0b000000-0000-4000-8000-000000000004", // Arjun's guardian
    helen: "0c000000-0000-4000-8000-000000000001", // counsellor, Al Noor (British)
    ravi: "0c000000-0000-4000-8000-000000000002", // counsellor, Desert Rose (CBSE)
  },
  goals: { aishaMed: "e0000000-0000-4000-8000-000000000001", aishaUcat: "e0000000-0000-4000-8000-000000000002", rohanOlympiad: "e0000000-0000-4000-8000-000000000004", arjunBiz: "e0000000-0000-4000-8000-000000000007" },
  courses: { aishaBio: "f0000000-0000-4000-8000-000000000001", rohanCs: "f0000000-0000-4000-8000-000000000003" },
  materials: { aishaEnzyme: "f1000000-0000-4000-8000-000000000002", rohanWorksheet: "f1000000-0000-4000-8000-000000000004" },
  opportunities: {
    youngScientists: "91000000-0000-4000-8000-000000000001",
    informatics: "91000000-0000-4000-8000-000000000003",
    shadowing: "91000000-0000-4000-8000-00000000000b",
    pitch: "91000000-0000-4000-8000-000000000016",
    writersClosed: "91000000-0000-4000-8000-000000000019",
  },
} as const;

/** Fixed clock matching the seed's reference date. */
export const FIXTURE_NOW = new Date("2026-10-10T08:00:00Z");

export function createSeededStore(clock: () => Date = () => FIXTURE_NOW): InMemoryStore {
  const s = new InMemoryStore(clock);
  const { schools: SC, students: ST, auth: A } = IDS;
  s.load("schools", [
    { id: SC.alNoor, name: "Al Noor British Academy (Test)", emirate: "dubai", curriculum: "british", lms: "google_classroom", domain: "alnoor-british.test" },
    { id: SC.desertRose, name: "Desert Rose Indian School (Test)", emirate: "dubai", curriculum: "indian_cbse", lms: "teams", domain: "desertrose-cbse.test" },
  ]);
  const student = (id: string, auth: string, full_name: string, dob: string, grade: number, school: string, curriculum: string, nationality: string) => ({
    id, auth_user_id: auth, full_name, preferred_name: full_name.split(" ")[0], date_of_birth: dob, grade, school_id: school, curriculum,
    emirate: "dubai", nationality, languages: ["en"], interests: [], strengths: [],
  });
  s.load("students", [
    student(ST.aisha, A.aisha, "Aisha Test", "2009-03-14", 12, SC.alNoor, "british", "AE"),
    student(ST.rohan, A.rohan, "Rohan Test", "2010-06-02", 11, SC.desertRose, "indian_cbse", "IN"),
    student(ST.mariam, A.mariam, "Mariam Test", "2013-01-20", 8, SC.alNoor, "british", "EG"),
    student(ST.arjun, A.arjun, "Arjun Test", "2011-09-05", 10, SC.desertRose, "indian_cbse", "IN"),
    student(ST.layla, A.layla, "Layla Test", "2012-04-11", 9, SC.alNoor, "british", "PK"),
  ]);
  const guardian = (n: number, sid: string, auth: string | null, name: string, status: string) => ({
    id: `c0000000-0000-4000-8000-00000000000${n}`, student_id: sid, auth_user_id: auth, name, email: `${name.split(" ")[0]!.toLowerCase()}.test@example.org`,
    phone: null, relation: "guardian", consent_status: status, verified_at: status === "granted" ? "2026-09-01T04:00:00.000Z" : null,
  });
  s.load("guardians", [
    guardian(1, ST.aisha, A.fatima, "Fatima Test", "granted"),
    guardian(2, ST.rohan, A.suresh, "Suresh Test", "granted"),
    guardian(3, ST.mariam, null, "Omar Test", "pending"),
    guardian(4, ST.arjun, A.priya, "Priya Test", "granted"),
    guardian(5, ST.layla, null, "Sana Test", "granted"),
  ]);
  s.load("school_staff", [
    { id: "d0000000-0000-4000-8000-000000000001", auth_user_id: A.helen, school_id: SC.alNoor, full_name: "Ms Helen Test", email: null, role: "counsellor" },
    { id: "d0000000-0000-4000-8000-000000000002", auth_user_id: A.ravi, school_id: SC.desertRose, full_name: "Mr Ravi Test", email: null, role: "counsellor" },
  ]);
  const consent = (n: string, sid: string, scope: string, status: string, at: string) => ({
    id: `99000000-0000-4000-8000-0000000000${n}`, student_id: sid, guardian_id: null, granted_by: "guardian", scope, status,
    policy_version: "v1", method: "email_link", evidence: {}, granted_at: status === "granted" ? at : null, revoked_at: status === "revoked" ? at : null, created_at: at,
  });
  s.load("consent_records", [
    consent("03", ST.aisha, "counsellor_access", "granted", "2026-09-01T04:02:00.000Z"),
    consent("06", ST.rohan, "counsellor_access", "granted", "2026-09-03T15:32:00.000Z"),
    consent("09", ST.arjun, "counsellor_access", "granted", "2026-09-10T16:16:00.000Z"),
    consent("0a", ST.arjun, "counsellor_access", "revoked", "2026-10-01T17:00:00.000Z"),
  ]);
  const G = IDS.goals;
  s.load("goals", [
    { id: G.aishaMed, student_id: ST.aisha, title: "Get into a UK medical school", category: "university", target_date: "2027-09-01", status: "active", parent_goal_id: null, progress: 35 },
    { id: G.aishaUcat, student_id: ST.aisha, title: "Score 2700+ on the UCAT", category: "academic", target_date: "2027-07-31", status: "active", parent_goal_id: G.aishaMed, progress: 20 },
    { id: G.rohanOlympiad, student_id: ST.rohan, title: "Qualify for the national informatics olympiad", category: "academic", target_date: "2027-01-31", status: "active", parent_goal_id: null, progress: 40 },
    { id: G.arjunBiz, student_id: ST.arjun, title: "Launch a small online business", category: "career", target_date: "2027-04-30", status: "active", parent_goal_id: null, progress: 25 },
  ]);
  s.load("milestones", [
    { id: "e1000000-0000-4000-8000-000000000001", goal_id: G.aishaMed, title: "Shortlist 4 medical schools", due_date: "2026-11-15", done: true },
    { id: "e1000000-0000-4000-8000-000000000005", goal_id: G.rohanOlympiad, title: "Solve 50 past olympiad problems", due_date: "2026-12-01", done: false },
  ]);
  const C = IDS.courses;
  s.load("courses", [
    { id: C.aishaBio, student_id: ST.aisha, name: "A-Level Biology (Y12)", teacher: "Mr Daniel Test", source: "google_classroom", external_id: "gc-bio-12a" },
    { id: C.rohanCs, student_id: ST.rohan, name: "Class 11 Computer Science", teacher: "Mrs Anjali Test", source: "teams", external_id: "teams-cs-11b" },
  ]);
  const M = IDS.materials;
  s.load("materials", [
    { id: M.aishaEnzyme, course_id: C.aishaBio, title: "Enzyme kinetics practical write-up", kind: "assignment", body_text: "Write up the catalase practical.", file_url: null, due_at: "2026-10-16T19:59:00.000Z", source: "google_classroom", external_id: "gc-mat-1002", ingested_at: "2026-10-10T03:00:00.000Z" },
    { id: M.rohanWorksheet, course_id: C.rohanCs, title: "Python lists and dictionaries worksheet", kind: "assignment", body_text: "Questions 1-15.", file_url: null, due_at: "2026-10-14T16:00:00.000Z", source: "teams", external_id: "teams-asg-301", ingested_at: "2026-10-10T03:05:00.000Z" },
  ]);
  s.load("material_chunks", [
    { id: "f2000000-0000-4000-8000-000000000001", material_id: M.aishaEnzyme, chunk_index: 0, chunk_text: "Catalase breaks down hydrogen peroxide.", embedding: null },
  ]);
  const O = IDS.opportunities;
  const opp = (id: string, title: string, type: string, emirate: string | null, min: number, max: number, cost: number, deadline: string | null, status: string, tags: string[]) => ({
    id, title, organizer: "Fictional Org", type, url: `https://example.org/opportunities/${id.slice(-4)}`, emirate, country: "AE", min_grade: min, max_grade: max,
    eligibility_text: null, nationality_restriction: null, cost_aed: cost, deadline, tags, source_id: null, last_seen_at: "2026-10-10T02:00:00.000Z", status,
  });
  s.load("opportunities", [
    opp(O.youngScientists, "Emirates Young Scientists Challenge 2027", "competition", "dubai", 9, 12, 0, "2026-12-15T19:59:00.000Z", "open", ["science", "stem"]),
    opp(O.informatics, "UAE National Informatics Olympiad - Selection Round", "olympiad", null, 8, 12, 0, "2026-11-10T19:59:00.000Z", "open", ["coding", "stem"]),
    opp(O.shadowing, "Hospital Shadowing Week for Future Doctors", "internship", "dubai", 11, 13, 500, "2026-11-15T19:59:00.000Z", "open", ["medicine"]),
    opp(O.pitch, "UAE Junior Entrepreneurship Pitch Competition", "competition", "dubai", 9, 12, 0, "2027-01-20T19:59:00.000Z", "open", ["entrepreneurship"]),
    opp(O.writersClosed, "Young Writers Short Story Prize", "competition", "ajman", 6, 12, 0, "2026-09-30T19:59:00.000Z", "closed", ["writing"]),
  ]);
  s.load("tasks", [
    { id: "92000000-0000-4000-8000-000000000001", student_id: ST.aisha, title: "Write up enzyme practical", kind: "assignment", due_at: "2026-10-16T16:00:00.000Z", est_minutes: 120, status: "doing", linked_goal_id: null, linked_material_id: M.aishaEnzyme, linked_opportunity_id: null, ai_use_level: "support" },
    { id: "92000000-0000-4000-8000-000000000003", student_id: ST.aisha, title: "UCAT verbal reasoning practice set", kind: "study", due_at: "2026-10-12T14:00:00.000Z", est_minutes: 45, status: "todo", linked_goal_id: G.aishaUcat, linked_material_id: null, linked_opportunity_id: null, ai_use_level: "none" },
    { id: "92000000-0000-4000-8000-000000000005", student_id: ST.rohan, title: "Finish Python worksheet Q1-15", kind: "assignment", due_at: "2026-10-14T15:00:00.000Z", est_minutes: 75, status: "todo", linked_goal_id: null, linked_material_id: M.rohanWorksheet, linked_opportunity_id: null, ai_use_level: "none" },
  ]);
  s.load("applications", [
    { id: "94000000-0000-4000-8000-000000000001", student_id: ST.aisha, opportunity_id: O.shadowing, status: "preparing", checklist: [{ item: "Reference letter", done: true }], notes: null, submitted_at: null },
    { id: "94000000-0000-4000-8000-000000000003", student_id: ST.rohan, opportunity_id: O.informatics, status: "submitted", checklist: [], notes: null, submitted_at: "2026-10-02T12:00:00.000Z" },
    { id: "94000000-0000-4000-8000-000000000005", student_id: ST.arjun, opportunity_id: O.pitch, status: "preparing", checklist: [], notes: null, submitted_at: null },
  ]);
  s.load("achievements", [
    { id: "95000000-0000-4000-8000-000000000001", student_id: ST.aisha, title: "Best Delegate, School MUN 2026", category: "award", date: "2026-04-18", description: null, evidence_url: null },
    { id: "95000000-0000-4000-8000-000000000006", student_id: ST.arjun, title: "School chess champion", category: "sport", date: "2026-03-12", description: null, evidence_url: null },
  ]);
  s.load("notifications", [
    { id: "97000000-0000-4000-8000-000000000001", student_id: ST.aisha, recipient: "student", channel: "push", template: "task_due_soon", payload: {}, scheduled_at: "2026-10-10T06:00:00.000Z", sent_at: null, status: "scheduled" },
    { id: "97000000-0000-4000-8000-000000000004", student_id: ST.rohan, recipient: "student", channel: "whatsapp", template: "opportunity_deadline", payload: {}, scheduled_at: "2026-11-24T13:00:00.000Z", sent_at: null, status: "scheduled" },
  ]);
  s.load("connections", [
    { id: "98000000-0000-4000-8000-000000000001", student_id: ST.aisha, provider: "google", scopes: ["classroom.courses.readonly"], status: "active", token_ref: "vault:conn/aisha-google", last_sync_at: null },
    { id: "98000000-0000-4000-8000-000000000003", student_id: ST.mariam, provider: "google", scopes: [], status: "pending", token_ref: null, last_sync_at: null },
  ]);
  s.load("audit_logs", [
    { id: "9a000000-0000-4000-8000-000000000001", actor: "connector:google_classroom", actor_type: "connector", action: "sync", resource: "materials", resource_id: null, student_id: ST.aisha, metadata: {}, at: "2026-10-10T03:00:00.000Z" },
  ]);
  return s;
}
