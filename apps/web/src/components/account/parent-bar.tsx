'use client';

import Link from 'next/link';
import { Eye } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { CHILD_KEY, chosenChild } from '@/lib/auth';

/** Parents see their child's Murshid read only: this bar says so, switches child, and points to what a parent can do. */
export function ParentBar() {
  const { account, tx } = useApp();
  if (account?.me.role !== 'parent' || !account.me.children.length) return null;
  const kids = account.me.children;
  const current = kids.find((k) => k.id === chosenChild()) ?? kids[0]!;
  const pick = (id: string) => { try { localStorage.setItem(CHILD_KEY, id); } catch { /* blocked */ } window.location.reload(); };
  return (
    <div className="no-print border-b border-border bg-[color-mix(in_oklab,var(--brand)_7%,var(--bg))] px-4 py-2 text-sm md:px-8">
      <div className="mx-auto flex max-w-[1360px] flex-wrap items-center gap-x-3 gap-y-1.5">
        <Eye className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1">{tx(`You’re viewing ${current.name}’s Murshid. You can look, not change.`, `أنت تعرض حساب ${current.name}. يمكنك الاطلاع دون التعديل.`)}</span>
        {kids.length > 1 && (
          <select aria-label={tx('Child', 'الطفل')} value={current.id} onChange={(e) => pick(e.target.value)} className="h-9 rounded-full border border-border bg-[var(--bg)] px-3 text-sm">
            {kids.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        )}
        <Link href="/app/attendance" className="inline-flex h-9 items-center rounded-full bg-[var(--bg)] px-3 text-xs font-medium">{tx('Ask for leave', 'اطلب إذناً')}</Link>
        <Link href="/app/reports" className="inline-flex h-9 items-center rounded-full bg-[var(--bg)] px-3 text-xs font-medium">{tx('Reports', 'التقارير')}</Link>
      </div>
    </div>
  );
}
