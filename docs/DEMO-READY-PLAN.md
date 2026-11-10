# Demo-ready plan (Nov 2026 – Jan 2027)

Goal: one sharp, working web app for the ITU final (8 Dec 2026, if shortlisted on 18 Nov) and the Dubai Chamber
Create AI Agents Championship, Youth (prototype + deck + demo video due Jan 2027, live final May 2027).
Murshid is the student's **manager, not their tutor**. iPhone and Android come after the web app.

## 1. Focus mode (students with ADHD and other learning differences)

Founder story: Sam has ADHD and built the manager he needed.

The product rule: a student turns Focus mode on themselves in Settings. **We never ask for or store a diagnosis.**
A diagnosis is health data about a minor, and the Child Digital Safety law and the PDPL treat it as sensitive.
Focus mode is a way of working, not a medical label.

What changes when it is on:

| Area | Change | Why |
|---|---|---|
| Home | One card: **"Now"**, the single next thing, with a start button and how long it takes | Fewer choices, so it is easier to start |
| Tasks | The agent breaks every task over 25 min into steps of 10–25 min, each with a clear "done" | Big tasks feel impossible; small steps don't |
| Time | A visible countdown on the current step (reuses the focus timer); overdue items go quiet instead of red | Makes time visible without shame |
| Reminders | Fewer and calmer: at most 3 nudges a day, at times the student picks; no streaks or guilt messages | Avoids notification fatigue |
| Reading | One-click Immersive Reader (already built: line focus, spacing, read aloud) on any assignment text | Supports students with dyslexia and attention differences |
| Weekly plan | The agent builds in buffer time and breaks, and plans hard work at the time of day the student says they focus best | Matches how the student actually works |
| Look | Reduced motion, fewer colours, larger targets, no badge counts | Less visual noise |
| Teacher view | Shows only "Focus mode on" if the student chooses to share it, never a reason | The student controls the label |

Agent changes: a `focusMode` flag in the student context makes the planner chunk tasks, cap daily load, add
buffers, and keep replies short with one clear next step. A test asserts that no diagnosis field exists anywhere.

## 2. Demo video (2.5–3 min, built with Remotion + real screen recordings)

1. **0:00 Hook (15 s).** "At my school there's one counsellor for every 930 students. So I built every student a manager."
2. **0:15 The student (40 s).** Ahamed asks Murshid to plan his week around a mid-term and football. Show the
   "How Murshid worked this out" trace: goal → plan → tools → actions.
3. **0:55 The hero moment (45 s).** Ms. Thomas posts an essay. Murshid replans every student in the class in seconds and flags
   the students at risk, each with the reason. Then "best day to set homework".
4. **1:40 Focus mode (30 s).** The same week for a student with Focus mode on: one "Now" card, 15-minute steps, calm reminders.
5. **2:10 Safety (25 s).** Crisis language never reaches a model; the ITU policy agents and the audit log show the
   plan follows UAE child-safety and data law.
6. **2:35 Close (15 s).** Team, pilot ask, URL.

Rules: real app footage only (no fake screens); captions burned in; 1080p; music low; record against the focused demo build.

## 3. Still to do

- [ ] Focus mode (spec above)
- [ ] UI pass in the browser on desktop, iPad and phone, against the focused build
- [ ] Set `OPENROUTER_API_KEY` in Vercel (owner does this) so the agent uses better models than the free tier
- [ ] Record and edit the demo video
- [ ] Deck update with the Focus mode story and validation numbers (survey, interviews, pilot)
- [ ] Decide which deployment is canonical: murshid-web.vercel.app still serves the 27 Oct build
