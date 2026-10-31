# @murshid/privacy

Consent, age gate, guardian links, policy checks, audit, export/delete, AI-use logging and academic-integrity rules for Murshid. Built for the UAE Child Digital Safety law (Federal Decree-Law No. 26 of 2025), the PDPL (Federal Decree-Law No. 45 of 2021), and school AI guidance (ADEK and others). Legal mapping still needs review by counsel.

Pure TypeScript with **no runtime dependencies**. All storage sits behind interfaces with in-memory implementations; `packages/db` provides the Supabase-backed versions.

## Modules
| File | What it does |
|---|---|
| `src/age-gate.ts` | Neutral DOB screen copy (no threshold hints, empty year), `AgeGate.evaluate/submit` → `blocked_under_min_age` (<13) / `allowed_needs_guardian` (13–17) / `allowed_adult`. Age is calculated on the Asia/Dubai calendar. A device lock stops retrying with another DOB after a block. |
| `src/guardian.ts` | `GuardianFlow`: invite → 6-digit email OTP (salted hash, 15-min TTL, 5 tries then locked, single use, resend invalidates). `EmailSender` interface for notify, `MockEmailSender` for tests. `UaePassVerifier` + `UaePassPlaceholder` hook (always returns unverified). |
| `src/consent.ts` | Versioned purposes: `core_service`, `school_connector`, `guardian_summaries`, `notifications`, `opportunity_sharing_universities`. All default off, and each can be revoked on its own (revoking a parent purpose also revokes the ones that depend on it). Minors need a **verified guardian linked to the same student**. Records are append-only, and a version bump forces re-consent (`needsReconsent`). |
| `src/policy.ts` | `can(actor, action, resource, ctx)`: a pure, deny-by-default check for student / guardian / counsellor / service actors. Returns `{allowed, reason, purpose}`. |
| `src/audit.ts` | `AuditWriter`: a hash-chained audit log per student plus `verifyChain`. Rejects meta keys that could carry content (text, token, email, …). |
| `src/integrity.ts` | Rule and keyword integrity check (English + Arabic patterns) → `allow` / `allow_with_guidance` / `block`, plus a coach message. `none` allows logistics only. `support` blocks ghostwriting and guides drafting. `led` allows with a declaration. Evading plagiarism checks and getting answers to graded work are always blocked. |
| `src/ai-use-log.ts` | `AiUseLogger.check(task, prompt, modelId)` evaluates and logs each request (stores only the prompt SHA-256, never the text). `declaration(task)` gives a plain-English AI-use statement. |
| `src/data-rights.ts` | `DataRightsService.exportZip` (manifest, README, one JSON per table, secrets removed) and `deleteStudent` (pre-delete hooks such as OAuth revoke, child-first cascade, peppered tombstone; audit logs are kept for anonymisation by default). |
| `src/retention.ts` | `RETENTION_POLICY` per table + `isExpired`. Periods are proposals for legal review. |
| `src/zip.ts` | Tiny dependency-free ZIP writer/reader (node:zlib). |
| `docs/` | `PRIVACY_POLICY_DRAFT.md`, `DPIA_TEMPLATE.md`, `PARENT_CONSENT_TEXT.md`, all **drafts needing legal review**. |

## Run
```bash
pnpm install --filter @murshid/privacy
cd packages/privacy && pnpm test && pnpm typecheck
```
24 vitest tests, no network.

## Env vars
See `.env.example`: `PRIVACY_TOMBSTONE_PEPPER`, `GUARDIAN_OTP_TTL_MINUTES`, `GUARDIAN_OTP_MAX_ATTEMPTS`, `AGE_GATE_LOCK_DAYS`, `UAE_PASS_*` (placeholder). The classes take options directly; the API layer maps env to options.

## AI-LATER
- `IntegrityClassifier` → replace `KeywordIntegrityClassifier` with a model classifier (same interface), routed through `@murshid/agent-gateway` on an approved, PII-safe model. Keep the rules as a first pass that can't be overridden for `paraphrase_evade` and `solve_assessed`.
- Nothing in this package calls a model.

## Design choices to confirm
- **Guardian consent for all under-18s.** The law's verified-parental-consent rule (Art. 7) is written for under-13s. Murshid is 13+ only, and the contract adds guardian consent for every under-18, which is stricter than the law requires.
- **Counsellor visibility** rides on the `school_connector` purpose (student opted into the school link). A separate `counsellor_access` purpose may be cleaner; that's a product and legal call.
- **Guardians of minors** can request export and deletion. Students can always export, delete and withdraw consent, and these rights are never consent-gated.

## Integration notes
- Types `Student`, `Guardian`, `Task` and the table list are copied locally in `src/types.ts` until `@murshid/core` exports them. Swap to imports then.
- **packages/db:** implement `ConsentStore`, `GuardianStore`, `AuditStore`, `AiUseLogStore`, `StudentDataSource` (deletion in one transaction with the service role), and tables `consent_records`, `audit_logs`, `ai_use_logs`, `guardian_invites`, `tombstones` using the field names in the interfaces. RLS should mirror `can()`.
- **packages/notify:** implement `EmailSender.sendGuardianOtp` (never log the OTP). Use the email text in `docs/PARENT_CONSENT_TEXT.md`.
- **packages/connectors:** call `can({role:'service',service:'connector'}, …)` and `AuditWriter.write` on every read. Register a `DeletionHook` that revokes provider tokens.
- **apps/api:** call `AgeGate.submit` at signup, `GuardianFlow` for invites, and `ConsentService.snapshot` → `can()` on each request.
- **packages/agent-gateway:** run `AiUseLogger.check` before routing any task-linked request. If the result is `block`, return `coachMessage` and don't call a model.
