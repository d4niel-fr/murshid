# Murshid v1 Web — Design System ("Clay")

Owner: Design team · Scope: `packages/design/**`, `docs/design/**` · Contract: `docs/V1-WEB-CONTRACT.md`
Tokens: `packages/design/tokens.css` · Tailwind/shadcn adapter: `packages/design/bridge.css` · Motion: `packages/design/motion.ts` · Fonts: `packages/design/fonts.md` · Visual check: `docs/design/preview.html` (open in a browser; renders straight from tokens.css).

The old Expo green/purple theme is retired for web. Do not port any of its colours.

---

## 1. Principles

1. **Paper, ink, one colour.** Warm off-white paper, near-black ink, one accent (Clay). The accent marks the single most important thing on a surface: the primary button, the active nav item, the first chart series. If two things are accent-coloured, one of them is wrong.
2. **Calm beats clever.** A companion, not a game HUD. No gradients on surfaces, no glow, no neon, no glassmorphism. Depth comes from 1px warm borders + very soft shadows.
3. **Space is the luxury.** Generous padding (20–24px in cards, 32px page gutter), at most 6 bento cards above the fold, one idea per card.
4. **Say the insight, then show the chart.** Every chart card leads with a one-line `insight` sentence (from ChartSpec) in text, chart below.
5. **Motion explains, never decorates.** Things enter once, softly; state changes are springs ≤ 300ms; nothing loops except "thinking".
6. **Bilingual by construction.** Every layout uses logical properties (`ms-`, `pe-`, `start-`, `border-inline-start`), so RTL is a `dir` flip, not a second design.
7. **Grow with the student.** Same system, four bands: Grade 5–6 rounder, bigger and warmer; Grade 11–12 tighter and more focused (§11).

---

## 2. Palette

All values are tokens; never hard-code hex in `apps/web`. Contrast ratios computed against `--bg`/`--surface`.

### Light (`:root`)
| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAF9F7` | App background (warm paper) |
| `--surface` | `#FFFFFF` | Cards, popovers, active nav pill |
| `--surface-2` | `#F3F1EC` | Inputs, composer, hover, ring tracks, wells |
| `--border` | `#E8E4DC` | All hairlines, dividers |
| `--text` | `#1C1A17` | Primary text (16.5:1) |
| `--text-muted` | `#6F6A62` | Secondary text, axis ticks (5.1:1) |
| `--accent` | `#B9562F` | Clay. Primary buttons, active states, chart-1 |
| `--accent-fg` | `#FFFFFF` | Text on accent (4.74:1) |
| `--accent-soft` | `#F6E7DF` | Chips, selected rows, streak badge |
| `--success` | `#3F8F5F` | Done, on-track |
| `--warning` | `#C98A1B` | Due soon |
| `--danger` | `#C4483C` | Overdue, destructive |
| `--info` | `#3D6FB6` | Neutral notices |
| `--chart-1…6` | accent · `#5B7FBF` slate · `#6F9E80` sage · `#E0A43C` amber · `#C47A8C` rose · `#A39E93` warm gray | Series order |

### Dark (`.dark`)
| Token | Hex |
|---|---|
| `--bg` / `--surface` / `--surface-2` / `--border` | `#141312` / `#1C1B19` / `#252321` / `#2E2C29` |
| `--text` / `--text-muted` | `#EDEAE4` (15.5:1) / `#9B958B` (6.2:1) |
| `--accent` / `--accent-fg` / `--accent-soft` | `#E07A52` / `#141312` (6.25:1) / `#3A2219` |
| status | success `#5FB07F` · warning `#E0A94A` · danger `#E36B5E` · info `#6F9BE0` |
| charts 2–6 | `#7D9FDB` `#86B896` `#E8B65A` `#D895A6` `#7C776E` |

Dark mode note: shadows are near-invisible on dark, so `--shadow-*` add a 1px inset top highlight; cards rely on `--border`.

### Band accents (override `--accent`, `--accent-fg`, `--accent-soft`)
| Band | Name | Light accent / fg | Dark accent / fg |
|---|---|---|---|
| g5-6 | Sunrise | `#E8833A` / `#1C1A17` (dark text, 6.4:1) | `#EE8E4E` / `#141312` |
| g7-8 | Coral | `#B5452F` / `#FFFFFF` (5.44:1) | `#E36F57` / `#141312` |
| g9-10 | Clay (default) | `#B9562F` / `#FFFFFF` | `#E07A52` / `#141312` |
| g11-12 | Ink | `#2F54C8` / `#FFFFFF` (6.52:1) | `#7AA2F7` / `#0F1424` |

### Usage rules
- Primary button = `bg-primary text-primary-foreground` (bridge maps primary → `--accent`). Secondary = `bg-surface-2 text-foreground`. Ghost = transparent + `hover:bg-surface-2`.
- Composer send button uses **inverted ink** (`bg-foreground text-background`), Grok-style, not the accent — it keeps the chat screen monochrome so tool cards' colours read.
- Status colours appear only as text, 8px dots, or 10%-tint chips (`color-mix(in oklab, var(--warning) 12%, transparent)`). Never as card fills.
- Text on `--accent-soft` uses `--accent` (chip) or `--text`.

---

## 3. Typography

Inter (Latin) + IBM Plex Sans Arabic. Details and loader code in `packages/design/fonts.md`.

Type scale (bridge.css → Tailwind `text-*`). Every size is multiplied by `--scale` (band + Arabic bump).

| Tailwind | px @scale 1 | Line-height | Weight | Use |
|---|---|---|---|---|
| `text-2xs` | 11 | 1.4 | 500, uppercase, +0.04em | Card eyebrow ("TODAY") |
| `text-xs` | 12 | 1.45 | 400/500 | Meta, timestamps, axis ticks |
| `text-sm` | 14 | 1.5 | 400/500 | Dense UI, nav, list rows |
| `text-base` | 16 | 1.6 | 400 | Body, chat messages |
| `text-lg` | 18 | 1.45 | 600 | Card titles |
| `text-xl` | 22 | 1.3 | 600, −0.01em | Section titles |
| `text-2xl` | 28 | 1.2 | 600, −0.01em | Page title / greeting |
| `text-3xl` | 36 | 1.1 | 600, tabular | Stat numerals |
| `text-4xl` | 48 | 1.05 | 600, tabular | Streak number, chat empty-state wordmark |

Max line length 68ch for prose; chat column max 760px.

---

## 4. Spacing, radius, elevation

- **4px base grid.** Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 56, 72.
- Card padding: 20px (iPad) / 24px (desktop). Bento gap: 14px (iPad) / 16px (desktop). Page gutter: 24px / 32px. Section gap: 32px.
- Hit targets ≥ 40×40 desktop, ≥ 44×44 iPad (touch).
- **Radius:** `--radius-sm` (8) inputs, buttons, chips-small; `--radius` (12) list rows, popovers, tooltips; `--radius-lg` (20) cards, sheets, chart cards. Pills (composer, chips) = `9999px`. Bands change these (§11). Nested radius rule: inner = outer − padding (approx), never larger.
- **Elevation:** `--shadow-1` on all resting cards; `--shadow-2` on hover-lift, popovers, dialogs, command palette, tooltips. Never stack a shadow on a card inside a card — inner blocks use `bg-surface-2` and no shadow.

---

## 5. Layout

Constants exported as `layout` from `@murshid/design`.

### Desktop (≥1280, designed at 1440×900)
```
┌──────────┬──────────────────────────────────────────┬────────────┐
│ Sidebar  │  Main (max 1120, gutter 32)              │ Right rail │
│ 248px    │  page header: eyebrow date + H1 greeting │ 320px      │
│ (64 icon │  bento grid 12-col, gap 16               │ Upcoming   │
│  rail)   │                                          │ timeline,  │
│          │                                          │ CV/social, │
│          │                                          │ nudges     │
└──────────┴──────────────────────────────────────────┴────────────┘
```
- Sidebar: `bg-background` (same as page — no separate colour), right hairline `border-inline-end`. Logo top; nav groups: **Home, Ask Murshid, Academics, Activities, Goals, Opportunities, Profile & CV** (exact items come from `BANDS[band].nav`). Active item = `bg-surface shadow-soft` pill that **slides** between items via Motion `layoutId="nav-active"` + `spring.layout`. Footer: student avatar + band label + settings. ⌘K search field at top opens the command palette.
- Collapses to a 64px icon rail via shadcn `sidebar-07` behaviour (`collapsible="icon"`), toggle ⌘B, state persisted in cookie.
- Right rail: `border-inline-start`, sticky, own scroll. Hidden on `/chat` (chat goes full-width centered).
- 1280–1439: right rail 288px, main gutter 24.

### Tablet-wide (1024–1279: iPad Air/Pro 11 landscape 1180×820, iPad Pro 12.9 portrait 1024×1366)
- Sidebar defaults to **icon rail (64px)**; expands as overlay sheet (no reflow) on tap.
- No right rail: its contents become the last row of the bento (Upcoming full-width, CV card half).
- Bento: 2 columns (6+6 of 12) with full-width hero rows.

### Tablet-narrow (768–1023: iPad Air/Pro 11 portrait 820×1180)
- Sidebar hidden; top bar 56px with menu button (opens shadcn `Sheet`, side = start), page title, avatar.
- Bento: 2 columns, cards stack to full width when content needs > 50%.
- Chat composer pinned bottom with `env(safe-area-inset-bottom)` padding.

Under 768 (phone, later): single column; not designed in v1.

---

## 6. Dashboard composition (Home)

Header (not a card): eyebrow date (`text-2xs` muted, uppercase in Latin only) → H1 "Good afternoon, {firstName}" → one-line muted summary from `highlights[0]` ("Two things today. You're ahead on Physics.").

Bento grid, 12 columns desktop, `stagger` parent + `fadeUp` children (first 8 staggered). Widget list and order come from `BANDS[band].dashboardWidgets`; slots below are the default (g9-10):

| Row | Desktop span | iPad span | Widget id | Content |
|---|---|---|---|---|
| 1 | 8 | 12 | `today` | "Today" list: checkbox, title, subject chip, time on the end edge. Max 5 rows + "See all". Checking = check-draw (SVG pathLength 0→1, `spring.snappy`) + row text to muted with strike that grows from the start edge. |
| 1 | 4 | 12 (merged into header on iPad) | `greeting` + `streaks` | Streak: big tabular numeral (`text-4xl`, NumberTicker on mount), "days" muted, accent-soft chip ("Best this term"). 7-dot week strip below (filled = accent). |
| 2 | 6 | 12 | `progress-rings` | Three rings side by side — Academics (`chart-1`), Extracurriculars (`chart-2`), Goals (`chart-3`) — fixed colours via `areaColor`. Ring: 88px, stroke 9, round caps, track `--surface-2`, centre % in `text-lg` tabular, label below. Fill animates 0→value with `spring.fill` on mount only. Click ring → `/progress?area=…`. |
| 2 | 6 | 12 | `weekly-briefing` / `academics` | One compact chart card (bar, 6 weeks) with insight line. |
| 3 | 12 | 12 | `ai-chat-entry` | "Ask Murshid" — the pill composer (static instance) + 3 suggestion chips from band copy ("How's my gym streak?", "What's due this week?", "Plan my revision"). Focusing/typing routes to `/chat` with the draft, using shared `layoutId="composer"` so the pill visibly travels into the chat screen. |
| rail | rail | 12 | `upcoming` | Vertical timeline (Origin UI comp-530 base): date on the start side, 2px `--border` line, 8px dot (warning colour if ≤48h). Max 6. |
| rail | rail | 6 | `cv` / `social-links` | "Profile & CV": "3 of 5 links connected", linear progress (4px, accent), logo chips for LinkedIn/GitHub/Instagram/Portfolio (gray until connected, then ink), primary button "Finish profile". |
| opt | 6 | 6 | `opportunities` / `applications` / `badges` / `goals` | Band-dependent cards; same card anatomy. |

**Card anatomy:** `rounded-[var(--radius-lg)] bg-surface border shadow-soft p-6` → eyebrow (`text-2xs` muted) + optional end-aligned action (ghost icon button / "See all" link) → body. Clickable cards use `cardHover` (y −2px + shadow-1 → shadow-2 via CSS `transition: box-shadow 200ms`). Non-clickable cards don't lift.

**Empty states:** muted line + one small primary action, never illustrations larger than 96px. **Loading:** shadcn `Skeleton` with `bg-surface-2`, same geometry as content; no shimmer sweep on more than one card at a time.

---

## 7. Chat screen (`/chat`) — Grok-style

Based on assistant-ui Grok example (`apps/docs/components/examples/grok.tsx`), restyled with tokens.

**Empty state:** vertically centered column (max 760px): Murshid mark (32px accent square, radius 10) + greeting `text-2xl` "What should we work on, {name}?" → pill composer → 3–4 suggestion chips (AI Elements `Suggestion`, `bg-surface border rounded-full text-sm`). Chips use `stagger`.

**With messages:** viewport `max-w-[760px] mx-auto`, composer docked at bottom (sticky, `bg-gradient-to-t from-background` 24px fade — gradient, **not** blur), disclaimer `text-2xs muted` under it ("Murshid can make mistakes. Check important things with your teacher.").

**Composer (pill):**
- `rounded-full` when single-line, morphs to `rounded-[28px]` when multi-line (animate radius via `layout` on the wrapper, not height on children).
- `bg-surface-2 ring-1 ring-inset ring-[var(--border)]`, focus: `ring-[color-mix(in_oklab,var(--accent)_45%,var(--border))]` + `shadow-lift`.
- Leading: paperclip ghost icon (attachments, disabled in v1 if no backend). Input: `text-base`, placeholder band copy ("Ask about your progress, tasks, or goals…"), autosize up to 8 lines.
- Trailing 36px circle, **inverted ink** (`bg-foreground text-background`): **Mic when empty → ArrowUp when typing → Square (stop) while running.** Implement with `data-empty` / `data-running` on `ComposerPrimitive.Root` exactly as the Grok example, but swap icons with `AnimatePresence mode="popLayout" initial={false}` + `iconSwap` preset (scale 0.6→1, rotate −20°→0, opacity). In RTL the send arrow stays ArrowUp (no mirroring needed).
- Grok's model picker is replaced by a **mode pill** ("Quick" / "Explain step-by-step"), same expand/collapse-on-typing behaviour; hide for g5-6.

**Messages:**
- User: end-aligned bubble `bg-surface-2 rounded-[var(--radius-lg)] px-4 py-2.5 max-w-[80%]`.
- Assistant: no bubble — plain text on page, full column width, Markdown (h3 max, lists, tables with `border` rows). Leading 24px Murshid mark only on first assistant message in a group.
- Entry: `messageIn`. Streaming text never animates per token (no fade per word — it costs layout); show AI Elements `Shimmer` "Thinking…" before first token.
- Hover-only action bar under assistant messages: Copy, Retry, 👍/👎 (ghost 28px icons, `opacity` transition 150ms).

**Inline tool cards (generative UI):** registered with assistant-ui `makeAssistantToolUI` per tool name.
- `render_chart` → **ChartCard** (§8) inside the message flow, full column width, `messageIn` entry, chart animates after card settles (`animationBegin: 80`).
- `show_tasks` → compact Today-list card (same row component as dashboard), checkable inline.
- `show_opportunities` → horizontal list of 2–3 opportunity cards (title, org, deadline chip, "Save" ghost button); overflow scrolls horizontally with snap, no blur edges.
- While the tool call is running: card-shaped Skeleton with the tool's title ("Building your gym chart…").
- Card footer: `text-2xs muted` "Generated by rules" / "Generated by AI" from `generatedBy`, + "Open in Progress" link.

---

## 8. Charts (Recharts, via shadcn `chart`)

Use `ChartContainer`/`ChartTooltipContent` from shadcn chart and constants `chartTheme`, `chartColors`, `chartAnimation` from `@murshid/design`.

**ChartCard anatomy:** eyebrow (`title`, muted uppercase) → insight sentence `text-lg` 600 ink (from `ChartSpec.insight`) → optional subtitle muted → chart (`height` 180 dashboard / 220 inline chat / 320 Progress page) → legend (only if ≥2 series; dots + labels, `text-xs`, start-aligned) → range toggle (4w · 12w · Term · Year) as shadcn `ToggleGroup` with sliding indicator (`layoutId`).

**Styling rules (all types):**
- Gridlines: horizontal only, `stroke var(--border)`, `strokeDasharray "3 6"`. No vertical gridlines, no axis lines, no tick lines.
- Ticks: `text-xs` `--text-muted`, tabular numerals, tickMargin 8. Y-axis ≤ 4 ticks; hide Y axis entirely on dashboard-size cards and label the max value instead.
- Colours: series in `chartColors` order unless `series[].color` given; a single-series chart is always `--chart-1`. Progress areas always use `areaColor`.
- **Bars:** `radius [6,6,6,6]` (fully rounded, floating look), `maxBarSize 36`, category gap 30%. Stacked bars: only the top segment gets `[6,6,0,0]`. Hover cursor = `fill var(--surface-2)` rounded rect.
- **Area:** `type="monotone"`, stroke 2px series colour, fill = `<linearGradient>` series colour 28% → 0% top-to-bottom. Define one gradient per series in `<defs>` with ids `fill-${spec.id}-${key}` (unique per card).
- **Line:** stroke 2.25, `dot={false}`, `activeDot r=4` with `--surface` stroke ring. Max 3 lines.
- **Radial:** `RadialBar` `cornerRadius 999`, background track `--surface-2`, inner 72%. Value centred in `text-3xl` tabular.
- **Pie:** donut only (inner 62%), `paddingAngle 2`, `cornerRadius 6`, max 5 slices (+ "Other" in `--chart-6`).
- Tooltip: `--surface`, 1px border, `--radius`, `--shadow-2`, label muted, values tabular. No tooltip animation (`isAnimationActive={false}` on Tooltip).
- **Animated entry:** spread `chartAnimation` (700ms ease-out, begin 80ms) on series. Animate once on mount; when the range toggle changes, let Recharts tween (it interpolates data). Disable animation when `prefers-reduced-motion` (`isAnimationActive={!reduced}` via Motion's `useReducedMotion()`).
- RTL: time keeps flowing left→right in both locales (matches UAE maths/science textbooks); do **not** set `reversed` on XAxis. Mirror only card chrome (title, legend, toggle positions). In RTL the Y axis moves to the right (`orientation="right"`).

---

## 9. Motion

Presets in `packages/design/motion.ts` (plain objects for `motion/react`):

| Preset | Spec | Use |
|---|---|---|
| `spring.snappy` | stiffness 520, damping 34, mass 0.7 | Buttons, toggles, icon swaps, checkboxes |
| `spring.gentle` | stiffness 210, damping 26 | Cards, panels, sheets, messages |
| `spring.fill` | stiffness 70, damping 20 | Rings, progress bars |
| `spring.layout` | stiffness 380, damping 36 | `layoutId` moves (nav pill, composer, toggle indicator) |
| `fadeUp` | opacity 0→1, y 8→0 | Block entry |
| `stagger` | 45ms children, 40ms delay | Bento grid, lists ≤ 8 |
| `pressable` | hover y −1, tap scale 0.97 | Any button-like element |
| `cardHover`, `iconSwap`, `messageIn`, `overlay`, `chartAnimation`, `bandMotion` | see file | Specs above |

Guidelines:
- Wrap app once: `<MotionConfig reducedMotion="user" transition={spring.gentle}>`.
- Durations: micro 120–180ms, standard 280ms, large surfaces ≤ 480ms. Nothing over 700ms except chart draw.
- Page transitions: content area only, `fadeUp` with y 8 (no slide of whole shell, sidebar never animates on route change).
- Celebration (task complete streak milestones): g5-6 and g7-8 only (`bandMotion[band].celebrate`) — Magic UI `Confetti`, max 1 burst, 80 particles, ≤1.2s. g9-12: a soft accent pulse on the streak numeral instead.
- Loops allowed only for "thinking" shimmer and the recording dot on mic.

### Performance rules (60fps on iPad)
1. Animate **transform and opacity only.** Height changes via `layout` (FLIP) or `grid-template-rows: 0fr→1fr`; never animate `height`, `width`, `top`, `box-shadow` in JS. Shadow change on hover = CSS transition on one element at a time.
2. **No `backdrop-filter` on anything that scrolls or sits over scrolling content** (lists, chat viewport, sticky composer). Overlays use solid `rgb(28 26 23 / 0.32)` scrim. Max one blurred element on screen, never animated.
3. No `filter: blur()` entry animations (rules out Magic UI BlurFade, Aceternity blur reveals).
4. Stagger ≤ 8 items; lists longer than ~30 rows are virtualised and do not animate entry.
5. `will-change: transform` only during an animation (Motion does this); never in static CSS.
6. Recharts: `ResponsiveContainer` debounce 100ms; ≤ 3 charts animating at once; dashboard charts ≤ 60 points.
7. Inline SVG rings over canvas; no Lottie in v1.
8. `prefers-reduced-motion`: Motion drops transforms (keeps opacity); bridge.css zeroes CSS animations; charts `isAnimationActive=false`; NumberTicker renders final value.

---

## 10. Arabic & RTL

- `<html lang="ar" dir="rtl">` flips everything. tokens.css swaps `--font-sans` to the Plex Arabic stack and bumps `--scale` ×1.04.
- **Logical properties only** in `apps/web`: `ms/me/ps/pe/start/end`, `border-s/e`, `rounded-s/e`, `text-start/end`. Lint for `ml-`, `mr-`, `pl-`, `pr-`, `left-`, `right-`, `text-left/right` (except charts).
- Mirror directional icons (chevrons, arrows meaning "next/back", sidebar collapse) with `rtl:-scale-x-100`. Do **not** mirror: send/arrow-up, mic, play, check, clock, brand logos, charts' time axis, numbers.
- Sidebar sits on the right in RTL (shadcn sidebar `side` = `dir === "rtl" ? "right" : "left"`); right rail on the left; sheets open from the start edge.
- No uppercase or letter-spacing for Arabic eyebrows — render eyebrow in `text-xs` 600 instead of uppercase `text-2xs`.
- Line-height ≥ 1.6 for Arabic body, 1.35 for titles (Arabic ascenders/descenders).
- Mixed content: wrap Latin course codes, emails, URLs, handles in `<bdi>` / `dir="ltr"` spans; numbers in Western digits by default.
- Truncation: `text-overflow: ellipsis` works with `dir`; never truncate Arabic mid-word with JS.
- Motion: x-offsets in presets are y-only on purpose so they don't need mirroring; any x-based slide must multiply by `dir === "rtl" ? -1 : 1`.
- Test every screen at 1180×820 in both `dir` values before merge.

---

## 11. Grade bands

`data-band` on `<html>` (or a wrapper) from `bandForGrade(grade)`. Product rules (nav, widgets, AI policy, copy) live in `@murshid/grade-bands`; visual deltas below live in tokens.css.

| | g5-6 "Sunrise" | g7-8 "Coral" | g9-10 "Clay" (default) | g11-12 "Ink" |
|---|---|---|---|---|
| Accent | Tangerine `#E8833A`, dark text | Coral `#B5452F` | Clay `#B9562F` | Ink blue `#2F54C8` |
| `--scale` | 1.0625 (body ≈17px) | 1.03 | 1 | 0.985 |
| Radius sm/base/lg | 12 / 18 / 28 | 10 / 14 / 22 | 8 / 12 / 20 | 6 / 10 / 16 |
| Tone of UI copy | Warm, short, emoji allowed in chips (1 max) | Friendly | Direct, encouraging | Concise, professional |
| Dashboard density | ≤ 5 cards, bigger rings (104px), streak + badges hero | ≤ 6 cards | 6–7 cards | 7–8 cards, adds Applications/Opportunities, smaller rings (80px) |
| Icons | lucide at 22px, stroke 2 | 20px, 2 | 20px, 1.75 | 18px, 1.75 |
| Motion | Slight bounce (`bandMotion.springBounce 0.25`), confetti on milestones | Light bounce, confetti on milestones | No bounce, accent pulse | No bounce, minimal; no celebrations |
| Charts | Bars + radial only, big labels, no grid numbers (labels on bars) | Bar, line, radial | All types | All types incl. stacked + 12w/term/year ranges by default |
| Chat | Mode pill hidden; suggestion chips always visible; larger composer (52px) | Chips visible | Standard | Standard + keyboard hints (⌘K, ⌘↵) |
| CV / social card | Hidden (guardian-managed) | "My portfolio" (no LinkedIn) | Full | Full + "Export CV" primary |

Rule: bands change **accent, scale, radius, density, tone**. They never change layout structure, component anatomy, or the neutral palette — one product, four ages.

---

## 12. Implementation checklist (for Implement team)
1. `globals.css`: import order as in bridge.css header; delete shadcn colour/theme blocks.
2. `layout.tsx`: fonts per fonts.md; `dir`, `lang`, `data-band`, `class="dark"` (next-themes `attribute="class"`).
3. `<MotionConfig reducedMotion="user">` at root.
4. Install components from `docs/design/COMPONENTS.md`, then restyle to tokens (remove hard-coded hex from Grok example and Magic UI defaults like `gaugePrimaryColor="rgb(79 70 229)"`).
5. Verify: light/dark × 4 bands × LTR/RTL at 1440×900 and 1180×820; Performance panel shows no long tasks > 50ms during dashboard entry.
