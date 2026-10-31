# @murshid/core

Shared domain types, zod schemas, enums and small pure helpers for Murshid. Owner: **db team**. No I/O, no env vars, no AI.

## What's in it
- `enums.ts` — every enum as a `const` array (`CURRICULA`, `EMIRATES`, `OPPORTUNITY_TYPES`, …), a zod enum (`Curriculum`, `Emirate`, …) and a TS type of the same name. Values match the Postgres enums in `supabase/migrations` exactly (a test parses the SQL and checks).
- `schemas.ts` — for every entity (`Student`, `School`, `Guardian`, `SchoolStaff`, `Goal`, `Milestone`, `Course`, `Material`, `MaterialChunk`, `Task`, `CalendarEvent`, `OpportunitySource`, `Opportunity`, `Application`, `Achievement`, `CvVersion`, `Notification`, `Connection`, `ConsentRecord`, `AuditLog`) a `{ Row, Insert, Update }` triple of zod schemas, plus inferred types (`Student`, `StudentInsert`, `StudentUpdate`, …). `TABLES` maps DB table name → schemas; `RowOf<'tasks'>`, `InsertOf<'tasks'>`, `UpdateOf<'tasks'>` helpers. `GuardianStudentSummary` for the guardian view.
  - Timestamps are ISO strings with offset (PostgREST shape); dates are `YYYY-MM-DD`.
  - `Connection.token_ref` only accepts a vault reference (`vault:…` or uuid).
- `helpers.ts`
  - `ageFromDob(dob, on?)` — whole years, Postgres `age()` semantics (leap-day safe).
  - `meetsMinimumAge` (13+), `isMinor` (<18), `requiresGuardianConsent(studentOrDob, on?)`.
  - `hasGuardianConsent(guardians)`, `isBlockedByMissingConsent`, `canActivateConnector`, `canNotify(recipient, …)` — same rules as the DB triggers.
  - `latestConsentStatus(records, scope)` — latest record per scope wins (same as counsellor RLS).
  - `gradeEligible(grade, opp)`, `milestoneProgress(milestones)`.

```ts
import { Task, requiresGuardianConsent, type Student } from "@murshid/core";
const input = Task.Insert.parse(body);
```

## Run
```
pnpm test        # vitest, no network
pnpm typecheck
```

## Env vars
None (`.env.example` is intentionally empty).

## AI-LATER
Nothing. Pure types + rules.

## Integration notes
- Other teams: import types from here instead of redefining them. If you need a new enum value, ask db: it must change in the SQL migration and here together (the sync test will fail otherwise).
- `consent_records.scope` is free text; `CONSENT_SCOPES` lists the well-known values (privacy team owns semantics).
