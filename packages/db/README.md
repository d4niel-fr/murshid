# @murshid/db

Typed data-access layer for Murshid. Owner: **db team**. Repositories per entity over a tiny `DbDriver` interface, with two drivers:

- `SupabaseDriver` — production; wraps a supabase-js client (structurally typed, no supabase-js dependency). Real Postgres RLS applies.
- `InMemoryDriver` — tests/dev; emulates the SQL RLS policies and triggers so scoping bugs show up without a database.

```ts
import { createRepositories, SupabaseDriver, type SupabaseLike } from "@murshid/db";
// user-scoped client (user's JWT) => RLS enforced by Postgres
const repos = createRepositories(new SupabaseDriver(supabase as unknown as SupabaseLike));
const tasks = await repos.tasks.listForStudent(studentId, { status: ["todo", "doing"] });

// tests
import { createSeededStore, IDS } from "@murshid/db";
const store = createSeededStore();                       // same ids as supabase/seed.sql
const asAisha = createRepositories(store.as({ role: "authenticated", authUserId: IDS.auth.aisha }));
const asService = createRepositories(store.as({ role: "service" }));
```

## API
- `DbDriver`: `select(table, {filters, orderBy, limit})`, `insert`, `update(table, filters, patch)`, `delete(table, filters)`. Filter helpers `eq, neq, gt, gte, lt, lte, inList, isNull, contains`. Errors are `DbError` with `code` (`permission_denied`, `check_violation`, `unique_violation`, `foreign_key_violation`, `not_found`, `validation`, `unknown`); Postgres SQLSTATEs are mapped.
- `Repository<T>`: `list, get, getOrThrow, create, createMany, update, delete` — input validated with `@murshid/core` Insert/Update schemas, output parsed with Row schemas (Dates, pgvector strings, numeric strings normalised). `update` returns `null` when the row is missing *or* hidden by RLS (Postgres semantics).
- Entity repos (`createRepositories`): `students.getByAuthUserId/listBySchool`, `goals.listForStudent/listChildren`, `milestones.listForGoal/setDone`, `courses`, `materials.listForCourse/listDueBetween`, `materialChunks.listForMaterial`, `tasks.listForStudent/complete`, `calendarEvents.listBetween`, `opportunities.search({grade, types, emirate, openOnly, maxCostAed, tagsAny})`, `applications.listForStudent/setStatus` (auto `submitted_at`), `achievements`, `cvVersions.latestForStudent`, `notifications.listDue/markSent`, `connections`, `consentRecords.latest(studentId, scope)`, `auditLogs.record/listForStudent` (append-only, no update/delete), `guardianSummaries.listMine()`, plus plain `schools`, `schoolStaff`, `opportunitySources`.
- `InMemoryStore` (`load()` raw rows, `as(principal)` → driver, settable `clock`); `PolicyContext` (the RLS mirror); `createSeededStore()`, `IDS`, `FIXTURE_NOW` fixtures.

## Run
```
pnpm test           # all tests, no network (includes PGlite SQL validation, ~5 s)
pnpm validate:sql   # only: apply supabase/migrations + seed.sql in PGlite and test RLS per role
pnpm typecheck
```
Tests: `test/memory-rls.test.ts` (in-memory RLS/trigger/repository behaviour), `test/supabase-driver.test.ts` (PostgREST call translation + error mapping with a fake client), `test/sql.pglite.test.ts` (real SQL: seed counts, RLS for student/guardian/counsellor/anon/service, triggers, pgvector search).

## Env vars
See `.env.example` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`). Read by the app/api that builds the client, not by this package. Never ship the service key to the mobile app.

## AI-LATER
None here. `material_chunks.embedding` is written by a future embedding job (agent-gateway); the seed uses synthetic vectors.

## Integration notes
- In-memory RLS mirrors `supabase/migrations/20261010000004_rls.sql`; when policies change, change both (the PGlite test and the in-memory test cover the same scenarios).
- In-memory driver does not enforce foreign keys or cascades; Postgres does.
- `opportunities.search` filters grade/emirate/deadline in code after a coarse DB query (fine for hundreds of rows; move to an RPC if the catalogue grows large).
- devDeps `@electric-sql/pglite@0.5.8` + `@electric-sql/pglite-pgvector` are only for the SQL validation test.
