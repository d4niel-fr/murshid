'use client';

import { motion } from 'motion/react';
import { useId } from 'react';
import { spring } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Toggle group with a sliding indicator (layoutId + spring.layout). */
export function Segmented<T extends string>({ value, onChange, options, size = 'md', className, ariaLabel }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: React.ReactNode }[]; size?: 'sm' | 'md'; className?: string; ariaLabel?: string;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex items-center rounded-full bg-[color-mix(in_oklab,var(--text)_6%,transparent)] p-1', className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={cn('relative rounded-full font-medium transition-colors', size === 'sm' ? 'h-7 px-3 text-xs' : 'h-8 px-3.5 text-[0.8125rem]', active ? 'text-background' : 'text-muted-foreground hover:text-foreground')}
          >
            {active && <motion.span layoutId={`seg-${id}`} transition={spring.layout} className="absolute inset-0 rounded-full bg-foreground" />}
            <span className="relative z-10 whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
