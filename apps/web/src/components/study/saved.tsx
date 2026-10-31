'use client';

import Link from 'next/link';
import { Bookmark, Clock, FileText, HelpCircle, Layers, Sparkles, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { library, useLibrary, type SavedKind } from '@/lib/library';
import { Ago } from '@/components/shared/ago';

const ICON: Record<SavedKind, typeof Bookmark> = { page: Bookmark, opportunity: Sparkles, note: FileText, deck: Layers, faq: HelpCircle };

export function SavedView() {
  const { tx, locale, toast } = useApp();
  const lib = useLibrary();
  const [tab, setTab] = useState<'saved' | 'recent'>('saved');
  const [kind, setKind] = useState<'all' | SavedKind>('all');
  const [sort, setSort] = useState<'new' | 'az'>('new');
  const KIND: Record<SavedKind, string> = { page: tx('Pages', 'صفحات'), opportunity: tx('Opportunities', 'فرص'), note: tx('Notes', 'ملاحظات'), deck: tx('Decks', 'مجموعات'), faq: tx('Help', 'مساعدة') };
  const kinds = Array.from(new Set(lib.saved.map((s) => s.kind)));
  const saved = lib.saved.filter((s) => kind === 'all' || s.kind === kind).sort((a, b) => (sort === 'az' ? a.title.localeCompare(b.title) : b.savedAt - a.savedAt));

  return (
    <Page>
      <PageHeader eyebrow={tx('Your library', 'مكتبتك')} title={tx('Saved and recent', 'المحفوظات والأخيرة')}
        subtitle={tx('Everything you saved for later, and the pages you looked at most recently. Kept on this device.', 'كل ما حفظته لوقت لاحق، والصفحات التي زرتها مؤخراً. محفوظة على هذا الجهاز.')}
        actions={<Segmented ariaLabel={tx('Show', 'عرض')} value={tab} onChange={setTab} options={[{ value: 'saved', label: tx(`Saved · ${lib.saved.length}`, `المحفوظات · ${lib.saved.length}`) }, { value: 'recent', label: tx('Recently viewed', 'شوهد مؤخراً') }]} />} />
      {tab === 'saved' ? (
        <>
          {lib.saved.length > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Segmented size="sm" ariaLabel={tx('Filter by type', 'تصفية حسب النوع')} value={kind} onChange={setKind} options={[{ value: 'all', label: tx('All', 'الكل') }, ...kinds.map((k) => ({ value: k, label: KIND[k] }))]} />
              <Segmented size="sm" className="ms-auto" ariaLabel={tx('Sort', 'ترتيب')} value={sort} onChange={setSort} options={[{ value: 'new', label: tx('Newest', 'الأحدث') }, { value: 'az', label: tx('A–Z', 'أ–ي') }]} />
            </div>
          )}
          {saved.length ? (
            <ul className="card divide-y divide-border p-2">
              {saved.map((s) => { const Icon = ICON[s.kind]; return (
                <li key={s.id} className="flex items-center gap-3 px-3 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><Icon className="size-4" /></span>
                  <Link href={s.href} className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem] font-medium hover:underline">{s.title}</span><span className="text-xs text-muted-foreground">{KIND[s.kind]} · {tx('saved', 'حُفظ')} <Ago ts={s.savedAt} locale={locale} /></span></Link>
                  <Button size="icon-sm" variant="ghost" aria-label={tx(`Remove ${s.title}`, `إزالة ${s.title}`)} onClick={() => { library.remove(s.id); toast({ title: tx('Removed', 'أُزيل'), tone: 'info', action: { label: tx('Undo', 'تراجع'), onClick: () => library.toggle(s) } }); }}><X /></Button>
                </li>
              ); })}
            </ul>
          ) : (
            <EmptyState title={tx('Nothing saved yet', 'لم تحفظ شيئاً بعد')}>{tx('Use the bookmark on any page, note, deck or opportunity (or the ⋯ menu at the top) to keep it here.', 'استخدم علامة الحفظ في أي صفحة أو ملاحظة أو مجموعة أو فرصة (أو قائمة ⋯ في الأعلى) لتحفظها هنا.')}</EmptyState>
          )}
        </>
      ) : lib.recent.length ? (
        <>
          <div className="mb-4 flex justify-end"><Button variant="ghost" size="sm" onClick={() => library.clearRecent()}><Trash2 />{tx('Clear history', 'مسح السجل')}</Button></div>
          <ul className="card divide-y divide-border p-2">
            {lib.recent.map((r) => (
              <li key={r.href}><Link href={r.href} className="flex items-center gap-3 rounded-[16px] px-3 py-3 transition-colors hover:bg-[var(--bg)]">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2"><Clock className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[0.9375rem]">{r.title}</span><span className="text-xs text-muted-foreground">{r.href}</span></span>
                <span className="shrink-0 text-xs text-muted-foreground"><Ago ts={r.at} locale={locale} /></span>
              </Link></li>
            ))}
          </ul>
        </>
      ) : <EmptyState title={tx('No history yet', 'لا يوجد سجل بعد')}>{tx('Pages you open will appear here.', 'ستظهر هنا الصفحات التي تفتحها.')}</EmptyState>}
    </Page>
  );
}
