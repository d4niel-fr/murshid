# Murshid grade bands: rationale

Source of truth: `packages/grade-bands` (`BANDS`, `bandForGrade`, `demoStudents`). This doc explains *why* each band looks the way it does. Change the code first, then this doc.

## Grounding

| Input | What we took from it |
|---|---|
| **UAE Federal Decree-Law No. 26 of 2025 on Child Digital Safety** (issued 1 Oct 2025, effective 1 Jan 2026) — [uaelegislation.gov.ae/en/legislations/3912](https://uaelegislation.gov.ae/en/legislations/3912) | Under-13 personal data only with **explicit, documented, verifiable** guardian consent, an easy way to withdraw it, a clear privacy notice, and minimum access. No targeted ads or commercial tracking of under-13s. Highest-privacy defaults and age-based controls. Educational platforms get some exemptions, but we design as if they don't apply. |
| **UAE gov portal: children's digital safety** — [u.ae](https://u.ae/en/information-and-services/social-affairs/children/Childrens-digital-safety) | Under-15s may not create or run personal **social-media accounts** (Cabinet resolution under the decree-law). → No social-link widget until g11-12; g9-10 gets portfolio/GitHub only. |
| **MoI Child Protection Centre hotline 116111** — [moi-cpc.ae](https://moi-cpc.ae/en/CONTACT.US.aspx) | Used in every band's `chat.safety` copy. 999 for emergencies. |
| **UK ICO Age Appropriate Design Code** (Annex B stages 10–12 / 13–15 / 16–17) — [ico.org.uk](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/3-age-appropriate-application) | High privacy by default. No nudge techniques. Younger children are *steered away* from changing protective defaults; teens get *neutral information* and make the choice themselves. → No leaderboards in any band, soft streaks with grace days, no infinite scroll, no public profiles. |
| **COPPA / GDPR Art. 8** | Under-13s need parental consent, plus data minimisation. Same direction as the UAE law. We require verifiable consent across all of g5-6 and g7-8 (g7-8 is mixed 12–14), so we don't have to check birthdays inside a band. |
| **KHDA / ADEK / school practice** — e.g. [ADEK Digital Policy](https://www.adek.gov.ae/-/media/Project/TAMM/ADEK/Policies/School-Policies/Health-safety-and-wellbeing/ADEK_S_Digital-Policy_EN.pdf), GEMS BYOD policies ([Westminster Ghusais](https://www.gemsws-ghusais.com/-/media/project/gems/tws_the_westminster_school_ghusais/_files-and-documents/key-documents-policies/tws-byod-policy-2025-26.pdf): device mandatory from Year 4; [Metropole](https://www.gemsmetropoleschool-dubai.com/en/-/media/project/gems/mts_metropole_school_motor_city/_files-and-documents/parent-resources/ay-2025---2026-final-parent-handbook.pdf): iPad Years 2–9, MacBook from Year 10) | Grade 5+ students already use an iPad or laptop every day, managed by the school's MDM. **iPad landscape and portrait are first-class layouts.** Schools ask families to cut home screen time. In Oct 2026 KHDA said a Dubai-wide AI-and-devices policy is coming ([Gulf News](https://gulfnews.com/uae/dubai-khda-to-issue-clear-rules-on-ai-mobile-phone-use-for-students-1.500694604)); revisit the AI caps when it's published. ECA (Abu Dhabi) caps screen time at 120 min/day for ages 5–8; we use gentle suggestions, not hard locks. |

**Grade naming.** We store the UAE/US grade number. British Year = grade + 1 (Grade 5 = Year 6, Grade 12 = Year 13). IB: Grade 5 = PYP 5, Grades 6–10 = MYP 1–5, Grades 11–12 = DP1–2. CBSE Class = grade. American middle school is Grades 6–8 and high school is 9–12 (Freshman to Senior). MoE: Cycle 2 = Grades 5–8, Cycle 3 = Grades 9–12. See `curriculumMapping()`, `gradeFromCurriculum()` and `classLabel()`.

**Rules for every band.** The AI never writes graded work and always escalates a crisis to a trusted adult + 116111. Safety alerts reach the guardian at every band. There are no leaderboards, DMs, public profiles or infinite feeds. Quiet hours are in Asia/Dubai time. Moving up a band only *adds* features (the exceptions: subject choices and badges retire in g11-12). The AI cap, reading level and chart complexity rise with each band. All of this is enforced by tests.

---

## g5-6 · Grades 5–6 · ages ~10–12 · "transition years"

**Who they are.** They have just been given a school iPad. They're concrete thinkers, motivated by praise and visible progress, and still learning to manage time. Parents are heavily involved, and most students in this band are under 13, so the UAE law requires verifiable consent.

**Design.**
- **Guardian `full`.** Verifiable consent, the guardian sees everything including chat transcripts, and nothing can be marked private. The student is told this in `guardian.notice`, so the oversight is open, not covert.
- **AI = "Homework helper", `explain-dont-answer`.** Hints, worked examples with different numbers, quiz-me and a reading buddy. The AI suggests asking an adult after 3 hints. 20 messages/day, ≤80 words per reply. No `show_opportunities` tool. Extra refusals: dating, social media, anything outside school.
- **Scope.** School competitions only. No external opportunities, CV, social links or planner.
- **Motivation.** Badges, a points-style star count and streaks with 2 grace days, so a missed day isn't a loss. Confetti celebrations. Never ranked against peers.
- **Charts.** Radial/bar, one series, data labels, 4-week default, a celebratory one-line insight.
- **Copy.** Flesch–Kincaid grade 4, ≤12 words per sentence, occasional emoji, simple MSA in Arabic.
- **Wellbeing.** 30-minute suggested daily use, a break nudge every 20 minutes, quiet hours 19:30–07:00.

---

## g7-8 · Grades 7–8 · ages ~12–14 · transition → early teens

**Who they are.** Starting middle school or KS3. Clubs and inter-school competitions begin, workloads rise, and the first study-skills habits form. They want more independence, and peer comparison hurts more at this age.

**Design.**
- **Guardian `summary`.** Weekly summary of grades, activities and goals. **No chat transcripts**, only topic summaries and safety alerts. The student can mark goals private. The guardian approves external competitions. Consent stays verifiable for the whole band.
- **AI = "Study buddy", `hints-first`.** Adds summarising notes, plan-my-week, study timetable, and finding competitions from the curated list. 40/day, ≤150 words. Refuses paid programmes, jobs and influencer advice.
- **Scope.** Clubs, school competitions plus curated UAE competitions, study planner, weekly briefing. No olympiads, summer programmes or CV yet.
- **Motivation.** Badges for planning, club attendance, entering competitions and personal bests (never versus peers). Subtle celebrations.
- **Charts.** Bar/line/radial, up to 2 series (e.g. this term vs last), 4w/12w/term ranges.
- **Copy.** FK grade 6, a "friendly older-student mentor" voice that offers choices and rarely uses emoji.
- **Wellbeing.** 45 min, break every 25 min, quiet hours 21:00–06:30 (matches `@murshid/notify` school-night rules).

---

## g9-10 · Grades 9–10 · ages ~14–16 · early teens

**Who they are.** GCSE/IGCSE, MYP 4–5 or CBSE IX–X board-exam years. The big decisions start: subject options and A-level/DP/stream choice. Olympiads and summer programmes appear, along with first thoughts about careers. Many are still under 15.

**Design.**
- **Guardian `digest`.** Weekly digest of grades, goals and deadlines. No chats. The guardian still approves external or paid opportunities, because summer programmes usually mean fees or travel. The student can mark items private.
- **AI = "Guide", `scaffolded-feedback`.** Adds revision plans, subject-choice advice, career exploration and feedback on the student's *own* essay drafts, never rewriting them. Presents options and trade-offs neutrally (ICO: teens get neutral information, not nudges) and points to the school counsellor. 60/day, ≤250 words.
- **Scope.** Subject choices, olympiads, summer programmes, portfolio, career explorer, exam countdowns. **No social links or LinkedIn**: the UAE bars personal social accounts under 15, and LinkedIn's own minimum age is 16. Portfolio and GitHub links live inside Portfolio instead. No CV or applications yet.
- **Motivation.** Badges move from effort to milestones (olympiad entry, portfolio started, careers explored). No points. Streaks are reframed as "Consistency" with 3 grace days.
- **Charts.** Line/bar/area/stacked bar, up to 3 series, axis titles, 12-week default, plain insights.
- **Copy.** FK grade 8, warm and direct, explains the *why*, full MSA.
- **Wellbeing.** 60 min, break every 30 min, quiet hours 21:30–06:30.

---

## g11-12 · Grades 11–12 · ages ~16–18 · approaching adulthood

**Who they are.** A-level, IB DP, CBSE XI–XII or AP. Applications to universities in the UK (UCAS), the US (Common App), the UAE and elsewhere, plus predicted grades, IA/EE and coursework deadlines, internships and hackathons. They are close to adults and handle a lot of their own admin, under heavy pressure.

**Design.**
- **Guardian `opt-in`.** The student decides what the guardian sees, area by area. By default the guardian gets only *counts* of deadlines in a weekly digest, plus safety alerts. This respects autonomy at 16–17 (ICO) and matches how families of this age actually work.
- **AI = "Advisor", `coach-with-citations`.** Adds personal-statement and CV review, interview practice and university shortlists. It never drafts submission text or invents achievements, because universities and exam boards check authorship. 100/day, ≤400 words. Flags unsustainable workload.
- **Scope.** Everything: external opportunities, applications, CV, LinkedIn and social links (connect-only, never a public directory), university planner, exam countdowns. Subject choices retire, since they've been made; course changes go through the university planner.
- **Motivation.** No badges or points: at this age they feel juvenile, and achievements go into the CV timeline instead. Optional "study consistency" streak with 3 grace days. No celebration animations.
- **Charts.** Line/area/stacked bar, up to 4 series, term default, year range, analytical insights, no entry animation (faster, calmer).
- **Copy.** FK grade 10, a calm professional advisor voice, no emoji, leads with the deadline or decision.
- **Wellbeing.** 90 min, break every 45 min, quiet hours 22:30–06:00.

---

## Demo students (synthetic)

| id | Band | Student | Curriculum | Activities |
|---|---|---|---|---|
| `demo-g5` | g5-6 | Layla Haddad, Grade 5 / Year 6, Dubai | British | Piano, football |
| `demo-g7` | g7-8 | Omar Siddiqui, Grade 7, Sharjah | American | Football, athletics 800 m, robotics |
| `demo-g9` | g9-10 | Priya Menon, Class IX, Dubai | CBSE | Gym (squat), athletics 100 m, coding club |
| `demo-g11` | g11-12 | Zayed Al Mansoori, DP1, Abu Dhabi | IB | Hackathons, gym (bench), football |

Sessions are generated on fixed dates from 31 Aug to 9 Oct 2026, with metrics that move in a believable direction (running times fall, lifted weights rise), so `/progress` charts have real shape. Upcoming items all fall after 10 Oct 2026. Schools carry the suffix "(demo)". IB grades use a 1–7 scale (`scale: 'ib7'`).

## Open questions for the lead
1. **Push notifications in g5-6:** turned off for the student (in-app only) on the assumption they go to the guardian. Confirm with Logic/notify.
2. **Implementing regulations:** some details of Decree-Law 26/2025 (the platform risk classes, how consent must be verified) are set by Cabinet resolutions. Re-check once the platform classification is published.
3. **KHDA AI policy:** announced Oct 2026 but not yet published. AI caps and the age at which AI is introduced may need tuning.
