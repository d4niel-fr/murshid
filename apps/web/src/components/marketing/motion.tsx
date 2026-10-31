'use client';

/**
 * Motion primitives for the marketing pages. Everything that moves is a damped spring
 * (`tension` → stiffness, `friction` → damping, mass 1 — the react-spring model), or a short tween
 * where a duration is the point. Reveals play once, when their block first enters the viewport,
 * and wait for the intro loader if the page has one.
 */

import { motion, useInView, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';

export const EASE = {
  entrance: [0.2, 0, 0, 1] as const,
  outExpo: [0.16, 1, 0.3, 1] as const,
  outQuart: [0.165, 0.84, 0.44, 1] as const,
  plate: [0.33, 0, 0, 1] as const,
  inOutCubic: [0.65, 0, 0.35, 1] as const,
};

/** react-spring's {tension, friction} as a Motion spring. */
export const spring = (tension: number, friction: number) => ({ type: 'spring' as const, stiffness: tension, damping: friction, mass: 1 });

/** Named configs, as the references ship them. */
export const SPRING = {
  reveal: spring(90, 26),
  item: spring(170, 24),
  sheet: spring(190, 26),
  figure: spring(200, 24),
  type: spring(210, 24),
  copy: spring(110, 26),
  hover: spring(300, 20),
  lift: spring(300, 22),
} as const;

/** The intro loader flips this; reveals in the first screen wait for it. */
export const ReadyContext = createContext(true);
export const useReady = () => useContext(ReadyContext);

/** True on a real pointer with room for hover (hover is off at 768 and below). */
export function useCanHover() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(hover: hover) and (min-width: 769px)');
    const sync = () => setOk(m.matches);
    sync();
    m.addEventListener('change', sync);
    return () => m.removeEventListener('change', sync);
  }, []);
  return ok;
}

/** In view (once) AND the page is ready. `margin` insets the viewport like an IO rootMargin. */
export function useShown<T extends Element>(margin = '0px 0px -12% 0px', gate = true): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { once: true, margin: margin as `${number}px` });
  const ready = useReady();
  return [ref, inView && ready && gate];
}

type TextTag = 'span' | 'div' | 'p' | 'h1' | 'h2' | 'h3';

/**
 * Word-by-word reveal: each word rises 0.35em and fades in on its own spring.
 * No overflow clip — the 0.95 display leading would shave descenders. A plain copy stays for
 * assistive technology; the animated words are hidden from it.
 */
export function Words({
  text, as: Tag = 'span', className, style, stagger = 110, delay = 0, config = SPRING.reveal, gap = '0.3em', gate = true, margin, justify = 'flex-start', end,
}: {
  text: string; as?: TextTag; className?: string; style?: CSSProperties; stagger?: number; delay?: number;
  config?: ReturnType<typeof spring>; gap?: string; gate?: boolean; margin?: string; justify?: CSSProperties['justifyContent']; end?: ReactNode;
}) {
  const [ref, on] = useShown<HTMLSpanElement>(margin, gate);
  const reduce = useReducedMotion();
  const words = text.split(' ');
  return (
    <Tag className={className} style={style}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden style={{ display: 'flex', flexWrap: 'wrap', columnGap: gap, justifyContent: justify }}>
        {words.map((w, i) => (
          <motion.span key={`${w}-${i}`} className="inline-block" initial={reduce ? false : { opacity: 0, y: '0.35em' }}
            animate={on || reduce ? { opacity: 1, y: '0em' } : { opacity: 0, y: '0.35em' }}
            transition={{ ...config, delay: (delay + i * stagger) / 1000 }}>
            {w}{i === words.length - 1 ? end : null}
          </motion.span>
        ))}
      </span>
    </Tag>
  );
}

/** Letter-by-letter reveal (figures, years, nav rows). */
export function Letters({
  text, className, style, stagger = 26, delay = 0, config = SPRING.figure, gate = true, margin,
}: { text: string; className?: string; style?: CSSProperties; stagger?: number; delay?: number; config?: ReturnType<typeof spring>; gate?: boolean; margin?: string }) {
  const [ref, on] = useShown<HTMLSpanElement>(margin, gate);
  const reduce = useReducedMotion();
  return (
    <span className={className} style={style}>
      <span className="sr-only">{text}</span>
      <span ref={ref} aria-hidden className="inline-flex whitespace-pre">
        {[...text].map((ch, i) => (
          <motion.span key={i} className="inline-block" initial={reduce ? false : { opacity: 0, y: '0.3em' }}
            animate={on || reduce ? { opacity: 1, y: '0em' } : { opacity: 0, y: '0.3em' }}
            transition={{ ...config, delay: (delay + i * stagger) / 1000 }}>
            {ch}
          </motion.span>
        ))}
      </span>
    </span>
  );
}

/**
 * Line-by-line clip-mask reveal: each line slides up from behind its own edge
 * (easeOutExpo). Used for the giant wordmark and stacked statements.
 */
export function Lines({
  lines, className, lineClassName, stagger = 90, delay = 0, duration = 900, gate = true, margin, from = '110%',
}: { lines: ReactNode[]; className?: string; lineClassName?: string; stagger?: number; delay?: number; duration?: number; gate?: boolean; margin?: string; from?: string }) {
  const [ref, on] = useShown<HTMLSpanElement>(margin, gate);
  const reduce = useReducedMotion();
  return (
    <span ref={ref} className={className}>
      {lines.map((l, i) => (
        <span key={i} className={`block overflow-hidden pb-[0.08em] ${lineClassName ?? ''}`}>
          <motion.span className="block" initial={reduce ? false : { y: from, opacity: 0 }} animate={on || reduce ? { y: '0%', opacity: 1 } : { y: from, opacity: 0 }}
            transition={{ duration: duration / 1000, ease: EASE.outExpo, delay: (delay + i * stagger) / 1000 }}>
            {l}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** A block that rises into place the first time it is seen. */
export function Rise({
  children, className, style, y = '0.75rem', delay = 0, config = SPRING.reveal, gate = true, margin, as = 'div', scale,
}: { children?: ReactNode; className?: string; style?: CSSProperties; y?: string | number; delay?: number; config?: ReturnType<typeof spring>; gate?: boolean; margin?: string; as?: 'div' | 'li' | 'article' | 'figure'; scale?: number }) {
  const [ref, on] = useShown<HTMLDivElement>(margin, gate);
  const reduce = useReducedMotion();
  const Comp = motion[as] as typeof motion.div;
  const hidden = { opacity: 0, y, ...(scale ? { scale } : {}) };
  const shown = { opacity: 1, y: 0, ...(scale ? { scale: 1 } : {}) };
  return (
    <Comp ref={ref} className={className} style={style} initial={reduce ? false : hidden} animate={on || reduce ? shown : hidden} transition={{ ...config, delay: delay / 1000 }}>
      {children}
    </Comp>
  );
}

/**
 * A scroll scrub: maps an element's crossing of the viewport onto a value.
 * `offset` follows Motion's useScroll ("start end" = element top meets viewport bottom).
 */
export function useScrub<T extends HTMLElement>(
  ref: RefObject<T | null>, range: [string | number, string | number], offset: [string, string] = ['start end', 'end start'],
): MotionValue<string | number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { scrollYProgress } = useScroll({ target: ref, offset: offset as any });
  return useTransform(scrollYProgress, [0, 1], range);
}
