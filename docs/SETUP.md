# Going live: the keys Murshid needs

Without keys, Murshid runs as the demo: made-up students, nothing charged, nothing sent. Each service below switches
on by itself when its settings are present. Set them in Vercel (Project → Settings → Environment Variables) for the
right app, redeploy, then check **Portal → Integrations** (Murshid admins): every service shows *Live* or *Demo* and
which settings are still missing (names only, never values).

Never put a key in the code or in a chat. Keys marked *server* must only be set for the API.

## 1. Supabase (database, files, sign-in)

1. Create a Supabase project in the region closest to your users.
2. Run the SQL in `supabase/migrations/` in order (SQL editor, or `supabase db push`). It creates the tables with
   row-level security, the `murshid_state` table the API saves into, and the private `murshid-files` bucket.
3. Authentication → Providers: turn on **Email** (keep "Confirm email" on), **Google**, and **Azure** (Microsoft;
   tenant `organizations` so any school account works). Add the redirect URLs
   `https://YOUR-DOMAIN/auth/callback` and `https://YOUR-DOMAIN/admin/login`.
4. Authentication → Rate limits and Attack Protection: turn on CAPTCHA for sign-up if you see abuse.

| Setting | App | What it is |
|---|---|---|
| `SUPABASE_URL` | API (server) | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | API (server only) | Saves state and files. Never in the web apps. |
| `AUTH_MODE=jwt` | API | Accept only real sign-ins (no demo headers) |
| `SUPABASE_JWT_SECRET` | API (server) | Only for older projects with a shared JWT secret; newer projects need nothing (the API reads the project's public keys) |
| `PLATFORM_ADMIN_EMAILS` | API | Comma-separated emails of Murshid's own admins |
| `NEXT_PUBLIC_SUPABASE_URL` | web + admin | Same project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web + admin | The public anon key (safe in the browser) |

After this: students and parents sign up in the app; Murshid admins add schools in **Portal → Schools**; school
admins sign in with the email you gave and set up teachers, students and classes in **Portal → School setup**.

## 2. AI (Ask Murshid, study tools)

| Setting | App | What it is |
|---|---|---|
| `GATEWAY_MODE=openrouter` | API | Use models (otherwise Murshid answers with its built-in rules) |
| `OPENROUTER_API_KEY` | API (server) | Model access. Other providers: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` |
| `OPENROUTER_MODELS` | API | Optional: which models, in order |

## 3. Payments (Stripe)

1. Stripe dashboard → Products: optional prices for AED 29/month and AED 249/year (otherwise the API sends them).
2. Developers → Webhooks: endpoint `https://YOUR-DOMAIN/api/billing/stripe-webhook`, events
   `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`,
   `invoice.paid`, `invoice.payment_failed`.
3. Settings → Billing → Customer portal: turn it on (people change card, see invoices, cancel there).

| Setting | App | What it is |
|---|---|---|
| `STRIPE_SECRET_KEY` | API (server) | `sk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | API (server) | `whsec_…` from step 2 |
| `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY` | API | Optional price ids |
| `PUBLIC_WEB_URL` | API | `https://YOUR-DOMAIN` (where Stripe sends people back) |

## 4. Email and notifications

| Setting | App | What it is |
|---|---|---|
| `RESEND_API_KEY` | API (server) | Email (verify your sending domain in Resend first) |
| `RESEND_FROM` | API | e.g. `Murshid <hello@yourdomain.ae>` |
| `WEB_PUSH_PUBLIC_KEY`, `WEB_PUSH_PRIVATE_KEY` | API (private: server only) | Make both with `npx web-push generate-vapid-keys` |
| `NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY` | web | The same public key |
| `CRON_SECRET` | API | Any long random string; Vercel sends it to the daily reminder job (`vercel.json` → `crons`) |

Push on iPhone and iPad works once the student adds Murshid to the Home Screen (Share → Add to Home Screen).

## 5. Microsoft 365 for schools (Teams classes)

1. Microsoft Entra admin center → App registrations → New registration (multi-tenant: "Accounts in any
   organizational directory").
2. Redirect URI (Web): `https://YOUR-DOMAIN/api/auth/microsoft/consent-callback`.
3. API permissions → Microsoft Graph → **Application**: `EduRoster.Read.All`, `EduAssignments.ReadBasic.All`,
   `User.Read.All`. Certificates & secrets → new client secret.
4. A school admin then opens **Portal → School & licence → Connect Microsoft 365**: their IT admin approves
   Murshid once, and classes sync with **Sync now**.

| Setting | App | What it is |
|---|---|---|
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET` | API (server) | From the app registration |
| `MS_STATE_SECRET` | API (server) | Optional: signs the approval link (defaults to the client secret) |

## 6. Hosting checks

- `CORS_ORIGINS`: only needed if the apps are on different domains from the API.
- Leave `ADMIN_PASSCODE` empty in production (it guards the public demo only).
- Vercel → Firewall: turn on Bot Protection and an `/api/*` rate-limit rule (see `docs/SECURITY.md`).
- Run `node scripts/check-links.mjs https://YOUR-DOMAIN` after the first deploy.

## What stays on the device

Students' planner, notes, decks, notebooks and whiteboards are kept on the device for speed and offline use, and
copied to their account (Supabase) when they are signed in, so every device they sign in on shows the same things.
