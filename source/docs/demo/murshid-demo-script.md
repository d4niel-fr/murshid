# Murshid demo video: script (v1, superseded)

> **Superseded.** The current demo is v3: `murshid-demo-v3.mp4`, script `murshid-demo-v3-script.md`. This v1 script and the v1/v2 videos (`murshid-demo.mp4`, `murshid-demo-v2.mp4`) are kept for reference only; they predate the live deployment and contain claims and features the v3 cut no longer makes.

Video: `docs/demo/murshid-demo.mp4` (1920x1080 H.264 + AAC, 89.4 s). Voice: Microsoft Edge neural TTS `en-GB-RyanNeural` (+6% rate) via `edge-tts`. Music: a quiet synth pad generated with ffmpeg (`aevalsrc`), about 20 dB under the voice.

Persona: **Ahamed Mehta** (`demo-ideal`, synthetic). Recorded against production builds of the web app (:3000) and admin portal (:3001) and the Hono API (:8787) in **rules mode** (`GATEWAY_MODE=mock`, no model calls). The `/chat` SSE events are paced in the browser during recording (~0.4-0.75 s per event) so each sub-agent step is readable; in rules mode the real turn takes ~20 ms.

Captions are burned in at the top of the frame (over the app's top bar) so they never cover the chat composer. The admin task in scene F is due today (Dubai date at record time), 16:00, so it lands in the student's Today list.

Word count: 222.

## A. Title card  (0:00.0 to 0:10.0)

**Caption:** (title card) Murshid, your AI school manager

> This is Murshid: your AI school manager. One home for a student's classes, sport and ambitions, run by a team of AI agents.

## B. Ahamed's dashboard + year charts (football, swimming, academics)  (0:09.6 to 0:27.7)

**Caption:** Ahamed's year in football, swimming and grades, straight from the API

> Meet Ahamed, a Year 12 student in Dubai. He's vice-captain of the football first eleven, swims competitively, and runs a small business on the side. Murshid tracks his whole year: training in both sports, and every grade, so he can see exactly where he's improving.

## C. Chat: "Plan my week around my mid-term and both sports"  (0:27.3 to 0:48.1)

**Caption:** One ask, two agents in parallel: the Planner and the Sports coach build his week

> Now he asks: plan my week around my mid-term and both sports. The manager agent splits the job. The planner and the sports coach work in parallel, reading his timetable and his training load, and only the lead agent is allowed to write. Seconds later: a full week, with protected revision, training, and rest.

## D. Opportunities scout saves a pitch night for Tideline  (0:47.7 to 0:57.8)

**Caption:** The Opportunities scout saves a pitch night for Tideline

> The opportunities scout matches openings to his profile, and saves a young founders pitch night for his side hustle, Tideline, with a task to start the application.

## E. LinkedIn CV generated + PDF  (0:57.4 to 1:08.0)

**Caption:** The Career & CV agent writes a LinkedIn-ready CV, exported as a PDF

> The career agent turns his whole year into a LinkedIn-ready CV: a headline, an about section, and experience from his business and his sport, as a clean PDF.

## F. Admin portal adds a task → student app shows it  (1:07.6 to 1:18.8)

**Caption:** An admin adds a task, and it is in Ahamed's app straight away

> And schools stay in control. In the admin portal, a teacher adds a task for Ahamed. Back in his app, it's already there, on today's list.

## G. Closing card  (1:18.4 to 1:29.4)

**Caption:** (closing card) Seven specialist agents. One manager. Every student's best year. / Built for Dubai Create AI Agents Championship · Youth

> Murshid. Seven specialist agents, one manager, and every student's best year. Built for the Dubai Create AI Agents Championship.

## Rebuild

`docs/demo/recorder/` holds the recorder (Playwright + CDP screencast at 1280x720 CSS px, device scale 1.5 = 1920x1080), the TTS script, the scene assembler and the final mix. Paths inside are absolute to the build sandbox (`/workspace/work/demo`); card fonts were Inter from `/opt/deckbuild/fonts` (not committed). Order: `restart-api.sh` → `scenes.py a b`, `scenes.py c d`, `scenes.py e f g` (API state carries across scenes) → `tts.sh` → `assemble.py` → `final.py`.
