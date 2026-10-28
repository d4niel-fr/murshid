# Murshid demo video v3: script

Video: `docs/demo/murshid-demo-v3.mp4` (1920x1080, H.264 30 fps + AAC 160 kb/s, 111.9 s). **Current version**; v2 (`murshid-demo-v2.mp4`) and v1 (`murshid-demo.mp4`, script `murshid-demo-script.md`) are superseded.

- **Recorded from the live deployment**: student app https://murshid-web.vercel.app, teacher/admin portal https://murshid-admin.vercel.app, one-click demo logins at https://murshid-web.vercel.app/judges. All students and teachers are fictional; **Microsoft 365 sign-in is simulated** (labelled in the teacher header).
- **Frame layout**: the recorded app fills the top 1920x960; captions sit in a 120 px dark band underneath, so they never cover the UI.
- **Windows**: teacher/admin clips 1280x640 CSS at 1.5x; student-app clips (Ahamed, /how-it-works) 1440x720 CSS at 4/3 so the sidebar's Settings item no longer overlaps the profile footer. Both give 1920x960 frames.
- The `/chat` SSE stream is paced in the browser during recording (~0.4-0.75 s per agent event) so each step is readable. Clips are sped up to fit the narration: b1 1.29x, b2 1.66x, c 0.91x, d 1.05x, e 1.30x, f 1.42x, g 1.24x (cards at 1x).
- Voice: Edge neural TTS (see `recorder/v3/tts.sh`); quiet synth pad generated with ffmpeg underneath; voice loudness-normalised.
- Claims: no school partnership or "piloting" claims; the close card says "Proposed Grade 11 pilot, not yet agreed".
- Narration: 270 words.

Rebuild: `recorder/v3/scenes_v3.py` (record clips; `SHOTS=e,f` re-records selected shots), then `recorder/v3/assemble_v3.py scenes` and `assemble_v3.py final`. Note: re-recording shot `c` posts a real assignment to the live demo class.

## A. Problem (title card)  (0:00.0 to 0:17.6)

**Caption:** The problem: students fall behind before anyone notices

**On screen:** `title` card: Murshid, "Students fall behind before anyone notices", ~4,660 students at one Dubai school, 1 : 930 counsellor ratio (edcare.ae school profile, Oct 2026).

> Grade 11 students juggle six subjects, tests, homework from every teacher, and sport. At a school of about four and a half thousand students, with one counsellor for every nine hundred or so, the students falling behind are spotted late. Murshid is built to change that.

## B. Student plan (Ahamed, demo student)  (0:17.2 to 0:33.9)

**Caption:** Student: Murshid plans a demo student's week around his mid-term and sport

**On screen:** `b1`: /judges, one-click "demo student" login, lands on Ahamed's Today page. `b2`: /chat, types "Plan my week around my mid-term and both sports"; the agent steps stream (paced) and the week plan is written to his calendar.

> This is Ahamed, a demo student with a mid-term coming up and two sports. He asks Murshid to plan his week around them. Murshid reads his timetable, tests and training, and writes the plan straight into his calendar.

## C. Teacher posts work once  (0:33.5 to 0:48.9)

**Caption:** A teacher posts work once: every student's week is replanned, with at-risk flags

**On screen:** `c`: admin portal teacher demo (Ms. Sana Thomas, Grade 11 English). Post assignment: "Poem analysis: Keeping Quiet", set the week after the best-day window; banner confirms every student's plan was replanned.

> His English teacher, Ms. Thomas, posts an assignment once. It lands in every student's plan, and Murshid replans each student's week: a work session on their lightest day, a reminder, and a flag for anyone at risk, with the reason.

## D. "How Murshid worked this out" trace  (0:48.5 to 1:03.4)

**Caption:** "How Murshid worked this out": goal, steps, tools, actions and result

**On screen:** `d`: opens "How Murshid worked this out (Ahamed Mehta)": goal understood, steps planned, tools used, actions taken, result, engine and guardrails.

> Murshid is an AI agent. It understands the goal, plans the steps, uses tools on each student's real timetable, takes action, and explains itself. Open How Murshid worked this out to see every step.

## E. Best day to set homework  (1:03.0 to 1:17.1)

**Caption:** Best day for homework: set Tuesday, due Thursday, 83% likely on time

**On screen:** `e`: fresh teacher page, Best day for homework tab: "Best day to set: Tuesday, due Thursday, 83% likely on time", 3 at risk get extra support, then the set-day by due-day grid with the 83% cell ringed.

> It also finds the best day to set homework. Set it Tuesday, due Thursday: eighty-three percent likely on time. The three students at risk get extra support, and the reason is always shown.

## F. Weekly reports  (1:16.7 to 1:26.6)

**Caption:** Weekly reports send themselves every Friday and roll up to the teacher

**On screen:** `f`: Weekly reports tab: this week's drafts, each sends itself Friday 16:00; reports in, work handed in, overdue, coming up, then the per-student report table.

> Every Friday, each student's weekly report sends itself and rolls up here, so teachers see who needs help before it is too late.

## G. Privacy and consent  (1:26.2 to 1:40.8)

**Caption:** Privacy: consent per purpose, separate school data, human approval, audit log

**On screen:** `g`: student site /how-it-works, Guardrails: Consent, School data separation, Human approval before anything is sent, Audit log.

> Privacy comes first. Consent is recorded for each purpose, with a guardian for under-eighteens. School data never mixes with family accounts, nothing is sent without approval, and every change is logged.

## H. Close card  (1:40.4 to 1:51.9)

**Caption:** Try it: murshid-web.vercel.app/judges  \u00b7  Microsoft sign-in is simulated

**On screen:** `closing` card: Murshid for Schools, murshid-web.vercel.app/judges, "Demo with fictional students · Proposed Grade 11 pilot, not yet agreed".

> Murshid. Every student on top of their work, and every teacher with the full picture. Try it at murshid-web dot vercel dot app, slash judges.
