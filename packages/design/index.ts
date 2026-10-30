/**
 * @murshid/design — JS entry. CSS lives in tokens.css (+ bridge.css).
 *   import "@murshid/design/tokens.css";
 *   import { spring, fadeUp, stagger, pressable, chartColors } from "@murshid/design";
 */
export * from "./motion";

export type BandId = "g5-6" | "g7-8" | "g9-10" | "g11-12";

/** Every CSS variable tokens.css defines (contract + --scale). */
export const TOKEN_NAMES = [
  "--bg", "--surface", "--surface-2", "--border",
  "--text", "--text-muted",
  "--accent", "--accent-fg", "--accent-soft",
  "--success", "--warning", "--danger", "--info",
  "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6",
  "--radius-sm", "--radius", "--radius-lg",
  "--shadow-1", "--shadow-2",
  "--font-sans", "--font-arabic",
  "--scale",
] as const;
export type TokenName = (typeof TOKEN_NAMES)[number];

/** CSS var reference helper: v("--accent") → "var(--accent)". */
export const v = (name: TokenName) => `var(${name})` as const;

/** Series colours for Recharts. SVG fill/stroke accept var() so band + dark mode apply automatically. */
export const chartColors = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
] as const;

/** Recharts styling defaults (see DESIGN.md §Charts). */
export const chartTheme = {
  grid: { stroke: "var(--border)", strokeDasharray: "3 6", vertical: false },
  axis: {
    tick: { fill: "var(--text-muted)", fontSize: 12 },
    axisLine: false,
    tickLine: false,
    tickMargin: 8,
  },
  bar: { radius: [6, 6, 6, 6] as [number, number, number, number], maxBarSize: 36 },
  stackedBarTop: [6, 6, 0, 0] as [number, number, number, number],
  line: { strokeWidth: 2.25, dot: false, activeDot: { r: 4, strokeWidth: 2, stroke: "var(--surface)" } },
  area: { strokeWidth: 2, fillOpacityTop: 0.28, fillOpacityBottom: 0 },
  radial: { innerRadius: "72%", outerRadius: "100%", cornerRadius: 999, background: { fill: "var(--surface-2)" } },
  cursor: { fill: "var(--surface-2)", stroke: "var(--border)" },
  tooltip: {
    contentStyle: {
      background: "var(--surface)",
      border: "1px solid var(--border)",
      borderRadius: "var(--radius)",
      boxShadow: "var(--shadow-2)",
      color: "var(--text)",
      padding: "8px 12px",
      fontSize: 13,
    },
    labelStyle: { color: "var(--text-muted)", marginBottom: 4 },
  },
  height: { inline: 220, card: 180, full: 320 },
} as const;

/** Map dashboard progress areas to fixed series colours so they never change meaning. */
export const areaColor = {
  academics: "var(--chart-1)",
  extracurriculars: "var(--chart-2)",
  goals: "var(--chart-3)",
} as const;

/** Design-side band metadata (product rules live in @murshid/grade-bands). */
export const bandTheme: Record<BandId, { name: string; accentLight: string; accentDark: string; scale: number; radius: number }> = {
  "g5-6": { name: "Sunrise", accentLight: "#e8833a", accentDark: "#ee8e4e", scale: 1.0625, radius: 18 },
  "g7-8": { name: "Coral", accentLight: "#b5452f", accentDark: "#e36f57", scale: 1.03, radius: 14 },
  "g9-10": { name: "Clay", accentLight: "#b9562f", accentDark: "#e07a52", scale: 1, radius: 12 },
  "g11-12": { name: "Ink", accentLight: "#2f54c8", accentDark: "#7aa2f7", scale: 0.985, radius: 10 },
};

/** Layout constants (px) shared by web shell. */
export const layout = {
  sidebar: { expanded: 248, collapsed: 64 },
  rightRail: 320,
  contentMax: 1120,
  chatMax: 760,
  gutter: { desktop: 32, ipad: 24 },
  gap: { desktop: 16, ipad: 14 },
  breakpoints: { ipadPortrait: 768, ipadLandscape: 1024, desktop: 1280, wide: 1440 },
} as const;
