# Murshid Admin (apps/admin)

School / admin staff portal for Murshid. Desktop-first Next.js 16 (App Router, webpack build), Tailwind v4 with the
shared `@murshid/design` tokens, zod-validated forms. Talks to the Murshid API's `/admin/*` routes with dev auth
(`x-dev-role: admin`). All students are synthetic demo data.

- **Students** (`/`): overview stats, search by name / school / interest / project, grade filter, create student.
- **Student detail** (`/students/[id]`): tabs for Profile, Academics (subjects + assessments and grades),
  Sports & activities (logged sessions, matches, races, PBs), Tasks & deadlines, Goals, Opportunities (feed +
  applications and outcomes), Side projects (revenue chart + milestones), CV & links (CV fields, social links,
  LinkedIn pack + PDF, achievements) and a per-student change log.
- **Opportunities** (`/opportunities`): publish to every student in a grade range or to listed students; shows reach.
- **Audit log** (`/audit`): every admin edit and every write by Murshid's agents.

Edits land in the API's shared store, so the student web app (`apps/web`) and Murshid's chat agents see them on the
next request.

```bash
cd apps/api && pnpm start          # API on :8787
cd apps/admin && pnpm dev          # http://localhost:3001
pnpm test                          # form validation tests
pnpm build                         # next build --webpack
```

Env: `NEXT_PUBLIC_MURSHID_API` (default http://localhost:8787), `NEXT_PUBLIC_MURSHID_ADMIN_USER` (audit actor, default dev-admin).
