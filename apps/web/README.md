# Murshid web (desktop + iPad)

Next.js 16 (App Router, webpack build) · Tailwind v4 · Motion · Recharts · assistant-ui · radix-ui (shadcn-style components in `src/components/ui`).

```
pnpm --filter web dev        # http://localhost:3000
pnpm --filter web build      # next build --webpack
pnpm --filter web start
pnpm --filter web test       # vitest: intent parser, mock client, API normalisers
MURSHID_API_LIVE=http://localhost:8787 pnpm --filter web test   # + live contract check against apps/api
```

Why webpack: workspace packages (`@murshid/grade-bands`) import `./x.js` for `.ts` files; Turbopack in Next 16 can't alias extensions, webpack does (`next.config.ts`).

## Data
- `src/lib/api.ts` typed client. Mode **auto** calls the API (`NEXT_PUBLIC_MURSHID_API`, default `http://localhost:8787`, header `x-dev-user-id: demo-g5|g7|g9|g11` per band) with a short timeout and falls back to the bundled mock in identical shapes. Mode **mock** never hits the network (Settings → Data source).
- `src/lib/normalize.ts` maps the Logic team's v1 payloads (`apps/api/src/v1/schemas.ts`) to the contract shapes.
- `src/lib/mock/data.ts` builds a deterministic world per band from `@murshid/grade-bands` demo students (+ a synthetic year of history before the term).
- `src/lib/progress.ts` ChartSpec builder (mirrors `GET /progress`); `src/lib/intent.ts` rule-based chat intent parser (mirrors `POST /chat`).
- Local user actions (ticks, logged sessions, goals, applications, links, planner blocks) live in localStorage per band (`src/lib/merge.ts`).

## Design
Tokens + bridge from `@murshid/design` (`tokens.css`, `bridge.css`, `motion.ts`, `chartTheme`). Prefs (band, locale, theme, data mode, sidebar) are a cookie so SSR renders the right `dir`/`lang`/`data-band`/`.dark` with no flash.
