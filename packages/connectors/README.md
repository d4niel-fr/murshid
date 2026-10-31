# @murshid/connectors

Connectors that pull a student's school data (courses, coursework, calendars) into
Murshid's normalized domain shapes, plus sign-in providers (UAE PASS, LinkedIn) and an
Apple-Calendar ICS feed. Everything is plain TypeScript + `fetch`; no SDKs, no AI calls.

## Run

```bash
pnpm install --filter @murshid/connectors...
cd packages/connectors
pnpm test        # vitest, fixtures only, no network
pnpm typecheck   # tsc --noEmit (strict)
```

## Providers

| Provider | Auth | Scopes / permissions | Approval needed | Status |
|---|---|---|---|---|
| Google Classroom | OAuth2 + PKCE, offline | `classroom.courses.readonly`, `classroom.coursework.me.readonly`, `classroom.courseworkmaterials.readonly`, `classroom.announcements.readonly` | Google OAuth app verification (sensitive scopes); **Workspace for Education admin** must allow the app (required for under-18 accounts) | Implemented |
| Google Calendar | OAuth2 + PKCE, offline | `calendar.events` (read + create study blocks) | Google OAuth verification (sensitive scope) | Implemented |
| Microsoft Teams for Education + Outlook | OAuth2 (Entra v2, `organizations`) | `EduAssignments.ReadBasic`, `EduRoster.ReadBasic`, `Calendars.Read`, `User.Read`, `offline_access` | **Tenant admin consent** for `EduAssignments.ReadBasic` + `EduRoster.ReadBasic` (AdminConsentRequired = Yes); publisher verification. Use `microsoftAdminConsentUrl()` | Implemented |
| ManageBac | Per-school API token (`auth-token` header), API `v2p2` | Classes, Tasks, Memberships (read) | School admin issues token in *Settings › Develop › API Manager*; DPA (token is school-wide) | Implemented |
| ICS import | URL (https/webcal) or uploaded file | — | None | Implemented |
| ICS export feed | HMAC-signed subscribe URL | — | None | Implemented |
| Email-forward inbox | Raw MIME from inbound mail webhook | — | Inbound mail domain/MX (api team) | Implemented (rule-based) |
| UAE PASS | OAuth2 (staging `stg-id.uaepass.ae`) | `urn:uae:digitalid:profile:general` | **Requires UAE trade licence + SP onboarding for production**; adapter refuses production unless `UAEPASS_PRODUCTION_APPROVED=true` | Sandbox only |
| LinkedIn | OIDC + OAuth2 | `openid profile email w_member_social` | Self-serve LinkedIn products; member must be 16+; **every post needs an explicit draft-bound student approval** | Implemented |
| GEMS Phoenix | LTI 1.3 (planned) | — | **GEMS partnership** + LTI 1.3 tool registration | Stub (+ generic LTI 1.3 validator skeleton) |
| Edlink | OAuth2 (`ed.link/sso/login`) | Configured per app in Edlink dashboard | Edlink agreement + per-school integration approval | Skeleton |

Machine-readable copy: `src/registry.ts` (`PROVIDERS`).

### Endpoint sources
- Classroom REST v1 `https://classroom.googleapis.com/v1/courses?studentId=me`, `/courses/{id}/courseWork|courseWorkMaterials|announcements` (pageToken pagination).
- Calendar v3 `https://www.googleapis.com/calendar/v3/calendars/{id}/events` (singleEvents, pageToken).
- Graph v1.0 `GET /education/me/classes`, `GET /education/me/assignments` (permissions per learn.microsoft.com/graph/api/educationuser-list-assignments), `GET /me/calendarView` with `Prefer: outlook.timezone="UTC"`, `@odata.nextLink` paging.
- ManageBac `https://api.managebac.com/v2p2/students/{id}/memberships`, `/classes/{id}`, `/classes/{id}/tasks` (`page`/`per_page`, `meta.total_pages`) — guide.fariaedu.com integrations portal.
- UAE PASS staging `https://stg-id.uaepass.ae/idshub/{authorize,token,userinfo,logout}` — docs.uaepass.ae (token call: POST, query params, HTTP Basic).
- LinkedIn `https://www.linkedin.com/oauth/v2/{authorization,accessToken,revoke}`, `https://api.linkedin.com/v2/userinfo`, `POST https://api.linkedin.com/v2/ugcPosts` (`X-Restli-Protocol-Version: 2.0.0`).
- Edlink `https://ed.link/api/authentication/token` (`{$data}` wrapper), `https://ed.link/api/v2/my/classes`, `/my/classes/:id/assignments` (`$next` paging).

## Design

- **`Connector` interface** (`src/core/connector.ts`): `authUrl()`, `handleCallback()`, `refresh()`, `sync()`, `revoke()` + descriptor (`scopes`, `approval`, `status`). Sign-in providers implement `IdentityProvider` (`src/core/identity.ts`).
- **Token vault** (`src/core/vault.ts`): connectors only return `token_ref` (`vault:<provider>:<uuid>`); the DB stores that, never tokens. `InMemoryTokenVault` for tests, `EncryptedTokenVault` (AES-256-GCM over any KV, key `CONNECTORS_VAULT_KEY`) as a portable default; production can swap in Supabase Vault/KMS behind the same interface. Tokens auto-refresh 60s before expiry. URLs are redacted in errors.
- **Normalized output** (`SyncResult`): `courses`, `materials`, `events`, `tasks`, `warnings`. Rows carry `source` + `external_id`; relations use external ids (`course_external_id`, `linked_material_external_id`) because connectors don't know DB ids. Assignments/exams with a due date also emit a default `Task` (exams become `study` "Revise: …" tasks).
- **Consent + audit**: `guardedSync()` checks a `ConsentGate` (privacy team: 13+, guardian consent for under-18s) before running and writes an `AuditLog` entry per resource type read.
- **Least privilege**: Classroom read-only scopes, no rosters scope (teacher name left null); ManageBac reads only the linked student's memberships; UAE PASS mapping drops Emirates ID (`idn`) and mobile.
- **Time zones**: all output is UTC ISO. Date-only values (all-day events, ICS `VALUE=DATE`, emails with no time) are interpreted in Asia/Dubai (UTC+4); date-only deadlines default to 23:59 local.
- **ICS export**: Apple Calendar ignores `VTODO` in subscriptions, so deadlines are published as short `VEVENT`s with a 24h alarm. CRLF, 75-octet UTF-8-safe folding, escaping; round-trips through our parser. `signFeedToken/verifyFeedToken` make unguessable, rotatable webcal URLs.
- **ICS import**: SSRF guard (https/webcal only, private ranges blocked), 5 MB cap. RRULEs are **not expanded** (master imported once + warning).
- **LinkedIn posting**: `publishDraft()` requires a `PostApproval` from `approveDraft()` that is from the same student, ≤15 min old and hash-bound to the exact draft text/url/visibility. The agent cannot post by itself.
- **LTI 1.3 skeleton**: OIDC login-initiation redirect + `id_token` validation (RS256 via JWKS, iss/aud/azp/exp/iat, nonce replay, version 1.3.0, deployment_id, message_type, resource_link). No deep linking/AGS/NRPS yet.

## AI-LATER
- `EmailExtractor` interface (`src/providers/email/inbox.ts`): an LLM extractor for notification emails no rule understands. Today the rule set (`rules.ts`) + `genericRule` fallback (rejected below confidence 0.5) is used.
- `taskFromMaterial()` sets `est_minutes: null` — effort estimation to be added later.

## Known gaps / to validate
- **Email formats** (Classroom, Teams, Phoenix, ManageBac fixtures) are synthetic approximations; validate the rules against real forwarded samples. Phoenix's notification format is not public at all.
- ManageBac `tasks` list key and task fields (`name`, `due_date`, `task_type`) are taken from the `CoreTaskAttributes` schema; the v2p2 list response schema is not fully documented — confirm with a school token.
- Microsoft has no per-app token revocation for this flow: `revoke()` deletes local tokens and points users to myapps.microsoft.com.
- LinkedIn `w_member_social` uses the legacy `ugcPosts` endpoint as documented on the Share on LinkedIn page; migrating to the versioned `/rest/posts` API is a later change.
- UAE PASS: most 13–17 year olds won't have their own account; keep it optional.

## Env vars
See `.env.example`. Tests use the inline `TEST_ENV` in `test/helpers/mockFetch.ts`.

## Integration notes
- Domain types are copied locally in `src/core/types.ts` from `docs/CONTRACT.md` because `packages/core` wasn't available; swap to `@murshid/core` once published. Extra values used for `source`: `google_calendar`, `outlook`, `managebac`, `ics`, `email_forward`, `phoenix`, `edlink` (contract lists `'google_classroom'|'teams'|'manual'|...`). `Connection.status` adds `pending_admin_consent`.
- **db / api teams**: upsert on `(student_id, source, external_id)`; resolve `course_external_id` → `course_id` and `linked_material_external_id` → `linked_material_id` after upsert. Email materials carry a `courseName` hint (no course id) for fuzzy matching. Store `pending` from `authUrl()` (PKCE verifier/nonce) server-side keyed by `state`; verify state on callback.
- **ManageBac**: one vault entry per school; each student connection references it with `options.managebacStudentId`. Student `revoke()` keeps the school token; `revokeSchoolToken()` on school offboarding.
- **privacy team**: implement `ConsentGate` and `AuditSink` (`src/core/guard.ts`); the api should call connectors through `guardedSync()`.
- **notify / app**: ICS feed route = `GET /feed/:token.ics` → `verifyFeedToken(token, ICS_FEED_SECRET, student.feed_version)` → `buildIcsFeed(events, tasks, …)` with `content-type: text/calendar`.
- **app**: LinkedIn "Post" button must call `approveDraft(draft, studentId)` and send the approval with the publish request; any edit requires a fresh approval.
