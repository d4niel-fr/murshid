'use client';

import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { NumberTicker } from './number-ticker';

/** SVG ring; the fill (pathLength) animates when the value changes, not on mount. */
export function ProgressRing({ value, size = 88, stroke = 9, color = 'var(--chart-1)', label, locale = 'en' }: { value: number; size?: number; stroke?: number; color?: string; label?: string; locale?: 'en' | 'ar' }) {
  const r = (size - stroke) / 2;
  const v = Math.max(0, Math.min(100, value)) / 100;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
            initial={false}
            animate={{ pathLength: v }}
            transition={spring.fill}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <NumberTicker value={Math.round(value)} suffix="%" locale={locale} className="text-[1.125rem] font-medium tracking-[-0.03em]" />
        </div>
      </div>
      {label && <span className="text-[0.8125rem] text-muted-foreground">{label}</span>}
    </div>
  );
}
