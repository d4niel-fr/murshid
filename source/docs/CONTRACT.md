# Murshid build contract (read before writing code)

Monorepo: pnpm workspaces, TypeScript strict, Node 22. Tests with vitest. No real secrets; every external service reads env vars listed in that package's `.env.example`. **No AI/LLM calls in this phase**: anything that will later use AI goes behind an interface with a deterministic rule-based or mock implementation, marked `// AI-LATER`.

## Ownership (only write inside your folder; never edit another team's folder)
| Folder | Team |
|---|---|
| supabase/ + packages/db | db |
| packages/core | db (shared domain types + zod schemas) |
| apps/api | api |
| apps/mobile | app (Expo, iOS/Android/web) |
| packages/connectors | connectors |
| packages/opportunities | opportunities |
| packages/documents | documents (CV/portfolio PDFs) |
| packages/notify | notify (push, email, WhatsApp, scheduler, briefings) |
| packages/privacy | privacy (consent, age gate, parent links, audit, export/delete) |
| packages/agent-gateway | gateway (model routing config + interfaces, no calls) |

If you need something from another team's package, code against the types in this contract (copy them locally if the package isn't there yet) and note it in your folder's README under "Integration notes".

## Core domain (canonical names; DB tables are snake_case plurals)
- **Student**: id (uuid), auth_user_id, full_name, preferred_name, date_of_birth, grade (int 6-13), school_id, curriculum ('british'|'indian_cbse'|'indian_icse'|'american'|'ib'|'uae_moe'|'other'), emirate, nationality, languages[], interests[], strengths[], created_at.
- **School**: id, name, emirate, curriculum, lms ('google_classroom'|'teams'|'phoenix'|'managebac'|'toddle'|'other'), domain.
- **Guardian**: id, student_id, name, email, phone, relation, consent_status ('pending'|'granted'|'revoked'), verified_at.
- **Goal**: id, student_id, title, category ('academic'|'university'|'career'|'sport'|'skill'|'personal'), target_date, status ('active'|'done'|'paused'), parent_goal_id (nullable), progress (0-100).
- **Milestone**: id, goal_id, title, due_date, done.
- **Course**: id, student_id, name, teacher, source ('google_classroom'|'teams'|'manual'|...), external_id.
- **Material**: id, course_id, title, kind ('note'|'assignment'|'announcement'|'exam'), body_text, file_url, due_at, source, external_id, ingested_at.
- **Task**: id, student_id, title, kind ('study'|'assignment'|'application'|'activity'|'habit'), due_at, est_minutes, status ('todo'|'doing'|'done'|'skipped'), linked_goal_id, linked_material_id, linked_opportunity_id, ai_use_level ('none'|'support'|'led').
- **CalendarEvent**: id, student_id, title, start_at, end_at, source, external_id.
- **Opportunity**: id, title, organizer, type ('competition'|'internship'|'scholarship'|'summer_program'|'volunteering'|'olympiad'|'mun'|'hackathon'|'course'), url, emirate/country, min_grade, max_grade, eligibility_text, nationality_restriction, cost_aed, deadline, tags[], source_id, last_seen_at, status ('open'|'closed'|'unknown').
- **Application**: id, student_id, opportunity_id, status ('saved'|'preparing'|'submitted'|'accepted'|'rejected'), checklist (json [{item, done}]), notes, submitted_at.
- **Achievement**: id, student_id, title, category ('academic'|'award'|'sport'|'project'|'volunteering'|'work'|'certificate'|'leadership'), date, description, evidence_url.
- **CvVersion**: id, student_id, template, target ('general'|'university'|'internship'), json (JSON Resume schema), pdf_url, created_at.
- **Notification**: id, student_id, channel ('push'|'email'|'whatsapp'|'in_app'), template, payload json, scheduled_at, sent_at, status.
- **Connection**: id, student_id, provider, scopes[], status, token_ref (vault reference, never raw tokens), last_sync_at.
- **ConsentRecord / AuditLog**: privacy team defines; every read of student data by a connector or the agent writes an AuditLog row (actor, action, resource, at).

## Rules
- Row Level Security: a student sees only their rows; a guardian sees only their linked student's summary views; school counsellor role sees students of their school who consented.
- Ages: 13+ only; under 18 requires guardian consent before connectors or notifications to anyone but the student.
- Synthetic data only (seed students like "Aisha Test", "Rohan Test").
- Each package: README.md (what it does, how to run, env vars, what's AI-LATER), `.env.example`, tests that pass with `pnpm test` inside the package without network.
- Do not run `pnpm install` at repo root concurrently with other teams' installs if avoidable; install inside your package with `pnpm install --filter <your-package>...` and keep deps lean.
