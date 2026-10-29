'use client';

import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { spring } from '@/lib/motion';

export interface ToastInput { title: string; description?: string; tone?: 'success' | 'info' | 'danger'; duration?: number; action?: { label: string; onClick: () => void } }
export interface ToastItem extends ToastInput { id: string }

const icons = { success: CheckCircle2, info: Info, danger: TriangleAlert };

export function Toaster({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: string) => void }) {
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 end-5 z-[60] flex w-[min(92vw,360px)] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = icons[t.tone ?? 'success'];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1, transition: spring.snappy }}
              exit={{ opacity: 0, y: 6, transition: { duration: 0.15 } }}
              className="pointer-events-auto flex items-start gap-3 rounded-[20px] bg-popover p-4 shadow-lift"
            >
              <Icon className={t.tone === 'danger' ? 'mt-0.5 size-4 text-danger' : t.tone === 'info' ? 'mt-0.5 size-4 text-info' : 'mt-0.5 size-4 text-success'} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
              </div>
              {t.action && (
                <button onClick={() => { t.action!.onClick(); onDismiss(t.id); }} className="text-sm font-medium text-primary hover:underline">
                  {t.action.label}
                </button>
              )}
              <button aria-label="Dismiss" onClick={() => onDismiss(t.id)} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
