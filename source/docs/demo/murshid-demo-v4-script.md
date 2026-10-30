# Murshid demo video v4: script and production notes

Video: `apps/web/public/media/murshid-demo.mp4` (1920x1080, H.264 30 fps + AAC, 1:53, about 13 MB, embedded on `/judges`). A higher-bitrate master can be rebuilt with the pipeline in `recorder/v4/`.

- **Recorded locally** from the student app, the teacher portal and `/how-it-works`, with the clock pinned to Thu 15 Oct 2026 so the numbers match the narration (best day: set Tuesday, due Thursday, 83% likely on time; 3 at risk). All students and teachers are fictional; **Microsoft 365 sign-in is simulated**.
- **Frame:** the app sits in a rounded window on the navy brand background, with a chapter eyebrow, a caption and chapter dots underneath. Title and closing cards are full frame, with the 3D star.
- **Motion:** each recording is re-timed to the narration from its logged events. A camera eases in on the action, and a smooth cursor with click ripples is drawn from the logged mouse paths. Scenes change with rise, push, dissolve and reveal transitions.
- **Voice:** Kokoro-82M v1.0 (open source, Apache-2.0), voice `af_heart`, via kokoro-onnx. It is generated one sentence at a time with set pauses, and the names are given exact pronunciations (Murshid, Ahamed, Ms.). The voice chain is EQ, gentle compression, a touch of room and a look-ahead limiter.
- **Music:** an original 90 BPM piece in D major, composed to the scene timings. Piano, electric piano and celesta use FluidR3 GM samples (gleitz/midi-js-soundfonts, MIT); the pad, sub bass, felt kick and shaker are synthesised. The music is ducked under the voice (about 16 dB below speech).
- **Sound design:** typing, clicks, swooshes, pops, chimes, agent-step ticks, a riser and soft impacts, all synthesised, so there are no third-party samples. 138 cues, each placed on a logged event.
- **Master:** −16 LUFS integrated, peaks below −3 dBFS.
- **Claims:** no school partnership or "piloting" claims; the close card says "Proposed Grade 11 pilot, not yet agreed".

Rebuild: see `recorder/v4/README.md`. Note: recording scene `c` posts an assignment to the demo class, so restart the API before re-recording `e`/`f` (otherwise the best-day numbers change).

## A. Problem (title card)
> Every week, a Grade 11 student juggles six subjects, homework from every teacher, tests, and sport. At a school of four and a half thousand students, there's one counsellor for every nine hundred or so. So the students who fall behind are spotted far too late. That's where Murshid comes in.

## B. Student plan (Ahamed, demo student)
> Meet Ahamed. He has a mid-term coming up, with football and swimming on top. He asks Murshid to plan his week. It reads his timetable, his tests and his training, and writes the plan straight into his calendar.

## C. Teacher posts work once
> Now his English teacher, Ms. Thomas, posts one assignment. It lands in every student's plan, and Murshid replans each week around it. A work session on their lightest day, a reminder the evening before, and a flag for anyone at risk, with the reason why.

## D. How Murshid worked this out
> And it never asks you to just trust it. Murshid is an agent. It understands the goal, plans the steps, uses tools on the student's own timetable, and takes action. Then it shows its working. Every step.

## E. Best day to set homework
> It even finds the best day to set homework. Set it Tuesday, due Thursday, and it's eighty-three percent likely to come in on time. The three students at risk get extra support.

## F. Weekly reports
> Every Friday, each student's weekly report sends itself, and rolls up here. So teachers can see who needs help, before it is too late.

## G. Privacy
> Privacy is built in, not bolted on. Consent is recorded for every purpose. School data never mixes with family accounts. Nothing is sent without a person saying yes, and every change is logged.

## H. Close card
> Murshid. Every student on top of their work. Every teacher with the full picture. Try it today, at murshid-web dot vercel dot app, slash judges.
