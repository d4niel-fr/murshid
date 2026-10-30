# @murshid/api

REST backend for Murshid (personal agent app for UAE high-school students). Built with **Hono** (TypeScript) so the
same app runs on Node (`pnpm dev`) and Vercel Edge (`api/index.ts`). Runs with **zero external services**: an
in-memory repository is seeded with synthetic students on boot.

No AI/LLM calls. Everything that will later use AI is rule-based today and marked `// AI-LATER`.

## Run

```bash
pnpm install --filter @murshid/api...   # from repo root
cd apps/api
cp .env.example .env                     # optional; dev defaults work without it
pnpm dev                                 # http://localhost:8787
pnpm test                                # vitest, no network
pnpm typecheck
pnpm openapi                             # regenerates openapi.json from the route registry
```

Try it (dev auth):

```bash
curl -H 'x-dev-user-id: dev-aisha' localhost:8787/planner/week
curl -H 'x-dev-user-id: dev-aisha' 'localhost:8787/opportunities?sort=score'
curl -H 'x-dev-user-id: g1' -H 'x-dev-role: guardian' -H 'x-dev-email: parent.aisha@example.test' \
  localhost:8787/guardian/students/00000000-0000-4000-a000-000000000101/summary
```

Seed users: `dev-aisha` (Aisha Test, grade 11, 16 y/o, guardian consent granted), `dev-rohan` (Rohan Test,
grade 12, 18 y/o, guardian pending). Seed dates are relative to "now" so deadlines are always upcoming.

## v1 web endpoints (docs/V1-WEB-CONTRACT.md)

Synthetic demo students, selected with `x-dev-user: demo-g5 | demo-g7 | demo-g9 | demo-g11` (default `demo-g11`;
`x-dev-user-id: demo-…` also works). Data is generated deterministically per Dubai day (`src/v1/`); logged sessions
and link edits live in memory. In `jwt` mode a valid token is required and demo-g11 is served. CORS allows
`http://localhost:3000` (+ `CORS_ORIGINS`).

| Route | Returns |
|---|---|
| `GET /demo/students` | the four demo students |
| `GET /dashboard` | `{ student, band, today[], upcoming[], progress:{academics, extracurriculars, goals}, streaks, highlights[], opportunities[] }` |
| `GET /progress?area=&range=4w\|12w\|term\|year` | `ChartSpec`. area: athletics, gym, hackathon, robotics, music, academics, extracurriculars, goals, a subject id, a goal id; comma-separate to compare. `GET /progress/areas` lists them. |
| `POST /chat` | `{ text, toolCalls:[{name:'render_chart'\|'show_tasks'\|'show_opportunities', args}], intent, lang, generatedBy, threadId }`; SSE (`meta`, `text-delta`, `tool-call`, `done`) with `Accept: text/event-stream`. Rule-based via `@murshid/agent-gateway` `AgentChat` + `RuleChatProvider`. |
| `GET/PUT /profile/links` | linkedin, github, instagram, portfolio, resumeUrl, behance, youtube, website + `connectedAt`, `restrictions` (LinkedIn 16+, Instagram/YouTube 13+) |
| `GET /academics` | subjects (current/target/trend, grades over time, monthly), graded + upcoming assessments, term chart |
| `GET /extracurriculars?limit=` / `POST /extracurriculars/:id/sessions` | activities with sessions/hours/metrics; log `{ date?, minutes, metrics?, note? }` |

```bash
curl -H 'x-dev-user: demo-g9' 'localhost:8787/progress?area=science&range=term'
curl -H 'content-type: application/json' -d '{"message":"compare athletics and gym"}' localhost:8787/chat
```

## Auth

`src/lib/auth.ts`
- **JWT**: `Authorization: Bearer <supabase access token>` verified with HS256 + `SUPABASE_JWT_SECRET`, audience
  `SUPABASE_JWT_AUDIENCE` (default `authenticated`), expiry checked. Role from `app_metadata.murshid_role`
  (`student` default | `guardian` | `counsellor` | `admin`), counsellor school from `app_metadata.school_id`.
- **Dev mode** (`AUTH_MODE=dev`, or no secret and `NODE_ENV!=production`): headers `x-dev-user-id`, `x-dev-role`,
  `x-dev-email`, `x-dev-school-id`. Dev headers are ignored in `jwt` mode.
- Access rules: students see only their rows (others' rows → 404); guardians only get summary views of linked
  students with `consent_status=granted`; counsellors may read profiles of same-school students who are 18+ or
  guardian-consented. Age gate 13+ on profile create; under-18 without guardian consent cannot start connectors.
  Agent and guardian/counsellor reads write AuditLog rows.

## Endpoints (OpenAPI: `GET /openapi.json`, file `openapi.json`)

| Group | Routes |
|---|---|
| meta | `GET /health`, `GET /openapi.json` |
| me / students | `GET /me`, `POST /students`, `GET/PATCH/DELETE /students/:id`, `GET /students/me/consent` |
| goals | `GET/POST /goals`, `GET/PATCH/DELETE /goals/:id`, `GET/POST /goals/:id/milestones`, `PATCH/DELETE /milestones/:id` (milestones recompute goal progress) |
| courses / materials | `GET/POST /courses`, `GET/PATCH/DELETE /courses/:id`, `GET /courses/:id/materials`, `GET/POST /materials`, `GET/PATCH/DELETE /materials/:id`, `POST /materials/upload` (metadata for a file already in storage) |
| inbox | `POST /inbox/email` — forwarded LMS email webhook (`x-inbox-secret` + `to: inbox+<student_id>@INBOX_DOMAIN`, or a user token). Rule-based parse → Material (+ Task if assignment/exam with a due date). Dedupes on `message_id`. |
| tasks | `GET/POST /tasks` (filters `status` csv, `kind`, `due_before`, `due_after`, `linked_goal_id`), `GET/PATCH/DELETE /tasks/:id` |
| calendar | `GET/POST /calendar` (`from`, `to`, `source`), `GET/PATCH/DELETE /calendar/:id` |
| opportunities | `GET /opportunities` (`grade`, `type` csv, `deadline_before/after`, `status`, `include_closed`, `emirate`, `tag`, `q`, `eligible_only`, `min_score`, `sort=score|deadline`, `limit`), `GET /opportunities/:id`, `POST /opportunities` (admin) |
| applications | `GET /applications/templates`, `GET/POST /applications`, `GET/PATCH/DELETE /applications/:id`, `PATCH /applications/:id/checklist/:index` |
| achievements | `GET/POST /achievements` (`category`), `GET/PATCH/DELETE /achievements/:id` |
| cv | `GET/POST /cv`, `GET/DELETE /cv/:id` — JSON Resume built from profile + achievements, section order by target |
| connections | `GET /connections`, `POST /connections/:provider/start`, `GET /connections/:provider/callback`, `DELETE /connections/:id` (placeholders) |
| guardian | `GET /guardian/students`, `GET /guardian/students/:studentId/summary` |
| planner | `GET /planner/week` (`start`, `max_minutes_per_day`, `block_minutes`, `weekday_start/end`, `weekend_start/end`) |
| briefing | `GET /briefing/weekly` (`start`) |
| agent | `POST /agent/chat` — deterministic keyword stub (AI-LATER) |

### Rule-based logic
- **Planner** (`src/services/planner.ts`): Asia/Dubai week Mon–Sun; windows Mon–Thu 16:00–21:00, Fri 14:00–21:00,
  Sat/Sun 10:00–20:00; calendar events removed with a 15-min buffer; never schedules in the past. Tasks
  earliest-due-first, split into ≤60-min blocks; pass 1 spreads one block per task per day, pass 2 fills; blocks
  end before the due time; 10-min breaks; 180 min/day cap. Overdue tasks scheduled ASAP and flagged. Leftovers are
  returned in `unscheduled` with `not_enough_time_before_due` or `week_full`.
- **Opportunity match** (`src/services/matching.ts`): hard eligibility (closed, past deadline, grade range,
  nationality) → score 0; otherwise interests/strengths ↔ tags/title (≤45), grade fit (15), goal-category ↔ type
  (15), deadline (≤10), location (≤10), cost (≤5). Returns `reasons` for the UI.
- **Email parser** (`src/services/email-parser.ts`): kind from keywords; title from quoted subject or
  `Assignment: …`; course from the student's known courses or `posted … in X` / `Course: X`; due date after
  `due/deadline/submit by` (ISO, day-first `dd/mm/yyyy`, `14 Oct`, `Oct 14`, today/tomorrow, weekday names; default
  23:59 Dubai, exams 08:00). Detects Google Classroom/Teams/ManageBac/Toddle/Phoenix.
- **Checklists** (`src/services/checklists.ts`): default checklist per opportunity type; creating an application
  also creates an `application` task due at the opportunity deadline (closed when submitted).
- **Briefing** (`src/services/briefing.ts`): due/overdue tasks, plan stats, goals + next milestone, applications
  in progress, top-3 unapplied matches, templated suggestions.

## Layout
```
src/app.ts            buildApi/createApp/createSeededApp (Hono app factory)
src/node.ts           Node server (pnpm dev); loads .env if present
api/index.ts          Vercel Edge entry (+ vercel.json rewrite)
src/domain.ts         contract types + zod schemas (local copy, see Integration notes)
src/lib/              auth, context/config, router (zod validation + OpenAPI registry), Dubai time helpers
src/repo/             Repository interface, in-memory implementation, synthetic seed
src/services/         planner, matching, email parser, checklists, cv, briefing, agent stub
src/routes/           route groups
test/                 vitest per route group (60 tests)
```

## Env vars
See `.env.example`: `PORT`, `SUPABASE_JWT_SECRET`, `SUPABASE_JWT_AUDIENCE`, `AUTH_MODE`, `INBOX_WEBHOOK_SECRET`
(defaults to `change-me-dev-only` in dev mode only), `INBOX_DOMAIN`, `PUBLIC_API_URL`, `SEED_DATA`.

## AI-LATER
`/agent/chat` (stub keyword router behind `AgentService`), email parsing, uploaded-file text extraction, CV wording,
briefing headline/suggestions, semantic opportunity matching.

## Integration notes
- **packages/core**: did not exist when this was written, so `src/domain.ts` holds a local copy of the contract
  types (zod v4). Core has since appeared and uses **zod v3** and an `entity()` helper (e.g. `auth_user_id`
  nullable). Swap `src/domain.ts` imports to `@murshid/core` once the zod major versions are aligned.
- **packages/db**: implement `Repository` (`src/repo/types.ts`, async collection CRUD) over Supabase and pass it to
  `buildApi({ repo })`. RLS is enforced in the API as well; the DB layer should still enforce it.
- **packages/connectors**: `/connections/*` are placeholders (fake authorize URL, `token_ref = vault://…`, no token
  exchange). Wire the real OAuth start/callback and sync here.
- **packages/privacy**: owns ConsentRecord/AuditLog and real export/delete; the API uses a minimal local AuditLog
  and an in-memory cascade on `DELETE /students/:id`. Guardian-consent check reads `guardians.consent_status`.
- **packages/notify**: consume `GET /briefing/weekly` JSON (or call `buildWeeklyBriefing`) for weekly sends.
- **packages/documents**: render `cv_versions.json` (JSON Resume) to PDF and set `pdf_url`.
- **packages/opportunities**: the catalogue should populate `opportunities`; `POST /opportunities` is admin-only.
- On Vercel Edge the in-memory repo is per isolate and resets on cold start (demo only).

## Chat with a real (free) model

    GATEWAY_MODE=openrouter OPENROUTER_API_KEY=sk-or-... pnpm start

Uses free OpenRouter models (Nemotron 3 Super, then Gemma 4 31B, then Nemotron 3.5 Lightning) and falls back to the rule-based agent if every model fails. `generatedBy` in the /chat response says which answered. Override the chain with `OPENROUTER_MODELS` (comma-separated). Behind a corporate proxy on Node 22, add `NODE_USE_ENV_PROXY=1`.

## Shared store, admin API, orchestrated chat (Oct 2026)

- **One store** (`src/v1/store.ts`, `DemoStore`) backs the student routes, `/admin/*` and Murshid's agent tools. Generated,
  deterministic history (400 days back from today, Asia/Dubai: weekly training with metrics, football matches, swim
  galas, assessments incl. mid-terms and end-of-term exams, summer break, side-project revenue, applications with
  outcomes, achievements) plus overlays for everything staff, the student or Murshid change.
- **Flagship persona** `demo-ideal` (Ahamed Mehta, synthetic): Grade 11 / Year 12, British curriculum, Dubai, age 16;
  football 1st XI vice-captain + competitive swimmer; runs Tideline (custom swim caps and team kit).
- **Admin API** (`src/admin/routes.ts`): dev auth `x-dev-role: admin`. Students list/search/create/edit/delete, subjects,
  assessments, activities + sessions, tasks, goals, opportunities catalog (publish by grade range or student list),
  applications, side projects + milestones, achievements, CV fields, links, LinkedIn pack, audit log, overview.
- **Student extras**: `/student/projects|applications|achievements|goals|training|tasks`, `/student/cv/linkedin` (pack),
  `/student/cv/linkedin.pdf` (ATS-safe PDF via `@murshid/documents`).
- **/chat** runs the agent-gateway `Orchestrator` with store-backed tools (`src/v1/agent-tools.ts`). SSE streams `route`,
  `agent-start`, `agent-tool`, `agent-done` while sub-agents work. With no model configured, quick lookups use the rule
  agent and every sub-agent answers from tool summaries.
- **Simulations**: start the API with a model (`NODE_USE_ENV_PROXY=1 GATEWAY_MODE=openrouter pnpm start`), then `pnpm sim`
  (env `SIM_ONLY=A|B`, `SIM_API`, `SIM_PAUSE_MS`, `SIM_TAG`). Reports go to `docs/simulations/`.
