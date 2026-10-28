# Murshid: validation plan

Goal: show the judges ("Validate: customer need, business potential, measurable impact") real evidence from real
students and teachers, not assumptions. Nothing below has been collected yet; every number here is a **target**.

## 1. Who we ask

| Group | Target | How we reach them | Why |
|---|---|---|---|
| Grade 11-12 classmates (Our Own High School Al Warqa'a) | **20+** responses (stretch 40) | WhatsApp class groups, in person at break | The users: workload, missed deadlines, would they use it |
| Grade 9-10 students | 10+ (stretch) | Friends / siblings, house captains | Checks the problem is not just a Grade 11 thing |
| Subject teachers | **3+** (stretch 6, across subjects) | Short email or in person | The buyer's daily user: homework timing, spotting struggling students |
| School counsellor | **1** (ideally a 15-min conversation as well) | Email / appointment | Counsellor load (about 1 per 930 students at OOW) and wellbeing angle |
| Parents | 5+ (stretch) | Through classmates (optional link) | Willingness to pay for the family plan |

Everything goes through one link: **`<live web URL>/survey`** (student or teacher version, about 8 questions, no names,
only an optional grade or role, consent tick-box). Results appear live in the admin portal under **Validation > Survey results**
(counts per answer, averages, comments), stored in Supabase.

Ethics and privacy: anonymous, no personal data, consent line on the form, under-18s can skip any optional question,
free-text boxes strip emails and phone numbers automatically. Ask a teacher before posting the link in any school channel,
and do not claim school endorsement.

## 2. What we measure (target metrics)

| Question in the survey | Metric | "Problem is real" if | "Product fits" if |
|---|---|---|---|
| Workload stress (1-5) | average | avg ≥ 3.5 | – |
| Deadlines missed or late in the last month | % with 1+ | ≥ 40% | – |
| Deadlines/tests landing on the same days | % "most weeks" or "every week" | ≥ 50% | – |
| How they track work now | % using 2+ places or "nothing / I just remember" | ≥ 50% | – |
| Would use one plan for everything (1-5) | % answering 4-5 | – | ≥ 60% |
| Family would pay | % "yes" at any price | – | ≥ 25% (≥ 10% at AED 30+) |
| Teacher: visibility of other homework (1-5) | average | avg ≤ 2.5 | – |
| Teacher: how often clustering is discovered | % monthly or more | ≥ 50% | – |
| Teacher: would use if school provided (1-5) | % 4-5 | – | ≥ 2 of 3 teachers |
| Teacher: time saved | median band | – | ≥ "30-60 minutes" a week |

## 3. Impact we can measure in a pilot (proposed, not started)

If the school agrees to the **proposed Grade 11 pilot at Our Own High School Al Warqa'a** (one class, 4 weeks):

- Late/missing homework rate in the pilot class vs. the same class in the 4 weeks before (teacher's own records).
- Share of homework set on the "best day" Murshid suggests, and its on-time rate vs. other days.
- Number of "at risk: extra support" flags raised and how many were acted on (extension, moved deadline).
- Weekly active students and how many weekly reports were opened.
- A 3-question follow-up survey at the end (stress, would keep using, would recommend).

## 4. Timeline

| When | What |
|---|---|
| Week 1 | Send the student message (outreach-drafts.md) to 2-3 class groups; email 3-4 teachers and the counsellor |
| Week 2 | Reminder message; 1-2 short teacher conversations; aim for 20 students + 3 teachers |
| Week 3 | Freeze results; screenshot the admin results page; put the real numbers in the pitch deck and evidence.md |
| After | If a teacher is keen, propose the 4-week pilot to the Head of Senior School |

## 5. How results reach the submission

- Pitch deck "Validate" slide: n per group, the 3-4 headline percentages, 1-2 anonymous quotes.
- `docs/submission/evidence.md`: add a "Survey results (real)" section with the date range and n.
- Never round up, never mix targets with results, always show n.
