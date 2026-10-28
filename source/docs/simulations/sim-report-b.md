# Murshid end-to-end simulations

Run: 2026-10-10T20:52:14.783Z · API: http://localhost:8787 · chat engine: orchestrator+models (nvidia/nemotron-3-super-120b-a12b:free > google/gemma-4-31b-it:free > nvidia/nemotron-3.5-lightning:free)

All students are synthetic. Turns are graded against hard checks; "(soft)" checks are reported but do not fail a turn.

| Simulation | Turns passed | Fallback turns | Avg latency | Models used |
|---|---|---|---|---|
| B: admin + student (demo-g11) | 3/3 | 3 | 0.1s | rules |

## Simulation B: admin steps

| Step | Request | Status |
|---|---|---|
| admin adds an assessment | `POST /admin/students/demo-g11/assessments` | 201 ✓ |
| admin adds a task | `POST /admin/students/demo-g11/tasks` | 201 ✓ |
| admin publishes an opportunity to this student | `POST /admin/opportunities` | 201 ✓ |
| admin detail shows the 3 edits in the change log | `GET /admin/students/demo-g11` | 200 ✗ |

## Simulation B turns

### B1 ✅ PASS · 0.2s · fell back to rules

**demo-g11:** Do I have any new exams or tests coming up this week?

- Route (rules): academics
- **Academics coach** · rules · 0.2s · rounds 0 · FALLBACK · tried: nemotron-3-super-120b-a12b:free:429 · error: nvidia/nemotron-3-super-120b-a12b:free HTTP 429: {"error":{"message":"Rate limit exceeded: free-models-per-day. Add 10 c
  - tools: get_academics(prefetch)
- UI cards: render_chart · writes: none · first agent event after 54 ms
- Checks:
  - ✓ non-empty reply — 223 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: academics — ran: academics
  - ✓ tools used: get_academics — ok tools: get_academics
  - ✓ text matches /projectile|practical/i

> Average 83.5% across 5 subjects. Furthest from target: English Literature (72.7% vs 80%). Next assessment: English Literature test — unit 3 on 2026-10-13. New from school: Physics practical: projectile motion on 2026-10-14.

### B2 ✅ PASS · 0.1s · fell back to rules

**demo-g11:** What tasks and deadlines do I have this week? Anything my teachers set?

- Route (rules): planner + academics
- **Planner** · rules · 0.0s · rounds 0 · FALLBACK · error: daily free-model quota exhausted until 2026-10-11T00:00:00.000Z
  - tools: get_upcoming(prefetch), get_tasks(prefetch)
- **Academics coach** · rules · 0.0s · rounds 0 · FALLBACK · error: daily free-model quota exhausted until 2026-10-11T00:00:00.000Z
  - tools: get_academics(prefetch)
- UI cards: render_chart · writes: none · first agent event after 52 ms
- Checks:
  - ✓ non-empty reply — 548 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ one of: planner | academics | general — ran: planner, academics
  - ✓ text matches /notebook|FTC/i

> Here's what your team put together, Zayed:
> **Planner**
> 6 assessments, 1 deadlines and 0 fixtures/events in the next 14 days. First: English Literature test — unit 3 on 2026-10-13.
> 21 open of 21 tasks (next 7 days + overdue). "Submit FTC engineering notebook to Mr. Sample" (2026-10-12, set by school).
> **Academics coach**
> Average 83.5% across 5 subjects. Furthest from target: English Literature (72.7% vs 80%). Next assessment: English Literature test — unit 3 on 2026-10-13. New from school: Physics practical: projectile motion on 2026-10-14.

### B3 ✅ PASS · 0.0s · fell back to rules

**demo-g11:** Has my school shared any new competitions or opportunities with me?

- Route (rules): opportunities
- **Opportunities scout** · rules · 0.0s · rounds 0 · FALLBACK · error: daily free-model quota exhausted until 2026-10-11T00:00:00.000Z
  - tools: find_opportunities(prefetch)
- UI cards: show_opportunities · writes: none · first agent event after 10 ms
- Checks:
  - ✓ non-empty reply — 148 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: opportunities — ran: opportunities
  - ✓ tools used: find_opportunities — ok tools: find_opportunities
  - ✓ text matches /Future Engineers/i

> 6 open matches. Best fit: Dubai Future Engineers Challenge (Demo) (16 days left). Published by your school: Dubai Future Engineers Challenge (Demo).
