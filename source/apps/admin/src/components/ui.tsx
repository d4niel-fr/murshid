'use client';

import { clsx } from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';

export const cn = clsx;

export function Button({ variant = 'primary', size = 'md', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'outline' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      {...p}
      className={cn(
        'group inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium transition-[background-color,color,border-color] duration-200 disabled:opacity-50 [&_svg]:size-4',
        size === 'sm' ? 'h-8 px-3.5 text-[13px]' : 'h-10 px-5 text-sm',
        variant === 'primary' && 'bg-[var(--text)] text-[var(--bg)] hover:bg-[var(--deep)]',
        variant === 'outline' && 'border border-[var(--border)] bg-transparent hover:border-[var(--text)]',
        variant === 'ghost' && 'text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]',
        variant === 'danger' && 'text-[var(--danger)] hover:bg-[color-mix(in_oklab,var(--danger)_10%,transparent)]',
        className,
      )}
    />
  );
}

export function Badge({ tone = 'neutral', children, className }: { tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium leading-none',
      tone === 'neutral' ? 'bg-[var(--surface-2)] text-[var(--text-muted)]' : `tint-${tone}`, className)}>
      {children}
    </span>
  );
}

export function Card({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {(title || action) && (
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
          <h3 className="card-title">{title}</h3>
          <div className="flex items-center gap-2">{action}</div>
        </header>
      )}
      <div className={pad ? 'p-6' : 'overflow-x-auto'}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card p-6">
      <div className="eyebrow">{label}</div>
      <div className="figure mt-4 text-[2.5rem]">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-[var(--text-muted)]">{sub}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, wide }: { open: boolean; title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[rgb(15_47_99/0.4)] p-6 pt-[8vh] backdrop-blur-sm" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={cn('w-full rounded-[28px] bg-[var(--popover)] shadow-[var(--shadow-2)]', wide ? 'max-w-3xl' : 'max-w-xl')} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-7 pb-2 pt-6">
          <h2 className="display text-[1.75rem]">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-[var(--surface)] text-[var(--text-muted)] transition-transform hover:rotate-90 hover:text-[var(--text)]"><X className="size-4" /></button>
        </header>
        <div className="px-7 pb-7 pt-4">{children}</div>
      </div>
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: { tabs: { id: string; label: string; count?: number }[]; active: string; onChange: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: false, end: false });
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const sync = () => setEdge({ start: el.scrollLeft > 2, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 2 });
    sync(); el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync); ro.observe(el);
    return () => { el.removeEventListener('scroll', sync); ro.disconnect(); };
  }, []);
  // Keep the active tab fully visible when the bar is narrower than its tabs (iPad, small laptops).
  useEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);
  const mask = edge.start || edge.end
    ? `linear-gradient(to right, ${edge.start ? 'transparent, #000 32px' : '#000'}, ${edge.end ? '#000 calc(100% - 32px), transparent' : '#000'})`
    : undefined;
  return (
    <div className="inline-flex max-w-full rounded-full bg-[var(--surface)] p-1">
      <div ref={ref} role="tablist" className="tabs-scroll flex gap-0.5 overflow-x-auto" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {tabs.map((t) => (
          <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
            className={cn('relative h-9 shrink-0 whitespace-nowrap rounded-full px-4 text-[13.5px] font-medium transition-colors',
              active === t.id ? 'bg-[var(--deep)] text-white' : 'text-[var(--text-muted)] hover:text-[var(--text)]')}>
            {t.label}{typeof t.count === 'number' && <span className={cn('ml-1.5 text-[11px]', active === t.id ? 'text-white/60' : 'text-[var(--text-muted)]')}>{t.count}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-[var(--text-muted)]">{children}</div>;
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null;
  return <div className="tint-danger rounded-[var(--radius-sm)] px-4 py-3 text-sm">{error}</div>;
}

export function Bar({ value, max = 100, tone = 'accent' }: { value: number; max?: number; tone?: 'accent' | 'success' | 'warning' }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-1.5 w-full min-w-12 overflow-hidden rounded-full bg-[var(--surface-2)]">
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone === 'accent' ? 'var(--accent)' : `var(--${tone})` }} />
    </div>
  );
}

/** Tiny inline SVG sparkline / bar chart (no chart lib needed for the admin portal). */
export function MiniBars({ values, labels, height = 64 }: { values: number[]; labels?: string[]; height?: number }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1" title={`${labels?.[i] ?? i}: ${v}`}>
          <div className="w-full rounded-full bg-[var(--accent)]" style={{ height: `${Math.max(2, (v / max) * (height - 14))}px` }} />
          {labels && <span className="text-[9px] text-[var(--text-muted)]">{labels[i]}</span>}
        </div>
      ))}
    </div>
  );
}
