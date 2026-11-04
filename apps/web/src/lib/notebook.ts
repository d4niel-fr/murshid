'use client';

import { createLocalStore, uid } from './local-store';

/**
 * Handwritten notebooks (GoodNotes-style): pages of pen and highlighter strokes on lined, grid, dotted or blank paper.
 * Points are stored in page units (a 1000 × 1414 A4 page), rounded, with pressure 0..100, so a page redraws sharply at
 * any screen size and stays small in localStorage.
 */
export const PAGE_W = 1000;
export const PAGE_H = 1414;

export type Tool = 'pen' | 'highlighter' | 'eraser' | 'lasso' | 'shape' | 'text';
export type Paper = 'lined' | 'cornell' | 'grid' | 'dotted' | 'blank';
/** [x, y, pressure 0..100] */
export type Pt = [number, number, number];
export interface Stroke { id: string; tool: 'pen' | 'highlighter'; color: string; size: number; points: Pt[]; /** a neat shape: drawn with straight segments */ shape?: boolean }
/** A typed text box on a page (page units; y is the first line's baseline). */
export interface NoteText { id: string; x: number; y: number; text: string; size: number; color: string }
export interface NotePage { id: string; strokes: Stroke[]; texts?: NoteText[] }
export interface Notebook { id: string; title: string; subject: string; paper: Paper; cover: string; pages: NotePage[]; createdAt: number; updatedAt: number; /** the school assignment these notes are for */ assignmentId?: string }
export interface NotebookState { notebooks: Notebook[] }

export const INK = ['#111827', '#0f2f63', '#2563c9', '#c2410c', '#15803d', '#7c3aed'] as const;
export const HIGHLIGHT = ['#fde047', '#86efac', '#93c5fd', '#f9a8d4'] as const;
export const COVERS = ['#0f2f63', '#2563c9', '#0b6e97', '#7c3aed', '#c2410c', '#15803d'] as const;

const page = (): NotePage => ({ id: uid('pg_'), strokes: [] });

function seed(): NotebookState {
  const now = Date.now();
  return { notebooks: [{ id: 'nb_physics', title: 'Physics: forces', subject: 'Physics', paper: 'grid', cover: COVERS[0], pages: [{ id: 'pg_physics_1', strokes: [] }], createdAt: now, updatedAt: now }] };
}

export const notebookStore = createLocalStore<NotebookState>('notebooks', seed, {
  migrate: (raw) => (raw && typeof raw === 'object' && Array.isArray((raw as NotebookState).notebooks) ? (raw as NotebookState) : null),
});
export const useNotebooks = () => notebookStore.use();

const touch = (id: string, fn: (n: Notebook) => Notebook) =>
  notebookStore.set((s) => ({ notebooks: s.notebooks.map((n) => (n.id === id ? { ...fn(n), updatedAt: Date.now() } : n)) }));

export const notebooks = {
  create(title: string, subject: string, paper: Paper, assignmentId?: string): string {
    const id = uid('nb_'); const now = Date.now();
    const cover = COVERS[notebookStore.get().notebooks.length % COVERS.length]!;
    notebookStore.set((s) => ({ notebooks: [{ id, title: title.trim() || 'Untitled notebook', subject, paper, cover, pages: [page()], createdAt: now, updatedAt: now, ...(assignmentId ? { assignmentId } : {}) }, ...s.notebooks] }));
    return id;
  },
  /** The notebook kept for a school assignment, created on first use (Cornell paper: cues, notes, summary). */
  forAssignment(assignmentId: string, title: string, subject: string): string {
    const found = notebookStore.get().notebooks.find((n) => n.assignmentId === assignmentId);
    return found ? found.id : notebooks.create(title, subject, 'cornell', assignmentId);
  },
  rename(id: string, title: string) { touch(id, (n) => ({ ...n, title: title.trim() || n.title })); },
  setPaper(id: string, paper: Paper) { touch(id, (n) => ({ ...n, paper })); },
  remove(id: string) { notebookStore.set((s) => ({ notebooks: s.notebooks.filter((n) => n.id !== id) })); },
  restore(n: Notebook) { notebookStore.set((s) => ({ notebooks: [n, ...s.notebooks.filter((x) => x.id !== n.id)] })); },
  addPage(id: string, after?: number): number {
    let at = 0;
    touch(id, (n) => { const pages = [...n.pages]; at = after === undefined ? pages.length : after + 1; pages.splice(at, 0, page()); return { ...n, pages }; });
    return at;
  },
  removePage(id: string, index: number) { touch(id, (n) => (n.pages.length <= 1 ? { ...n, pages: [page()] } : { ...n, pages: n.pages.filter((_, i) => i !== index) })); },
  setStrokes(id: string, pageId: string, strokes: Stroke[]) { touch(id, (n) => ({ ...n, pages: n.pages.map((p) => (p.id === pageId ? { ...p, strokes } : p)) })); },
  setTexts(id: string, pageId: string, texts: NoteText[]) { touch(id, (n) => ({ ...n, pages: n.pages.map((p) => (p.id === pageId ? { ...p, texts } : p)) })); },
  /** A copy of a page, straight after it. Returns the copy's index. */
  duplicatePage(id: string, index: number): number {
    touch(id, (n) => { const pages = [...n.pages]; const src = pages[index]; if (!src) return n; pages.splice(index + 1, 0, { ...src, id: uid('pg_'), strokes: src.strokes.map((st) => ({ ...st, id: uid('s') })), texts: src.texts?.map((t) => ({ ...t, id: uid('tx_') })) }); return { ...n, pages }; });
    return index + 1;
  },
  movePage(id: string, from: number, to: number) {
    touch(id, (n) => { if (to < 0 || to >= n.pages.length) return n; const pages = [...n.pages]; const [pg] = pages.splice(from, 1); pages.splice(to, 0, pg!); return { ...n, pages }; });
  },
};

/** Drop points closer than `min` page units to the last kept point (keeps the shape, shrinks storage). */
export function simplify(points: Pt[], min = 1.6): Pt[] {
  if (points.length < 3) return points;
  const out: Pt[] = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]!; const q = out[out.length - 1]!;
    if (Math.hypot(p[0] - q[0], p[1] - q[1]) >= min) out.push(p);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/** Whether a point (page units) touches a stroke, within `r`. Used by the eraser. */
export function hits(stroke: Stroke, x: number, y: number, r: number): boolean {
  const reach = r + stroke.size / 2;
  for (let i = 0; i < stroke.points.length; i++) {
    const a = stroke.points[i]!; const b = stroke.points[i + 1] ?? a;
    const dx = b[0] - a[0]; const dy = b[1] - a[1]; const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / len2)) : 0;
    if (Math.hypot(x - (a[0] + t * dx), y - (a[1] + t * dy)) <= reach) return true;
  }
  return false;
}

/** Pen width at a point: thinner on light pressure, like a real pen. */
export const widthAt = (s: Stroke, pressure: number) => (s.tool === 'highlighter' ? s.size : s.size * (0.45 + (pressure / 100) * 0.9));

/* ------------------------------------------------------------------ shapes */

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);
/**
 * A rough hand-drawn shape made neat: a straight line, a box, a circle or ellipse, or a triangle. Returns the neat
 * points, or null when the stroke is not a shape (it then stays as it was drawn).
 */
export function recognise(points: Pt[]): Pt[] | null {
  if (points.length < 3) return null;
  const xs = points.map((p) => p[0]); const ys = points.map((p) => p[1]);
  const x0 = Math.min(...xs); const y0 = Math.min(...ys); const w = Math.max(...xs) - x0; const h = Math.max(...ys) - y0;
  if (Math.hypot(w, h) < 24) return null;
  let len = 0; for (let i = 1; i < points.length; i++) len += dist(points[i - 1]!, points[i]!);
  const a = points[0]!; const z = points[points.length - 1]!; const P = 60;
  const closed = dist(a, z) < Math.max(28, len * 0.16);
  if (!closed) {
    const chord = dist(a, z); if (chord < 24) return null;
    let dev = 0;
    for (const p of points) dev = Math.max(dev, Math.abs((z[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (z[1] - a[1])) / chord);
    return dev / chord < 0.09 ? [[a[0], a[1], P], [z[0], z[1], P]] : null;
  }
  // closed: tell box, ellipse and triangle apart by how much of their bounding box they fill
  let area = 0; for (let i = 0; i < points.length; i++) { const p = points[i]!; const q = points[(i + 1) % points.length]!; area += p[0] * q[1] - q[0] * p[1]; }
  const ratio = Math.abs(area / 2) / Math.max(1, w * h);
  if (ratio >= 0.86) return [[x0, y0, P], [x0 + w, y0, P], [x0 + w, y0 + h, P], [x0, y0 + h, P], [x0, y0, P]];
  if (ratio >= 0.6) {
    const cx = x0 + w / 2; const cy = y0 + h / 2;
    return Array.from({ length: 49 }, (_, i) => { const t = (i / 48) * Math.PI * 2; return [Math.round(cx + Math.cos(t) * (w / 2)), Math.round(cy + Math.sin(t) * (h / 2)), P] as Pt; });
  }
  if (ratio >= 0.33) {
    const c: Pt = [xs.reduce((s2, v) => s2 + v, 0) / xs.length, ys.reduce((s2, v) => s2 + v, 0) / ys.length, P];
    const far = (from: Pt) => points.reduce((best, p) => (dist(p, from) > dist(best, from) ? p : best), points[0]!);
    const A = far(c); const B = far(A);
    const C = points.reduce((best, p) => { const d = (q: Pt) => Math.abs((B[0] - A[0]) * (A[1] - q[1]) - (A[0] - q[0]) * (B[1] - A[1])); return d(p) > d(best) ? p : best; }, points[0]!);
    return [[A[0], A[1], P], [B[0], B[1], P], [C[0], C[1], P], [A[0], A[1], P]];
  }
  return null;
}

/** Whether a point is inside a polygon (the lasso). */
export function inside(pt: [number, number], poly: Pt[]): boolean {
  let yes = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!; const [xj, yj] = poly[j]!;
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) yes = !yes;
  }
  return yes;
}
/** Strokes the lasso caught: most of their points inside the loop. */
export function lassoed(strokes: Stroke[], loop: Pt[]): string[] {
  if (loop.length < 3) return [];
  return strokes.filter((s) => s.points.filter((p) => inside([p[0], p[1]], loop)).length >= s.points.length * 0.6).map((s) => s.id);
}
/** Text boxes whose middle is inside the loop (`box` gives each one's bounds). */
export function lassoedTexts(texts: NoteText[], loop: Pt[], box: (t: NoteText) => { x: number; y: number; w: number; h: number }): string[] {
  if (loop.length < 3) return [];
  return texts.filter((t) => { const b = box(t); return inside([b.x + b.w / 2, b.y + b.h / 2], loop); }).map((t) => t.id);
}
