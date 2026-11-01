'use client';

import Link from 'next/link';
import { Dialog as D } from 'radix-ui';
import { ArrowLeft, Check, NotebookPen } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { pageCanvas } from '@/components/study/notebook-render';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { useNotebooks, type Notebook } from '@/lib/notebook';
import { fromCanvas, type Prepared } from '@/lib/upload';
import { cn } from '@/lib/utils';

/** Pick pages from the student's handwritten notebooks; each page is rendered to a JPEG and handed back. */
export function NotebookPicker({ open, onOpenChange, onPick }: { open: boolean; onOpenChange: (o: boolean) => void; onPick: (files: Prepared[]) => void }) {
  const { tx } = useApp();
  const { notebooks } = useNotebooks();
  const [nb, setNb] = useState<Notebook | null>(null);
  const [chosen, setChosen] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setNb(null); setChosen([]); } }, [open]);

  const add = async () => {
    if (!nb) return;
    setBusy(true);
    try {
      const out: Prepared[] = [];
      for (const i of [...chosen].sort((a, b) => a - b)) out.push(await fromCanvas(pageCanvas(nb, i, 1.2), `${nb.title.replace(/[^\p{L}\p{N}]+/gu, '-')}-page-${i + 1}.jpg`));
      onPick(out); onOpenChange(false);
    } finally { setBusy(false); }
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <DialogContent title={nb ? nb.title : tx('Add pages from your notebook', 'أضف صفحات من دفترك')} description={nb ? tx('Tap the pages to send.', 'اختر الصفحات لإرسالها.') : tx('Your handwritten notes, sent as photos.', 'ملاحظاتك المكتوبة بخط اليد، تُرسل كصور.')} className="max-h-[88dvh] w-[min(94vw,640px)] overflow-y-auto">
        {!notebooks.length ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <NotebookPen className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{tx('No notebooks yet.', 'لا توجد دفاتر بعد.')}</p>
            <Button asChild variant="secondary"><Link href="/app/study/notebook">{tx('Start a notebook', 'ابدأ دفتراً')}</Link></Button>
          </div>
        ) : !nb ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {notebooks.map((n) => (
              <li key={n.id}>
                <button type="button" onClick={() => setNb(n)} className="flex w-full flex-col gap-2 rounded-2xl border border-border p-2 text-start transition-colors hover:bg-surface">
                  <span className="grid aspect-[3/4] w-full place-items-end rounded-xl p-2.5 text-xs font-medium text-white" style={{ background: n.cover }}>{n.pages.length} {n.pages.length === 1 ? tx('page', 'صفحة') : tx('pages', 'صفحات')}</span>
                  <span className="truncate px-1 text-sm font-medium">{n.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <button type="button" onClick={() => { setNb(null); setChosen([]); }} className="mb-3 inline-flex min-h-10 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('All notebooks', 'كل الدفاتر')}</button>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {nb.pages.map((p, i) => <PageThumb key={p.id} nb={nb} index={i} on={chosen.includes(i)} toggle={() => setChosen((c) => (c.includes(i) ? c.filter((x) => x !== i) : [...c, i]))} />)}
            </ul>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <button type="button" className="min-h-10 text-sm text-muted-foreground hover:text-foreground" onClick={() => setChosen(chosen.length === nb.pages.length ? [] : nb.pages.map((_, i) => i))}>{chosen.length === nb.pages.length ? tx('Clear', 'مسح') : tx('Select all', 'تحديد الكل')}</button>
              <Button disabled={!chosen.length || busy} onClick={() => void add()}>{busy ? tx('Preparing…', 'جارٍ التجهيز…') : chosen.length ? tx(`Add ${chosen.length} page${chosen.length === 1 ? '' : 's'}`, `أضف ${chosen.length} صفحة`) : tx('Choose pages', 'اختر صفحات')}</Button>
            </div>
          </>
        )}
      </DialogContent>
    </D.Root>
  );
}

function PageThumb({ nb, index, on, toggle }: { nb: Notebook; index: number; on: boolean; toggle: () => void }) {
  const { tx } = useApp();
  const src = useMemo(() => (typeof document === 'undefined' ? '' : pageCanvas(nb, index, 0.22).toDataURL('image/png')), [nb, index]);
  const empty = !nb.pages[index]?.strokes.length;
  return (
    <li>
      <button type="button" onClick={toggle} aria-pressed={on} aria-label={tx(`Page ${index + 1}`, `صفحة ${index + 1}`)} className={cn('relative block w-full overflow-hidden rounded-xl border-2 transition-colors', on ? 'border-[var(--deep)] dark:border-[var(--brand-light)]' : 'border-border hover:border-[var(--text-muted)]')}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src && <img src={src} alt="" className="aspect-[1000/1414] w-full bg-white" />}
        <span className="absolute bottom-1 start-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[0.6875rem] text-white">{index + 1}{empty ? ` · ${tx('blank', 'فارغة')}` : ''}</span>
        {on && <span className="absolute end-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-[var(--deep)] text-white"><Check className="size-3.5" /></span>}
      </button>
    </li>
  );
}
