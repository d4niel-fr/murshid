# Murshid v1 Web (desktop + iPad first) — team contract

Product: a calm, beautiful companion app for UAE students (Grade 5–12). Desktop and iPad first (1280–1440 desktop, 1024×1366 / 1180×820 iPad landscape+portrait). Phone later.
Old Expo green/purple theme is retired for web. Smooth 60fps, no lag: prefer CSS transforms/opacity, Motion springs, no heavy blur on scroll.

## Ownership (do NOT edit outside your area)
| Team | Owns |
|---|---|
| Design | `packages/design/**`, `docs/design/**` |
| Implement | `apps/web/**` (new Next.js app) |
| Logic | `apps/api/**`, `apps/mobile/**` bug fixes, `packages/core/**`, `packages/agent-gateway/**` |
| Grade bands | `packages/grade-bands/**` (new) |
| Outreach | `docs/outreach/**` |
Only the Implement team runs `pnpm install` at repo root. Others add deps to their own package.json only if essential and tell the lead. Nobody commits; the lead commits.

## Stack (apps/web)
Next.js (App Router, TS) + Tailwind v4 + shadcn/ui + Motion (`motion/react`) + Recharts + lucide-react + `@assistant-ui/react` (Grok-clone style composer, generative UI tool rendering). Fonts: Inter / Geist for Latin, IBM Plex Sans Arabic or Noto Kufi Arabic for Arabic.

## Design tokens contract (`packages/design/tokens.css`)
CSS variables on `:root` (light) and `.dark`:
`--bg --surface --surface-2 --border --text --text-muted --accent --accent-fg --accent-soft --success --warning --danger --info --chart-1..--chart-6 --radius-sm --radius --radius-lg --shadow-1 --shadow-2 --font-sans --font-arabic`
Grade band overrides via `[data-band="g5-6"|"g7-8"|"g9-10"|"g11-12"]` (may change accent, radius, font scale `--scale`).
Motion presets in `packages/design/motion.ts`: `spring.snappy`, `spring.gentle`, `fadeUp`, `stagger`, `pressable` (exported plain objects, no deps).

## Grade bands contract (`packages/grade-bands`)
`export type BandId = 'g5-6'|'g7-8'|'g9-10'|'g11-12'`
`export function bandForGrade(grade:number): BandId`
`export const BANDS: Record<BandId, BandConfig>` where BandConfig = { id, label, grades:[min,max], tone, readingLevel, nav: NavItem[], dashboardWidgets: WidgetId[], features: Record<FeatureId, boolean>, aiPolicy, guardian, copy: Record<string,string> (en + ar), chartDefaults, rewards }
WidgetId: 'greeting'|'today'|'progress-rings'|'upcoming'|'streaks'|'goals'|'academics'|'extracurriculars'|'opportunities'|'applications'|'cv'|'social-links'|'ai-chat-entry'|'badges'|'weekly-briefing'
Also `demoStudents: Record<BandId, DemoStudent>` synthetic only.

## API additions (Logic team; base `http://localhost:8787`, dev header `x-dev-user`)
- `GET /dashboard` → { student, band, today[], upcoming[], progress:{academics, extracurriculars, goals}, streaks, highlights }
- `GET /progress?area=<athletics|gym|hackathon|academics|<subject>|<goal id>>&range=<4w|12w|term|year>` → ChartSpec
- `POST /chat` (SSE or JSON) mock agent: rule-based intent parser (no live AI yet) that answers and can emit tool calls `render_chart` (ChartSpec), `show_tasks`, `show_opportunities`. Behind agent-gateway so a real model plugs in later.
- `GET/PUT /profile/links` → { linkedin, github, instagram, portfolio, resumeUrl, …, connectedAt }
- `GET /academics`, `GET /extracurriculars` (activities with logged sessions/hours/metrics)
ChartSpec = { id, type:'bar'|'line'|'area'|'radial'|'pie'|'stacked-bar', title, subtitle?, unit?, xKey, series:[{key,label,color?}], data:Array<Record<string,string|number>>, insight:string, generatedBy:'rules'|'ai' }
Web app must also run with a bundled mock (same shapes) if API is down.
