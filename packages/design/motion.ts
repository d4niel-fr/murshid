/**
 * @murshid/design — motion presets for `motion/react` (Motion v11+).
 * Plain objects, zero deps. Contract names: spring.snappy, spring.gentle, fadeUp, stagger, pressable.
 *
 * Rules (see docs/design/DESIGN.md §Motion):
 *  - Animate transform + opacity only. Never width/height/top/left/filter on hot paths.
 *  - Wrap the app in <MotionConfig reducedMotion="user">. With reduced motion Motion drops
 *    transforms and keeps opacity, so every preset below still reads correctly.
 *  - Entry animations run once per mount; never on scroll-into-view inside long lists.
 */

/* ── Springs ─────────────────────────────────────────────── */
export const spring = {
  /** Buttons, toggles, icon swaps, tabs indicator. Settles ≈180ms, no visible overshoot. */
  snappy: { type: "spring", stiffness: 520, damping: 34, mass: 0.7 },
  /** Cards, panels, sheets, page content. Settles ≈420ms, soft. */
  gentle: { type: "spring", stiffness: 210, damping: 26, mass: 1 },
  /** Progress rings / bars / numbers filling. Slow and calm. */
  fill: { type: "spring", stiffness: 70, damping: 20, mass: 1 },
  /** Layout (layoutId) moves: sidebar active pill, composer resize. */
  layout: { type: "spring", stiffness: 380, damping: 36, mass: 0.9 },
} as const;

/* ── Tweens (when a spring is wrong: fades, colour, Recharts) ───── */
export const ease = {
  outSoft: [0.22, 1, 0.36, 1],
  inOutSoft: [0.65, 0, 0.35, 1],
} as const;

export const duration = {
  instant: 0.12,
  fast: 0.18,
  base: 0.28,
  slow: 0.48,
  chart: 0.7,
} as const;

/* ── Variants ───────────────────────────────────────────── */

/** Card / block entry. Use with initial="hidden" animate="show". */
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { ...spring.gentle, opacity: { duration: duration.base, ease: ease.outSoft } },
  },
  exit: { opacity: 0, y: -4, transition: { duration: duration.fast, ease: ease.outSoft } },
} as const;

/** Parent of fadeUp children (bento grid, list of tasks). Max ~8 children staggered; rest appear together. */
export const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.045, delayChildren: 0.04 } },
} as const;

/** Spread onto any tappable motion element: <motion.button {...pressable} />. */
export const pressable = {
  whileHover: { y: -1 },
  whileTap: { scale: 0.97 },
  transition: spring.snappy,
} as const;

/* ── Extras used by the specs ───────────────────────────── */

/** Lift for clickable bento cards (hover only; pair with shadow-1 → shadow-2 CSS transition). */
export const cardHover = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.99 },
  transition: spring.gentle,
} as const;

/** Composer trailing slot: Mic ⇄ Send ⇄ Stop. Use inside <AnimatePresence mode="popLayout" initial={false}>. */
export const iconSwap = {
  initial: { opacity: 0, scale: 0.6, rotate: -20 },
  animate: { opacity: 1, scale: 1, rotate: 0, transition: spring.snappy },
  exit: { opacity: 0, scale: 0.6, rotate: 20, transition: { duration: duration.instant } },
} as const;

/** Chat message bubble / inline tool card appearing. */
export const messageIn = {
  initial: { opacity: 0, y: 6, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: spring.gentle },
} as const;

/** Overlay (dialog, command palette). Backdrop uses opacity only — no blur. */
export const overlay = {
  backdrop: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: duration.fast } },
    exit: { opacity: 0, transition: { duration: duration.fast } },
  },
  panel: {
    initial: { opacity: 0, scale: 0.98, y: 6 },
    animate: { opacity: 1, scale: 1, y: 0, transition: spring.snappy },
    exit: { opacity: 0, scale: 0.98, transition: { duration: duration.instant } },
  },
} as const;

/** Recharts props: spread onto <Bar>/<Area>/<Line>/<RadialBar>. */
export const chartAnimation = {
  isAnimationActive: true,
  animationBegin: 80,
  animationDuration: 700,
  animationEasing: "ease-out",
} as const;

/** Per-band multiplier for stagger/spring feel. g5-6 bouncier, g11-12 quieter. */
export const bandMotion = {
  "g5-6": { springBounce: 0.25, stagger: 0.06, celebrate: true },
  "g7-8": { springBounce: 0.15, stagger: 0.05, celebrate: true },
  "g9-10": { springBounce: 0, stagger: 0.045, celebrate: false },
  "g11-12": { springBounce: 0, stagger: 0.035, celebrate: false },
} as const;

export type SpringName = keyof typeof spring;
