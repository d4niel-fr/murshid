'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * Numeral that ticks from its old value to a new one when the value changes (a real change the user caused).
 * It shows the value straight away on first render: counting up on every page load is decoration.
 * Writes textContent directly (no React re-render per frame).
 */
export function NumberTicker({ value, decimals = 0, suffix = '', className, locale = 'en' }: { value: number; decimals?: number; suffix?: string; className?: string; locale?: 'en' | 'ar' }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduced = useReducedMotion();
  const fmt = (v: number) => new Intl.NumberFormat(locale === 'ar' ? 'ar-AE' : 'en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v) + suffix;
  const prev = useRef(value);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduced || from === value) { el.textContent = fmt(value); return; }
    const controls = animate(from, value, { duration: 0.4, ease: [0.23, 1, 0.32, 1], onUpdate: (v) => { el.textContent = fmt(v); } });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced, locale]);
  return <span ref={ref} className={`tabular ${className ?? ''}`}>{fmt(value)}</span>;
}
