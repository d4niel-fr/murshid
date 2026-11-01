'use client';

import { ChevronDown, Cpu, Eye, ListChecks, ShieldCheck, Target, Wrench, Zap } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { cn } from '@/lib/utils';
import type { WorkTrace } from '@/lib/types';

const MODE: Record<WorkTrace['engine']['mode'], { label: [string, string]; cls: string }> = {
  model: { label: ['AI models', 'نماذج ذكاء اصطناعي'], cls: 'tint-info' },
  rules: { label: ['Rule-based engine', 'محرك قواعد'], cls: 'bg-surface-2 text-foreground' },
  cached: { label: ['Replayed demo answer', 'إجابة تجريبية محفوظة'], cls: 'tint-warning' },
  offline: { label: ['Offline fallback', 'وضع دون اتصال'], cls: 'tint-warning' },
};

const ACCESS: Record<string, [string, string]> = { read: ['read', 'قرأ'], write: ['changed', 'غيّر'], ui: ['showed', 'عرض'] };

function Section({ icon: Icon, title, children }: { icon: typeof Target; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"><Icon className="size-3.5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-1 text-sm leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/**
 * "How Murshid worked this out": an opt-in, collapsed panel showing the real plan behind a reply or an automated
 * action (goal understood -> steps planned -> tools used -> actions taken -> result), straight from the API trace.
 */
export function Workings({ trace, defaultOpen = false, className }: { trace: WorkTrace; defaultOpen?: boolean; className?: string }) {
  const { tx } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  const mode = MODE[trace.engine.mode] ?? MODE.rules;
  const modeLabel = tx(...mode.label);
  return (
    <div className={cn('rounded-[var(--radius-lg)] bg-surface', className)} data-testid="workings">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm font-medium text-muted-foreground hover:text-foreground">
        <Eye className="size-4 shrink-0" />
        <span className="min-w-0 flex-1">{tx('How Murshid worked this out', 'كيف توصّل مرشد إلى هذا')}</span>
        <span className={cn('hidden shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-medium sm:inline', mode.cls)}>{modeLabel}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="flex flex-col gap-3 border-t border-border px-4 py-4">
          <Section icon={Target} title={tx('1 · Goal understood', '١ · الهدف')}><p dir="auto">{trace.goal}</p></Section>
          <Section icon={ListChecks} title={tx('2 · Steps planned', '٢ · الخطوات')}>
            <ol dir="auto" className="list-decimal space-y-0.5 ps-4">{trace.plan.map((p, i) => <li key={i}>{p}</li>)}</ol>
          </Section>
          <Section icon={Wrench} title={tx('3 · Tools used', '٣ · الأدوات')}>
            {trace.tools.length ? (
              <ul className="flex flex-wrap gap-1.5">
                {trace.tools.map((t) => (
                  <li key={t.id} className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs', t.ok ? 'border-border' : 'border-[var(--danger)] text-[var(--danger)]')}>
                    <span className="text-muted-foreground">{ACCESS[t.access] ? tx(...ACCESS[t.access]) : t.access}</span>{t.label}{t.calls > 1 ? ` ×${t.calls}` : ''}{t.ok ? '' : tx(' (failed)', ' (فشل)')}
                  </li>
                ))}
              </ul>
            ) : <p className="text-muted-foreground">{tx('None needed.', 'لم يلزم شيء.')}</p>}
          </Section>
          <Section icon={Zap} title={tx('4 · Actions taken', '٤ · ما تم تنفيذه')}>
            {trace.actions.length ? <ul dir="auto" className="list-disc space-y-0.5 ps-4">{trace.actions.map((a, i) => <li key={i}>{a}</li>)}</ul> : <p className="text-muted-foreground">{tx('No changes: answer only.', 'لا تغييرات: إجابة فقط.')}</p>}
          </Section>
          <Section icon={ListChecks} title={tx('5 · Result', '٥ · النتيجة')}><p dir="auto">{trace.result}</p></Section>
          <Section icon={Cpu} title={tx('Engine', 'المحرك')}>
            <p>
              {modeLabel}{trace.engine.models.length ? `: ${trace.engine.models.join(', ')}` : ''}
              {trace.engine.ms ? ` · ${(trace.engine.ms / 1000).toFixed(1)} s` : ''}
            </p>
            {trace.engine.note && <p className="text-muted-foreground">{trace.engine.note}</p>}
          </Section>
          {trace.guardrails.length > 0 && (
            <Section icon={ShieldCheck} title={tx('Guardrails', 'ضوابط الأمان')}>
              <ul className="list-disc space-y-0.5 ps-4 text-muted-foreground">{trace.guardrails.map((g, i) => <li key={i}>{g}</li>)}</ul>
            </Section>
          )}
          <a href="/how-it-works" className="text-xs font-medium text-primary hover:underline">{tx('How Murshid works →', 'كيف يعمل مرشد ←')}</a>
        </div>
      )}
    </div>
  );
}
