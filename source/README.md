# Murshid

**An AI agent that keeps a UAE high-school student's week under control, and tells teachers who needs support and the best day to set homework.**

Built by Vardan (Sam) Kapur, Grade 11, Dubai, for the Dubai Chamber **Create AI Agents Championship (Youth)**.

> Demo build. Every student and teacher is fictional (synthetic data). Microsoft 365 sign-in is simulated.
> The Grade 11 pilot at Our Own High School Al Warqa'a is **proposed**, subject to the school's approval. It is not a confirmed partnership.

## Try it (live)

| | Link |
|---|---|
| **Start here: one-click demo logins** | https://murshid-web.vercel.app/judges |
| How Murshid works (agent loop, tools, guardrails) | https://murshid-web.vercel.app/how-it-works |
| Anonymous validation survey | https://murshid-web.vercel.app/survey |
| Student app | https://murshid-web.vercel.app |
| Teacher and school portal | https://murshid-admin.vercel.app |
| API (health) | https://murshid-api.vercel.app/health |

**Demo logins** (all on `/judges`):

- **Student: Ahamed Mehta.** Grade 11, football and swimming, mid-terms coming up. Opens the student app with "How Murshid worked this out" switched on.
- **Teacher: Ms. Sana Thomas.** Grade 11 English: class progress, who needs what, best day for homework, weekly reports, post an assignment.
- **School admin.** School and licence, audit log, survey results. Needs the **admin passcode** given in the submission notes, so random visitors can't read admin data.

**What to try**

1. As Ahamed, open Chat and ask *"Plan my week around my mid-term and both sports"*. Open **How Murshid worked this out** under the reply to see the goal, the plan, the tools it used, the actions it took and the result.
2. As Ms. Thomas, open **Best day for homework**: every set-day and due-day option with the class's on-time likelihood, and how many students would be at risk.
3. Post an assignment. Murshid replans every student's week (a work session on their lightest day, a reminder) and flags anyone at risk, with the reason.

## How the agent works

For every request Murshid:

1. **Checks safety first.** Crisis language never reaches a model; the student gets a fixed, supportive reply with UAE helplines.
2. **Understands the goal and plans.** Keyword rules pick which parts need handling (studies, training, opportunities, CV, week plan, side project, wellbeing). If no rule matches, a small routing model picks up to three.
3. **Reads the student's real data** through read tools: timetable, assignments, grades, training load, goals, opportunities.
4. **Reasons and uses tools.** The model gets that data and a short tool list, and can make up to two rounds of tool calls. In a multi-part request, one part leads and owns the changes, so nothing is created twice.
5. **Acts.** Write tools change only the student's own planner and records: add tasks, write a week plan, save an opportunity with a prep task, build a CV and PDF. Every change is audit-logged.
6. **Falls back safely.** If models fail or the daily model budget runs out, the same steps run on a rule engine, and a clear "write" request is still carried out.
7. **Explains itself.** Each reply carries a trace (goal, plan, tools, actions, result) shown as "How Murshid worked this out".

When a **teacher posts work**, an automated replan runs for every student in the class with fixed, explainable rules (no model): it adds up each student's load per day across all subjects, schedules a session on the lightest day before the deadline, sets a reminder, and flags the student as **"At risk: extra support"** when no day has room or 2+ tests fall in the 2 days before it is due. The best-day model uses the same rule.

Models: free OpenRouter models in the demo (NVIDIA Nemotron, Google Gemma), guarded by a per-day budget and a replay cache for the demo questions. Production plan: a cheap mix without DeepSeek at about **US$0.49 per active student per month** (estimate, see `docs/submission/cost_estimate.py`).

## Architecture

```
apps/
  web      Next.js 16 student app + /judges, /how-it-works, /survey, /pricing   (Vercel: murshid-web)
  admin    Next.js 16 teacher + school portal                                    (Vercel: murshid-admin)
  api      Hono (TypeScript) REST API, runs on Node and as a Vercel function     (Vercel: murshid-api)
  mobile   Expo app (prototype)
packages/
  agent-gateway   orchestrator, routing, model guard, OpenRouter provider, rule engine, prompts
  connectors      Microsoft Graph, Google, LTI 1.3 (school systems; Microsoft is simulated in the demo)
  privacy         age gate, guardian consent per purpose, retention, data rights, audit
  opportunities   crawler + matching for competitions and programmes
  documents       CV / portfolio PDFs
  core, db, notify, grade-bands, survey, design
supabase/         survey table (insert-only RLS) and results RPC
docs/             SCHOOLS.md, submission pack (evidence, deck, validation plan), demo recorder and videos (current: docs/demo/murshid-demo-v3.mp4)
```

Data in the demo lives in memory per API instance (seeded synthetic students; posted work and edits reset on a cold start). Survey responses are stored in Supabase.

## Privacy and safety

- **Consent per purpose**, versioned and revocable; under-18s need a verified guardian. Under-13s are blocked by a neutral age gate.
- **School data separation**: each student belongs to one tenant (a school or a family). Teachers see only the classes they teach.
- **Human approval** before anything leaves Murshid; posting to social profiles is blocked in code until the student approves that exact draft.
- **Audit log** of every change made for a student, by a teacher, an admin or Murshid.
- **Data minimisation**: models see only what the current step needs, never other students; no ads.
- **Public demo**: admin data needs the admin passcode; the survey collects no names or personal data.

## Run locally

Requires Node 22+ and pnpm.

```bash
pnpm install
cd apps/api && cp .env.example .env && pnpm dev      # http://localhost:8787 (rules only by default; GATEWAY_MODE=openrouter + OPENROUTER_API_KEY for models)
cd apps/web && pnpm dev                             # http://localhost:3000  (/judges for the demo logins)
cd apps/admin && pnpm dev                           # http://localhost:3001
```

No external services are needed: the API seeds synthetic students on boot. Survey storage falls back to memory without Supabase.

## Tests

```bash
pnpm typecheck
pnpm test                  # all packages and apps (vitest)
pnpm build                 # web + admin production builds
```

See `docs/submission/evidence.md` for test counts, end-to-end agent simulations, the homework-timing results on synthetic data and the cost estimate.

## Deploy (Vercel)

```bash
cd apps/api && node scripts/build-vercel.mjs && vercel deploy --prebuilt --prod   # API: esbuild bundle -> Build Output v3
# web / admin: Vercel projects with Root Directory apps/web and apps/admin (Next.js)
```

API environment: `AUTH_MODE=dev`, `GATEWAY_MODE=openrouter`, `OPENROUTER_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SURVEY_ADMIN_CODE`, `ADMIN_PASSCODE`, `CORS_ORIGINS`. Web/admin: `NEXT_PUBLIC_MURSHID_API`, `NEXT_PUBLIC_MURSHID_ADMIN_URL` (web). Secrets live only in the Vercel project settings, never in this repository.
