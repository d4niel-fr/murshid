'use client';

import { createLocalStore, uid } from './local-store';

/**
 * Whiteboards: an endless board of pen strokes, shapes, arrows, text, sticky notes and pictures, in board units
 * (1 unit = 1 CSS px at 100% zoom). Saved on this device.
 */
export type Background = 'dots' | 'grid' | 'lined' | 'blank';
export type Pt = [number, number];
interface Base { id: string; color: string }
export interface StrokeEl extends Base { type: 'stroke'; tool: 'pen' | 'highlighter'; size: number; points: Pt[] }
export interface ShapeEl extends Base { type: 'rect' | 'ellipse' | 'line' | 'arrow'; x1: number; y1: number; x2: number; y2: number; size: number; fill: boolean }
export interface TextEl extends Base { type: 'text'; x: number; y: number; text: string; size: number }
export interface StickyEl extends Base { type: 'sticky'; x: number; y: number; w: number; h: number; text: string }
export interface ImageEl extends Base { type: 'image'; x: number; y: number; w: number; h: number; src: string }
export type El = StrokeEl | ShapeEl | TextEl | StickyEl | ImageEl;
export interface View { x: number; y: number; z: number }
export interface Board { id: string; title: string; subject: string; background: Background; elements: El[]; view: View; createdAt: number; updatedAt: number }
export interface BoardState { boards: Board[] }

export const BOARD_INK = ['#111827', '#0f2f63', '#2563c9', '#dc2626', '#16a34a', '#7c3aed', '#ea580c'] as const;
export const STICKY = ['#fef08a', '#fbcfe8', '#bfdbfe', '#bbf7d0', '#fed7aa'] as const;

function seed(): BoardState {
  const now = Date.now();
  const elements: El[] = [
    { id: 'el_s1', type: 'sticky', color: STICKY[0], x: 60, y: 60, w: 220, h: 150, text: 'Forces: draw the free-body diagram first' },
    { id: 'el_t1', type: 'text', color: '#0f2f63', x: 340, y: 90, text: 'Resultant force = 6 N − 2 N = 4 N', size: 26 },
    { id: 'el_r1', type: 'rect', color: '#2563c9', x1: 360, y1: 140, x2: 520, y2: 230, size: 3, fill: false },
    { id: 'el_a1', type: 'arrow', color: '#dc2626', x1: 520, y1: 185, x2: 660, y2: 185, size: 3, fill: false },
    { id: 'el_a2', type: 'arrow', color: '#16a34a', x1: 360, y1: 185, x2: 260, y2: 185, size: 3, fill: false },
    { id: 'el_t2', type: 'text', color: '#dc2626', x: 600, y: 165, text: '6 N', size: 20 },
    { id: 'el_t3', type: 'text', color: '#16a34a', x: 262, y: 165, text: '2 N', size: 20 },
  ];
  return { boards: [{ id: 'wb_forces', title: 'Forces: worked example', subject: 'Physics', background: 'dots', elements, view: { x: 40, y: 40, z: 1 }, createdAt: now, updatedAt: now }] };
}

export const boardStore = createLocalStore<BoardState>('boards', seed, {
  migrate: (raw) => (raw && typeof raw === 'object' && Array.isArray((raw as BoardState).boards) ? (raw as BoardState) : null),
});
export const useBoards = () => boardStore.use();

const touch = (id: string, fn: (b: Board) => Board) => boardStore.set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...fn(b), updatedAt: Date.now() } : b)) }));

export const boards = {
  create(title: string, subject: string, background: Background = 'dots'): string {
    const id = uid('wb_'); const now = Date.now();
    boardStore.set((s) => ({ boards: [{ id, title: title.trim() || 'Untitled board', subject, background, elements: [], view: { x: 0, y: 0, z: 1 }, createdAt: now, updatedAt: now }, ...s.boards] }));
    return id;
  },
  rename(id: string, title: string) { touch(id, (b) => ({ ...b, title: title.trim() || b.title })); },
  setBackground(id: string, background: Background) { touch(id, (b) => ({ ...b, background })); },
  setElements(id: string, elements: El[]) { touch(id, (b) => ({ ...b, elements })); },
  setView(id: string, view: View) { boardStore.set((s) => ({ boards: s.boards.map((b) => (b.id === id ? { ...b, view } : b)) })); },
  duplicate(id: string, copy = 'copy'): string | null {
    const b = boardStore.get().boards.find((x) => x.id === id); if (!b) return null;
    const nid = uid('wb_'); const now = Date.now();
    boardStore.set((s) => ({ boards: [{ ...b, id: nid, title: `${b.title} (${copy})`, createdAt: now, updatedAt: now }, ...s.boards] }));
    return nid;
  },
  remove(id: string): Board | undefined {
    const b = boardStore.get().boards.find((x) => x.id === id);
    boardStore.set((s) => ({ boards: s.boards.filter((x) => x.id !== id) }));
    return b;
  },
  restore(b: Board) { boardStore.set((s) => ({ boards: [b, ...s.boards.filter((x) => x.id !== b.id)] })); },
};

/* ------------------------------------------------------------------ geometry */

export interface Box { x: number; y: number; w: number; h: number }
const lines = (t: string) => t.split('\n');
/** Rough text size (no layout engine needed): wide enough for hit-testing and selection boxes. */
export const textBox = (e: TextEl): Box => ({ x: e.x, y: e.y - e.size, w: Math.max(...lines(e.text).map((l) => l.length), 1) * e.size * 0.56, h: lines(e.text).length * e.size * 1.25 });

export function bbox(e: El): Box {
  if (e.type === 'stroke') {
    const xs = e.points.map((p) => p[0]); const ys = e.points.map((p) => p[1]); const pad = e.size / 2;
    return { x: Math.min(...xs) - pad, y: Math.min(...ys) - pad, w: Math.max(...xs) - Math.min(...xs) + pad * 2, h: Math.max(...ys) - Math.min(...ys) + pad * 2 };
  }
  if (e.type === 'text') return textBox(e);
  if (e.type === 'sticky' || e.type === 'image') return { x: e.x, y: e.y, w: e.w, h: e.h };
  return { x: Math.min(e.x1, e.x2), y: Math.min(e.y1, e.y2), w: Math.abs(e.x2 - e.x1), h: Math.abs(e.y2 - e.y1) };
}
export function unionBox(els: El[]): Box | null {
  if (!els.length) return null;
  const bs = els.map(bbox);
  const x = Math.min(...bs.map((b) => b.x)); const y = Math.min(...bs.map((b) => b.y));
  return { x, y, w: Math.max(...bs.map((b) => b.x + b.w)) - x, h: Math.max(...bs.map((b) => b.y + b.h)) - y };
}
function segDist(px: number, py: number, a: Pt, b: Pt) {
  const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2)) : 0;
  return Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy));
}
/** Whether the point (board units) touches the element, within `r`. */
export function hit(e: El, x: number, y: number, r: number): boolean {
  if (e.type === 'stroke') {
    const reach = r + e.size / 2;
    for (let i = 0; i < e.points.length; i++) if (segDist(x, y, e.points[i]!, e.points[i + 1] ?? e.points[i]!) <= reach) return true;
    return false;
  }
  if (e.type === 'line' || e.type === 'arrow') return segDist(x, y, [e.x1, e.y1], [e.x2, e.y2]) <= r + e.size;
  const b = bbox(e);
  return x >= b.x - r && x <= b.x + b.w + r && y >= b.y - r && y <= b.y + b.h + r;
}
export function moveEl(e: El, dx: number, dy: number): El {
  if (e.type === 'stroke') return { ...e, points: e.points.map(([x, y]) => [x + dx, y + dy] as Pt) };
  if (e.type === 'text' || e.type === 'sticky' || e.type === 'image') return { ...e, x: e.x + dx, y: e.y + dy };
  return { ...e, x1: e.x1 + dx, y1: e.y1 + dy, x2: e.x2 + dx, y2: e.y2 + dy };
}
/** Smooth SVG path through stroke points (quadratic curves through midpoints). */
export function strokePath(points: Pt[]): string {
  if (!points.length) return '';
  if (points.length < 3) { const [a, b = a] = points; return `M${a![0]} ${a![1]}L${b![0]} ${b![1]}`; }
  let d = `M${points[0]![0]} ${points[0]![1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!; const q = points[i + 1]!;
    d += `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)} ${((p[1] + q[1]) / 2).toFixed(1)}`;
  }
  const last = points[points.length - 1]!; return `${d}L${last[0]} ${last[1]}`;
}
/** Wrap sticky-note text to fit its width (character estimate). */
export function wrap(text: string, width: number, size: number): string[] {
  const per = Math.max(4, Math.floor(width / (size * 0.55)));
  return text.split('\n').flatMap((para) => {
    const out: string[] = []; let line = '';
    for (const w of para.split(/\s+/)) {
      if ((line ? `${line} ${w}` : w).length > per && line) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
    }
    out.push(line); return out;
  });
}
