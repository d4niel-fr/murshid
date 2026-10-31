# Fonts — @murshid/design

| Role | Family | Weights | Loader (Next.js) | CSS var it fills |
|---|---|---|---|---|
| Latin UI + body | **Inter** (variable) | 400, 500, 600 (700 only for g5-6 numerals) | `next/font/google` → `Inter({ subsets:["latin"], variable:"--font-inter", display:"swap" })` | `--font-sans` |
| Latin alt (optional, numerals/headings) | Geist | 500, 600 | `geist` package → `GeistSans.variable` (`--font-geist`) | fallback in `--font-sans` |
| Arabic | **IBM Plex Sans Arabic** | 400, 500, 600 | `IBM_Plex_Sans_Arabic({ subsets:["arabic"], weight:["400","500","600"], variable:"--font-plex-arabic", display:"swap" })` | `--font-arabic` |
| Arabic fallback | Noto Kufi Arabic | — | not loaded by default (system/Google fallback only) | in `--font-arabic` stack |

Decision: **Inter + IBM Plex Sans Arabic.** Plex Arabic was drawn to pair with Latin grotesques, has matching x-height feel and calm terminals; Noto Kufi is geometric/heavier and reads "signage". Geist is allowed but not required — don't load both Inter and Geist unless headings need it (cost ~30 KB).

## Wiring (apps/web/app/layout.tsx)
```tsx
import { Inter, IBM_Plex_Sans_Arabic } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const plexAr = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400","500","600"], variable: "--font-plex-arabic", display: "swap" });

<html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"} data-band={band}
      className={`${inter.variable} ${plexAr.variable}`}>
```
`tokens.css` already references `--font-inter` / `--font-plex-arabic`, and switches `--font-sans` to the Arabic stack under `[dir="rtl"]` / `:lang(ar)`. Mixed-script strings (Arabic UI showing an English course name) render correctly because both families are in each stack.

## Rules
- Weights: 400 body, 500 UI labels/buttons, 600 titles and numerals. No 300 (too thin on warm paper), no 800+.
- Numerals: `font-variant-numeric: tabular-nums` (`.tabular` class) on stats, timers, chart axes.
- Letter-spacing: titles ≥ 22px get `-0.01em`; eyebrow labels (11–12px uppercase) `+0.04em`. **Never letter-space Arabic** and never uppercase-transform it.
- Arabic gets +4% size automatically (`--scale` × 1.04) and line-height ≥ 1.6 for body.
- Western digits (0–9) in both locales by default (UAE schools use them); offer Eastern Arabic digits as a setting later via `Intl.NumberFormat("ar-AE-u-nu-arab")`.
