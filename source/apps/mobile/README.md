# @murshid/mobile — Murshid app (iOS · Android · web)

> Every athlete has a manager. Now every student does too.

Expo SDK 57 + Expo Router + TypeScript (strict). One codebase for iOS, Android and web. Runs **standalone on synthetic data** (mock adapter) until `apps/api` is live.

## Run

```bash
# from repo root (installs only this package's deps)
pnpm install --filter @murshid/mobile...
cd apps/mobile
cp .env.example .env        # optional; defaults = mock data + placeholder sign-in
pnpm start                  # Expo dev server (press w / i / a)
pnpm web                    # web only
pnpm typecheck              # tsc --noEmit
pnpm test                   # tsc + node:test unit tests (no network)
pnpm export:web             # static web build into dist/
```

Demo path: enter a DOB (e.g. `2009-03-14`) → **Explore with demo student** (Aisha Test, Grade 11) to land straight on Home. Or go Google/Microsoft → onboarding → guardian-consent flow (use "Simulate guardian approval (demo)" in mock mode).

## Env vars (`.env.example`)

| Var | Purpose |
|---|---|
| `EXPO_PUBLIC_API_URL` | Base URL of `apps/api`. Empty → mock adapter. |
| `EXPO_PUBLIC_USE_MOCK` | `true` forces the mock even if an API URL is set. |
| `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase values. Empty → local placeholder sign-in. |

No secrets live in the app. Connector tokens are never seen client-side (`Connection.token_ref` only).

## Structure

```
app/                       Expo Router routes
  index.tsx                redirects by session state (welcome → sign-in → onboarding → consent → tabs)
  (auth)/welcome.tsx       brand + language switch + age gate (13+, under-18 note)
  (auth)/sign-in.tsx       Google / Microsoft (placeholder Supabase OAuth) + demo student
  (auth)/onboarding.tsx    5 steps: identity, school/emirate, grade+curriculum, interests, goals in plain words
  (auth)/consent.tsx       guardian consent request / pending / granted; "continue for now" = limited mode
  (tabs)/index.tsx         Home "This week": tasks, deadlines, new opportunities, goal progress
  (tabs)/planner.tsx       week view (Mon-start), day picker, calendar events + tasks
  (tabs)/opportunities.tsx search, type filter, eligible/free toggles, save
  (tabs)/chat.tsx          placeholder "Murshid agent coming" (AI-LATER)
  (tabs)/more.tsx          menu, language (en/ar), appearance (system/light/dark), sign out
  goals.tsx                goal → sub-goal → milestone tree, toggle milestones, add goal
  classes.tsx              courses + materials, upload photo (expo-image-picker) / PDF (expo-document-picker)
  applications.tsx         tracker grouped by status, move between statuses
  opportunity/[id].tsx     detail, eligibility, save, application checklist
  cv.tsx                   achievements list + add, generate CV (target), JSON-Resume preview
  connections.tsx          Google Classroom, Teams, Google Calendar, UAE PASS, LinkedIn
  notifications.tsx        channels, morning briefing time, reminders, guardian weekly summary
  privacy.tsx              export data, delete account (30-day grace), AI & data access log
src/api/                   types.ts (contract copy), client.ts (MurshidApi interface), http.ts, mock.ts, mockData.ts
src/auth/                  placeholder Supabase OAuth via expo-web-browser
src/state/session.tsx      in-memory session, age/consent gating (`canShare`)
src/theme/                 tokens + light/dark palettes
src/i18n/                  en (complete), ar (stub, falls back to en), RTL handling
src/components/ui.tsx      design-system primitives (Screen, Card, Button, Chip, Row, ProgressBar, …)
src/lib/                   age gate, dates, useAsync, labels
test/                      node:test unit tests
```

## Rules implemented in the app
- **Age gate**: under 13 blocked on Welcome. 13–17 → guardian consent flow after onboarding.
- **Under-18 without consent**: connectors' Connect buttons disabled and the "weekly summary to guardian" toggle locked; banner on Home. The student can still plan.
- **RTL**: `Row`/`Text`/`Button` flip manually on web and before native reload; on native `I18nManager.forceRTL` applies after reload.

## AI-LATER
- `(tabs)/chat.tsx` — agent conversation (packages/agent-gateway).
- `mockData.defaultChecklist` — rule-based checklist per opportunity type.
- `MockApi.generateCv` — rule-based achievements → JSON Resume mapping.
- Onboarding `goals_text` — plain-words goals to be parsed into Goal rows server-side.
- Material OCR/text extraction for uploads (server-side).

## Integration notes
- **Types**: `src/api/types.ts` is a local copy of the CONTRACT domain types. Swap for `@murshid/core` when it exports them. App-only extras: `Student.goals_text`, `NotificationPrefs`, `WeekSummary`, `OpportunityFilter`, `ConnectionProvider` includes `google_calendar`.
- **API paths the app expects** (all under `${EXPO_PUBLIC_API_URL}/v1`, Bearer = Supabase access token):
  `GET/PUT /me`, `GET /schools?q=`, `GET /me/guardian`, `POST /me/guardian/consent-request`, `GET /me/week`,
  `GET/POST /goals`, `GET /milestones?goal_id=`, `PATCH /milestones/:id`, `GET /tasks?from&to`, `PATCH /tasks/:id`,
  `GET /calendar-events?from&to`, `GET /courses`, `GET /materials?course_id=`, `POST /materials/upload` (multipart: course_id, title, file),
  `GET /opportunities?type&q&free&eligible`, `GET /opportunities/:id`, `GET/POST /applications`, `PATCH /applications/:id`,
  `GET/POST /achievements`, `POST /cv/generate {target}`, `GET /connections`, `POST /connections/:provider/start` → `{connection, authUrl}`,
  `DELETE /connections/:provider`, `GET/PATCH /notification-prefs`, `GET /privacy/ai-use-log`, `POST /privacy/export`, `POST /privacy/delete`.
  If apps/api chooses different paths, only `src/api/http.ts` changes.
- **Auth**: placeholder uses Supabase hosted `/auth/v1/authorize?provider=google|azure` and reads `access_token` from the redirect fragment. Replace with `@supabase/supabase-js` + PKCE when the db team publishes the project.
- **Privacy**: age logic in `src/lib/age.ts` mirrors 13+/18 rules; swap for `@murshid/privacy` when available.

## Not done yet
- Session persistence (in-memory only; planned: expo-secure-store).
- Real CV PDF (preview only; PDF comes from packages/documents `pdf_url`).
- Arabic strings are a stub; screen-level labels (curricula, categories, CV headings) are English-only.
- Push notification registration (expo-notifications) not wired.
- No app icon/splash assets yet.
