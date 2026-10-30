# Murshid Navy — design system

One visual language for the three surfaces: the landing site (`apps/web/src/app/judges` and the other marketing pages), the student app (`apps/web/src/app/(app)`) and the teacher portal (`apps/admin`). Tokens live in `tokens.css`; Tailwind aliases in `bridge.css`.

The feel: a white page, deep-navy blocks with rounded corners, soft grey cards without borders, royal-blue actions, and one typeface set confidently. Calm, editorial, premium. Not gamified (no condensed display type, no brackets, no cut corners) and not plain (navy blocks, big type, real depth from a single 3D mark).

## Tokens

### Colour
| Token | Light | Use |
|---|---|---|
| `--deep` | `#0f2f63` | Navy blocks: sidebar, hero cards, stats bands, footer, loader |
| `--brand` | `#2563c9` | Royal blue: primary actions on white, flagship band accent |
| `--brand-light` | `#5790e6` | Accents on navy, focus ring |
| `--teal` | `#0b6e97` | Secondary accent, default band accent |
| `--spark` | `#c2e029` | Lime, tiny doses only: live dots, avatar stacks |
| `--bg` | `#ffffff` | Page |
| `--surface` | `#f4f5f7` | Cards (flat: no border, no shadow) |
| `--surface-2` / `--field` / `--popover` | `#ffffff` | Wells and chips inside cards, inputs, menus and dialogs |
| `--border` | `#e6e8ec` | Hairlines between rows |
| `--text` / `--text-muted` / `--ghost` | `#0a0a0a` / `#666c79` / `#d7dae1` | Ink, muted text (4.8:1 on cards), oversized ghost words (decorative only) |
| Status | `#1b7a50` / `#946207` / `#b23a31` | Success / warning / danger, each ≥ 4.5:1 on white and cards. Reserved: never a chart series; always with a label |

Inside any navy block add `.on-deep`: tokens flip to white-on-navy, glass surfaces become white @8–12% with a white @15% hairline. Text on navy is white at 60% or more (5.7:1); lower opacities are for decoration only.

Charts (validated with the dataviz validator against `#f4f5f7` light and `#0e1b31` dark): blue/accent, orange, aqua, yellow, magenta, violet, in that fixed order. Orange and yellow are under 3:1 on light, so charts always carry a legend and an insight line.

**No gradient glows.** Colour comes from flat fills; depth comes from the 3D mark and real content.

### Type: Onest
| Role | Size / weight / tracking |
|---|---|
| Hero title (landing) | 12.5vw (fluid), 500, uppercase, −0.02em, line-height 0.85 |
| Section title | 3rem (48px), 500, −0.025em, line-height 0.95, stacked lines |
| Page title (app) | 30–34px, 500, −0.025em |
| Card title | 15px, 500 |
| Body | 14–16px, 400, line-height 1.55 |
| Eyebrow | 12px, 500, uppercase, +0.22em, led by a 6px dot |
| Figures | 500, −0.03em, tabular numerals |

Uppercase is only for eyebrows, the wordmark and the landing hero. Navigation, buttons in the app and body copy are sentence case.

### Shape and space
Radii: 12px (chips, inner tiles), 16px (controls), 24px (cards), 32px (`--radius-band`: navy blocks), pill (buttons, badges, dots). Page inset 12px (8px on phones). Card padding 24px. Grid gap 16px.

### Motion
Springs, not curves: rises `{tension 180–200, friction 24–26}` from `y 24–40, opacity 0`; hovers `{300, 20}`. Reveals: clip-mask slide-up for headings (easeOutExpo, 700–1100ms, 90–140ms stagger). Arrows nudge 5–8px on hover. All motion respects `prefers-reduced-motion`.

## Components
| Component | Variants | States and behaviour |
|---|---|---|
| **Eyebrow** | dark (muted text, brand dot), light (white @70%, light-blue dot) | Static |
| **Pill button** | solid (ink → navy on hover), light (white on navy), accent (royal blue), outline, ghost | Trailing arrow nudges 5px; focus ring light blue; disabled 50% |
| **Arrow button** | outline circle, solid circle | Arrow scales 1.15 on hover |
| **Carousel dots** | dark, light | Active dot stretches to a 20px pill |
| **Card** | surface (grey on white), glass (on navy) | Interactive cards lift 4px on hover |
| **Numbered row** | — | `01` index, title, body, trailing circle arrow that slides on hover; hairline above and below |
| **Stats band** | — | Navy block, 4–5 cells with a white @20% hairline on top, big figure, muted label |
| **Navy hero card** | landing (full height), app (dashboard header), login (left panel) | Holds the 3D star, title, glass cards |
| **3D mark** | `Star3D` (three.js) | Slow turn, follows the pointer; a still render when motion is reduced |
| **Badge** | neutral, brand, status | Pill, 12px, never colour alone |

## Patterns
- **App shell:** white page with a 12px inset; navy sidebar card (radius 32) holding sentence-case navigation grouped Today / Learning / Growth; the active item is a white pill with navy text.
- **Tables:** inside a surface card; 12px muted headers; hairline rows; hover lifts the row to white.
- **Forms:** white fields on grey cards; 16px radius; light-blue focus ring.
- **Modals and menus:** white popover, radius 24–32, navy shadow, backdrop navy @40% with blur.

## Do / don't
| Do | Don't |
|---|---|
| Use navy blocks to frame the most important thing on a page | Add a second dark colour or a gradient glow |
| Keep cards flat and grey; let spacing separate them | Add borders and shadows to every card |
| Use one 3D mark per view, at most | Scatter 3D or decorative shapes |
| Set big type in Onest 500 with tight tracking | Use condensed, bold display faces or corner brackets |
| Use lime as a 6px accent | Fill anything large with lime |
