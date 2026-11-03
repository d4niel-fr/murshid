'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Dialog as D } from 'radix-ui';
import {
  ArrowLeft, ArrowUpRight, Circle, Copy, Download, Eraser, Hand, Highlighter, ImagePlus, Maximize, Minus, MousePointer2, PenLine, Plus, Presentation, Redo2, Slash, Square, StickyNote, Trash2, Type, Undo2,
} from 'lucide-react';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Ago } from '@/components/shared/ago';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Select } from '@/components/ui/input';
import { count } from '@/lib/plural';
import { SUBJECTS } from '@/lib/study';
import { cn } from '@/lib/utils';
import {
  BOARD_INK, bbox, boards, hit, moveEl, STICKY, strokePath, unionBox, useBoards, wrap,
  type Background, type Board, type Box, type El, type Pt, type ShapeEl, type View,
} from '@/lib/whiteboard';

type Tool = 'select' | 'hand' | 'pen' | 'highlighter' | 'eraser' | 'rect' | 'ellipse' | 'line' | 'arrow' | 'text' | 'sticky';
const newId = () => `el_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---------------------------------------------------------------- drawing one element */

const ElView = memo(function ElView({ e }: { e: El }) {
  if (e.type === 'stroke') return <path d={strokePath(e.points)} fill="none" stroke={e.color} strokeWidth={e.size} strokeLinecap="round" strokeLinejoin="round" opacity={e.tool === 'highlighter' ? 0.35 : 1} />;
  if (e.type === 'rect') { const b = bbox(e); return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill={e.fill ? e.color : 'none'} fillOpacity={e.fill ? 0.18 : 0} stroke={e.color} strokeWidth={e.size} />; }
  if (e.type === 'ellipse') { const b = bbox(e); return <ellipse cx={b.x + b.w / 2} cy={b.y + b.h / 2} rx={b.w / 2} ry={b.h / 2} fill={e.fill ? e.color : 'none'} fillOpacity={e.fill ? 0.18 : 0} stroke={e.color} strokeWidth={e.size} />; }
  if (e.type === 'line' || e.type === 'arrow') {
    const a = Math.atan2(e.y2 - e.y1, e.x2 - e.x1); const h = 10 + e.size * 2.2;
    return (
      <g stroke={e.color} strokeWidth={e.size} strokeLinecap="round" fill="none">
        <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} />
        {e.type === 'arrow' && <path d={`M${e.x2 - h * Math.cos(a - 0.45)} ${e.y2 - h * Math.sin(a - 0.45)}L${e.x2} ${e.y2}L${e.x2 - h * Math.cos(a + 0.45)} ${e.y2 - h * Math.sin(a + 0.45)}`} strokeLinejoin="round" />}
      </g>
    );
  }
  if (e.type === 'text') return <text x={e.x} y={e.y} fill={e.color} fontSize={e.size} fontFamily="Onest, system-ui, sans-serif" fontWeight={500}>{e.text.split('\n').map((l, i) => <tspan key={i} x={e.x} dy={i ? e.size * 1.25 : 0}>{l || ' '}</tspan>)}</text>;
  if (e.type === 'sticky') {
    const size = 17; const ls = wrap(e.text, e.w - 28, size);
    return (
      <g>
        <rect x={e.x + 3} y={e.y + 5} width={e.w} height={e.h} rx={10} fill="#000" opacity={0.08} />
        <rect x={e.x} y={e.y} width={e.w} height={e.h} rx={10} fill={e.color} />
        <text x={e.x + 14} y={e.y + 30} fill="#1f2937" fontSize={size} fontFamily="Onest, system-ui, sans-serif">{ls.slice(0, Math.floor((e.h - 20) / (size * 1.3))).map((l, i) => <tspan key={i} x={e.x + 14} dy={i ? size * 1.3 : 0}>{l || ' '}</tspan>)}</text>
      </g>
    );
  }
  if (e.type !== 'image') return null;
  // eslint-disable-next-line jsx-a11y/alt-text
  return <image href={e.src} x={e.x} y={e.y} width={e.w} height={e.h} preserveAspectRatio="xMidYMid meet" />;
});

function Pattern({ id, bg, view }: { id: string; bg: Background; view: View }) {
  const s = (bg === 'grid' || bg === 'lined' ? 32 : 24) * view.z;
  const ox = view.x % s; const oy = view.y % s;
  return (
    <pattern id={id} width={s} height={s} patternUnits="userSpaceOnUse" x={ox} y={oy}>
      {bg === 'dots' && <circle cx={s / 2} cy={s / 2} r={Math.max(0.8, 1.1 * view.z)} className="fill-[color-mix(in_oklab,var(--text)_22%,transparent)]" />}
      {bg === 'grid' && <path d={`M${s} 0H0V${s}`} fill="none" strokeWidth={1} className="stroke-[color-mix(in_oklab,var(--text)_10%,transparent)]" />}
      {bg === 'lined' && <path d={`M0 ${s - 0.5}H${s}`} fill="none" strokeWidth={1} className="stroke-[color-mix(in_oklab,var(--brand)_22%,transparent)]" />}
    </pattern>
  );
}

/** A small live preview of a board (fits its contents). */
export function BoardThumb({ board, className }: { board: Board; className?: string }) {
  const b = unionBox(board.elements) ?? { x: 0, y: 0, w: 400, h: 300 };
  const pad = 30;
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${Math.max(b.w, 200) + pad * 2} ${Math.max(b.h, 150) + pad * 2}`} preserveAspectRatio="xMidYMid meet" className={className} aria-hidden>
      {board.elements.map((e) => <ElView key={e.id} e={e} />)}
    </svg>
  );
}

/* ---------------------------------------------------------------- list */

export function BoardsView() {
  const { tx, locale, toast } = useApp();
  const router = useRouter();
  const { boards: list } = useBoards();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(''); const [subject, setSubject] = useState('Other'); const [bg, setBg] = useState<Background>('dots');
  const create = () => { const id = boards.create(title || tx('Untitled board', 'سبورة بلا عنوان'), subject, bg); setOpen(false); router.push(`/app/study/whiteboard/${id}`); };
  const remove = (b: Board) => { boards.remove(b.id); toast({ title: tx('Board deleted', 'حُذفت السبورة'), tone: 'info', action: { label: tx('Undo', 'تراجع'), onClick: () => boards.restore(b) } }); };
  return (
    <Page>
      <PageHeader eyebrow={tx('Study tools', 'أدوات الدراسة')} title={tx('Whiteboard', 'السبورة')}
        subtitle={tx('An endless board for diagrams, mind maps and worked examples: draw, add shapes, arrows, sticky notes, text and pictures. Saved on this device.', 'سبورة بلا حدود للرسوم والخرائط الذهنية والأمثلة المحلولة: ارسم وأضف أشكالاً وأسهماً وملاحظات لاصقة ونصاً وصوراً. تُحفظ على هذا الجهاز.')}
        actions={<Button onClick={() => setOpen(true)}><Plus />{tx('New board', 'سبورة جديدة')}</Button>} />
      {list.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="group relative">
              <Link href={`/app/study/whiteboard/${b.id}`} onDoubleClick={() => router.push(`/app/study/whiteboard/${b.id}`)} className="lift card block overflow-hidden">
                <span className="block aspect-[16/10] bg-[var(--bg)] p-3"><BoardThumb board={b} className="size-full" /></span>
                <span className="block border-t border-border p-4"><span className="block truncate font-medium">{b.title}</span><span className="text-xs text-muted-foreground">{b.subject} · {tx(count(b.elements.length, 'item'), `${b.elements.length} عنصر`)} · <Ago ts={b.updatedAt} locale={locale} /></span></span>
              </Link>
              <span className="absolute end-3 top-3 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100">
                <button type="button" onClick={() => { const id = boards.duplicate(b.id); if (id) toast({ title: tx('Board copied', 'نُسخت السبورة') }); }} aria-label={tx(`Duplicate ${b.title}`, `تكرار ${b.title}`)} className="grid size-9 place-items-center rounded-full bg-[var(--popover)] shadow-sm"><Copy className="size-4" /></button>
                <button type="button" onClick={() => remove(b)} aria-label={tx(`Delete ${b.title}`, `حذف ${b.title}`)} className="grid size-9 place-items-center rounded-full bg-[var(--popover)] text-[var(--danger)] shadow-sm"><Trash2 className="size-4" /></button>
              </span>
            </li>
          ))}
        </ul>
      ) : <EmptyState title={tx('No boards yet', 'لا سبورات بعد')} action={<Button onClick={() => setOpen(true)}><Plus />{tx('New board', 'سبورة جديدة')}</Button>}>{tx('Sketch a diagram, plan an essay or work through a problem.', 'ارسم مخططاً أو خطط لمقال أو حلّ مسألة.')}</EmptyState>}
      <D.Root open={open} onOpenChange={setOpen}>
        <DialogContent title={tx('New board', 'سبورة جديدة')}>
          <form onSubmit={(e) => { e.preventDefault(); create(); }} className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Title', 'العنوان')}<Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={tx('e.g. Photosynthesis mind map', 'مثل: خريطة ذهنية للبناء الضوئي')} /></label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">{tx('Subject', 'المادة')}<Select value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.map((x) => <option key={x}>{x}</option>)}</Select></label>
            <fieldset><legend className="mb-1.5 text-sm font-medium">{tx('Background', 'الخلفية')}</legend>
              <div className="grid grid-cols-4 gap-2">{(['dots', 'grid', 'lined', 'blank'] as const).map((k) => <button key={k} type="button" aria-pressed={bg === k} onClick={() => setBg(k)} className={cn('h-11 rounded-[14px] border text-sm', bg === k ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-border')}>{{ dots: tx('Dots', 'نقاط'), grid: tx('Grid', 'مربعات'), lined: tx('Lines', 'أسطر'), blank: tx('Blank', 'فارغة') }[k]}</button>)}</div>
            </fieldset>
            <div className="flex justify-end gap-2"><D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close><Button type="submit">{tx('Create', 'إنشاء')}</Button></div>
          </form>
        </DialogContent>
      </D.Root>
    </Page>
  );
}

/* ---------------------------------------------------------------- editor */

type Op =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | { kind: 'draw'; el: El }
  | { kind: 'erase'; before: El[]; removed: boolean }
  | { kind: 'move'; sx: number; sy: number; before: El[]; moved: boolean }
  | { kind: 'marquee'; x: number; y: number; x2: number; y2: number }
  | { kind: 'resize'; id: string; before: El[] }
  | { kind: 'pinch' };

/** Shrink a picture so a board stays small enough to keep on the device. */
async function readImage(file: File): Promise<{ src: string; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return { src: c.toDataURL('image/jpeg', 0.78), w: c.width, h: c.height };
  } finally { URL.revokeObjectURL(url); }
}

export function BoardEditor() {
  const { id } = useParams<{ id: string }>();
  const { tx, toast } = useApp();
  const { boards: list } = useBoards();
  const board = list.find((b) => b.id === id);
  const [els, setEls] = useState<El[]>(() => board?.elements ?? []);
  const [view, setView] = useState<View>(() => board?.view ?? { x: 0, y: 0, z: 1 });
  const [tool, setTool] = useState<Tool>('pen');
  const [ink, setInk] = useState<string>(BOARD_INK[1]);
  const [size, setSize] = useState(3);
  const [fill, setFill] = useState(false);
  const [stickyColor, setStickyColor] = useState<string>(STICKY[0]);
  const [sel, setSel] = useState<string[]>([]);
  const [draft, setDraft] = useState<El | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [space, setSpace] = useState(false);
  const op = useRef<Op | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; cx: number; cy: number; view: View } | null>(null);
  const penSeen = useRef(false);
  const undo = useRef<El[][]>([]); const redo = useRef<El[][]>([]);
  const [, force] = useState(0);
  const svg = useRef<SVGSVGElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  // load once the store is ready (it reads localStorage after the first render)
  const loaded = useRef(false);
  useEffect(() => { if (board && !loaded.current) { loaded.current = true; setEls(board.elements); setView(board.view); } }, [board]);
  // save (debounced)
  useEffect(() => { if (!loaded.current || !board) return; const t = setTimeout(() => boards.setElements(board.id, els), 300); return () => clearTimeout(t); }, [els]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!loaded.current || !board) return; const t = setTimeout(() => boards.setView(board.id, view), 400); return () => clearTimeout(t); }, [view]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = useCallback((next: El[], before: El[] = els) => { undo.current = [...undo.current.slice(-59), before]; redo.current = []; setEls(next); }, [els]);
  const doUndo = () => { const p = undo.current.pop(); if (!p) return; redo.current.push(els); setEls(p); setSel([]); force((n) => n + 1); };
  const doRedo = () => { const n = redo.current.pop(); if (!n) return; undo.current.push(els); setEls(n); force((x) => x + 1); };

  const toWorld = (cx: number, cy: number): Pt => { const r = svg.current!.getBoundingClientRect(); return [(cx - r.left - view.x) / view.z, (cy - r.top - view.y) / view.z]; };
  const zoomAt = (cx: number, cy: number, factor: number) => setView((v) => {
    const r = svg.current!.getBoundingClientRect(); const z = Math.max(0.1, Math.min(6, v.z * factor));
    const px = cx - r.left; const py = cy - r.top;
    return { z, x: px - ((px - v.x) / v.z) * z, y: py - ((py - v.y) / v.z) * z };
  });
  const fit = () => {
    const b = unionBox(els); const r = svg.current?.getBoundingClientRect(); if (!r) return;
    if (!b) { setView({ x: 0, y: 0, z: 1 }); return; }
    const z = Math.max(0.1, Math.min(2, Math.min((r.width - 80) / Math.max(1, b.w), (r.height - 80) / Math.max(1, b.h))));
    setView({ z, x: r.width / 2 - (b.x + b.w / 2) * z, y: r.height / 2 - (b.y + b.h / 2) * z });
  };
  const topHit = (x: number, y: number) => { for (let i = els.length - 1; i >= 0; i--) if (hit(els[i]!, x, y, 6 / view.z)) return els[i]!; return null; };

  const addEl = (e: El, edit = false) => { commit([...els, e]); setSel([e.id]); if (edit) setEditing(e.id); };

  const onDown = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (editing) { setEditing(null); return; }
    if (ev.pointerType === 'pen') penSeen.current = true;
    svg.current!.setPointerCapture(ev.pointerId);
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    if (pointers.current.size === 2) {
      // two fingers: pinch to zoom and pan; drop whatever one finger started
      const [a, b] = [...pointers.current.values()];
      pinch.current = { d: Math.hypot(a!.x - b!.x, a!.y - b!.y), cx: (a!.x + b!.x) / 2, cy: (a!.y + b!.y) / 2, view };
      setDraft(null); op.current = { kind: 'pinch' }; return;
    }
    const [x, y] = toWorld(ev.clientX, ev.clientY);
    const palm = penSeen.current && ev.pointerType === 'touch';
    const t: Tool = space || ev.button === 1 || palm ? 'hand' : tool;
    if (t === 'hand') { op.current = { kind: 'pan', sx: ev.clientX, sy: ev.clientY, view }; return; }
    if (t === 'pen' || t === 'highlighter') { const el: El = { id: newId(), type: 'stroke', tool: t, color: t === 'highlighter' ? '#facc15' : ink, size: t === 'highlighter' ? size * 6 : size, points: [[x, y]] }; op.current = { kind: 'draw', el }; setDraft(el); return; }
    if (t === 'eraser') { op.current = { kind: 'erase', before: els, removed: false }; eraseAt(x, y); return; }
    if (t === 'rect' || t === 'ellipse' || t === 'line' || t === 'arrow') { const el: ShapeEl = { id: newId(), type: t, color: ink, x1: x, y1: y, x2: x, y2: y, size, fill }; op.current = { kind: 'draw', el }; setDraft(el); return; }
    if (t === 'text') { addEl({ id: newId(), type: 'text', color: ink, x, y, text: '', size: 24 }, true); setTool('select'); return; }
    if (t === 'sticky') { addEl({ id: newId(), type: 'sticky', color: stickyColor, x: x - 110, y: y - 75, w: 220, h: 150, text: '' }, true); setTool('select'); return; }
    // select
    const h = topHit(x, y);
    if (h) {
      const next = ev.shiftKey ? (sel.includes(h.id) ? sel.filter((s) => s !== h.id) : [...sel, h.id]) : sel.includes(h.id) ? sel : [h.id];
      setSel(next); op.current = { kind: 'move', sx: x, sy: y, before: els, moved: false };
    } else { if (!ev.shiftKey) setSel([]); op.current = { kind: 'marquee', x, y, x2: x, y2: y }; }
  };
  const eraseAt = (x: number, y: number) => setEls((cur) => { const keep = cur.filter((e) => !hit(e, x, y, 10 / view.z)); if (keep.length !== cur.length && op.current?.kind === 'erase') op.current.removed = true; return keep.length === cur.length ? cur : keep; });

  const onMove = (ev: React.PointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(ev.pointerId)) return;
    pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
    const o = op.current; if (!o) return;
    if (o.kind === 'pinch' && pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]; const p = pinch.current;
      const d = Math.hypot(a!.x - b!.x, a!.y - b!.y); const cx = (a!.x + b!.x) / 2; const cy = (a!.y + b!.y) / 2;
      const r = svg.current!.getBoundingClientRect(); const z = Math.max(0.1, Math.min(6, p.view.z * (d / p.d)));
      const px = p.cx - r.left; const py = p.cy - r.top;
      setView({ z, x: px - ((px - p.view.x) / p.view.z) * z + (cx - p.cx), y: py - ((py - p.view.y) / p.view.z) * z + (cy - p.cy) });
      return;
    }
    if (o.kind === 'pan') { setView({ ...o.view, x: o.view.x + ev.clientX - o.sx, y: o.view.y + ev.clientY - o.sy }); return; }
    const [x, y] = toWorld(ev.clientX, ev.clientY);
    if (o.kind === 'draw') {
      if (o.el.type === 'stroke') {
        const pts: Pt[] = [];
        for (const ce of (ev.nativeEvent.getCoalescedEvents?.() ?? [ev.nativeEvent])) pts.push(toWorld(ce.clientX, ce.clientY));
        const last = o.el.points[o.el.points.length - 1]!;
        const add = pts.filter((p) => Math.hypot(p[0] - last[0], p[1] - last[1]) > 0.8 / view.z);
        if (add.length) { o.el = { ...o.el, points: [...o.el.points, ...add] }; setDraft(o.el); }
      } else if (o.el.type !== 'text' && o.el.type !== 'sticky' && o.el.type !== 'image') {
        let x2 = x; let y2 = y;
        if (ev.shiftKey) {
          const dx = x - o.el.x1; const dy = y - o.el.y1;
          if (o.el.type === 'rect' || o.el.type === 'ellipse') { const m = Math.max(Math.abs(dx), Math.abs(dy)); x2 = o.el.x1 + Math.sign(dx || 1) * m; y2 = o.el.y1 + Math.sign(dy || 1) * m; }
          else { const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const l = Math.hypot(dx, dy); x2 = o.el.x1 + Math.cos(a) * l; y2 = o.el.y1 + Math.sin(a) * l; }
        }
        o.el = { ...o.el, x2, y2 }; setDraft(o.el);
      }
      return;
    }
    if (o.kind === 'erase') { eraseAt(x, y); return; }
    if (o.kind === 'move') {
      const dx = x - o.sx; const dy = y - o.sy; if (!dx && !dy) return;
      o.moved = true; const ids = new Set(sel);
      setEls(o.before.map((e) => (ids.has(e.id) ? moveEl(e, dx, dy) : e)));
      return;
    }
    if (o.kind === 'resize') {
      setEls(o.before.map((e) => {
        if (e.id !== o.id) return e;
        if (e.type === 'sticky' || e.type === 'image') { const w = Math.max(60, x - e.x); return { ...e, w, h: e.type === 'image' ? w * (e.h / e.w) : Math.max(60, y - e.y) }; }
        if (e.type === 'rect' || e.type === 'ellipse') return { ...e, x2: x, y2: y };
        if (e.type === 'text') return { ...e, size: Math.max(10, Math.min(160, Math.round((y - (e.y - e.size)) / (e.text.split('\n').length * 1.25)))) };
        return e;
      }));
      return;
    }
    if (o.kind === 'marquee') { o.x2 = x; o.y2 = y; setMarquee({ x: Math.min(o.x, x), y: Math.min(o.y, y), w: Math.abs(x - o.x), h: Math.abs(y - o.y) }); }
  };

  const onUp = (ev: React.PointerEvent<SVGSVGElement>) => {
    pointers.current.delete(ev.pointerId);
    const o = op.current;
    if (o?.kind === 'pinch') { if (pointers.current.size === 0) { op.current = null; pinch.current = null; } return; }
    op.current = null;
    if (!o) return;
    if (o.kind === 'draw') {
      setDraft(null);
      const e = o.el;
      const tiny = e.type === 'stroke' ? false : e.type !== 'text' && e.type !== 'sticky' && e.type !== 'image' && Math.hypot(e.x2 - e.x1, e.y2 - e.y1) < 4;
      if (!tiny) commit([...els, e]);
    }
    if (o.kind === 'erase' && o.removed) { undo.current = [...undo.current.slice(-59), o.before]; redo.current = []; }
    if (o.kind === 'move' && o.moved) { undo.current = [...undo.current.slice(-59), o.before]; redo.current = []; }
    if (o.kind === 'resize') { undo.current = [...undo.current.slice(-59), o.before]; redo.current = []; }
    if (o.kind === 'marquee') {
      setMarquee(null);
      const box = { x: Math.min(o.x, o.x2), y: Math.min(o.y, o.y2), w: Math.abs(o.x2 - o.x), h: Math.abs(o.y2 - o.y) };
      if (box.w > 3 || box.h > 3) {
        const inside = els.filter((e) => { const b = bbox(e); return b.x >= box.x && b.y >= box.y && b.x + b.w <= box.x + box.w && b.y + b.h <= box.y + box.h; }).map((e) => e.id);
        setSel((cur) => (ev.shiftKey ? [...new Set([...cur, ...inside])] : inside));
      }
    }
  };

  const onWheel = (ev: React.WheelEvent<SVGSVGElement>) => {
    if (ev.ctrlKey || ev.metaKey) zoomAt(ev.clientX, ev.clientY, Math.exp(-ev.deltaY * 0.01));
    else setView((v) => ({ ...v, x: v.x - ev.deltaX, y: v.y - ev.deltaY }));
  };
  // the page should not scroll or zoom while the board is under the pointer
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const stop = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', stop, { passive: false });
    return () => el.removeEventListener('wheel', stop);
  }, [board?.id]);

  const selected = els.filter((e) => sel.includes(e.id));
  const delSel = () => { if (!sel.length) return; commit(els.filter((e) => !sel.includes(e.id))); setSel([]); };
  const dupSel = () => { if (!sel.length) return; const copies = selected.map((e) => ({ ...moveEl(e, 24, 24), id: newId() })); commit([...els, ...copies]); setSel(copies.map((c) => c.id)); };
  const recolor = (c: string) => { setInk(c); if (sel.length) commit(els.map((e) => (sel.includes(e.id) && e.type !== 'image' && e.type !== 'sticky' ? { ...e, color: c } : e))); };
  const editEl = els.find((e) => e.id === editing) as Extract<El, { type: 'text' | 'sticky' }> | undefined;
  const setText = (text: string) => setEls((cur) => cur.map((e) => (e.id === editing && (e.type === 'text' || e.type === 'sticky') ? { ...e, text } : e)));
  const endEdit = () => { if (editEl && editEl.type === 'text' && !editEl.text.trim()) setEls((cur) => cur.filter((e) => e.id !== editEl.id)); setEditing(null); };

  const insertImages = async (files: File[]) => {
    const r = svg.current?.getBoundingClientRect(); if (!r) return;
    const added: El[] = [];
    for (const f of files.filter((x) => x.type.startsWith('image/')).slice(0, 4)) {
      try {
        const img = await readImage(f); const k = Math.min(1, 480 / Math.max(img.w, img.h));
        const [cx, cy] = toWorld(r.left + r.width / 2, r.top + r.height / 2);
        added.push({ id: newId(), type: 'image', color: '#000', x: cx - (img.w * k) / 2 + added.length * 30, y: cy - (img.h * k) / 2 + added.length * 30, w: img.w * k, h: img.h * k, src: img.src });
      } catch { toast({ title: tx('That picture could not be added', 'تعذّرت إضافة الصورة'), tone: 'danger' }); }
    }
    if (added.length) { commit([...els, ...added]); setSel(added.map((a) => a.id)); setTool('select'); }
  };

  // keyboard: tools, undo/redo, delete, duplicate, select all, nudge, zoom (captured so app-wide shortcuts stay out)
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('input,textarea,select,[contenteditable]')) return;
      const mod = e.metaKey || e.ctrlKey; const k = e.key.toLowerCase();
      const handled = () => { e.preventDefault(); e.stopImmediatePropagation(); };
      if (k === ' ' && !e.repeat) { setSpace(true); handled(); return; }
      if (mod && k === 'z') { handled(); if (e.shiftKey) doRedo(); else doUndo(); return; }
      if (mod && k === 'y') { handled(); doRedo(); return; }
      if (mod && k === 'd') { handled(); dupSel(); return; }
      if (mod && k === 'a') { handled(); setSel(els.map((x) => x.id)); setTool('select'); return; }
      if (mod && (k === '=' || k === '+')) { handled(); const r = svg.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); return; }
      if (mod && k === '-') { handled(); const r = svg.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); return; }
      if (mod && k === '0') { handled(); fit(); return; }
      if (mod) return;
      if ((k === 'delete' || k === 'backspace') && sel.length) { handled(); delSel(); return; }
      if (k === 'escape') { setSel([]); return; }
      if (sel.length && k.startsWith('arrow')) { handled(); const d = e.shiftKey ? 10 : 1; const dx = k === 'arrowleft' ? -d : k === 'arrowright' ? d : 0; const dy = k === 'arrowup' ? -d : k === 'arrowdown' ? d : 0; commit(els.map((x) => (sel.includes(x.id) ? moveEl(x, dx, dy) : x))); return; }
      if (sel.length === 1 && k === 'enter') { const one = els.find((x) => x.id === sel[0]); if (one && (one.type === 'text' || one.type === 'sticky')) { handled(); setEditing(one.id); } return; }
      const map: Record<string, Tool> = { v: 'select', h: 'hand', p: 'pen', m: 'highlighter', e: 'eraser', r: 'rect', o: 'ellipse', l: 'line', a: 'arrow', t: 'text', s: 'sticky' };
      if (map[k] && !e.shiftKey) { handled(); setTool(map[k]); }
    };
    const up = (e: KeyboardEvent) => { if (e.key === ' ') setSpace(false); };
    window.addEventListener('keydown', on, { capture: true }); window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', on, { capture: true }); window.removeEventListener('keyup', up); };
  });

  const exportPng = async () => {
    const b = unionBox(els); if (!b) return;
    const pad = 40; const w = b.w + pad * 2; const h = b.h + pad * 2;
    const clone = svg.current!.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', String(w)); clone.setAttribute('height', String(h)); clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
    clone.querySelectorAll('[data-ui]').forEach((n) => n.remove());
    const g = clone.querySelector('[data-world]'); g?.setAttribute('transform', `translate(${pad - b.x} ${pad - b.y})`);
    const bgRect = clone.querySelector('[data-bg]'); bgRect?.setAttribute('fill', '#ffffff');
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = url; });
    const c = document.createElement('canvas'); const scale = Math.min(2, 4000 / Math.max(w, h)); c.width = w * scale; c.height = h * scale;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    const a = document.createElement('a'); a.href = c.toDataURL('image/png'); a.download = `${(board?.title ?? 'board').replace(/[^\p{L}\p{N}]+/gu, '-')}.png`; a.click();
  };

  const selBox = unionBox(selected);
  const single = selected.length === 1 ? selected[0]! : null;
  const resizable = single && (single.type === 'sticky' || single.type === 'image' || single.type === 'rect' || single.type === 'ellipse' || single.type === 'text');
  const cursor = space || tool === 'hand' ? 'grab' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair';
  const toolBtn = (t: Tool, Icon: typeof PenLine, label: string, key: string) => (
    <button key={t} type="button" onClick={() => setTool(t)} aria-pressed={tool === t} aria-label={`${label} (${key})`} title={`${label} (${key})`}
      className={cn('grid size-10 shrink-0 place-items-center rounded-full transition-colors', tool === t ? 'bg-[var(--deep)] text-white' : 'text-foreground hover:bg-surface-2')}><Icon className="size-[18px]" /></button>
  );

  if (!board) return <Page><EmptyState title={tx('This board isn’t here', 'هذه السبورة غير موجودة')} action={<Button asChild><Link href="/app/study/whiteboard">{tx('All boards', 'كل السبورات')}</Link></Button>}>{tx('It may have been deleted on this device.', 'ربما حُذفت على هذا الجهاز.')}</EmptyState></Page>;

  const screen = (x: number, y: number) => ({ left: x * view.z + view.x, top: y * view.z + view.y });
  return (
    <div className="fill-view relative flex flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-3 pb-2 pt-1 md:px-6">
        <Link href="/app/study/whiteboard" className="inline-flex h-10 items-center gap-1 rounded-full px-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Boards', 'السبورات')}</Link>
        <input aria-label={tx('Board title', 'عنوان السبورة')} defaultValue={board.title} onBlur={(e) => boards.rename(board.id, e.target.value)} className="min-w-0 flex-1 truncate rounded-[10px] bg-transparent px-2 py-1.5 text-[0.9375rem] font-medium outline-none hover:bg-surface focus:bg-surface" />
        <Select aria-label={tx('Background', 'الخلفية')} value={board.background} onChange={(e) => boards.setBackground(board.id, e.target.value as Background)} className="h-9 w-28 text-sm">
          <option value="dots">{tx('Dots', 'نقاط')}</option><option value="grid">{tx('Grid', 'مربعات')}</option><option value="lined">{tx('Lines', 'أسطر')}</option><option value="blank">{tx('Blank', 'فارغة')}</option>
        </Select>
        <Button size="sm" variant="secondary" onClick={() => void exportPng()} disabled={!els.length}><Download />{tx('PNG', 'PNG')}</Button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden border-y border-border bg-[var(--bg)] md:mx-6 md:rounded-[24px] md:border"
        onDragOver={(e) => { if ([...e.dataTransfer.items].some((i) => i.kind === 'file')) e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); void insertImages([...e.dataTransfer.files]); }}
        onPaste={(e) => { const files = [...e.clipboardData.files]; if (files.length) { e.preventDefault(); void insertImages(files); } }}>
        <svg ref={svg} className="absolute inset-0 size-full touch-none select-none" style={{ cursor }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
          onDoubleClick={(ev) => { const [x, y] = toWorld(ev.clientX, ev.clientY); const h = topHit(x, y); if (h && (h.type === 'text' || h.type === 'sticky')) { setSel([h.id]); setEditing(h.id); } else if (!h && tool === 'select') { addEl({ id: newId(), type: 'text', color: ink, x, y, text: '', size: 24 }, true); } }}
          role="img" aria-label={tx(`Whiteboard with ${els.length} items`, `سبورة فيها ${els.length} عنصر`)}>
          <defs><Pattern id="wb-bg" bg={board.background} view={view} /></defs>
          {board.background !== 'blank' && <rect data-bg width="100%" height="100%" fill="url(#wb-bg)" />}
          <g data-world transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
            {els.map((e) => editing === e.id && e.type === 'text' ? null : <ElView key={e.id} e={e} />)}
            {draft && <ElView e={draft} />}
            {selBox && (
              <g data-ui pointerEvents="none">
                <rect x={selBox.x - 6 / view.z} y={selBox.y - 6 / view.z} width={selBox.w + 12 / view.z} height={selBox.h + 12 / view.z} fill="none" stroke="var(--brand)" strokeWidth={1.5 / view.z} strokeDasharray={`${5 / view.z} ${4 / view.z}`} rx={4 / view.z} />
              </g>
            )}
            {resizable && selBox && !editing && (
              <rect data-ui x={selBox.x + selBox.w + 2 / view.z} y={selBox.y + selBox.h + 2 / view.z} width={12 / view.z} height={12 / view.z} rx={3 / view.z} fill="var(--brand)" style={{ cursor: 'nwse-resize' }}
                onPointerDown={(ev) => { ev.stopPropagation(); svg.current!.setPointerCapture(ev.pointerId); pointers.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY }); op.current = { kind: 'resize', id: single!.id, before: els }; }} />
            )}
            {marquee && <rect data-ui x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="color-mix(in oklab, var(--brand) 10%, transparent)" stroke="var(--brand)" strokeWidth={1 / view.z} />}
          </g>
        </svg>

        {editEl && (() => {
          const b = bbox(editEl); const pos = screen(b.x, b.y);
          return (
            <textarea autoFocus dir="auto" value={editEl.text} onChange={(e) => setText(e.target.value)} onBlur={endEdit}
              onKeyDown={(e) => { if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); endEdit(); } }}
              aria-label={editEl.type === 'sticky' ? tx('Sticky note text', 'نص الملاحظة اللاصقة') : tx('Text', 'النص')}
              placeholder={tx('Type…', 'اكتب…')}
              style={editEl.type === 'sticky'
                ? { left: pos.left, top: pos.top, width: editEl.w * view.z, height: editEl.h * view.z, fontSize: 17 * view.z, background: editEl.color, padding: 14 * view.z, borderRadius: 10 * view.z }
                : { left: pos.left, top: pos.top, minWidth: 160, width: Math.max(160, b.w * view.z + 40), height: Math.max(editEl.size * 1.6, b.h) * view.z + 16, fontSize: editEl.size * view.z, color: editEl.color, fontWeight: 500 }}
              className={cn('absolute z-10 resize-none overflow-hidden border-0 leading-[1.25] outline-none', editEl.type === 'sticky' ? 'text-[#1f2937] shadow-lg' : 'bg-transparent ring-2 ring-[var(--brand-light)]')} />
          );
        })()}

        {/* toolbar */}
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-2">
          <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border bg-[var(--popover)] p-1.5 shadow-[var(--shadow-2)]">
            {toolBtn('select', MousePointer2, tx('Select', 'تحديد'), 'V')}
            {toolBtn('hand', Hand, tx('Move the board', 'تحريك السبورة'), 'H')}
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            {toolBtn('pen', PenLine, tx('Pen', 'قلم'), 'P')}
            {toolBtn('highlighter', Highlighter, tx('Highlighter', 'قلم تمييز'), 'M')}
            {toolBtn('eraser', Eraser, tx('Eraser', 'ممحاة'), 'E')}
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            {toolBtn('rect', Square, tx('Rectangle', 'مستطيل'), 'R')}
            {toolBtn('ellipse', Circle, tx('Ellipse', 'شكل بيضوي'), 'O')}
            {toolBtn('line', Slash, tx('Line', 'خط'), 'L')}
            {toolBtn('arrow', ArrowUpRight, tx('Arrow', 'سهم'), 'A')}
            {toolBtn('text', Type, tx('Text', 'نص'), 'T')}
            {toolBtn('sticky', StickyNote, tx('Sticky note', 'ملاحظة لاصقة'), 'S')}
            <button type="button" onClick={() => fileInput.current?.click()} aria-label={tx('Add a picture', 'أضف صورة')} title={tx('Add a picture (or paste / drop one)', 'أضف صورة (أو الصق / أفلت)')} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2"><ImagePlus className="size-[18px]" /></button>
            <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void insertImages([...(e.target.files ?? [])]); e.target.value = ''; }} />
            <span className="mx-1 h-6 w-px shrink-0 bg-border" />
            <button type="button" onClick={doUndo} disabled={!undo.current.length} aria-label={tx('Undo', 'تراجع')} title={`${tx('Undo', 'تراجع')} (⌘Z)`} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-35"><Undo2 className="size-[18px]" /></button>
            <button type="button" onClick={doRedo} disabled={!redo.current.length} aria-label={tx('Redo', 'إعادة')} title={`${tx('Redo', 'إعادة')} (⇧⌘Z)`} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-surface-2 disabled:opacity-35"><Redo2 className="size-[18px]" /></button>
          </div>
        </div>

        {/* style + selection bar */}
        <div className="absolute start-3 top-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border bg-[var(--popover)] p-2 shadow-sm">
            {(tool === 'sticky' ? STICKY : BOARD_INK).map((c) => (
              <button key={c} type="button" onClick={() => (tool === 'sticky' ? setStickyColor(c) : recolor(c))} aria-label={tx(`Colour ${c}`, `اللون ${c}`)} aria-pressed={(tool === 'sticky' ? stickyColor : ink) === c}
                className={cn('size-7 rounded-full ring-offset-2 ring-offset-[var(--popover)]', (tool === 'sticky' ? stickyColor : ink) === c && 'ring-2 ring-[var(--text)]')} style={{ background: c }} />
            ))}
            {tool !== 'sticky' && <>
              <span className="mx-1 h-5 w-px bg-border" />
              {[2, 3, 6].map((w) => <button key={w} type="button" onClick={() => setSize(w)} aria-pressed={size === w} aria-label={tx(`Thickness ${w}`, `السماكة ${w}`)} className={cn('grid size-7 place-items-center rounded-full', size === w && 'bg-surface-2')}><span className="rounded-full bg-[var(--text)]" style={{ width: w + 2, height: w + 2 }} /></button>)}
              {(tool === 'rect' || tool === 'ellipse') && <button type="button" onClick={() => setFill((f) => !f)} aria-pressed={fill} className={cn('h-7 rounded-full px-2.5 text-xs', fill ? 'bg-[var(--deep)] text-white' : 'bg-surface')}>{tx('Fill', 'تعبئة')}</button>}
            </>}
          </div>
          {sel.length > 0 && (
            <div className="flex items-center gap-1 rounded-2xl border border-border bg-[var(--popover)] p-1.5 shadow-sm">
              <span className="px-2 text-xs text-muted-foreground">{tx(`${sel.length} selected`, `${sel.length} محدد`)}</span>
              <button type="button" onClick={dupSel} aria-label={tx('Duplicate', 'تكرار')} title={`${tx('Duplicate', 'تكرار')} (⌘D)`} className="grid size-8 place-items-center rounded-full hover:bg-surface-2"><Copy className="size-4" /></button>
              <button type="button" onClick={() => { commit([...els.filter((e) => !sel.includes(e.id)), ...selected]); }} aria-label={tx('Bring to front', 'إلى الأمام')} title={tx('Bring to front', 'إلى الأمام')} className="grid size-8 place-items-center rounded-full hover:bg-surface-2"><Maximize className="size-4" /></button>
              <button type="button" onClick={delSel} aria-label={tx('Delete', 'حذف')} title={`${tx('Delete', 'حذف')} (⌫)`} className="grid size-8 place-items-center rounded-full text-[var(--danger)] hover:bg-surface-2"><Trash2 className="size-4" /></button>
            </div>
          )}
        </div>

        {/* zoom */}
        <div className="absolute end-3 top-3 flex items-center gap-0.5 rounded-full border border-border bg-[var(--popover)] p-1 shadow-sm">
          <button type="button" onClick={() => { const r = svg.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.2); }} aria-label={tx('Zoom out', 'تصغير')} className="grid size-8 place-items-center rounded-full hover:bg-surface-2"><Minus className="size-4" /></button>
          <button type="button" onClick={() => setView((v) => ({ ...v, z: 1 }))} className="h-8 min-w-12 rounded-full px-1 text-xs tabular hover:bg-surface-2" aria-label={tx('Reset zoom', 'إعادة التكبير')}>{Math.round(view.z * 100)}%</button>
          <button type="button" onClick={() => { const r = svg.current!.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }} aria-label={tx('Zoom in', 'تكبير')} className="grid size-8 place-items-center rounded-full hover:bg-surface-2"><Plus className="size-4" /></button>
          <button type="button" onClick={fit} aria-label={tx('Fit everything', 'عرض الكل')} title={`${tx('Fit everything', 'عرض الكل')} (⌘0)`} className="grid size-8 place-items-center rounded-full hover:bg-surface-2"><Presentation className="size-4" /></button>
        </div>
        {!els.length && <p className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-sm text-muted-foreground">{tx('Draw anywhere. Two fingers or the scroll wheel move the board; pinch or ⌘ + scroll to zoom.', 'ارسم في أي مكان. حرّك السبورة بإصبعين أو بعجلة الفأرة؛ كبّر بالقرص أو ⌘ + التمرير.')}</p>}
      </div>
    </div>
  );
}
