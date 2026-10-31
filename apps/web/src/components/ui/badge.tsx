import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

const tones = {
  neutral: 'bg-surface-2 text-foreground',
  navy: 'bg-[var(--deep)] text-white',
  brand: 'bg-brand-soft text-primary',
  success: 'tint-success',
  warning: 'tint-warning',
  danger: 'tint-danger',
  info: 'tint-info',
  outline: 'border border-border text-muted-foreground',
} as const;

export function Badge({ className, tone = 'neutral', ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.7188rem] font-medium leading-none whitespace-nowrap', tones[tone], className)} {...props} />;
}
