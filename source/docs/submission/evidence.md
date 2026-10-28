# Murshid: measurable evidence (what exists today)

Everything here is reproducible from this repository. **No user research has been collected yet**: survey results will
be added only when real responses come in (see validation-plan.md). Anything computed on demo data is marked
**SYNTHETIC**: the demo school, students and teachers are fictional.

## 1. Engineering: automated tests

`pnpm -r test` on 15 Oct 2026, re-run for the v3 demo cut (all passing):

| Package | Tests |
|---|---|
| apps/api (student API, teacher portal, schools, chat orchestrator, survey, reliability) | 139 |
| packages/agent-gateway (orchestrator, routing, model guard, providers) | 72 |
| packages/grade-bands | 99 |
| packages/opportunities (crawler, matching) | 76 |
| packages/connectors (Microsoft Graph, Google, LTI, ...) | 61 |
| packages/core | 42 |
| packages/db | 40 |
| packages/notify | 37 |
| apps/web | 25 (+4 skipped live-API tests) |
| packages/privacy (consent, guardian, retention, audit) | 24 |
| packages/documents (CV / portfolio PDFs) | 20 |
| apps/mobile | 7 |
| apps/admin | 5 |
| packages/survey | 3 |
| **Total** | **650 passing** (4 skipped) |

`pnpm -r typecheck` and the production builds of the web app and the school/admin portal also pass (15 Oct 2026).

## 2. Agent behaviour: end-to-end simulations (docs/simulations)

Graded runs of the real API with live free models (NVIDIA Nemotron via OpenRouter), 10-11 Oct 2026, synthetic students:

| Run | Turns passed | Turns fully on models | Turns on the rule fallback | Avg latency |
|---|---|---|---|---|
| A: flagship student, live models | 7/7 | 5 | 2 (1 model printed tool-call markup, 1 hit the daily quota) | 16.4 s |
| B: admin edits, then the student asks | 3/3 | 0 | 3 (free daily limit of 50 requests reached) | 0.1 s |
| A + B with no model at all | 10/10 | – | 10 | < 0.1 s |

What this shows: the agent routes, reads the student's data, calls tools and writes to the plan; when models fail or the
free quota runs out, the same turn still completes on the rule engine. Two real bugs found by the simulations (duplicate
writes in compound requests; tool-call markup leaking into replies) were fixed and are now checked by the grader.

Prewarming the demo replay cache on 15 Oct 2026 (live models, `pnpm --filter @murshid/api prewarm`): "Plan my week around
my mid-term and both sports" 44.1 s, "Find opportunities for Tideline and save the best one" 16.8 s, "Generate my LinkedIn
CV" 34.6 s, all answered by the models with no fallback (about 6 model requests in total).

## 3. Homework-timing model on demo data (SYNTHETIC)

Teacher portal, "Best day for homework", computed on the seeded Grade 11 classes (30 fictional students each) for the
school week of Thu 15 Oct 2026, as of 10:00 Dubai time (the live page moves with the clock). Fixed, explainable rules, no model (formula in docs/SCHOOLS.md and on the page).

| Class (synthetic) | Task | Best option | On-time likelihood | At risk (extra support) | Option to avoid | On-time likelihood | At risk |
|---|---|---|---|---|---|---|---|
| Grade 11 English (11A/11B) | 45 min | Set Tue 20 Oct, due Thu 22 Oct | 83% (24 of 30 likely on time) | 3 of 30 | Set Thu 15, due Fri 16 Oct | 50% (12 of 30) | 13 of 30 |
| Grade 11 Mathematics (11B/11C) | 40 min | Set Tue 20 Oct, due Thu 22 Oct | 85% (27 of 30 likely on time) | 3 of 30 | Set Thu 15, due Fri 16 Oct | 52% (14 of 30) | 14 of 30 |

The "avoid" slot overlaps an inter-school football fixture (Thu) and a Biology practical assessment (Fri).
On this synthetic data the gap between the best and the worst slot is **33 percentage points**. This is a model
output, not a measured outcome: a pilot would test it against real hand-in rates.

**One at-risk rule everywhere (fixed 15 Oct 2026).** A student is *at risk* for a set/due window when no single day
before the due date has enough free after-school time for the task, or 2+ tests fall in the 2 days before it is due.
The best-day model applies this rule (at-risk students are never counted as "likely on time"), and the automated
replan after a teacher posts work raises the same flag, shown to the teacher as "At risk: extra support" with the
reason. Earlier builds used two slightly different load calculations, so the best slot showed 85-87% on time next to
10 of 30 overload flags; a test now checks that the two always agree.

Class progress on the same data (SYNTHETIC): English 8 ahead / 15 on track / 3 keep an eye / 4 at risk; Mathematics
9 / 14 / 3 / 4.

Automated replan when a teacher posts work (SYNTHETIC, Mathematics, 40-min task): Murshid scheduled a work session and
a reminder for all 30 students each time; at-risk flags: 14 of 30 when set Thu 15 due Fri 16 (no free day for it),
3 of 30 when set Tue 20 due Thu 22 (2 tests just before the deadline, or no free day), 3 of 30 when set Thu 15 due Thu 22.

## 4. Cost (ESTIMATE)

- AI cost per active student: **about US$0.49 a month** with a cheap model mix **without DeepSeek** (ruled out for
  personal data): OpenAI GPT-6 Luna for routing, everyday chat and research (US$0.10 / 0.50 per million input / output
  tokens; the weekly briefing on the batch rate, 0.05 / 0.25), Google Gemini 3.8 Flash for week planning and CV help
  (0.75 / 3.75), Gemini 3.1 Flash-Lite for long notes and photos of notes (0.25 / 1.50). Prices from the OpenRouter
  models API (https://openrouter.ai/api/v1/models), checked 15 Oct 2026; usage per student is an assumption; caching
  and per-student budget caps assumed. Reproduce: `python3 docs/submission/cost_estimate.py`. That is about 14% of an
  AED 150 per student-year school licence (~US$3.40 a month). A premium mix with heavy planning on a top model was
  estimated at about US$1.29 a month. Not yet measured in production. (An earlier US$0.44 figure used DeepSeek models
  and has been withdrawn.)
- The demo runs on free models (about 50 requests a day). About US$10 of OpenRouter credit raises the limit to 1,000
  requests a day; not bought (needs approval).
- Price points for context: schools AED 120-180 per student per year (list AED 150); families AED 29 or 79 a month.

## 5. Problem context (public sources)

- Our Own High School Al Warqa'a: about 4,660 students and 5 counsellors, about 1 counsellor per 930 students
  (edcare.ae school profile, checked Oct 2026).

## 6. Not yet available (to add when real)

- Survey responses (target 20+ students, 3+ teachers, 1 counsellor): live at `/survey`, results in the admin portal.
- Any pilot outcome: the Grade 11 pilot at Our Own High School Al Warqa'a is **proposed**, not agreed.
