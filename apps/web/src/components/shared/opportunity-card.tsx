'use client';

import { Bookmark, CalendarClock, ExternalLink, MapPin } from 'lucide-react';
import { useApp } from '@/components/providers/app-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { diffDays, formatDate } from '@/lib/dates';
import type { Opportunity } from '@/lib/types';
import { cn } from '@/lib/utils';

const KIND: Record<Opportunity['kind'], { en: string; ar: string }> = {
  competition: { en: 'Competition', ar: 'مسابقة' }, olympiad: { en: 'Olympiad', ar: 'أولمبياد' }, summer: { en: 'Summer program', ar: 'برنامج صيفي' },
  internship: { en: 'Internship', ar: 'تدريب' }, hackathon: { en: 'Hackathon', ar: 'هاكاثون' }, volunteering: { en: 'Volunteering', ar: 'تطوع' }, scholarship: { en: 'Scholarship', ar: 'منحة' },
};

export function useSaveOpportunity() {
  const { user, world, update, tx, toast } = useApp();
  // An opportunity counts as saved when the student bookmarked it here or an agent/teacher already tracks it as an application.
  const tracked = (id: string, flag?: boolean) => !!flag || world.applications.some((a) => a.opportunityId === id);
  return {
    saved: (id: string, flag?: boolean) => user.savedOpps.includes(id) || tracked(id, flag),
    toggle: (o: Opportunity) => {
      if (!user.savedOpps.includes(o.id) && tracked(o.id, o.saved)) {
        toast({ title: tx('Already in your applications', 'موجودة في طلباتك بالفعل'), description: o.title, tone: 'info' });
        return;
      }
      const on = user.savedOpps.includes(o.id);
      update((u) => ({ ...u, savedOpps: on ? u.savedOpps.filter((x) => x !== o.id) : [...u.savedOpps, o.id] }));
      toast({ title: on ? tx('Removed from saved', 'أُزيلت من المحفوظات') : tx(`Saved “${o.title}”`, `تم حفظ “${o.title}”`), tone: on ? 'info' : 'success' });
    },
  };
}

/** Demo listings point at reserved example domains: never send a student to them as if they were real. */
export function isPlaceholderUrl(url?: string): boolean {
  if (!url || url === '#') return true;
  try { const u = new URL(url); const h = u.protocol === 'mailto:' ? u.pathname.split('@')[1] ?? '' : u.hostname; return /(^|\.)example\.(org|com|net)$/.test(h) || h.endsWith('.example') || h.endsWith('.test'); } catch { return true; }
}

export function OpportunityCard({ o, compact, onApply }: { o: Opportunity; compact?: boolean; onApply?: (o: Opportunity) => void }) {
  const { locale, tx, world } = useApp();
  const { saved, toggle } = useSaveOpportunity();
  const days = diffDays(o.deadline, world.today);
  const isSaved = saved(o.id, o.saved);
  return (
    <div className={cn('flex min-w-0 max-w-full flex-col gap-3 rounded-[var(--radius-lg)] bg-surface p-5', compact && 'rounded-[var(--radius)] bg-surface-2 p-4')}>
      <div className="flex min-w-0 items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{o.title}</p>
          <p className="truncate text-xs text-muted-foreground">{o.org}</p>
        </div>
        <button onClick={() => toggle(o)} aria-pressed={isSaved} aria-label={isSaved ? tx('Unsave', 'إلغاء الحفظ') : tx('Save', 'حفظ')} title={isSaved ? tx('Saved', 'محفوظة') : tx('Save', 'حفظ')} className={cn('-me-1.5 -mt-1.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm transition-colors hover:bg-surface-2', isSaved ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
          <Bookmark aria-hidden className="size-4" fill={isSaved ? 'currentColor' : 'none'} strokeWidth={isSaved ? 2.25 : 2} />
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone="brand">{o.match}% {tx('match', 'ملاءمة')}</Badge>
        <Badge tone={days <= 7 ? 'warning' : 'neutral'}><CalendarClock className="size-3" />{formatDate(o.deadline, locale)}</Badge>
        {!compact && <Badge tone="outline">{tx(KIND[o.kind].en, KIND[o.kind].ar)}</Badge>}
        {!compact && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" />{o.location}</span>}
      </div>
      {!compact && (
        <div className="mt-auto flex gap-2">
          {onApply && <Button size="sm" onClick={() => onApply(o)}>{tx('Start application', 'بدء الطلب')}</Button>}
          {isPlaceholderUrl(o.url)
            ? <span className="inline-flex h-8 items-center px-2 text-xs text-muted-foreground" title={tx('Demo listing: no external page', 'إدراج تجريبي: لا توجد صفحة خارجية')}>{tx('Demo listing', 'إدراج تجريبي')}</span>
            : <Button size="sm" variant="ghost" asChild><a href={o.url} target="_blank" rel="noreferrer">{tx('Details', 'التفاصيل')}<ExternalLink className="rtl:-scale-x-100" /><span className="sr-only">{tx(' (opens in a new tab)', ' (تفتح في علامة تبويب جديدة)')}</span></a></Button>}
        </div>
      )}
    </div>
  );
}
