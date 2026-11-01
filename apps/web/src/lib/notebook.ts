'use client';

import { createLocalStore, uid } from './local-store';

/**
 * Handwritten notebooks (GoodNotes-style): pages of pen and highlighter strokes on lined, grid, dotted or blank paper.
 * Points are stored in page units (a 1000 × 1414 A4 page), rounded, with pressure 0..100, so a page redraws sharply at
 * any screen size and stays small in localStorage.
 */
export const PAGE_W = 1000;
export const PAGE_H = 1414;

export type Tool = 'pen' | 'highlighter' | 'eraser';
export type Paper = 'lined' | 'cornell' | 'grid' | 'dotted' | 'blank';
/** [x, y, pressure 0..100] */
export type Pt = [number, number, number];
export interface Stroke { id: string; tool: 'pen' | 'highlighter'; color: string; size: number; points: Pt[] }
export interface NotePage { id: string; strokes: Stroke[] }
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
