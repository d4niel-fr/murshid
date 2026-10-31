'use client';

/**
 * Smooth scroll (Lenis), scroll lock for the loader / menu / modals, and the adaptive rem grid
 * above 1920px.
 */

import Lenis from 'lenis';
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react';

type Scroller = { lock: () => void; unlock: () => void; to: (target: string | HTMLElement | number) => void };
const ScrollContext = createContext<Scroller>({ lock: () => {}, unlock: () => {}, to: () => {} });
export const useScroller = () => useContext(ScrollContext);

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function SmoothScroll({ children }: { children: ReactNode }) {
  const lenis = useRef<Lenis | null>(null);
  const locks = useRef(0);

  useIso(() => {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const l = new Lenis({ smoothWheel: true, autoRaf: false });
    lenis.current = l;
    let id = 0;
    const raf = (t: number) => { l.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); l.destroy(); lenis.current = null; };
  }, []);

  const lock = useCallback(() => {
    locks.current += 1;
    lenis.current?.stop();
    const h = document.documentElement.style;
    h.position = 'relative'; h.overflow = 'hidden'; h.height = '100%';
  }, []);
  const unlock = useCallback(() => {
    locks.current = Math.max(0, locks.current - 1);
    if (locks.current) return;
    lenis.current?.start();
    const h = document.documentElement.style;
    h.removeProperty('position'); h.removeProperty('overflow'); h.removeProperty('height');
  }, []);
  const to = useCallback((target: string | HTMLElement | number) => {
    const el = typeof target === 'string' ? document.querySelector<HTMLElement>(target) : target;
    if (el === null) return;
    if (lenis.current) lenis.current.scrollTo(el as HTMLElement | number, { duration: 1.2 });
    else if (typeof el === 'number') window.scrollTo({ top: el, behavior: 'smooth' });
    else el.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Adaptive grid: above 1920 the root keeps scaling up, damped (below it the CSS bands drive).
  useEffect(() => {
    const apply = () => {
      const w = window.innerWidth;
      const reduction = ((1920 - w) / 1920) * 100 * 0.6666;
      const size = 16 - (16 * reduction) / 100;
      if (size > 16) document.documentElement.style.fontSize = `${size}px`;
      else document.documentElement.style.removeProperty('font-size');
    };
    apply();
    window.addEventListener('resize', apply);
    return () => { window.removeEventListener('resize', apply); document.documentElement.style.removeProperty('font-size'); };
  }, []);

  const value = useMemo(() => ({ lock, unlock, to }), [lock, unlock, to]);
  return <ScrollContext.Provider value={value}>{children}</ScrollContext.Provider>;
}
