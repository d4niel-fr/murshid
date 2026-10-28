'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { stagger } from '@/lib/motion';
import { cn } from '@/lib/utils';

export function Page({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return <div className={cn('mx-auto w-full px-4 py-6 md:px-6 xl:px-8 xl:py-8', wide ? 'max-w-[1360px]' : 'max-w-[1200px]', className)}>{children}</div>;
}

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: ReactNode; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 xl:mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold tracking-[-0.01em]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-[68ch] text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Stagger parent for bento grids: children using `fadeUp` variants enter one after another. */
export function Bento({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div initial="hidden" animate="show" variants={stagger} className={cn('grid grid-cols-12 gap-3.5 xl:gap-4', className)}>
      {children}
    </motion.div>
  );
}

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg bg-surface-2 p-4 text-sm text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}
