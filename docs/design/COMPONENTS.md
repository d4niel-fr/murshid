# Murshid v1 Web — Chosen components

All installs run **inside `apps/web`** (Implement team only), after `npx shadcn@latest init` with Tailwind v4. Everything lands as source in `components/ui` and must be restyled to tokens (`packages/design/tokens.css` via `bridge.css`): strip hard-coded hex/indigo defaults, use `bg-surface`, `bg-primary`, `var(--chart-n)` etc.

Registry notes:
- `@magicui/*` and `@react-bits/*` are namespaces built into the shadcn CLI directory (no config).
- 21st.dev installs need `API_KEY_21ST` (free key at https://21st.dev/mcp, daily limit). They are **reference only** in v1 — we build from shadcn blocks and borrow layout ideas, so nothing ships blocked on a key.
- Origin UI now lives at coss.com/origin; registry JSON URLs below install directly.

## Shell & navigation
| Component | Source | Install | Where used |
|---|---|---|---|
| Sidebar (icon-collapsible) | https://ui.shadcn.com/blocks/sidebar#sidebar-07 | `npx shadcn@latest add sidebar-07` | App shell left nav; collapses to 64px rail (⌘B). Active pill via Motion `layoutId`. |
| Left + right sidebars (pattern) | https://ui.shadcn.com/blocks/sidebar#sidebar-15 | `npx shadcn@latest add sidebar-15` | Reference for desktop right rail (Upcoming, CV). Use its `SidebarRight` structure; drop calendars. |
| Command palette | https://ui.shadcn.com/docs/components/command | `npx shadcn@latest add command dialog` | ⌘K: jump to pages, "Ask Murshid: …" (prefills chat), recent tasks. `overlay` motion preset, solid scrim. |
| Sheet | https://ui.shadcn.com/docs/components/sheet | `npx shadcn@latest add sheet` | Tablet-narrow nav drawer (side = start). |
| Icon-rail app shell (reference) | https://21st.dev/@7ovr/components/app-shell-3 | `npx shadcn@latest add "https://21st.dev/r/7ovr/app-shell-3?api_key=$API_KEY_21ST"` | Reference only: top bar + ⌘K + icon rail proportions for iPad. |

## Dashboard
| Component | Source | Install | Where used |
|---|---|---|---|
| Card, Badge, Avatar, Skeleton, Tooltip, Progress, Checkbox, Tabs, Toggle Group, Dropdown Menu, Scroll Area, Separator | https://ui.shadcn.com/docs/components | `npx shadcn@latest add card badge avatar skeleton tooltip progress checkbox tabs toggle-group dropdown-menu scroll-area separator` | Base primitives everywhere. |
| Bento Grid | https://magicui.design/docs/components/bento-grid | `npx shadcn@latest add @magicui/bento-grid` | Home grid container. Keep the grid; **remove** its hover-reveal CTA and background gradients; use our card anatomy (DESIGN §6). |
| Animated Circular Progress Bar | https://magicui.design/docs/components/animated-circular-progress-bar | `npx shadcn@latest add @magicui/animated-circular-progress-bar` | Base for progress rings (academics / extracurriculars / goals). Replace its CSS transition with Motion `spring.fill` on `strokeDashoffset`, colours from `areaColor`, track `--surface-2`, round caps. |
| Number Ticker | https://magicui.design/docs/components/number-ticker | `npx shadcn@latest add @magicui/number-ticker` | Streak numeral, stat tiles, ring centre %. Renders final value under reduced motion. |
| Confetti | https://magicui.design/docs/components/confetti | `npx shadcn@latest add @magicui/confetti` | g5-6 / g7-8 milestone celebrations only (1 burst, ≤80 particles). |
| Timeline | https://coss.com/origin/timeline (comp-530) | `npx shadcn@latest add https://coss.com/origin/r/comp-530.json` | "Upcoming" rail / card. Restyle line `--border`, dot warning if ≤48h. |
| Stats Bento (reference) | https://21st.dev/@uilayout.contact/components/stats-bento | `npx shadcn@latest add "https://21st.dev/r/uilayout.contact/stats-bento?api_key=$API_KEY_21ST"` | Reference only for mixed-size stat cards (g11-12 dense dashboard). |

## Charts
| Component | Source | Install | Where used |
|---|---|---|---|
| shadcn Chart (Recharts wrapper) | https://ui.shadcn.com/docs/components/chart · gallery https://ui.shadcn.com/charts | `npx shadcn@latest add chart` | `ChartCard` for every ChartSpec type (bar, line, area, radial, pie, stacked-bar) on Dashboard, Progress pages and inline in chat. Apply `chartTheme` + `chartAnimation` from `@murshid/design`. Start from gallery "Bar Chart – Default", "Area Chart – Gradient", "Radial Chart – Text". |

## Chat (assistant-ui + AI Elements)
| Component | Source | Install | Where used |
|---|---|---|---|
| assistant-ui Thread | https://www.assistant-ui.com/docs | `npx assistant-ui@latest add thread` (adds `@assistant-ui/react`) | `/chat` runtime, messages, composer primitives, tool UI registry (`makeAssistantToolUI`) for `render_chart`, `show_tasks`, `show_opportunities`. |
| Grok clone (pattern + source) | https://www.assistant-ui.com/examples/grok · source https://github.com/assistant-ui/assistant-ui/blob/main/apps/docs/components/examples/grok.tsx | copy file into `components/chat/grok-composer.tsx` | Centered empty state, `rounded-full` pill composer, `data-empty`/`data-running` Mic⇄Send⇄Stop swap, hover action bars. Replace its hex palette (`#fdfdfd`, `#f8f8f8`, `#e5e5e5`, `#0d0d0d`) with `bg-background`, `bg-surface-2`, `ring-border`, `bg-foreground`; replace model picker with mode pill. |
| assistant-ui Thread List (optional) | https://www.assistant-ui.com/docs | `npx assistant-ui@latest add thread-list` | Chat history in sidebar sub-section (v1 optional). |
| AI Elements Suggestion | https://ai-sdk.dev/elements/components/suggestion | `npx ai-elements@latest add suggestion` | Prompt chips on chat empty state and dashboard "Ask Murshid" card. Presentational only (we don't use AI SDK `useChat`). |
| AI Elements Shimmer | https://ai-sdk.dev/elements/components/shimmer | `npx ai-elements@latest add shimmer` | "Thinking…" text before first token; tool-card loading label. |
| AI Elements Tool (reference) | https://ai-sdk.dev/elements/components/tool | `npx ai-elements@latest add tool` | Reference for tool-call collapsed/expanded states; use only its header styling in our ChartCard loading state. |

## Onboarding
| Component | Source | Install | Where used |
|---|---|---|---|
| Stepper | https://coss.com/origin/stepper | browse page, then `npx shadcn@latest add https://coss.com/origin/r/<comp-id>.json` for the horizontal numbered variant | Onboarding: language → grade → goals → connect links. One step per screen, centered card max 560px, `fadeUp` between steps (y only). |
| Input OTP / Form / Select / Radio Group | https://ui.shadcn.com/docs/components | `npx shadcn@latest add input-otp form select radio-group` | Onboarding fields, guardian code. |

## Considered and rejected
| Component | Why not |
|---|---|
| Magic UI Blur Fade, Aceternity blur/spotlight reveals | `filter: blur` animation — breaks 60fps rule on iPad. |
| Magic UI Border Beam, Shine Border, Neon Gradient Card, Aurora Text, Particles | Decorative glow/loops; off-brand for "calm". |
| Aceternity sidebar | Hover-expand width animation (animates `width`); shadcn sidebar-07 does the same job with a CSS-variable transition and better a11y. |
| React Bits Count Up (`npx shadcn@latest add @react-bits/CountUp-TS-TW`) | Equivalent to Magic UI Number Ticker; pick one — Number Ticker chosen. |
| Glass/backdrop-blur headers from 21st dashboards | Violates no-blur-on-scroll rule. |

Verification status: install commands for shadcn blocks, Magic UI (`@magicui/…`), React Bits, AI Elements, assistant-ui `add thread`, Origin comp-530 and 21st.dev were read off each source's own page on 2026-10-10. `npx assistant-ui@latest add thread-list` and the Origin stepper comp id were not individually confirmed — check the page before running.
