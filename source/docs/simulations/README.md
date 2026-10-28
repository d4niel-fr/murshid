# Murshid simulations (live API + Nemotron)

Runner: `pnpm sim` (apps/api/scripts/sim.ts). It drives a running API over HTTP (SSE `/chat`, `/admin/*`, `/student/*`),
records every turn (route, sub-agents, tools with read/write/ui access, models tried and used, latency, fallback) and
grades it against hard checks (soft checks are reported but do not fail a turn). All students are synthetic.

| File | What |
|---|---|
| `sim-report-a.md` / `.json` | **Simulation A, live models** (GATEWAY_MODE=openrouter): the flagship student, 7 turns |
| `sim-report-b.md` / `.json` | **Simulation B, live API**: admin edits, then the student asks Murshid. Ran after the free daily quota was exhausted, so every agent answered through the rule fallback (see below) |
| `sim-report-rules-only.md` / `.json` | Both simulations against an API with no model configured (the safety net on its own) |
| `ahamed-linkedin-cv.pdf` | LinkedIn-ready CV for demo-ideal (headline + About written by nemotron-3-super through the career agent; PDF re-rendered after the persona rename to Ahamed Mehta) |
| `ahamed-linkedin-pack.json` | The matching LinkedIn profile pack (headline, About, experience, education, skills, featured, honours) |

## Results (10-11 Oct 2026, Asia/Dubai)

| Run | Passed | Model turns | Fallback turns | Avg latency |
|---|---|---|---|---|
| A: ideal student, live | 7/7 | 5 fully on Nemotron (super + lightning) | 2 (1 model returned tool-call markup, 1 hit the daily quota mid-turn) | 16.4 s |
| B: admin + student, live API | 3/3 | 0 | 3 (OpenRouter `free-models-per-day` limit of 50 reached; resets 00:00 UTC) | 0.1 s |
| A + B, rules only | 10/10 | – | 10 | <0.1 s |

Earlier live run of A (same day, before fixes): 7/7 by the grader at the time, but it exposed two real bugs that the
grader now checks for: (1) in a compound request, the advisor agents also created tasks (duplicate writes), and
(2) nemotron-3-super sometimes prints tool calls as `<tool_call><function=…>` text, which leaked into the reply. Fixed:
only the lead agent may write; advisors get read/UI tools and one round; printed tool calls are parsed and executed,
leftover markup and markdown tables are stripped; the runner fails any turn with raw markup or an empty section.

## Limits seen
- Free tier: OpenRouter allows 50 free-model requests per day on this key (shared across all `:free` models). The
  provider now detects the per-day 429, stops calling the chain until the reset time, and the orchestrator answers
  from store data via rules (sub-second) instead of hammering the API.
- Latency: nemotron-3-super 3-12 s per call today; nemotron-3.5-lightning 11-57 s under load; gemma-4-31b mostly 429.
  Compound requests run agents in parallel, so a 3-agent plan took 12 s.
