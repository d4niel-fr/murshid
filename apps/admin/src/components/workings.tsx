'use client';

import { ChevronDown, Eye } from 'lucide-react';
import { useState } from 'react';
import { Badge, cn } from './ui';

/* eslint-disable @typescript-eslint/no-explicit-any */
const MODE: Record<string, string> = { model: 'AI models', rules: 'Rule-based engine', cached: 'Replayed demo answer', offline: 'Offline fallback' };
const ACCESS: Record<string, string> = { read: 'read', write: 'changed', ui: 'showed' };

/** "How Murshid worked this out": collapsed by default; the real plan behind an automated action (API WorkTrace). */
export function Workings({ trace, who, className }: { trace: any; who?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  if (!trace) return null;
  const rows: [string, React.ReactNode][] = [
    ['1 · Goal understood', <p key="g">{trace.goal}</p>],
    ['2 · Steps planned', <ol key="p" className="list-decimal space-y-0.5 pl-4">{trace.plan.map((p: string, i: number) => <li key={i}>{p}</li>)}</ol>],
    ['3 · Tools used', <div key="t" className="flex flex-wrap gap-1.5">{trace.tools.map((t: any) => <span key={t.id} className="rounded-full border border-[var(--border)] px-2 py-0.5 text-xs"><span className="text-[var(--text-muted)]">{ACCESS[t.access] ?? t.access} </span>{t.label}</span>)}</div>],
    ['4 · Actions taken', trace.actions.length ? <ul key="a" className="list-disc space-y-0.5 pl-4">{trace.actions.map((a: string, i: number) => <li key={i}>{a}</li>)}</ul> : <p key="a">No changes.</p>],
    ['5 · Result', <p key="r">{trace.result}</p>],
    ['Engine', <p key="e">{MODE[trace.engine.mode] ?? trace.engine.mode}{trace.engine.note ? ` · ${trace.engine.note}` : ''}</p>],
    ['Guardrails', <ul key="gr" className="list-disc space-y-0.5 pl-4 text-[var(--text-muted)]">{trace.guardrails.map((g: string, i: number) => <li key={i}>{g}</li>)}</ul>],
  ];
  return (
    <div className={cn('rounded-[var(--radius)] border border-dashed border-[var(--border)] bg-[var(--surface)]', className)} data-testid="workings">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)]">
        <Eye className="size-4" /><span className="flex-1">How Murshid worked this out{who ? ` (${who})` : ''}</span>
        <Badge>{MODE[trace.engine.mode] ?? trace.engine.mode}</Badge>
        <ChevronDown className={cn('size-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="grid gap-3 border-t border-dashed border-[var(--border)] px-3 py-3 text-sm">
          {rows.map(([title, body]) => (
            <div key={title}><p className="text-xs font-medium text-[var(--text-muted)]">{title}</p><div className="mt-1 leading-relaxed">{body}</div></div>
          ))}
        </div>
      )}
    </div>
  );
}
