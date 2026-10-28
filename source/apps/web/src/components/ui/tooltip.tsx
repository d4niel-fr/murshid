'use client';

import { Tooltip as T } from 'radix-ui';
import type { ReactNode } from 'react';

export const TooltipProvider = T.Provider;

export function Tip({ label, children, side = 'top' }: { label: ReactNode; children: ReactNode; side?: 'top' | 'right' | 'bottom' | 'left' }) {
  return (
    <T.Root delayDuration={250}>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content side={side} sideOffset={8} className="z-50 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs text-foreground shadow-lift data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0">
          {label}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
