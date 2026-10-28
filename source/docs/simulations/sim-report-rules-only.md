# Murshid end-to-end simulations

Run: 2026-10-10T20:53:16.791Z · API: http://localhost:8788 · chat engine: orchestrator+rules (no models)

All students are synthetic. Turns are graded against hard checks; "(soft)" checks are reported but do not fail a turn.

| Simulation | Turns passed | Fallback turns | Avg latency | Models used |
|---|---|---|---|---|
| A: ideal student (demo-ideal) | 7/7 | 7 | 0.0s | rules |
| B: admin + student (demo-g11) | 3/3 | 3 | 0.0s | rules |

## Simulation B: admin steps

| Step | Request | Status |
|---|---|---|
| admin adds an assessment | `POST /admin/students/demo-g11/assessments` | 201 ✓ |
| admin adds a task | `POST /admin/students/demo-g11/tasks` | 201 ✓ |
| admin publishes an opportunity to this student | `POST /admin/opportunities` | 201 ✓ |
| admin detail shows the 3 edits in the change log | `GET /admin/students/demo-g11` | 200 ✗ |

## Simulation A turns

### A1 ✅ PASS · 0.1s · fell back to rules

**demo-ideal:** How am I doing in football and swimming lately, and how are my grades looking?

- Route (rules): sports + academics
- **Sports & training coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_training(prefetch)
- **Academics coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_academics(prefetch)
- UI cards: render_chart, render_chart · writes: none · first agent event after 91 ms
- Checks:
  - ✓ non-empty reply — 554 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: sports, academics — ran: sports, academics
  - ✓ tools used: get_training, get_academics — ok tools: get_training, get_academics
  - ✓ text matches /\d/
  - ✓ (soft) text matches /swim|freestyle|100m/i
  - ✓ (soft) text matches /football|match|yo-?yo|sprint/i

> Here's what your team put together, Ahamed:
> **Sports & training coach**
> Football: 4.4h last week (target 4.2h), load ratio 1.02; bests: 30m sprint 4.17s, Yo-Yo IR1 level 19.6 level; next: Match vs Test British School on 2026-10-15. Swimming: 3.7h last week (target 5h), load ratio 0.72; bests: 100m freestyle 55.36s, 200m IM 138.3s; next: UAE Club Championships (Demo) on 2026-10-31.
> **Academics coach**
> Average 86.1% across 5 subjects. Furthest from target: Extended Project (EPQ) (81.3% vs 90%). Next assessment: Economics mid-term exam on 2026-10-14.

### A2 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** Plan my week around my exams and both sports. Keep some time for Tideline but grades come first.

- Route (rules): planner + academics + sports
- **Planner** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_upcoming(prefetch), get_tasks(prefetch), build_week_plan[write]
- **Academics coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_academics(prefetch)
- **Sports & training coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_training(prefetch)
- UI cards: show_plan, render_chart, render_chart · writes: build_week_plan · first agent event after 18 ms
- Checks:
  - ✓ non-empty reply — 887 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: planner — ran: planner, academics, sports
  - ✓ one of: academics | sports — ran: planner, academics, sports
  - ✓ writes: build_week_plan — writes: build_week_plan
  - ✓ UI cards: show_plan — cards: show_plan, render_chart, render_chart
  - ✓ plan items visible in the student API — 6 Murshid tasks this week
  - ✓ plan visible to admin (audit, actor murshid)

> Here's what your team put together, Ahamed:
> **Planner**
> Saved a 7-day plan from 2026-10-11: 6 new items (2 deep-revision blocks, 1 Tideline block, rest evening, weekly review) around 1 assessments and 1 fixtures.
> 4 assessments, 1 deadlines and 2 fixtures/events in the next 14 days. First: Economics mid-term exam on 2026-10-14.
> 18 open of 18 tasks (next 7 days + overdue).
> **Academics coach**
> Average 86.1% across 5 subjects. Furthest from target: Extended Project (EPQ) (81.3% vs 90%). Next assessment: Economics mid-term exam on 2026-10-14.
> **Sports & training coach**
> Football: 4.4h last week (target 4.2h), load ratio 1.02; bests: 30m sprint 4.17s, Yo-Yo IR1 level 19.6 level; next: Match vs Test British School on 2026-10-15. Swimming: 3.7h last week (target 5h), load ratio 0.72; bests: 100m freestyle 55.36s, 200m IM 138.3s; next: UAE Club Championships (Demo) on 2026-10-31.

### A3 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** Find me opportunities that fit my business and my sports, and save the best one to my applications.

- Route (rules): opportunities
- **Opportunities scout** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: find_opportunities(prefetch)
- UI cards: show_opportunities · writes: none · first agent event after 5 ms
- Checks:
  - ✓ non-empty reply — 75 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: opportunities — ran: opportunities
  - ✓ tools used: find_opportunities — ok tools: find_opportunities
  - ✓ text matches /\(Demo\)|Pitch|Founders|Showcase|Coaching|Summer/i
  - ○ (soft) writes: save_opportunity — writes: none

> 6 open matches. Best fit: Young Founders Pitch Night (Demo) (12 days left).

### A4 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** How can I grow Tideline over the next month without hurting my grades or training?

- Route (rules): business
- **Side-hustle mentor** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_side_projects(prefetch)
- UI cards: render_chart · writes: none · first agent event after 10 ms
- Checks:
  - ✓ non-empty reply — 168 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: business — ran: business
  - ✓ tools used: get_side_projects — ok tools: get_side_projects
  - ✓ text matches /AED|customer|order|revenue/i

> Tideline: AED 18,990 revenue from 118 orders and 76 customers since 2025-12; last full month AED 3,750. Next milestone: Kit configurator v2 on the website (2026-11-01).

### A5 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** Generate my LinkedIn CV, with my business and my sports leadership.

- Route (rules): career
- **Career & CV agent** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_cv_profile(prefetch), get_side_projects(prefetch), generate_linkedin_cv[write]
- UI cards: show_cv · writes: generate_linkedin_cv · first agent event after 6 ms
- Checks:
  - ✓ non-empty reply — 554 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: career — ran: career
  - ✓ writes: generate_linkedin_cv — writes: generate_linkedin_cv
  - ✓ UI cards: show_cv — cards: show_cv
  - ✓ CV PDF downloads (application/pdf, %PDF) — 6782 bytes
  - ✓ LinkedIn pack: headline ≤ 220, About mentions Tideline, 3+ experience entries — generatedBy=rules

> Generated your LinkedIn pack (headline, About, 3 experience entries, 15 skills, 3 featured items) and a CV PDF. Download: /student/cv/linkedin.pdf
> Headline: "Year 12 student | Founder, Tideline | Vice-captain U18 football | Competitive swimmer | Aspiring economist". 8 skills, 2 certifications, 6 achievements. University goal: Economics & Management (UK) or Business Economics (US).
> Tideline: AED 18,990 revenue from 118 orders and 76 customers since 2025-12; last full month AED 3,750. Next milestone: Kit configurator v2 on the website (2026-11-01).

### A6 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** Honestly I'm really stressed. I can't sleep before the mocks and the gala, and I feel like I'm letting everyone down.

- Route (rules): wellbeing
- **Wellbeing** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_wellbeing_signals(prefetch)
- UI cards: none · writes: none · first agent event after 5 ms
- Checks:
  - ✓ non-empty reply — 395 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ one of: wellbeing — ran: wellbeing
  - ✓ tools used: get_wellbeing_signals — ok tools: get_wellbeing_signals
  - ✓ text matches /counsel|parent|trusted|talk to|800/i
  - ✓ text avoids /\b\d+\s?mg\b|melatonin|sleeping pill|diagnos/i
  - ✓ wellbeing answered first — wellbeing

> That sounds like a lot to carry. Let's make the week lighter.
> 4 assessments in the next 14 days; 8.1h of training last week (usual 9.4h); 1 overdue tasks; 21-day study streak.
> Try one small step today: a proper break, a walk, or an earlier night. Talking to a parent or your school counsellor really helps. If things ever feel like too much, the UAE Mental Support Line is 800-HOPE (800 4673).

### A7 ✅ PASS · 0.0s · fell back to rules

**demo-ideal:** Add a task to email my swim coach about the gala tomorrow at 5pm.

- Route (rules): planner
- **Planner** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_upcoming(prefetch), get_tasks(prefetch), create_task[write]
- UI cards: none · writes: create_task · first agent event after 5 ms
- Checks:
  - ✓ non-empty reply — 581 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ one of tools: create_task — ok tools: get_upcoming, get_tasks, create_task
  - ✓ writes: create_task — writes: create_task
  - ✓ task saved for tomorrow 17:00 — Email my swim coach about the gala 2026-10-12 17:00

> Added "Email my swim coach about the gala" on Mon 2026-10-12 at 17:00 (45 min).
> 4 assessments, 1 deadlines and 2 fixtures/events in the next 14 days. First: Economics mid-term exam on 2026-10-14.
> 24 open of 24 tasks (next 7 days + overdue). "Weekly review with Murshid: goals, grades, training, business (15 min)" (2026-10-11). "Deep revision: Economics mid-term exam (past paper + mark scheme)" (2026-10-12). "Deep revision: Economics mid-term exam (past paper + mark scheme)" (2026-10-13). "Prep for Match vs Test British School: kit, hydration, lights out 22:00" (2026-10-14).


## Simulation B turns

### B1 ✅ PASS · 0.0s · fell back to rules

**demo-g11:** Do I have any new exams or tests coming up this week?

- Route (rules): academics
- **Academics coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_academics(prefetch)
- UI cards: render_chart · writes: none · first agent event after 14 ms
- Checks:
  - ✓ non-empty reply — 223 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: academics — ran: academics
  - ✓ tools used: get_academics — ok tools: get_academics
  - ✓ text matches /projectile|practical/i

> Average 83.5% across 5 subjects. Furthest from target: English Literature (72.7% vs 80%). Next assessment: English Literature test — unit 3 on 2026-10-13. New from school: Physics practical: projectile motion on 2026-10-14.

### B2 ✅ PASS · 0.0s · fell back to rules

**demo-g11:** What tasks and deadlines do I have this week? Anything my teachers set?

- Route (rules): planner + academics
- **Planner** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_upcoming(prefetch), get_tasks(prefetch)
- **Academics coach** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: get_academics(prefetch)
- UI cards: render_chart · writes: none · first agent event after 8 ms
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
- **Opportunities scout** · rules · 0.0s · rounds 0 · FALLBACK
  - tools: find_opportunities(prefetch)
- UI cards: show_opportunities · writes: none · first agent event after 2 ms
- Checks:
  - ✓ non-empty reply — 148 chars
  - ✓ clean text (no raw tool-call markup or tables)
  - ✓ every sub-agent answered (no empty section)
  - ✓ agents ran: opportunities — ran: opportunities
  - ✓ tools used: find_opportunities — ok tools: find_opportunities
  - ✓ text matches /Future Engineers/i

> 6 open matches. Best fit: Dubai Future Engineers Challenge (Demo) (16 days left). Published by your school: Dubai Future Engineers Challenge (Demo).
