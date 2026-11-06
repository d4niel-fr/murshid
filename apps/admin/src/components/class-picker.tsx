'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';
import { cn } from './ui';

/** The class being looked at (kept in ?class=), from the teacher's own classes or, for school admins, every class. */
export function useClassPick() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [cls, setCls] = useState<string | null>(null);
  useEffect(() => {
    if (!getSession()) { router.replace('/login'); return; }
    setCls(new URLSearchParams(window.location.search).get('class')); setReady(true);
  }, [router]);
  const me = useData<any>(ready ? '/teacher/me' : null, 'staff');
  const classes: { id: string; name: string; students: number; subjectName?: string }[] = me.data?.classes ?? [];
  const id = (cls && classes.some((c) => c.id === cls) ? cls : null) ?? classes[0]?.id ?? null;
  const pick = (x: string) => { setCls(x); const u = new URL(window.location.href); u.searchParams.set('class', x); window.history.replaceState(null, '', u); };
  return { id, classes, pick, ready, error: me.error, current: classes.find((c) => c.id === id) ?? null };
}

export function ClassPicker({ classes, id, pick }: { classes: { id: string; name: string; students: number }[]; id: string | null; pick: (id: string) => void }) {
  if (classes.length < 2) return null;
  return (
    <div className="tabs-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Class">
      {classes.map((c) => (
        <button key={c.id} role="tab" aria-selected={c.id === id} onClick={() => pick(c.id)} className={cn('shrink-0 rounded-2xl border px-4 py-2 text-start', c.id === id ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] hover:bg-[var(--surface)]')}>
          <span className="block text-sm font-medium">{c.name}</span><span className={cn('block text-xs', c.id === id ? 'text-white/70' : 'text-[var(--text-muted)]')}>{c.students} students</span>
        </button>
      ))}
    </div>
  );
}

/** A face for a 1–5 mood (the same drawing students pick). */
export function Face({ mood, className = 'size-7' }: { mood: number; className?: string }) {
  const curve = (mood - 3) * 4.2; const y = 26.5 - curve * 0.35;
  const tone = ['var(--danger)', 'var(--warning)', 'var(--text-muted)', 'var(--brand)', 'var(--success)'][Math.max(0, Math.min(4, Math.round(mood) - 1))];
  return (
    <svg viewBox="0 0 40 40" aria-hidden className={className} style={{ color: tone }}>
      <circle cx="20" cy="20" r="18.5" fill="currentColor" opacity={0.16} />
      <circle cx="14.2" cy="16" r="1.9" fill="currentColor" /><circle cx="25.8" cy="16" r="1.9" fill="currentColor" />
      <path d={Math.round(mood) === 3 ? 'M13.5 26h13' : `M12.5 ${y} Q20 ${y + curve} 27.5 ${y}`} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
