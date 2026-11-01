'use client';

import { drawPaper, drawStroke, pageCanvas } from './notebook-render';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Download, Eraser, FilePlus2, Hand, Highlighter, PenLine, Plus, Printer, Redo2, Send, Trash2, Undo2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { HIGHLIGHT, hits, INK, notebooks, PAGE_H, PAGE_W, simplify, useNotebooks, type Notebook, type Paper, type Pt, type Stroke, type Tool } from '@/lib/notebook';
import { SUBJECTS } from '@/lib/study';
import { cn } from '@/lib/utils';
import { Ago } from '@/components/shared/ago';

/* ------------------------------------------------------------------ drawing */
const PAPER_LABEL: Record<Paper, [string, string]> = { lined: ['Lined', 'مسطّر'], cornell: ['Cornell', 'كورنيل'], grid: ['Grid', 'مربعات'], dotted: ['Dotted', 'منقّط'], blank: ['Blank', 'فارغ'] };


/* ------------------------------------------------------------------ list */
export function NotebookList() {
  const { tx, locale } = useApp();
  const state = useNotebooks();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(SUBJECTS[0]!);
  const [paper, setPaper] = useState<Paper>('lined');
  const create = () => { const id = notebooks.create(title, subject, paper); setOpen(false); setTitle(''); router.push(`/app/study/notebook/${id}`); };
  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Notebook', 'الدفتر')}
        subtitle={tx('Write by hand with a stylus or your finger: pen, highlighter and eraser on lined, grid or dotted paper. Saved on this device.', 'اكتب بخط يدك بالقلم أو بإصبعك: قلم وقلم تمييز وممحاة على ورق مسطّر أو مربعات أو منقّط. يُحفظ على هذا الجهاز.')}
        actions={<Button onClick={() => setOpen(true)}><Plus className="size-4" />{tx('New notebook', 'دفتر جديد')}</Button>} />
      {state.notebooks.length === 0 ? (
        <EmptyState title={tx('No notebooks yet', 'لا دفاتر بعد')} action={<Button onClick={() => setOpen(true)}>{tx('Start a notebook', 'ابدأ دفتراً')}</Button>}>{tx('A notebook is a stack of pages you write on by hand.', 'الدفتر مجموعة صفحات تكتب عليها بيدك.')}</EmptyState>
      ) : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {state.notebooks.map((n) => (
            <li key={n.id}>
              <Link href={`/app/study/notebook/${n.id}`} className="group block active:scale-[0.98]">
                <span className="relative block aspect-[3/4] overflow-hidden rounded-[18px] shadow-[0_1px_2px_rgb(0_0_0/0.08)]" style={{ background: n.cover }}>
                  <span className="absolute inset-y-0 start-0 w-3 bg-black/15" aria-hidden />
                  <span className="absolute inset-x-4 top-4 rounded-[10px] bg-white/95 px-3 py-2 text-[0.8125rem] font-medium leading-snug text-[#0a0a0a]">{n.title}</span>
                  <BookOpen className="absolute bottom-4 end-4 size-5 text-white/70" aria-hidden />
                </span>
                <span className="mt-2 block truncate text-sm font-medium">{n.title}</span>
                <span className="block text-xs text-muted-foreground">{n.subject} · {n.pages.length} {n.pages.length === 1 ? tx('page', 'صفحة') : tx('pages', 'صفحات')} · <Ago ts={n.updatedAt} locale={locale} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={tx('New notebook', 'دفتر جديد')}>
          <form onSubmit={(e) => { e.preventDefault(); create(); }} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Title', 'العنوان')}<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Chemistry: moles', 'مثال: الكيمياء: المول')} autoFocus /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Subject', 'المادة')}<Select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</Select></label>
            <fieldset><legend className="mb-1.5 text-sm font-medium">{tx('Paper', 'الورق')}</legend>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(Object.keys(PAPER_LABEL) as Paper[]).map((p) => (
                <button key={p} type="button" onClick={() => setPaper(p)} aria-pressed={paper === p} className={cn('h-11 rounded-[14px] border text-sm transition-colors', paper === p ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-border hover:border-foreground/40')}>{tx(...PAPER_LABEL[p])}</button>
              ))}</div>
            </fieldset>
            <Button type="submit">{tx('Create', 'إنشاء')}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}

/* ------------------------------------------------------------------ editor */
export function NotebookEditor({ id }: { id: string }) {
  const { tx, toast, prefs } = useApp();
  const state = useNotebooks();
  const nb = state.notebooks.find((n) => n.id === id);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState<string>(INK[0]);
  const [mark, setMark] = useState<string>(HIGHLIGHT[0]);
  const [size, setSize] = useState(4);
  const [penOnly, setPenOnly] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const page = nb?.pages[Math.min(index, (nb?.pages.length ?? 1) - 1)];

  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const undo = useRef<Stroke[][]>([]);
  const redo = useRef<Stroke[][]>([]);
  const current = useRef<Stroke | null>(null);
  const erasing = useRef<{ before: Stroke[] } | null>(null);
  const active = useRef<number | null>(null);
  const scale = useRef(1);
  const [, force] = useState(0);
  const dark = prefs.theme === 'dark';

  const fit = useCallback(() => {
    const w = wrap.current?.clientWidth ?? 0;
    if (!w || !base.current || !live.current) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    scale.current = w / PAGE_W;
    for (const c of [base.current, live.current]) {
      c.width = Math.round(w * dpr); c.height = Math.round(PAGE_H * scale.current * dpr);
      c.style.width = `${w}px`; c.style.height = `${PAGE_H * scale.current}px`;
      c.getContext('2d')!.setTransform(dpr * scale.current, 0, 0, dpr * scale.current, 0, 0);
    }
  }, []);
  const redraw = useCallback(() => {
    const ctx = base.current?.getContext('2d');
    if (!ctx || !nb) return;
    drawPaper(ctx, nb.paper, dark);
    for (const s of strokes.current) drawStroke(ctx, s);
  }, [nb, dark]);

  // load the page's strokes when the page changes (not on every save of the same page)
  useEffect(() => {
    if (!page) return;
    strokes.current = page.strokes; undo.current = []; redo.current = [];
    fit(); redraw(); force((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page?.id, mounted]);
  useEffect(() => { redraw(); }, [redraw]);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => { fit(); redraw(); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fit, redraw]);

  const commit = useCallback((next: Stroke[], before: Stroke[]) => {
    undo.current = [...undo.current.slice(-49), before]; redo.current = [];
    strokes.current = next;
    if (nb && page) notebooks.setStrokes(nb.id, page.id, next);
    redraw(); force((n) => n + 1);
  }, [nb, page, redraw]);
  const doUndo = useCallback(() => {
    const prev = undo.current.pop(); if (!prev || !nb || !page) return;
    redo.current.push(strokes.current); strokes.current = prev; notebooks.setStrokes(nb.id, page.id, prev); redraw(); force((n) => n + 1);
  }, [nb, page, redraw]);
  const doRedo = useCallback(() => {
    const next = redo.current.pop(); if (!next || !nb || !page) return;
    undo.current.push(strokes.current); strokes.current = next; notebooks.setStrokes(nb.id, page.id, next); redraw(); force((n) => n + 1);
  }, [nb, page, redraw]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() === 'z') { e.preventDefault(); (e.shiftKey ? doRedo : doUndo)(); }
      else if (e.key.toLowerCase() === 'y') { e.preventDefault(); doRedo(); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [doUndo, doRedo]);

  const toPage = (e: { clientX: number; clientY: number; pressure: number; pointerType: string }): Pt => {
    const r = live.current!.getBoundingClientRect();
    const p = e.pointerType === 'pen' ? e.pressure : e.pointerType === 'mouse' ? 0.5 : e.pressure || 0.5;
    return [Math.round((e.clientX - r.left) / scale.current), Math.round((e.clientY - r.top) / scale.current), Math.round(Math.max(0.05, Math.min(1, p)) * 100)];
  };
  const eraseAt = (pt: Pt) => {
    const keep = strokes.current.filter((s) => !hits(s, pt[0], pt[1], 14));
    if (keep.length !== strokes.current.length) { strokes.current = keep; redraw(); }
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen' && !penOnly) setPenOnly(true); // a stylus was used: fingers and palms stop drawing
    if (penOnly && e.pointerType === 'touch') return; // palm rejection: with a stylus in use, fingers don't draw
    if (active.current !== null) return; // one stroke at a time (a second finger is ignored)
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    active.current = e.pointerId;
    const pt = toPage(e);
    if (tool === 'eraser') { erasing.current = { before: strokes.current }; eraseAt(pt); return; }
    current.current = { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tool, color: tool === 'pen' ? ink : mark, size: tool === 'highlighter' ? size * 5 : size, points: [pt] };
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    if (tool === 'eraser') { for (const ev of events) eraseAt(toPage(ev)); return; }
    const s = current.current; if (!s) return;
    for (const ev of events.length ? events : [e.nativeEvent]) s.points.push(toPage(ev));
    const ctx = live.current!.getContext('2d')!;
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    drawStroke(ctx, s);
  };
  const up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return;
    active.current = null;
    if (tool === 'eraser') {
      const before = erasing.current?.before ?? strokes.current; erasing.current = null;
      if (before !== strokes.current) { const next = strokes.current; strokes.current = before; commit(next, before); }
      return;
    }
    const s = current.current; current.current = null;
    live.current!.getContext('2d')!.clearRect(0, 0, PAGE_W, PAGE_H);
    if (!s) return;
    const before = strokes.current;
    commit([...before, { ...s, points: simplify(s.points) }], before);
  };

  const exportPng = () => {
    if (!nb || !page) return;
    const c = document.createElement('canvas'); c.width = PAGE_W * 1.5; c.height = PAGE_H * 1.5;
    const ctx = c.getContext('2d')!; ctx.scale(1.5, 1.5);
    drawPaper(ctx, nb.paper, false); for (const s of strokes.current) drawStroke(ctx, s);
    c.toBlob((b) => {
      if (!b) return;
      const url = URL.createObjectURL(b); const a = document.createElement('a');
      a.href = url; a.download = `${nb.title.replace(/[^\w]+/g, '-').toLowerCase()}-page-${index + 1}.png`; a.click(); URL.revokeObjectURL(url);
    }, 'image/png');
  };
  /** Every page, one per sheet, through the browser's print dialog ("Save as PDF" works everywhere). */
  const printAll = () => {
    if (!nb) return;
    const imgs = nb.pages.map((_, i) => pageCanvas(nb, i, 1.4).toDataURL('image/jpeg', 0.9));
    const w = window.open('', '_blank');
    if (!w) return;
    const esc = (t: string) => t.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]!));
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(nb.title)}</title><style>@page{size:A4;margin:0}body{margin:0}img{display:block;width:100%;height:auto;page-break-after:always}img:last-child{page-break-after:auto}</style></head><body>${imgs.map((src, i) => `<img src="${src}" alt="Page ${i + 1}">`).join('')}</body></html>`);
    w.document.close();
    w.onload = () => { w.focus(); w.print(); };
  };

  if (!mounted) return <Page><h1 className="sr-only">{tx('Notebook', 'الدفتر')}</h1></Page>;
  if (!nb || !page) {
    return <Page><EmptyState title={tx('This notebook isn’t here', 'هذا الدفتر غير موجود')} action={<Button asChild><Link href="/app/study/notebook">{tx('All notebooks', 'كل الدفاتر')}</Link></Button>}>{tx('It may have been deleted on this device.', 'ربما حُذف على هذا الجهاز.')}</EmptyState></Page>;
  }
  const n = nb.pages.length; const at = Math.min(index, n - 1);
  const toolBtn = (t: Tool, Icon: typeof PenLine, label: string) => (
    <button type="button" onClick={() => setTool(t)} aria-pressed={tool === t} aria-label={label} title={label}
      className={cn('grid size-10 shrink-0 place-items-center rounded-full transition-colors', tool === t ? 'bg-[var(--deep)] text-white' : 'text-foreground hover:bg-surface-2')}><Icon className="size-[18px]" /></button>
  );
  const iconBtn = (onClick: () => void, Icon: typeof PenLine, label: string, disabled = false) => (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid size-10 shrink-0 place-items-center rounded-full text-foreground transition-colors hover:bg-surface-2 disabled:opacity-35"><Icon className="size-[18px]" /></button>
  );
  const colours = tool === 'highlighter' ? HIGHLIGHT : INK;
  const colour = tool === 'highlighter' ? mark : ink;

  return (
    <div className="mx-auto w-full max-w-[920px] px-3 pb-10 pt-3 md:px-6">
      <h1 className="sr-only">{nb.title}</h1>
      <div className="mb-2 flex items-center gap-2">
        <Link href="/app/study/notebook" className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{tx('Notebooks', 'الدفاتر')}</Link>
        <input aria-label={tx('Notebook title', 'عنوان الدفتر')} defaultValue={nb.title} onBlur={(e) => notebooks.rename(nb.id, e.target.value)} className="min-w-0 flex-1 truncate rounded-[10px] bg-transparent px-2 py-1.5 text-[0.9375rem] font-medium outline-none hover:bg-surface focus:bg-surface" />
      </div>
      {nb.assignmentId && (
        <Link href={`/app/school/assignments/${encodeURIComponent(nb.assignmentId)}`} className="mb-3 flex items-center gap-3 rounded-2xl bg-[color-mix(in_oklab,var(--deep)_7%,transparent)] px-4 py-3 text-sm hover:bg-[color-mix(in_oklab,var(--deep)_11%,transparent)]">
          <Send className="size-4 shrink-0 rtl:-scale-x-100" />
          <span className="min-w-0 flex-1">{tx('Notes for a school assignment. When you’re done, hand the pages in.', 'ملاحظات لواجب مدرسي. عندما تنتهي، سلّم الصفحات.')}</span>
          <span className="shrink-0 font-medium">{tx('Hand in', 'سلّم')}</span>
        </Link>
      )}
      {/* toolbar: sticky, scrolls sideways on a phone */}
      <div role="toolbar" aria-label={tx('Writing tools', 'أدوات الكتابة')} className="no-scrollbar sticky top-[calc(var(--topbar-h)+0.5rem)] z-20 mb-3 flex items-center gap-1 overflow-x-auto rounded-full border border-border bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] p-1 backdrop-blur">
        {toolBtn('pen', PenLine, tx('Pen', 'قلم'))}
        {toolBtn('highlighter', Highlighter, tx('Highlighter', 'قلم تمييز'))}
        {toolBtn('eraser', Eraser, tx('Eraser', 'ممحاة'))}
        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        {tool !== 'eraser' && colours.map((c) => (
          <button key={c} type="button" onClick={() => (tool === 'highlighter' ? setMark(c) : setInk(c))} aria-label={tx(`Colour ${c}`, `اللون ${c}`)} aria-pressed={colour === c}
            className={cn('grid size-10 shrink-0 place-items-center rounded-full', colour === c && 'bg-surface-2')}><span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} /></button>
        ))}
        {tool !== 'eraser' && [2, 4, 7].map((w) => (
          <button key={w} type="button" onClick={() => setSize(w)} aria-label={tx(`Size ${w}`, `الحجم ${w}`)} aria-pressed={size === w}
            className={cn('grid size-10 shrink-0 place-items-center rounded-full', size === w && 'bg-surface-2')}><span className="rounded-full bg-foreground" style={{ width: w + 3, height: w + 3 }} /></button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        {iconBtn(doUndo, Undo2, tx('Undo', 'تراجع'), !undo.current.length)}
        {iconBtn(doRedo, Redo2, tx('Redo', 'إعادة'), !redo.current.length)}
        <button type="button" onClick={() => setPenOnly((v) => !v)} aria-pressed={penOnly} title={tx('Only the stylus draws (palm rejection)', 'القلم فقط يرسم (تجاهل راحة اليد)')}
          className={cn('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors', penOnly ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2')}>
          <Hand className="size-4" />{penOnly ? tx('Stylus only', 'القلم فقط') : tx('Finger draws', 'الإصبع يرسم')}
        </button>
        <Select aria-label={tx('Paper', 'الورق')} value={nb.paper} onChange={(e) => notebooks.setPaper(nb.id, e.target.value as Paper)} className="h-10 w-auto shrink-0 rounded-full py-0 text-sm">
          {(Object.keys(PAPER_LABEL) as Paper[]).map((p) => <option key={p} value={p}>{tx(...PAPER_LABEL[p])}</option>)}
        </Select>
        {iconBtn(exportPng, Download, tx('Save page as image', 'حفظ الصفحة كصورة'))}
        {iconBtn(printAll, Printer, tx('Print or save as PDF', 'طباعة أو حفظ PDF'))}
      </div>

      <div ref={wrap} className="relative w-full overflow-hidden rounded-[14px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_-12px_rgb(15_47_99/0.18)]" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}` }}>
        <canvas ref={base} className="absolute inset-0" aria-hidden />
        <canvas ref={live} className="absolute inset-0 select-none" style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
          role="img" aria-label={tx(`Page ${at + 1} of ${n}: ${strokes.current.length} strokes`, `الصفحة ${at + 1} من ${n}`)} />
      </div>

      <div className="mt-3 flex items-center justify-center gap-1">
        {iconBtn(() => setIndex(Math.max(0, at - 1)), ChevronLeft, tx('Previous page', 'الصفحة السابقة'), at === 0)}
        <span className="min-w-16 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">{at + 1} / {n}</span>
        {iconBtn(() => setIndex(Math.min(n - 1, at + 1)), ChevronRight, tx('Next page', 'الصفحة التالية'), at >= n - 1)}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        {iconBtn(() => { const i = notebooks.addPage(nb.id, at); setIndex(i); }, FilePlus2, tx('Add a page after this one', 'إضافة صفحة بعد هذه'))}
        {iconBtn(() => {
          const removed = nb.pages[at]!;
          notebooks.removePage(nb.id, at); setIndex(Math.max(0, at - 1));
          toast({ title: tx('Page deleted', 'حُذفت الصفحة'), tone: 'info', action: removed.strokes.length ? { label: tx('Undo', 'تراجع'), onClick: () => notebooks.restore({ ...nb }) } : undefined });
        }, Trash2, tx('Delete this page', 'حذف هذه الصفحة'))}
      </div>
    </div>
  );
}

export type { Notebook };
