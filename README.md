# Murshid

**The AI study planner for UAE students and schools.** Murshid keeps a high-school student's week under control (tests, homework, training, applications), gives them study tools that remember what they know, and tells teachers who needs support and the best day to set homework.

Built by Vardan (Sam) Kapur, Grade 11, Dubai.

> Demo build. Every student and teacher is fictional (synthetic data). Microsoft 365 sign-in is simulated. The school in the demo (Demo Secondary School) is fictional.

## What is in here

| | Path | What it is |
|---|---|---|
| Website and student app | `apps/web` | Next.js 16. Landing page at `/`, pricing, features, FAQ, privacy, checkout; the student app under `/app` |
| Teacher and school portal | `apps/admin` | Next.js 16. Class progress, who needs what, best day for homework, weekly reports, assignments and forms |
| API | `apps/api` | Hono (TypeScript) REST API. Runs on Node and as a Vercel function |
| Shared packages | `packages/*` | Agent gateway, privacy, connectors, opportunities, documents (CV/PDF), core types, design tokens, grade bands, survey |
| Database | `supabase/` | Postgres migrations with row-level security, seed data |
| Docs | `docs/` | Schools and licensing, design system, grade bands |
| Scripts | `scripts/` | `check-links.mjs` crawls the built site for broken links and missing titles or headings |

## Features

**For students** (`/app`)

- **Ask Murshid**: plan the week in plain words. Every reply shows how it was worked out (goal, plan, tools, actions, result).
- **Study tools** (`/app/study`): flashcard decks with spaced repetition (Again, Hard, Good, Easy) and a quiz mode; Markdown notes with checklists, tables and an outline, which turn `term :: meaning` lines into flashcards; a focus timer with a weekly chart; a topic tracker for exam revision.
- **Saved and recently viewed** pages, smart search (`/` or Ctrl+K), keyboard shortcuts (`?`), adjustable text size, dark mode, English and Arabic (right to left).
- **Nour**, an optional companion mascot you can recolour, rename and dress up in Settings, with a calm companion mode in chat.
- **School page**: work from teachers, including Murshid forms to answer in the app and Google Forms or Microsoft Forms links.

**For teachers** (`apps/admin`)

- Post an assignment as a written task, a **Murshid form** (short answer, long answer, multiple choice), or a **Google Forms / Microsoft Forms link**. Only links from the real form hosts are accepted. Drafts save on the device.
- See answers per student, copy them as CSV or download them. Sort and filter every assignment.
- Class progress, at-risk flags with the reason, the best day to set homework, automatic weekly reports.

**Plans**

- **Single**: one student, AED 29 a month or AED 249 a year. Bought online at `/checkout`.
- **School**: AED 150 per student per year, arranged with the school (not sold online). The API refuses a school purchase and points to the school contact.

## Reliability, security and SEO

- **API**: request ids on every response, rate limits per client (chat, writes, reads and sign-in or checkout each have their own budget; 429 with `Retry-After`), `Idempotency-Key` support so a retried payment or post never happens twice, a 15-second timeout (504), and one error shape: `{ error, code, details?, requestId }`.
- **Billing**: one active plan per email, enforced in the API and by a unique index in the database.
- **Web client**: timeouts, retries with backoff only for requests that are safe to repeat, loading, empty and error states, autosaved forms, a cookie notice for the few essential cookies.
- **Database**: indexes for the hottest queries (open tasks by due date, scheduled notifications, open opportunities), row-level security on every table.
- **SEO**: one `<h1>` per page, canonical URLs, `sitemap.xml`, `robots.txt`, Open Graph images, JSON-LD (Organization, WebSite, SoftwareApplication with prices, FAQPage, BreadcrumbList), `noindex` on the app, checkout and 404 pages, a real 404 status, a print stylesheet.

## Run locally

Requires Node 22 and pnpm (the version is pinned in `package.json`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Then in three terminals:

```bash
cd apps/api && pnpm dev       # http://localhost:8787
cd apps/web && pnpm dev       # http://localhost:3000
cd apps/admin && pnpm dev     # http://localhost:3001/admin
```

Open http://localhost:3000. As on Vercel, the portal is at `/admin` and the API at `/api`: the website's dev server proxies both paths to the other two dev servers. To run all three through Vercel's own router instead, use `vercel dev` at the repo root.

No external services are needed: the API seeds synthetic students on boot and runs on rules only by default (`GATEWAY_MODE=openrouter` with `OPENROUTER_API_KEY` turns on models). Survey storage falls back to memory without Supabase.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/check-links.mjs http://localhost:3000   # with the web app running
```

CI (`.github/workflows/ci.yml`) runs all four on every push and pull request.

## Deploy

One Vercel project serves everything on one domain. The root `vercel.json` defines three services:

| Service | Root | Public path |
|---|---|---|
| `web` | `apps/web` (Next.js) | `/` (everything not matched below) |
| `admin` | `apps/admin` (Next.js, `basePath: '/admin'`) | `/admin` |
| `api` | `apps/api` (Hono, bundled by `scripts/build-service.mjs`) | `/api` (the prefix is stripped, so API routes start at `/`) |

The browser calls the API at `/api` on the same domain, so no CORS setup is needed. The website and portal don't call each other on the server, so no service bindings are needed.

- **Database**: apply `supabase/migrations` in order (`supabase db push`).
- **API environment**: `AUTH_MODE`, `GATEWAY_MODE`, `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SURVEY_ADMIN_CODE`, `ADMIN_PASSCODE`. `PUBLIC_API_URL` defaults to `https://<production domain>/api`.
- **Optional overrides** for the web apps: `NEXT_PUBLIC_SITE_URL` (canonical URL; defaults to the project's production domain), `NEXT_PUBLIC_MURSHID_API` (defaults to `/api`), `NEXT_PUBLIC_MURSHID_ADMIN_URL` (defaults to `/admin`).

Secrets (API keys, the Supabase service-role key, the database password) live only in the hosting and Supabase dashboards. Never commit them; `.env*` files are ignored.

## Privacy and safety

- Consent per purpose, versioned and revocable; under-18s need a verified guardian, under-13s are stopped by a neutral age gate.
- Each student belongs to one school or one family; teachers see only the classes they teach.
- Nothing leaves Murshid without the student's approval, and every change is audit-logged.
- Models see only what the current step needs, never other students. No ads, no tracking cookies.
