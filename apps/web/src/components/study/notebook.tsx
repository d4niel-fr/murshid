'use client';

import { drawPaper, drawStroke, drawTexts, pageCanvas, textBounds } from './notebook-render';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Copy, CopyPlus, Download, Eraser, FilePlus2, Hand, Highlighter, Lasso, MoveLeft, MoveRight, PenLine, Plus, Printer, Redo2, Send, Shapes, Trash2, Type, Undo2, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { HIGHLIGHT, hits, INK, lassoed, lassoedTexts, notebooks, PAGE_H, PAGE_W, recognise, simplify, useNotebooks, type Notebook, type NoteText, type Paper, type Pt, type Stroke, type Tool } from '@/lib/notebook';
import { SUBJECTS } from '@/lib/study';
import { cn } from '@/lib/utils';
import { Ago } from '@/components/shared/ago';
import { Subject, SubjectOptions } from '@/components/shared/subject';
import { colourName } from '@/lib/colour-names';

/** One page's contents, for undo. */
type Snap = { strokes: Stroke[]; texts: NoteText[] };

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
                <span className="block text-xs text-muted-foreground"><Subject name={n.subject} /> · {n.pages.length} {n.pages.length === 1 ? tx('page', 'صفحة') : tx('pages', 'صفحات')} · <Ago ts={n.updatedAt} locale={locale} /></span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={tx('New notebook', 'دفتر جديد')}>
          <form onSubmit={(e) => { e.preventDefault(); create(); }} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Title', 'العنوان')}<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Chemistry: moles', 'مثال: الكيمياء: المول')} autoFocus /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Subject', 'المادة')}<Select value={subject} onChange={(e) => setSubject(e.target.value)}><SubjectOptions list={SUBJECTS} /></Select></label>
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
  const { tx, toast, prefs, locale } = useApp();
  const state = useNotebooks();
  const nb = state.notebooks.find((n) => n.id === id);
  const [index, setIndex] = useState(0);
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState<string>(INK[0]);
  const [mark, setMark] = useState<string>(HIGHLIGHT[0]);
  const [size, setSize] = useState(4);
  const [penOnly, setPenOnly] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [sel, setSel] = useState<string[]>([]);
  const [editText, setEditText] = useState<NoteText | null>(null);
  const [textSize, setTextSize] = useState(26);
  const lasso = useRef<Pt[] | null>(null);
  const moving = useRef<{ from: Pt; before: Snap } | null>(null);
  const texts = useRef<NoteText[]>([]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const page = nb?.pages[Math.min(index, (nb?.pages.length ?? 1) - 1)];

  const wrap = useRef<HTMLDivElement>(null);
  const base = useRef<HTMLCanvasElement>(null);
  const live = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  // undo covers ink and text boxes together, so a moved or deleted selection comes back whole
  const undo = useRef<Snap[]>([]);
  const redo = useRef<Snap[]>([]);
  const current = useRef<Stroke | null>(null);
  const erasing = useRef<{ before: Snap } | null>(null);
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
    drawTexts(ctx, texts.current.filter((t) => t.id !== editingId.current));
  }, [nb, dark]);
  const editingId = useRef<string | null>(null);
  /** The dashed box around lassoed strokes, on the top canvas. */
  const selBox = useCallback((ids: string[]) => {
    const picked = strokes.current.filter((s) => ids.includes(s.id));
    const boxes = texts.current.filter((t) => ids.includes(t.id)).map(textBounds);
    if (!picked.length && !boxes.length) return null;
    const xs = [...picked.flatMap((s) => s.points.map((p) => p[0])), ...boxes.flatMap((b) => [b.x, b.x + b.w])];
    const ys = [...picked.flatMap((s) => s.points.map((p) => p[1])), ...boxes.flatMap((b) => [b.y, b.y + b.h])];
    return { x: Math.min(...xs) - 10, y: Math.min(...ys) - 10, w: Math.max(...xs) - Math.min(...xs) + 20, h: Math.max(...ys) - Math.min(...ys) + 20 };
  }, []);
  const drawSel = useCallback((ids: string[]) => {
    const ctx = live.current?.getContext('2d'); if (!ctx) return;
    ctx.clearRect(0, 0, PAGE_W, PAGE_H);
    const b = selBox(ids); if (!b) return;
    ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = '#2563c9'; ctx.lineWidth = 2; ctx.strokeRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(37,99,201,0.06)'; ctx.fillRect(b.x, b.y, b.w, b.h); ctx.restore();
  }, [selBox]);

  // load the page's strokes when the page changes (not on every save of the same page)
  useEffect(() => {
    if (!page) return;
    strokes.current = page.strokes; texts.current = page.texts ?? []; undo.current = []; redo.current = []; setSel([]); setEditText(null);
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

  const snap = (): Snap => ({ strokes: strokes.current, texts: texts.current });
  /** Show and save a page state (only the parts that changed are written). */
  const apply = useCallback((next: Snap) => {
    if (nb && page) {
      if (next.strokes !== strokes.current) notebooks.setStrokes(nb.id, page.id, next.strokes);
      if (next.texts !== texts.current) notebooks.setTexts(nb.id, page.id, next.texts);
    }
    strokes.current = next.strokes; texts.current = next.texts;
    redraw(); force((n) => n + 1);
  }, [nb, page, redraw]);
  /** `before` must be the state as last saved: pass it explicitly when the refs were changed live (drag, eraser). */
  const commit = useCallback((next: Partial<Snap>, before: Snap = { strokes: strokes.current, texts: texts.current }) => {
    undo.current = [...undo.current.slice(-49), before]; redo.current = [];
    strokes.current = before.strokes; texts.current = before.texts;
    apply({ strokes: next.strokes ?? before.strokes, texts: next.texts ?? before.texts });
  }, [apply]);
  const clearSel = () => { setSel([]); live.current?.getContext('2d')?.clearRect(0, 0, PAGE_W, PAGE_H); };
  const doUndo = useCallback(() => {
    const prev = undo.current.pop(); if (!prev) return;
    redo.current.push({ strokes: strokes.current, texts: texts.current }); apply(prev); clearSel();
  }, [apply]); // eslint-disable-line react-hooks/exhaustive-deps
  const doRedo = useCallback(() => {
    const next = redo.current.pop(); if (!next) return;
    undo.current.push({ strokes: strokes.current, texts: texts.current }); apply(next); clearSel();
  }, [apply]); // eslint-disable-line react-hooks/exhaustive-deps
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
    // a tap outside an open text box finishes it first
    if (editText) { e.preventDefault(); saveText(); return; }
    if (e.pointerType === 'pen' && !penOnly) setPenOnly(true); // a stylus was used: fingers and palms stop drawing
    if (penOnly && e.pointerType === 'touch') return; // palm rejection: with a stylus in use, fingers don't draw
    if (active.current !== null) return; // one stroke at a time (a second finger is ignored)
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    active.current = e.pointerId;
    const pt = toPage(e);
    if (tool === 'eraser') { erasing.current = { before: snap() }; eraseAt(pt); return; }
    if (tool === 'lasso') {
      const b = selBox(sel);
      if (b && pt[0] >= b.x && pt[0] <= b.x + b.w && pt[1] >= b.y && pt[1] <= b.y + b.h) { moving.current = { from: pt, before: snap() }; return; }
      setSel([]); lasso.current = [pt]; return;
    }
    if (tool === 'text') {
      active.current = null;
      const hitText = [...texts.current].reverse().find((t) => { const b = textBounds(t); return pt[0] >= b.x - 6 && pt[0] <= b.x + b.w + 6 && pt[1] >= b.y - 4 && pt[1] <= b.y + b.h + 4; });
      const t = hitText ?? { id: `tx${Date.now().toString(36)}`, x: pt[0], y: pt[1] + textSize * 0.4, text: '', size: textSize, color: ink };
      editingId.current = t.id; setEditText(t); redraw(); return;
    }
    const kind = tool === 'shape' ? 'pen' : tool;
    current.current = { id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tool: kind as 'pen' | 'highlighter', color: kind === 'pen' ? ink : mark, size: kind === 'highlighter' ? size * 5 : size, points: [pt] };
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (active.current !== e.pointerId) return;
    const events = typeof e.nativeEvent.getCoalescedEvents === 'function' ? e.nativeEvent.getCoalescedEvents() : [e.nativeEvent];
    if (tool === 'eraser') { for (const ev of events) eraseAt(toPage(ev)); return; }
    if (tool === 'lasso') {
      const ctx = live.current!.getContext('2d')!;
      if (moving.current) {
        const pt = toPage(e.nativeEvent); const dx = pt[0] - moving.current.from[0]; const dy = pt[1] - moving.current.from[1];
        strokes.current = moving.current.before.strokes.map((st) => (sel.includes(st.id) ? { ...st, points: st.points.map((q) => [q[0] + dx, q[1] + dy, q[2]] as Pt) } : st));
        texts.current = moving.current.before.texts.map((t) => (sel.includes(t.id) ? { ...t, x: t.x + dx, y: t.y + dy } : t));
        redraw(); drawSel(sel); return;
      }
      if (!lasso.current) return;
      for (const ev of events) lasso.current.push(toPage(ev));
      ctx.clearRect(0, 0, PAGE_W, PAGE_H); ctx.save(); ctx.setLineDash([6, 6]); ctx.strokeStyle = '#2563c9'; ctx.lineWidth = 2;
      ctx.beginPath(); lasso.current.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.stroke(); ctx.restore();
      return;
    }
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
      const before = erasing.current?.before ?? snap(); erasing.current = null;
      if (before.strokes !== strokes.current) commit({ strokes: strokes.current }, before);
      return;
    }
    if (tool === 'lasso') {
      if (moving.current) { const before = moving.current.before; moving.current = null; commit({ strokes: strokes.current, texts: texts.current }, before); drawSel(sel); return; }
      const loop = lasso.current; lasso.current = null;
      const ids = loop ? [...lassoed(strokes.current, loop), ...lassoedTexts(texts.current, loop, textBounds)] : [];
      setSel(ids); drawSel(ids); return;
    }
    const s = current.current; current.current = null;
    live.current!.getContext('2d')!.clearRect(0, 0, PAGE_W, PAGE_H);
    if (!s) return;
    const pts = simplify(s.points);
    // the shape tool tidies a rough line, box, circle or triangle
    const neat = tool === 'shape' ? recognise(pts) : null;
    commit({ strokes: [...strokes.current, neat ? { ...s, points: neat, shape: true } : { ...s, points: pts }] });
  };

  const rid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const delSel = () => { if (!sel.length) return; commit({ strokes: strokes.current.filter((st) => !sel.includes(st.id)), texts: texts.current.filter((t) => !sel.includes(t.id)) }); clearSel(); };
  const dupSel = () => {
    if (!sel.length) return;
    const sc = strokes.current.filter((st) => sel.includes(st.id)).map((st) => ({ ...st, id: rid('s'), points: st.points.map((q) => [q[0] + 24, q[1] + 24, q[2]] as Pt) }));
    const tc = texts.current.filter((t) => sel.includes(t.id)).map((t) => ({ ...t, id: rid('tx'), x: t.x + 24, y: t.y + 24 }));
    commit({ strokes: [...strokes.current, ...sc], texts: [...texts.current, ...tc] });
    const ids = [...sc, ...tc].map((c) => c.id); setSel(ids); drawSel(ids);
  };
  const recolorSel = (c: string) => {
    if (!sel.length) return;
    commit({ strokes: strokes.current.map((st) => (sel.includes(st.id) && st.tool === 'pen' ? { ...st, color: c } : st)), texts: texts.current.map((t) => (sel.includes(t.id) ? { ...t, color: c } : t)) });
    drawSel(sel);
  };
  const saveText = () => {
    const t = editText; editingId.current = null; setEditText(null);
    if (!t || !nb || !page) { redraw(); return; }
    const old = texts.current.find((x) => x.id === t.id);
    if ((old?.text ?? '') === t.text && old?.color === t.color) { redraw(); return; } // nothing changed
    const others = texts.current.filter((x) => x.id !== t.id);
    commit({ texts: t.text.trim() ? [...others, t] : others });
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (el.closest('input,textarea,select,[contenteditable]')) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel.length) { e.preventDefault(); delSel(); }
      if (e.key === 'Escape' && sel.length) clearSel();
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd' && sel.length) { e.preventDefault(); dupSel(); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => { if (tool !== 'lasso' && sel.length) clearSel(); }, [tool]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportPng = () => {
    if (!nb || !page) return;
    const c = document.createElement('canvas'); c.width = PAGE_W * 1.5; c.height = PAGE_H * 1.5;
    const ctx = c.getContext('2d')!; ctx.scale(1.5, 1.5);
    drawPaper(ctx, nb.paper, false); for (const s of strokes.current) drawStroke(ctx, s); drawTexts(ctx, texts.current);
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
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Link href="/app/study/notebook" className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Notebooks', 'الدفاتر')}</Link>
        <input aria-label={tx('Notebook title', 'عنوان الدفتر')} defaultValue={nb.title} onBlur={(e) => notebooks.rename(nb.id, e.target.value)} className="min-w-[8rem] flex-1 truncate rounded-[10px] bg-transparent px-2 py-1.5 text-[0.9375rem] font-medium outline-none hover:bg-surface focus:bg-surface" />
        <div className="ms-auto flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => setPenOnly((v) => !v)} aria-pressed={penOnly} title={tx('Only the stylus draws (palm rejection)', 'القلم فقط يرسم (تجاهل راحة اليد)')} aria-label={penOnly ? tx('Stylus only', 'القلم فقط') : tx('Finger draws', 'الإصبع يرسم')}
            className={cn('inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors', penOnly ? 'bg-surface-2 text-foreground' : 'text-muted-foreground hover:bg-surface-2')}>
            <Hand className="size-4" /><span className="max-sm:sr-only">{penOnly ? tx('Stylus only', 'القلم فقط') : tx('Finger draws', 'الإصبع يرسم')}</span>
          </button>
          <Select aria-label={tx('Paper', 'الورق')} value={nb.paper} onChange={(e) => notebooks.setPaper(nb.id, e.target.value as Paper)} className="h-10 w-auto shrink-0 rounded-full py-0 text-sm">
            {(Object.keys(PAPER_LABEL) as Paper[]).map((p) => <option key={p} value={p}>{tx(...PAPER_LABEL[p])}</option>)}
          </Select>
          {iconBtn(exportPng, Download, tx('Save page as image', 'حفظ الصفحة كصورة'))}
          {iconBtn(printAll, Printer, tx('Print or save as PDF', 'طباعة أو حفظ PDF'))}
        </div>
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
        {toolBtn('lasso', Lasso, tx('Lasso: select to move, recolour or delete', 'الحبل: حدد لتحريك أو تلوين أو حذف'))}
        {toolBtn('shape', Shapes, tx('Shapes: draw a rough line, box or circle and it straightens', 'الأشكال: ارسم خطاً أو مربعاً أو دائرة تقريبية فتُعدَّل'))}
        {toolBtn('text', Type, tx('Text box', 'مربع نص'))}
        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        {tool === 'text' && [18, 26, 38].map((ts) => <button key={ts} type="button" onClick={() => setTextSize(ts)} aria-pressed={textSize === ts} aria-label={[tx('Small text', 'نص صغير'), tx('Medium text', 'نص متوسط'), tx('Large text', 'نص كبير')][[18, 26, 38].indexOf(ts)]} className={cn('grid size-10 shrink-0 place-items-center rounded-full font-medium', textSize === ts && 'bg-surface-2')} style={{ fontSize: ts / 2.2 }}>A</button>)}
        {tool !== 'eraser' && tool !== 'lasso' && colours.map((c) => (
          <button key={c} type="button" onClick={() => (tool === 'highlighter' ? setMark(c) : setInk(c))} aria-label={colourName(c, locale)} title={colourName(c, locale)} aria-pressed={colour === c}
            className={cn('grid size-10 shrink-0 place-items-center rounded-full', colour === c && 'bg-surface-2')}><span className="size-5 rounded-full ring-1 ring-black/10" style={{ background: c }} /></button>
        ))}
        {(tool === 'pen' || tool === 'highlighter' || tool === 'shape') && [2, 4, 7].map((w) => (
          <button key={w} type="button" onClick={() => setSize(w)} aria-label={[tx('Thin', 'رفيع'), tx('Medium', 'متوسط'), tx('Thick', 'عريض')][[2, 4, 7].indexOf(w)]} aria-pressed={size === w}
            className={cn('grid size-10 shrink-0 place-items-center rounded-full', size === w && 'bg-surface-2')}><span className="rounded-full bg-foreground" style={{ width: w + 3, height: w + 3 }} /></button>
        ))}
        <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden />
        {iconBtn(doUndo, Undo2, tx('Undo', 'تراجع'), !undo.current.length)}
        {iconBtn(doRedo, Redo2, tx('Redo', 'إعادة'), !redo.current.length)}
      </div>

      {/* the selection bar floats over the page (it takes no room), so the page never jumps under the pen */}
      {sel.length > 0 && (
        <div className="sticky top-[calc(var(--topbar-h)+4rem)] z-20 h-0">
        <div className="absolute inset-x-2 top-0 flex flex-wrap items-center gap-1 rounded-full border border-border bg-[var(--popover)] p-1 shadow-[var(--shadow-2)] sm:inset-x-auto sm:start-2">
          <span className="px-3 text-xs text-muted-foreground">{tx(`${sel.length} selected · drag to move`, `${sel.length} محدد · اسحب للتحريك`)}</span>
          {INK.map((c) => <button key={c} type="button" onClick={() => recolorSel(c)} aria-label={tx(`Make it ${colourName(c, 'en').toLowerCase()}`, `لوّنه ${colourName(c, 'ar')}`)} className="grid size-9 place-items-center rounded-full hover:bg-surface-2"><span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: c }} /></button>)}
          {iconBtn(dupSel, Copy, tx('Duplicate', 'تكرار'))}
          {iconBtn(delSel, Trash2, tx('Delete', 'حذف'))}
        </div>
        </div>
      )}
      <div className="overflow-auto rounded-[14px]" onWheel={(e) => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.max(1, Math.min(3, Math.round((z - e.deltaY * 0.004) * 10) / 10))); } }}>
      <div ref={wrap} className="relative overflow-hidden rounded-[14px] shadow-[0_1px_3px_rgb(0_0_0/0.08),0_8px_24px_-12px_rgb(15_47_99/0.18)]" style={{ aspectRatio: `${PAGE_W} / ${PAGE_H}`, width: `${zoom * 100}%` }}>
        <canvas ref={base} className="absolute inset-0" aria-hidden />
        {editText && (
          <textarea autoFocus dir="auto" value={editText.text} onChange={(e) => setEditText({ ...editText, text: e.target.value })} onBlur={saveText}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); saveText(); } }} aria-label={tx('Text box', 'مربع نص')} placeholder={tx('Type…', 'اكتب…')}
            className="absolute z-10 resize-none overflow-hidden bg-transparent font-medium leading-[1.3] outline-none ring-2 ring-[var(--brand-light)]"
            style={{ left: (editText.x - 4) * scale.current, top: (editText.y - editText.size) * scale.current, fontSize: editText.size * scale.current, color: editText.color, width: Math.max(220, (PAGE_W - editText.x - 20) * scale.current * 0.9), height: (editText.text.split('\n').length + 1) * editText.size * 1.3 * scale.current, fontFamily: 'Onest, system-ui, sans-serif' }} />
        )}
        <canvas ref={live} className="absolute inset-0 select-none" style={{ touchAction: penOnly ? 'pan-x pan-y' : 'none', cursor: tool === 'eraser' ? 'cell' : tool === 'text' ? 'text' : tool === 'lasso' ? 'default' : 'crosshair' }}
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onContextMenu={(e) => e.preventDefault()}
          role="img" aria-label={tx(`Page ${at + 1} of ${n}: ${strokes.current.length} strokes`, `الصفحة ${at + 1} من ${n}`)} />
      </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
        {iconBtn(() => setIndex(Math.max(0, at - 1)), ChevronLeft, tx('Previous page', 'الصفحة السابقة'), at === 0)}
        <span className="min-w-16 text-center text-sm tabular-nums text-muted-foreground" aria-live="polite">{at + 1} / {n}</span>
        {iconBtn(() => setIndex(Math.min(n - 1, at + 1)), ChevronRight, tx('Next page', 'الصفحة التالية'), at >= n - 1)}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        {iconBtn(() => { const i = notebooks.addPage(nb.id, at); setIndex(i); }, FilePlus2, tx('Add a page after this one', 'إضافة صفحة بعد هذه'))}
        {iconBtn(() => { const i = notebooks.duplicatePage(nb.id, at); setIndex(i); toast({ title: tx('Page duplicated', 'كُررت الصفحة') }); }, CopyPlus, tx('Duplicate this page', 'تكرار هذه الصفحة'))}
        {iconBtn(() => { notebooks.movePage(nb.id, at, at - 1); setIndex(at - 1); }, MoveLeft, tx('Move page earlier', 'انقل الصفحة للأمام'), at === 0)}
        {iconBtn(() => { notebooks.movePage(nb.id, at, at + 1); setIndex(at + 1); }, MoveRight, tx('Move page later', 'انقل الصفحة للخلف'), at >= n - 1)}
        {iconBtn(() => {
          const removed = nb.pages[at]!;
          notebooks.removePage(nb.id, at); setIndex(Math.max(0, at - 1));
          toast({ title: tx('Page deleted', 'حُذفت الصفحة'), tone: 'info', action: removed.strokes.length ? { label: tx('Undo', 'تراجع'), onClick: () => notebooks.restore({ ...nb }) } : undefined });
        }, Trash2, tx('Delete this page', 'حذف هذه الصفحة'))}
        <span className="mx-1 h-6 w-px bg-border" aria-hidden />
        {iconBtn(() => setZoom((z) => Math.max(1, z - 0.5)), ZoomOut, tx('Zoom out', 'تصغير'), zoom <= 1)}
        <button type="button" onClick={() => setZoom(1)} className="h-10 min-w-12 rounded-full text-xs tabular text-muted-foreground hover:bg-surface-2" aria-label={tx('Fit the page', 'ملاءمة الصفحة')}>{Math.round(zoom * 100)}%</button>
        {iconBtn(() => setZoom((z) => Math.min(3, z + 0.5)), ZoomIn, tx('Zoom in', 'تكبير'), zoom >= 3)}
      </div>
    </div>
  );
}

export type { Notebook };
