'use client';

import { motion } from 'motion/react';
import { spring } from '@/lib/motion';

/** Linear progress: scaleX on an inner bar (transform only). */
export function ProgressBar({ value, color = 'var(--accent)', className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-2 ${className}`}>
      <motion.div
        className="h-full w-full origin-left rounded-full rtl:origin-right"
        style={{ background: color }}
        initial={false}
        animate={{ scaleX: Math.max(0, Math.min(1, value / 100)) }}
        transition={spring.fill}
      />
    </div>
  );
}
