# Murshid for Schools: licensing, Microsoft 365 and the teacher portal

## Two ways to get Murshid

| | Families | Institutions (main focus) |
|---|---|---|
| Who pays | A parent for their child, or a student for themselves | The school (or school group), per student per year |
| Plans | Plus AED 29/mo (249/yr), Pro AED 79/mo (699/yr) | Murshid for Schools, list AED 150 per student per year (range 120–180); pilots |
| Tenant | Family org (`kind: family`), one per account | School org (`kind: school`, optional parent group) |
| How work arrives | The student adds it / Murshid plans it | Teachers post in the portal, or the school connects Microsoft 365 (Teams) |
| Who sees the data | The student and their parent | The student, their teachers (own classes only) and the school admin (own school only) |

Every app student has exactly one tenant (`SchoolStore.tenant`), and the licence on it says which kind it is (`licenceOf(studentId)`: type, orgId, plan, boughtBy, connectedVia). Demo tenants:

- **GEMS Education → Our Own High School Al Warqa'a** (`gems-oow`), institution licence modelling the proposed Grade 11 pilot (demo tenant; no partnership is confirmed). Ahamed Mehta (`demo-ideal`) and a synthetic roster of 38 Grade 11 students; English (Ms. Sana Thomas, 30 students) and Mathematics (Mr. Vikram Desai, 30 students) teachers can sign in to the portal.
- **Demo British School** (`demo-british`), institution trial: Zayed (`demo-g11`). It proves isolation: its teacher cannot open GEMS classes.
- Families: Haddad (parent → `demo-g5`), Siddiqui (parent → `demo-g7`), Priya Menon (self → `demo-g9`).

Onboarding (`POST /onboarding`) has three paths, matching the web chooser at `/welcome`: `parent`, `student`, and `school` (via simulated Microsoft sign-in or a school join code such as `OOW-G11`).

## Microsoft 365 connector

`apps/api/src/schools/microsoft.ts` defines `SchoolDirectoryConnector` (authorize URL, account list, code exchange, list classes). The demo uses `SimulatedMicrosoft365`: Murshid renders its own "Pick an account" page, codes are `sim:<id>`, and classes come from the seeded roster. A production `GraphMicrosoft365` would implement the same interface with Entra ID (auth code + PKCE) and Graph education endpoints (`/education/classes`, `/members`, `/assignments`, which need EduRoster.ReadBasic + EduAssignments.ReadBasic with admin consent). The scopes and Graph normalizers already exist in `packages/connectors/src/providers/microsoft/graph.ts`. No Azure credentials are needed for the demo.

## Teacher portal analytics (deterministic, explainable)

All in `apps/api/src/schools/engine.ts`, seeded by student id + item id + week, with no model calls:

- **Work**: each class sets homework on its set days (due 2 school days later). Hand-in outcomes come from each student's diligence: on time, late, missing, handed in early or pending. Tests and events (fixtures, swim gala, athletics heats, MUN) are fixed relative to the current school week.
- **Load**: per day = homework spread to its due date + test revision (45 + 60 min before each test) + sport/activities + events, against a capacity of 240 min after school (330 at weekends).
- **Class progress**: completion %, average, overdue/remaining in this subject, plus all-subject overdue, tests and how full the next 7 days are. Status rules: at risk (2+ overdue here, <70% handed in, average <55%, or 4+ overdue overall), keep an eye (1 overdue, <85%, or a week 85%+ full), ahead (95%+, average 85%+, week <70% full).
- **Who needs what**: support = at risk; same task with more time = up to date but a heavy week (2+ tests, a fixture/event or 85%+ full); extension = ahead; peer partners and snake-drafted mixed groups.
- **Best day for homework**: for each of the next 5 school days × due +1/+2/+3 school days, each student's on-time chance = (0.72 + 0.28 × diligence) × (1 − e^(−free minutes / task minutes / 0.9)) − 5 points per test and 4 per event in the window − 4 per overdue task (max 3). The class likelihood is the average. Best = highest, with 3 points off windows that run over a weekend; ties go to the earlier due date.
- **At risk (one rule for the best-day model and the replan after posting)**: a student is at risk for a set/due window when no single day before the due date has enough free time for the task, or 2+ tests fall in the 2 days before it is due. At-risk students are capped below the 70% "likely on time" line in the best-day model, and the replan shows them to the teacher as "At risk: extra support" with the reason, so the two numbers always agree.
- **Weekly reports**: each student's report auto-submits Friday 16:00 Dubai. It covers work handed in (the weekend before counts), on time vs due so far, overdue, still to do in the next 7 days, tests and activity hours, rolled up per class.

## API

| Method | Path | Who |
|---|---|---|
| GET | `/plans` | public |
| POST | `/onboarding` | public |
| GET | `/auth/microsoft/authorize`, `/auth/microsoft/accounts` | public (simulated) |
| POST | `/auth/microsoft/callback` | public (simulated) → session headers |
| GET | `/teacher/me` | teacher / school admin |
| GET | `/teacher/classes/:id/report` · `/recommendations` · `/homework-timing?minutes=` · `/weekly-reports?week=current\|last` · `/assignments` | class teacher / school admin |
| POST | `/teacher/classes/:id/assignments` | class teacher. Lands in each linked student's Today list and School page |
| GET | `/orgs/:id`, `/orgs/:id/students` | that school's admin |
| POST | `/orgs/:id/microsoft/connect` · `/disconnect` | that school's admin |
| GET | `/licensing/overview` | platform admin: families vs institutions |
| GET | `/student/school`, `/student/weekly-report` | student |

Dev auth: teachers `x-dev-role: teacher` + `x-dev-user-id: t-thomas | t-desai`; school admin `x-dev-role: admin` (+ `x-dev-school-id`). Tests: `apps/api/test/schools.test.ts`.

## Screens

- School portal (`apps/admin`, :3001): `/login` (Demo: simulated Microsoft 365 sign-in; `?demo=teacher` / `?demo=admin` for one-click logins; admin needs ADMIN_PASSCODE when set), `/teacher` (class progress, who needs what, best day for homework, weekly reports, assignments, post assignment), `/school` (licence, Connect Microsoft 365, classes, families vs schools).
- Student app (`apps/web`, :3000): `/welcome` (Get Murshid chooser), `/pricing` (Schools featured), `/school` (school or family plan, work from teachers, weekly report).
