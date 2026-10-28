'use client';

import { animate, useInView, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Count-up numeral. Writes textContent directly (no React re-render per frame). Final value under reduced motion. */
export function NumberTicker({ value, decimals = 0, suffix = '', className, locale = 'en' }: { value: number; decimals?: number; suffix?: string; className?: string; locale?: 'en' | 'ar' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const inView = useInView(ref, { once: true });
  const fmt = (v: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) + suffix;
  const prev = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (reduced || !inView) { el.textContent = fmt(value); return; }
    const controls = animate(prev.current, value, {
      type: 'spring', stiffness: 70, damping: 20, mass: 1,
      onUpdate: (v) => { el.textContent = fmt(v); },
    });
    prev.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, inView]);
  return <span ref={ref} className={`tabular ${className ?? ''}`}>{fmt(reduced ? value : 0)}</span>;
}
