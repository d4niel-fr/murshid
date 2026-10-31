# supabase/ — Murshid Postgres schema

Owner: **db team**. Postgres 15+ (Supabase), pgvector.

## Files
| File | What |
|---|---|
| `migrations/20261010000001_extensions_enums.sql` | `vector` extension (schema `extensions`), `private` schema, all enum types |
| `migrations/20261010000002_tables.sql` | every contract entity + `school_staff`, `opportunity_sources`, `material_chunks`, `consent_records`, `audit_logs`; FKs, checks, indexes (incl. HNSW cosine index on embeddings, GIN on opportunity tags) |
| `migrations/20261010000003_functions_triggers.sql` | `updated_at` triggers, RLS helper functions (`private.*`), integrity triggers, `public.match_material_chunks()` |
| `migrations/20261010000004_rls.sql` | grants, RLS policies, `public.guardian_student_summaries` view |
| `seed.sql` | synthetic data (see below) |

## How to run
- Supabase CLI: `supabase db reset` (applies migrations, then `seed.sql`).
- Without Docker / Postgres: `cd packages/db && pnpm validate:sql` runs every migration + the seed inside PGlite (WASM Postgres + pgvector) and checks RLS by switching roles. Verified passing on 2026-10-10.

## Access model (RLS)
Roles are Supabase's: `anon` (no access to anything), `authenticated`, `service_role` (backend jobs; bypasses RLS, explicit `service_all` policies also exist). Who an authenticated user *is* comes from `auth.uid()` lookups:

| Caller | How identified | Can see / do |
|---|---|---|
| Student | `students.auth_user_id = auth.uid()` | Full CRUD on own goals, milestones, courses, materials, tasks, calendar_events, applications, achievements, cv_versions. Read-only: own notifications, connections, consent_records, audit_logs, material_chunks, guardians. May update only `preferred_name, emirate, nationality, languages, interests, strengths` on own `students` row (column grant). May invite a guardian (`consent_status='pending'` only). Reads all `schools` and `opportunities`. |
| Guardian | `guardians.auth_user_id = auth.uid()` | Own `guardians` row + `guardian_student_summaries` (aggregates only: counts of goals/tasks/applications/achievements, avg progress). No base-table access to the student's data. |
| Counsellor | `school_staff.auth_user_id = auth.uid()` and `role='counsellor'` | Read-only students, goals, milestones, applications, achievements, cv_versions of students at their school whose **latest** `consent_records` row with `scope='counsellor_access'` is `granted`. No tasks, materials, calendar, notifications. |
| Service | `service_role` key | Everything. Students are created here (onboarding), connectors/notifications/audit written here. |

## Rules enforced in the database (triggers)
- `students`: date of birth must give age >= 13 (on insert / DOB change).
- `connections`: cannot become `status='active'` for an under-18 without a guardian whose `consent_status='granted'`.
- `notifications`: `recipient <> 'student'` (guardian / counsellor) requires the same guardian consent for under-18s.
- `connections.token_ref`: must be `vault:...` or a Vault secret uuid — never a raw token (CHECK constraint).
- `tasks.linked_goal_id / linked_material_id` and `goals.parent_goal_id` must belong to the same student.
- `audit_logs` is append-only (UPDATE/DELETE raise).
- `updated_at` maintained on every table.

## Seed (synthetic only)
Fixed, valid-v4 uuids by prefix (schools `a0…`, students `b0…`, guardians `c0…`, staff `d0…`, goals `e0…`, opportunities `91…`, auth users `0a…`/`0b…`/`0c…`).
- 2 schools: *Al Noor British Academy (Test)* (British, Google Classroom) and *Desert Rose Indian School (Test)* (CBSE, Teams), both Dubai.
- 5 students aged 13-17 on 2026-10-10: Aisha Test (17, Y12), Rohan Test (16, Cl 11), Mariam Test (13, Y8 — guardian consent **pending**), Arjun Test (15, Cl 10 — counsellor access **revoked**), Layla Test (14, Y9).
- 5 guardians, 2 counsellors, consent records, 10 goals (one sub-goal tree), 10 milestones, 8 courses, 8 materials, 3 material chunks with deterministic (non-model) 768-d vectors, 12 tasks, 6 calendar events, 2 opportunity sources, **25 fictional opportunities** (all `https://example.org/...`, mixed types/emirates, one closed, one unknown), 8 applications, 8 achievements, 2 CV versions, 3 connections (vault refs), 5 notifications, 3 audit logs.
- `auth_user_id`s are not backed by `auth.users` rows (no FK on purpose, so seed/tests run without GoTrue). To log in locally, create users in Supabase Auth with those ids or update the column.

## Integration notes
- **Not in the contract, added by db:** `school_staff` (for the counsellor role), `opportunity_sources` (target of `opportunities.source_id`), `notifications.recipient` (needed to enforce the consent rule), `material_chunks.chunk_index`, `guardians.auth_user_id`, `opportunities.emirate` + `country` (contract's "emirate/country"), and `created_at/updated_at` everywhere.
- `data_source` enum covers `course.source`, `material.source`, `calendar_event.source`: google_classroom, google_calendar, teams, outlook, phoenix, managebac, toddle, manual, other. Ask db to extend it.
- **privacy team:** `consent_records` / `audit_logs` shapes are a starting point; `scope` is free text. RLS for counsellors keys off `scope='counsellor_access'`; guardian consent for connectors/notifications keys off `guardians.consent_status`. Tell db if you want different keys.
- **opportunities team:** dedupe key is not enforced (no unique on url); add `external_id` if you need upserts.
- **agent-gateway:** embeddings are `vector(768)`; use `match_material_chunks(query_embedding, match_count, filter_course_id)` with the user's JWT so RLS scopes results. `// AI-LATER`: nothing here calls a model; seed vectors are synthetic.
- Every connector/agent read of student data must insert an `audit_logs` row (service role) — use `AuditLogsRepo.record()` in `@murshid/db`.
