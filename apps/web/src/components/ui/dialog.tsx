'use client';

import { Dialog as D } from 'radix-ui';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Solid scrim (no blur), panel scales in (overlay preset feel via CSS animations from tw-animate-css). */
export function DialogContent({ title, description, children, className, side }: { title: ReactNode; description?: ReactNode; children: ReactNode; className?: string; side?: 'start' }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-[rgb(15_47_99/0.4)] backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
      <D.Content
        className={cn(
          'fixed z-50 bg-popover shadow-lift outline-none',
          side === 'start'
            ? 'inset-y-2 start-2 w-[300px] rounded-[var(--radius-band)] p-4 data-[state=open]:animate-in data-[state=open]:slide-in-from-left rtl:data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:fade-out-0'
            : 'start-1/2 top-1/2 w-[min(92vw,520px)] -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2 rounded-[28px] p-6 sm:p-7 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98] data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <D.Title className="text-lg font-medium tracking-[-0.02em]">{title}</D.Title>
            {description ? <D.Description className="mt-1 text-sm text-muted-foreground">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close className="-me-1 -mt-1 inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground transition-transform hover:rotate-90 hover:text-foreground" aria-label="Close">
            <X className="size-4" />
          </D.Close>
        </div>
        {children}
      </D.Content>
    </D.Portal>
  );
}
