/**
 * The Murshid bot's face, as geometry. Each eye is a rounded capsule drawn on a 3D sphere (the head): it is laid out
 * in the head's own frame, turned with the head (yaw, pitch, roll) and projected back to 2D, so the eyes slide and
 * foreshorten as the bot looks around instead of just moving flat. Moods are sets of eye parameters that the
 * renderer blends between. Pure functions, no DOM: the same code draws the first (server) frame and every frame after.
 */

export type BotMood = 'idle' | 'happy' | 'thinking' | 'talking' | 'listening' | 'sleepy';
export type BotEyes = 'tall' | 'round' | 'wide' | 'mono';

/** One eye, in radians on the head: where it sits (u across, v up), how long and thick it is, its tilt and bend. */
export interface Eye { u: number; v: number; len: number; thick: number; tilt: number; bend: number }
export interface Pose { yaw: number; pitch: number; roll: number; open: number; eyes: [Eye, Eye]; mono: boolean }

type V3 = [number, number, number];
const rotY = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) + z * Math.sin(a), y, -x * Math.sin(a) + z * Math.cos(a)];
const rotX = ([x, y, z]: V3, a: number): V3 => [x, y * Math.cos(a) + z * Math.sin(a), -y * Math.sin(a) + z * Math.cos(a)];
const rotZ = ([x, y, z]: V3, a: number): V3 => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z];

/** The eye's outline in its own flat frame (radians): a capsule around a straight or arched spine. */
function capsule(e: Eye, open: number): [number, number][] {
  const L = e.len * open; const w = e.thick / 2; const half = L / 2;
  if (L < 1e-4) {
    return Array.from({ length: 20 }, (_, i) => { const a = (i / 20) * Math.PI * 2; return [Math.cos(a) * w, Math.sin(a) * w] as [number, number]; });
  }
  // spine along y, bent sideways (x) by `bend` at the middle
  const S = 10;
  const spine: [number, number][] = []; const tang: [number, number][] = [];
  for (let i = 0; i <= S; i++) {
    const t = -1 + (2 * i) / S;
    spine.push([e.bend * half * (1 - t * t), t * half]);
    const dx = e.bend * half * (-2 * t); const dy = half; const n = Math.hypot(dx, dy) || 1;
    tang.push([dx / n, dy / n]);
  }
  const left: [number, number][] = []; const right: [number, number][] = [];
  for (let i = 0; i <= S; i++) {
    const [sx, sy] = spine[i]!; const [tx, ty] = tang[i]!;
    left.push([sx - ty * w, sy + tx * w]); right.push([sx + ty * w, sy - tx * w]);
  }
  const cap = (c: [number, number], t: [number, number], from: number) => {
    const out: [number, number][] = []; const base = Math.atan2(t[1], t[0]);
    for (let k = 1; k < 8; k++) { const a = base + from - (k / 8) * Math.PI; out.push([c[0] + Math.cos(a) * w, c[1] + Math.sin(a) * w]); }
    return out;
  };
  return [...left, ...cap(spine[S]!, tang[S]!, Math.PI / 2), ...right.reverse(), ...cap(spine[0]!, [-tang[0]![0], -tang[0]![1]], Math.PI / 2)];
}

/** Lay one eye on the head, turn it with the head and project it: SVG points around (cx, cy) for a head of radius r. */
function eyePoints(e: Eye, p: Pose, cx: number, cy: number, r: number): [number, number][] {
  const flat = capsule(e, p.open);
  const ct = Math.cos(e.tilt); const st = Math.sin(e.tilt);
  return flat.map(([x, y]) => {
    // tilt in the eye's frame, then walk that far over the sphere from the eye's centre
    const a = x * ct - y * st; const b = x * st + y * ct;
    const d = Math.hypot(a, b);
    let q: V3 = d < 1e-6 ? [0, 0, 1] : [(a / d) * Math.sin(d), (b / d) * Math.sin(d), Math.cos(d)];
    q = rotY(rotX(q, e.v), e.u);
    q = rotZ(rotX(rotY(q, p.yaw), p.pitch), p.roll);
    return [cx + q[0] * r, cy - q[1] * r];
  });
}

/** A closed, smooth path through points (quadratic curves through the midpoints). */
export function smoothPath(pts: [number, number][]): string {
  const n = pts.length; if (n < 3) return '';
  const mid = (i: number) => { const a = pts[i % n]!; const b = pts[(i + 1) % n]!; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
  const m0 = mid(0); let d = `M${m0[0]!.toFixed(2)} ${m0[1]!.toFixed(2)}`;
  for (let i = 1; i <= n; i++) { const c = pts[i % n]!; const m = mid(i); d += `Q${c[0].toFixed(2)} ${c[1].toFixed(2)} ${m[0]!.toFixed(2)} ${m[1]!.toFixed(2)}`; }
  return `${d}Z`;
}

export function eyePaths(p: Pose, cx: number, cy: number, r: number): [string, string | null] {
  if (p.mono) return [smoothPath(eyePoints({ ...p.eyes[0], u: (p.eyes[0].u + p.eyes[1].u) / 2 }, p, cx, cy, r)), null];
  return [smoothPath(eyePoints(p.eyes[0], p, cx, cy, r)), smoothPath(eyePoints(p.eyes[1], p, cx, cy, r))];
}

/* ------------------------------------------------------------------ moods */

const pair = (e: Omit<Eye, 'u'> & { u: number }, mirrorTilt = true): [Eye, Eye] => [
  { ...e, u: -e.u, tilt: mirrorTilt ? -e.tilt : e.tilt, bend: mirrorTilt ? -e.bend : e.bend },
  { ...e },
];

/** The base eyes for each eye style, at rest. */
const BASE: Record<BotEyes, Eye> = {
  tall: { u: 0.25, v: 0.12, len: 0.5, thick: 0.21, tilt: 0.12, bend: 0 },
  round: { u: 0.24, v: 0.1, len: 0, thick: 0.27, tilt: 0, bend: 0 },
  wide: { u: 0.29, v: 0.08, len: 0.3, thick: 0.17, tilt: Math.PI / 2 - 0.1, bend: 0 },
  mono: { u: 0, v: 0.1, len: 0.46, thick: 0.32, tilt: 0, bend: 0 },
};

/** The pose a mood asks for (before the pointer, blinking and talking are added). */
export function moodPose(mood: BotMood, eyes: BotEyes): Pose {
  const b = BASE[eyes];
  const mono = eyes === 'mono';
  const at = (e: Partial<Eye>, tiltMirror = true) => pair({ ...b, ...e }, tiltMirror);
  switch (mood) {
    case 'happy': // eyes become arches: horizontal, bent upwards
      return { yaw: 0, pitch: 0.06, roll: 0, open: 1, mono, eyes: pair({ ...b, u: mono ? 0 : 0.3, len: mono ? 0.5 : 0.3, thick: 0.15, tilt: Math.PI / 2, bend: 0.55, v: b.v + 0.02 }, false) };
    case 'thinking': // looks up and to the side, eyes narrower
      return { yaw: 0.32, pitch: 0.24, roll: -0.06, open: 1, mono, eyes: at({ len: Math.max(b.len * 0.85, 0), thick: b.thick * 0.85 }) };
    case 'listening': // eyes a little bigger, head tilted
      return { yaw: 0, pitch: 0.04, roll: 0.09, open: 1, mono, eyes: at({ len: b.len * 1.12, thick: b.thick * 1.12 }) };
    case 'sleepy': // thin, low lines
      return { yaw: 0, pitch: -0.12, roll: 0, open: 1, mono, eyes: pair({ ...b, u: mono ? 0 : 0.27, len: mono ? 0.36 : 0.26, thick: 0.08, tilt: Math.PI / 2, bend: -0.1, v: b.v - 0.04 }, false) };
    case 'talking':
    case 'idle':
    default:
      return { yaw: 0, pitch: 0, roll: 0, open: 1, mono, eyes: at({}) };
  }
}

/** Blend two poses (t = 0..1 of the way from a to b). */
export function mix(a: Pose, b: Pose, t: number): Pose {
  const l = (x: number, y: number) => x + (y - x) * t;
  const e = (x: Eye, y: Eye): Eye => ({ u: l(x.u, y.u), v: l(x.v, y.v), len: l(x.len, y.len), thick: l(x.thick, y.thick), tilt: l(x.tilt, y.tilt), bend: l(x.bend, y.bend) });
  return { yaw: l(a.yaw, b.yaw), pitch: l(a.pitch, b.pitch), roll: l(a.roll, b.roll), open: l(a.open, b.open), mono: b.mono, eyes: [e(a.eyes[0], b.eyes[0]), e(a.eyes[1], b.eyes[1])] };
}

/** How far apart two poses are (to stop animating once settled). */
export function distance(a: Pose, b: Pose): number {
  let d = Math.abs(a.yaw - b.yaw) + Math.abs(a.pitch - b.pitch) + Math.abs(a.roll - b.roll) + Math.abs(a.open - b.open);
  for (let i = 0; i < 2; i++) { const x = a.eyes[i]!; const y = b.eyes[i]!; d += Math.abs(x.u - y.u) + Math.abs(x.v - y.v) + Math.abs(x.len - y.len) + Math.abs(x.thick - y.thick) + Math.abs(x.tilt - y.tilt) + Math.abs(x.bend - y.bend); }
  return d;
}

/* ------------------------------------------------------------------ bodies */

export type BotShape = 'orb' | 'pebble' | 'cube' | 'capsule';
/** Body outlines (superellipses) around (cx, cy) with radius r: the head the eyes are drawn on. */
export function bodyPath(shape: BotShape, cx: number, cy: number, r: number): string {
  const spec = { orb: { w: 1, h: 1, n: 2, taper: 0 }, pebble: { w: 1.02, h: 0.94, n: 2.3, taper: 0.1 }, cube: { w: 0.98, h: 0.94, n: 3.6, taper: 0 }, capsule: { w: 0.8, h: 1.08, n: 2.6, taper: 0 } }[shape];
  const pts: [number, number][] = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2; const c = Math.cos(a); const s = Math.sin(a);
    const x = Math.sign(c) * Math.abs(c) ** (2 / spec.n) * r * spec.w * (1 + spec.taper * (s > 0 ? s : 0) * 0.5);
    const y = Math.sign(s) * Math.abs(s) ** (2 / spec.n) * r * spec.h;
    pts.push([cx + x, cy + y]);
  }
  return smoothPath(pts);
}

/* ------------------------------------------------------------------ colour */

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`;
/** WCAG relative luminance of a #rrggbb colour (0 black … 1 white). */
export function luminance(h: string): number {
  const [r, g, b] = hex(h).map((v) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
/** Contrast ratio between two colours (1 … 21). */
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}
/**
 * Eyes that stay readable on the body: keep the chosen colour when it stands out enough,
 * otherwise use white or near-black, whichever stands out more.
 */
export function readableEyes(eye: string, body: string): string {
  if (contrast(eye, body) >= 2.6) return eye;
  return contrast('#ffffff', body) >= contrast('#141a2e', body) ? '#ffffff' : '#141a2e';
}

/** Mix a colour towards white (t > 0) or black (t < 0). */
export function shadeOf(h: string, t: number): string {
  const c = hex(h); const to = t > 0 ? 255 : 0; const k = Math.abs(t);
  return toHex(c.map((v) => v + (to - v) * k));
}
