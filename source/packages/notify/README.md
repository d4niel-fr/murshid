# @murshid/notify

Push, email, WhatsApp and in-app notifications for Murshid, plus the reminder scheduler, quiet hours, the weekly briefing and the guardian-consent gate. Mock mode by default; no AI.

## Pieces

| Module | What it does |
|---|---|
| `channels/adapters.ts` | `ExpoPushAdapter` (expo-server-sdk, chunking, reports `DeviceNotRegistered` tokens), `ResendEmailAdapter` (REST `POST /emails`, `Idempotency-Key`), `WhatsAppCloudAdapter` (Graph API template messages; **UTILITY templates only**, opt-in required, param count + sanitising), `InAppAdapter` (writes to an `InAppStore` port), `MockAdapter` (records an `outbox`). |
| `channels/factory.ts` | `createChannelAdapters(env)` → mock or live per `NOTIFY_MODE` / `NOTIFY_<CHANNEL>_MODE`; throws a clear error if a live channel lacks its env vars. |
| `consent.ts` | `ConsentHook` + `defaultConsentHook`: under-13 → nothing; under 18 (or unknown DOB) → guardian must be `consent_status='granted'` **and** `verified_at` set before any message to that guardian; WhatsApp needs the recipient's recorded opt-in. Students can always be messaged themselves. |
| `quiet-hours.ts` | Asia/Dubai, configurable: no push/WhatsApp during school hours (07:30–14:30, school days), none after 21:30 on school nights (22:30 other nights) until 06:30, holidays list. `placeOutsideQuietHours()` moves a send later, or earlier if later would pass the deadline. |
| `notifier.ts` | `Notifier.deliver()`: per channel → dedupe (`wasSent`) → consent → quiet-hours safety net (defers) → adapter → writes a `Notification` row via `NotificationStore`. |
| `scheduler/rules.ts` | Reminder planning: tasks 48h/24h/2h before `due_at`; applications 7d/3d/1d before the opportunity deadline (status `saved`/`preparing`). Only the most recent due offset per item is sent; reminders >3h late or past the deadline are dropped. Weekly slot helpers (`TZ=Asia/Dubai 0 18 * * 0`). |
| `scheduler/runner.ts` | `runReminderTick(deps)` and `runWeeklyBriefing(deps)` over a `SchedulerDataSource` port. Idempotent. |
| `scheduler/triggers.ts` | `inngestFunctionDefs` / `registerInngestFunctions(inngest, deps)` (no inngest dependency here) **or** `createCronHandler(deps, { secret })` for Vercel/Supabase/GitHub cron, called every 15 min. |
| `briefing.ts` | Rule-based weekly briefing: tests (exam materials + calendar events matching test/exam/quiz…, de-duplicated), deadlines (assignment/application tasks + application deadlines), new opportunities, overdue, goal progress with week-on-week delta, tips. Renders push (≤50/178 chars), email HTML+text, WhatsApp params (6, no newlines). Guardian version is **summary-only** (counts + goal %, no task titles). |
| `templates.ts` | Task / application reminder copy for all four channels; WhatsApp template registry. Wording ("today", "tomorrow", "in 2 hours") is computed from the actual send time after quiet-hours placement. |

## Run
```bash
pnpm install --filter @murshid/notify...
cd packages/notify
pnpm test        # 37 vitest tests, all mocked, no network
pnpm typecheck
```

## Wiring (apps/api)
```ts
const adapters = createChannelAdapters(process.env, { inAppStore });   // inAppStore: db-backed
const notifier = new Notifier({ adapters, store: notificationStore, consent: privacy.consentHook,
  quietHours: quietHoursFromEnv(), onInvalidTokens: deleteTokens });
const deps = { data: schedulerDataSource, notifier, quietHours: quietHoursFromEnv() };
// either
registerInngestFunctions(inngest, deps);
// or
app.post('/cron/notify', (req) => createCronHandler(deps, { secret: process.env.CRON_SECRET! })(req));
```

## Env vars
See `.env.example`: `NOTIFY_MODE`, `NOTIFY_<CHANNEL>_MODE`, `EXPO_ACCESS_TOKEN`, `RESEND_API_KEY`, `RESEND_FROM`, `RESEND_REPLY_TO`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_API_VERSION`, `CRON_SECRET`, `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` (if Inngest used), `NOTIFY_TIMEZONE`, `QUIET_*`.

## WhatsApp templates to submit to Meta (category: UTILITY, language: en)
| Name | Body (params) |
|---|---|
| `murshid_task_reminder` | `Hi {{1}}, reminder: {{2}} is due {{3}} (Dubai time).` |
| `murshid_application_deadline` | `Hi {{1}}, {{2}} closes {{3}} (Dubai time). Progress: {{4}}.` |
| `murshid_weekly_briefing` | `Hi {{1}}, the week ahead: {{2}} tests, {{3}} deadlines, {{4}} new opportunities. Goals: {{5}}. Next: {{6}}.` |
Until approved, run with `NOTIFY_WHATSAPP_MODE=mock`.

## AI-LATER
- `composeWeeklyBriefing()` headline/tips are rules → personalised tone, study-plan suggestions, Arabic copy.
- Reminder copy in `templates.ts` is fixed English → localised/varied wording.

## Integration notes
- **Types**: `@murshid/core` wasn't there yet, so `src/types.ts` copies `Student`, `Guardian`, `Task`, `Opportunity`, `Application`, `Goal`, `CalendarEvent`, `Material`, `Notification` from `docs/CONTRACT.md`.
- **Notification table**: I need two extra columns on `notifications` (db team): `dedupe_key text` (unique where `status='sent'`) and `error text`; `recipient_kind` ('student'|'guardian') is also written. Status values used: `scheduled | sent | deferred | blocked | failed`.
- **Privacy team**: pass your consent check as `consent` (same `ConsentHook` signature); the default here implements the contract rules but doesn't write AuditLog rows or read `ConsentRecord`.
- **Data port**: `SchedulerDataSource.reminderBundles/briefingBundles` must be implemented over Supabase (service role) by api/db: recipient addresses, Expo tokens, WhatsApp opt-in (`{ optedIn, at }`), channel preferences, guardians, "new opportunities since last briefing", and last week's goal progress snapshot.
- **Expo receipts**: tickets are returned; checking push receipts ~15 min later (`getPushNotificationReceiptsAsync`) to prune tokens is not implemented yet.
- **Retries**: failed rows are recorded with `retryable`; the next tick retries automatically while the reminder is still within its 3h lateness window (dedupe only blocks `sent`).
