'use client';

import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Nothing here yet: the mascot, a line on what goes here, and the action that fills it. */
export function EmptyState({ title, children, action, className, compact }: { title: string; children?: ReactNode; action?: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-6 text-center', compact ? 'py-8' : 'py-14', className)}>
      <span className="text-[var(--deep)]"><MyMascot size={compact ? 64 : 88} mood="sleepy" track={false} /></span>
      <p className="text-[1.0625rem] font-medium">{title}</p>
      {children && <p className="max-w-[44ch] text-sm leading-relaxed text-muted-foreground">{children}</p>}
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Something failed: what happened in plain words, and a retry. */
export function ErrorState({ title, detail, onRetry, className }: { title?: string; detail?: string; onRetry?: () => void; className?: string }) {
  const { tx } = useApp();
  return (
    <div role="alert" className={cn('flex flex-col items-center gap-3 rounded-[var(--radius-lg)] bg-surface px-6 py-12 text-center', className)}>
      <span className="text-[var(--deep)]"><MyMascot size={72} mood="thinking" track={false} /></span>
      <p className="text-[1.0625rem] font-medium">{title ?? tx('That didn’t load', 'تعذّر التحميل')}</p>
      <p className="max-w-[46ch] text-sm leading-relaxed text-muted-foreground">{detail ?? tx('Check your connection and try again. Nothing you entered has been lost.', 'تحقق من اتصالك وحاول مرة أخرى. لم يُفقد أي شيء أدخلته.')}</p>
      {onRetry && <Button variant="secondary" onClick={onRetry}><RotateCcw />{tx('Try again', 'حاول مرة أخرى')}</Button>}
    </div>
  );
}

/** Page loading: the mascot thinking over a few skeleton blocks. */
export function LoadingState({ label, rows = 3 }: { label?: string; rows?: number }) {
  const { tx } = useApp();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 pb-10 pt-6 md:px-8" aria-busy="true" aria-live="polite">
      <div className="mb-8 flex items-center gap-4">
        <span className="text-[var(--deep)]"><MyMascot size={56} mood="thinking" track={false} /></span>
        <div className="flex-1"><div className="skeleton h-3 w-28" /><div className="skeleton mt-3 h-8 w-[min(420px,70%)]" /></div>
        <span className="sr-only">{label ?? tx('Loading…', 'جارٍ التحميل…')}</span>
      </div>
      <div className="grid grid-cols-12 gap-4">
        {Array.from({ length: rows }, (_, i) => <div key={i} className={cn('skeleton h-40', i === 0 ? 'col-span-12 lg:col-span-8' : 'col-span-12 md:col-span-6 lg:col-span-4')} />)}
      </div>
    </div>
  );
}
