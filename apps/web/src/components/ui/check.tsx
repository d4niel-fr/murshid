'use client';

import { motion } from 'motion/react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Round checkbox with a check that draws in (pathLength 0→1). */
export function Check({ checked, onChange, label, className }: { checked: boolean; onChange: (v: boolean) => void; label: string; className?: string }) {
  return (
    <motion.button
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      whileTap={{ scale: 0.85 }}
      transition={spring.snappy}
      className={cn('relative inline-flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200', checked ? 'border-primary bg-primary' : 'border-[color-mix(in_oklab,var(--text-muted)_60%,transparent)] hover:border-primary', className)}
    >
      <svg viewBox="0 0 24 24" className="size-3.5" fill="none" aria-hidden>
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          stroke="var(--accent-fg)" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={spring.snappy}
        />
      </svg>
      {checked && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary"
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      )}
    </motion.button>
  );
}
