'use client';

import { PAGE_H, PAGE_W, widthAt, type Notebook, type Paper, type Stroke } from '@/lib/notebook';

/** Drawing a notebook page: the paper, then each stroke (shared by the editor, exports and hand-ins). */
export function drawPaper(ctx: CanvasRenderingContext2D, paper: Paper, dark: boolean) {
  ctx.fillStyle = dark ? '#0b1626' : '#ffffff';
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const line = dark ? 'rgba(148,163,184,0.22)' : 'rgba(15,47,99,0.13)';
  ctx.strokeStyle = line; ctx.fillStyle = line; ctx.lineWidth = 1.2;
  if (paper === 'cornell') {
    for (let y = 160; y < PAGE_H - 300; y += 40) { ctx.beginPath(); ctx.moveTo(300, y); ctx.lineTo(PAGE_W - 40, y); ctx.stroke(); }
    ctx.strokeStyle = dark ? 'rgba(148,163,184,0.5)' : 'rgba(15,47,99,0.32)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(40, 120); ctx.lineTo(PAGE_W - 40, 120); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(280, 120); ctx.lineTo(280, PAGE_H - 280); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(40, PAGE_H - 280); ctx.lineTo(PAGE_W - 40, PAGE_H - 280); ctx.stroke();
    ctx.fillStyle = dark ? 'rgba(148,163,184,0.55)' : 'rgba(15,47,99,0.4)'; ctx.font = '500 22px system-ui, sans-serif';
    ctx.fillText('CUES', 56, 156); ctx.fillText('NOTES', 316, 156); ctx.fillText('SUMMARY', 56, PAGE_H - 244);
    return;
  }
  if (paper === 'lined') {
    for (let y = 120; y < PAGE_H - 40; y += 40) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(PAGE_W - 40, y); ctx.stroke(); }
    ctx.strokeStyle = dark ? 'rgba(248,113,113,0.35)' : 'rgba(220,38,38,0.28)';
    ctx.beginPath(); ctx.moveTo(110, 40); ctx.lineTo(110, PAGE_H - 40); ctx.stroke();
  } else if (paper === 'grid') {
    for (let x = 40; x <= PAGE_W - 40; x += 40) { ctx.beginPath(); ctx.moveTo(x, 40); ctx.lineTo(x, PAGE_H - 40); ctx.stroke(); }
    for (let y = 40; y <= PAGE_H - 40; y += 40) { ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(PAGE_W - 40, y); ctx.stroke(); }
  } else if (paper === 'dotted') {
    for (let x = 40; x <= PAGE_W - 40; x += 40) for (let y = 40; y <= PAGE_H - 40; y += 40) { ctx.beginPath(); ctx.arc(x, y, 1.8, 0, Math.PI * 2); ctx.fill(); }
  }
}

export function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke) {
  const pts = s.points;
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = s.color; ctx.fillStyle = s.color;
  if (s.tool === 'highlighter') {
    ctx.globalAlpha = 0.38; ctx.globalCompositeOperation = 'multiply'; ctx.lineWidth = s.size;
    ctx.beginPath(); ctx.moveTo(pts[0]![0], pts[0]![1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]![0], pts[i]![1]);
    ctx.stroke();
  } else if (pts.length === 1) {
    ctx.beginPath(); ctx.arc(pts[0]![0], pts[0]![1], widthAt(s, pts[0]![2]) / 2, 0, Math.PI * 2); ctx.fill();
  } else {
    // a quadratic curve through the midpoints, with the width following pressure
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!; const b = pts[i]!;
      const pa = i === 1 ? a : ([(pts[i - 2]![0] + a[0]) / 2, (pts[i - 2]![1] + a[1]) / 2] as const);
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
      ctx.lineWidth = widthAt(s, (a[2] + b[2]) / 2);
      ctx.beginPath(); ctx.moveTo(pa[0], pa[1]); ctx.quadraticCurveTo(a[0], a[1], mid[0], mid[1]); ctx.stroke();
    }
    const last = pts[pts.length - 1]!; const prev = pts[pts.length - 2]!;
    ctx.lineWidth = widthAt(s, last[2]);
    ctx.beginPath(); ctx.moveTo((prev[0] + last[0]) / 2, (prev[1] + last[1]) / 2); ctx.lineTo(last[0], last[1]); ctx.stroke();
  }
  ctx.restore();
}

/** A page as a canvas at `scale` (1 = 1000 x 1414), on white paper, ready to export or upload. */
export function pageCanvas(nb: Notebook, index: number, scale = 1.2): HTMLCanvasElement {
  const c = document.createElement('canvas'); c.width = Math.round(PAGE_W * scale); c.height = Math.round(PAGE_H * scale);
  const ctx = c.getContext('2d')!; ctx.scale(scale, scale);
  drawPaper(ctx, nb.paper, false);
  for (const st of nb.pages[index]?.strokes ?? []) drawStroke(ctx, st);
  return c;
}
