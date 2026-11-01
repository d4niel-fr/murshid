'use client';

import { motion, type HTMLMotionProps } from 'motion/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { cardHover, fadeUp } from '@/lib/motion';
import { cn } from '@/lib/utils';

/** Bento card (DESIGN §6). `interactive` adds the hover lift. Enters with fadeUp when inside a stagger parent. */
export function Card({ className, interactive, children, ...props }: HTMLMotionProps<'section'> & { interactive?: boolean }) {
  return (
    <motion.section
      variants={fadeUp}
      {...(interactive ? cardHover : {})}
      className={cn('card relative flex min-w-0 flex-col p-5 xl:p-6', interactive && 'lift', className)}
      {...props}
    >
      {children}
    </motion.section>
  );
}

export function CardHeader({ title, action, icon, className }: { title: ReactNode; action?: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-5 flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2', className)}>
      <div className="flex min-w-0 max-w-full items-center gap-2">
        {icon && <span className="text-muted-foreground [&_svg]:size-4">{icon}</span>}
        <h2 className="card-title truncate">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Muted({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}
