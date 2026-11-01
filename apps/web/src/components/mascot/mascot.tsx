'use client';

import { memo, useEffect, useId, useRef, type ReactNode, type SVGProps } from 'react';
import { useReducedMotion } from 'motion/react';
import type { MascotAccessory, MascotColor, MascotFace, MascotGlow, MascotShape } from '@/lib/prefs';
import { cn } from '@/lib/utils';

/**
 * Murshid, the companion bot: a small shell with a glass screen for a face. The eyes on the screen blink, follow the
 * pointer and change with the conversation (listening, thinking, talking). Students pick the shell shape, the eyes,
 * the shell and glow colours and an accessory in Settings.
 *
 * Built to stay light: eye tracking and blinking write CSS variables and attributes straight onto the SVG (no React
 * re-render per frame), one shared pointer listener serves every mascot on screen, and moods animate in CSS.
 */
export type Mood = 'idle' | 'happy' | 'thinking' | 'talking' | 'listening' | 'sleepy';

export const MASCOT_FILL: Record<MascotColor, { body: string; shade: string }> = {
  navy: { body: '#0f2f63', shade: '#1d4485' },
  royal: { body: '#2563c9', shade: '#3f7ad8' },
  teal: { body: '#0b6e97', shade: '#1c86b0' },
  lime: { body: '#a9c71f', shade: '#c2e029' },
  coral: { body: '#e0603f', shade: '#ee7b5c' },
  violet: { body: '#6250d6', shade: '#7a6ae2' },
};
export const MASCOT_GLOW: Record<MascotGlow, string> = { sky: '#8fbaff', lime: '#c2e029', mint: '#6ee7c8', white: '#f4f7ff', coral: '#ff9d82' };
const SCREEN = '#0b1630';

// the eight-point Murshid star, on a 120 x 120 canvas
const STAR = [[60, 9], [68.8, 38.8], [96, 24], [81.3, 51.2], [111, 60], [81.3, 68.8], [96, 96], [68.8, 81.3], [60, 111], [51.2, 81.3], [24, 96], [38.8, 68.8], [9, 60], [38.8, 51.2], [24, 24], [51.2, 38.8]];
const starPath = (k = 1, dx = 0, dy = 0) => `M${STAR.map(([x, y]) => `${(60 + (x! - 60) * k + dx).toFixed(1)} ${(60 + (y! - 60) * k + dy).toFixed(1)}`).join(' L')}Z`;

interface Geo { top: number; mid: number; left: number; right: number; face: { x: number; y: number; w: number; h: number; r: number }; nubs: boolean }
const GEO: Record<MascotShape, Geo> = {
  orb: { top: 18, mid: 62, left: 16, right: 104, face: { x: 27, y: 42, w: 66, h: 40, r: 20 }, nubs: true },
  cube: { top: 20, mid: 62, left: 16, right: 104, face: { x: 26, y: 40, w: 68, h: 42, r: 15 }, nubs: true },
  capsule: { top: 21, mid: 64, left: 24, right: 96, face: { x: 31, y: 43, w: 58, h: 42, r: 20 }, nubs: true },
  star: { top: 18, mid: 64, left: 14, right: 106, face: { x: 40, y: 51.5, w: 40, h: 25, r: 12 }, nubs: false },
};

type ShapeProps = SVGProps<SVGCircleElement> & SVGProps<SVGRectElement> & SVGProps<SVGPathElement>;
function Body({ shape, ...p }: { shape: MascotShape } & ShapeProps) {
  if (shape === 'orb') return <circle cx="60" cy="62" r="44" {...(p as SVGProps<SVGCircleElement>)} />;
  if (shape === 'cube') return <rect x="16" y="20" width="88" height="84" rx="28" {...(p as SVGProps<SVGRectElement>)} />;
  if (shape === 'capsule') return <rect x="24" y="21" width="72" height="89" rx="36" {...(p as SVGProps<SVGRectElement>)} />;
  return <path d={starPath(0.9, 0, 4)} strokeWidth={8} strokeLinejoin="round" {...(p as SVGProps<SVGPathElement>)} />;
}

/* ---- one pointer listener for every mascot on the page ---- */
const tracked = new Set<SVGSVGElement>();
let raf = 0;
let pointer: { x: number; y: number } | null = null;
function flush() {
  raf = 0; if (!pointer) return;
  const vw = window.innerWidth; const vh = window.innerHeight;
  for (const el of tracked) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue; // off screen: skip
    const dx = pointer.x - (r.left + r.width / 2); const dy = pointer.y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 320);
    const lx = ((dx / d) * k).toFixed(2); const ly = ((dy / d) * k).toFixed(2);
    // written on the eyes only, so only they restyle (and a redrawn face picks it up on the next move)
    const eyes = el.querySelector<SVGGElement>('.mascot-gaze');
    if (!eyes || (eyes.dataset.lx === lx && eyes.dataset.ly === ly)) continue;
    eyes.dataset.lx = lx; eyes.dataset.ly = ly;
    eyes.style.setProperty('--lx', lx); eyes.style.setProperty('--ly', ly);
  }
}
const onMove = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(flush); };
function follow(el: SVGSVGElement) {
  tracked.add(el);
  if (tracked.size === 1) window.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    tracked.delete(el);
    if (!tracked.size) { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); raf = 0; }
  };
}

function MascotImpl({
  size = 96, mood = 'idle', shape = 'orb', face = 'round', color = 'navy', glow = 'sky', accessory = 'none', track = true, grounded = true, className, label,
}: {
  size?: number; mood?: Mood; shape?: MascotShape; face?: MascotFace; color?: MascotColor; glow?: MascotGlow; accessory?: MascotAccessory;
  /** draw the soft shadow underneath (off while flying) */
  grounded?: boolean;
  /** eyes follow the pointer */
  track?: boolean; className?: string; label?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const clip = useId().replace(/:/g, '');
  const f = MASCOT_FILL[color];
  const g = MASCOT_GLOW[glow];
  const geo = GEO[shape];
  const fb = geo.face;

  useEffect(() => {
    const el = ref.current;
    if (!el || !track || reduce) return;
    return follow(el);
  }, [track, reduce]);

  // blink every few seconds, by attribute (no re-render)
  useEffect(() => {
    const el = ref.current;
    if (!el || reduce || mood === 'sleepy' || mood === 'happy') return;
    let t: ReturnType<typeof setTimeout>; let u: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { el.dataset.blink = '1'; u = setTimeout(() => { delete el.dataset.blink; }, 120); loop(); }, 2600 + Math.random() * 3400); };
    loop();
    return () => { clearTimeout(t); clearTimeout(u); delete el.dataset.blink; };
  }, [reduce, mood]);

  // the face, laid out on the screen
  const cx = 60; const cy = fb.y + fb.h * 0.44; const s = fb.h / 42;
  const ex = fb.w * 0.2; const my = fb.y + fb.h * 0.78;
  const twoEyes = face !== 'mono';
  const xs = twoEyes ? [cx - ex, cx + ex] : [cx];
  const line = { fill: 'none', stroke: g, strokeLinecap: 'round' as const, strokeWidth: 3 * s };

  let eyes: ReactNode;
  if (mood === 'happy') {
    const w = twoEyes ? 5.2 * s : 8 * s;
    eyes = <g {...line}>{xs.map((x) => <path key={x} d={`M${x - w} ${cy + 2 * s} Q${x} ${cy - 5.5 * s} ${x + w} ${cy + 2 * s}`} />)}</g>;
  } else if (mood === 'sleepy') {
    const w = twoEyes ? 5 * s : 7.5 * s;
    eyes = <g {...line}>{xs.map((x) => <path key={x} d={`M${x - w} ${cy + 1} L${x + w} ${cy + 1}`} />)}</g>;
  } else {
    const big = mood === 'listening' ? 1.12 : 1;
    const one = (x: number) => face === 'round' ? <circle key={x} cx={x} cy={cy} r={5.2 * s * big} />
      : face === 'tall' ? <rect key={x} x={x - 3.2 * s} y={cy - 6.2 * s * big} width={6.4 * s} height={12.4 * s * big} rx={3.2 * s} />
        : face === 'wide' ? <rect key={x} x={x - 6.4 * s} y={cy - 2.8 * s * big} width={12.8 * s} height={5.6 * s * big} rx={2.8 * s} />
          : <g key={x}><circle cx={x} cy={cy} r={8 * s * big} /><circle cx={x} cy={cy} r={3.2 * s} fill={SCREEN} /></g>;
    const gaze = mood === 'thinking' ? { transform: `translate(${(1.8 * s).toFixed(2)}px, ${(-2 * s).toFixed(2)}px)` } : undefined;
    eyes = (
      <g className="mascot-lids" style={{ transformOrigin: `60px ${cy}px` }}>
        <g className="mascot-gaze" fill={g} style={gaze}>{xs.map(one)}</g>
      </g>
    );
  }

  const mw = 4.4 * s;
  const mouth = mood === 'talking' ? <ellipse className="mascot-mouth-talk" cx={cx} cy={my} rx={4.6 * s} ry={2.8 * s} fill={g} />
    : mood === 'happy' ? <path d={`M${cx - 6 * s} ${my - 1.6 * s} Q${cx} ${my + 6 * s} ${cx + 6 * s} ${my - 1.6 * s} Z`} fill={g} />
      : mood === 'listening' ? <circle cx={cx} cy={my} r={2 * s} {...line} strokeWidth={2.2 * s} />
        : mood === 'thinking' ? <path d={`M${cx - mw} ${my + 0.6 * s} L${cx + mw} ${my - 0.8 * s}`} {...line} strokeWidth={2.4 * s} />
          : mood === 'sleepy' ? <path d={`M${cx - 2.6 * s} ${my} L${cx + 2.6 * s} ${my}`} {...line} strokeWidth={2.2 * s} />
            : <path d={`M${cx - mw} ${my - 1.2 * s} Q${cx} ${my + 3.2 * s} ${cx + mw} ${my - 1.2 * s}`} {...line} strokeWidth={2.4 * s} />;

  const { top, mid, left, right } = geo;
  return (
    <svg
      ref={ref} viewBox="0 0 120 120" width={size} height={size} {...(label === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? 'Murshid' })}
      className={cn('mascot select-none overflow-visible', !reduce && `mascot-${mood}`, className)}
    >
      <defs><clipPath id={clip}><Body shape={shape} /></clipPath></defs>
      <g className="mascot-body">
        {grounded && <ellipse cx="60" cy="116" rx="26" ry="3.2" fill="currentColor" opacity="0.12" />}
        {/* side modules, like the ears of a little robot */}
        {geo.nubs && accessory !== 'headphones' && <g fill={f.shade}><rect x={left - 4} y={mid - 8} width="8" height="16" rx="4" /><rect x={right - 4} y={mid - 8} width="8" height="16" rx="4" /></g>}
        <Body shape={shape} fill={f.body} stroke={f.body} />
        <g clipPath={`url(#${clip})`}>
          <g transform="translate(-6 -7) translate(60 62) scale(0.86) translate(-60 -62)"><Body shape={shape} fill={f.shade} stroke={f.shade} opacity={0.5} /></g>
          <ellipse cx="40" cy={top + 12} rx="11" ry="5.5" fill="#fff" opacity="0.14" transform={`rotate(-28 40 ${top + 12})`} />
        </g>
        {accessory === 'antenna' && (
          <g>
            <path d={`M60 ${top + 1} L60 ${top - 10}`} stroke={f.body} strokeWidth="3.2" strokeLinecap="round" />
            <circle cx="60" cy={top - 13} r="4.2" fill={g} />
          </g>
        )}
        {accessory === 'headphones' && (
          <g>
            <path d={`M${left + 3} ${mid - 2} C${left + 3} ${top - 16}, ${right - 3} ${top - 16}, ${right - 3} ${mid - 2}`} fill="none" stroke="#111827" strokeWidth="4.6" strokeLinecap="round" />
            <rect x={left - 6} y={mid - 9} width="11" height="18" rx="5" fill="#111827" /><rect x={right - 5} y={mid - 9} width="11" height="18" rx="5" fill="#111827" />
            <rect x={left - 3.5} y={mid - 6} width="6" height="12" rx="3" fill={g} /><rect x={right - 2.5} y={mid - 6} width="6" height="12" rx="3" fill={g} />
          </g>
        )}
        {/* the screen */}
        <g className="mascot-face">
          <rect x={fb.x} y={fb.y} width={fb.w} height={fb.h} rx={fb.r} fill={SCREEN} />
          <rect x={fb.x + fb.r * 0.6} y={fb.y + 3} width={fb.w - fb.r * 1.2} height={fb.h * 0.16} rx={fb.h * 0.08} fill="#fff" opacity="0.06" />
          {eyes}
          {mouth}
        </g>
        {accessory === 'cap' && (
          <g>
            <path d={`M60 ${top - 13} L92 ${top - 2} L60 ${top + 9} L28 ${top - 2} Z`} fill="#111827" />
            <path d={`M43 ${top + 2} L43 ${top + 8} Q60 ${top + 14} 77 ${top + 8} L77 ${top + 2} L60 ${top + 9} Z`} fill="#1f2937" />
            <path d={`M88 ${top - 1} L88 ${top + 14}`} stroke={g} strokeWidth="2" /><circle cx="88" cy={top + 16} r="2.6" fill={g} />
          </g>
        )}
        {accessory === 'bow' && (
          <g transform={`translate(${right - 14} ${top + 8}) rotate(-18)`}>
            <path d="M0 0 L-11 -7.5 L-11 7.5 Z" fill="#ff6fa3" /><path d="M0 0 L11 -7.5 L11 7.5 Z" fill="#ff6fa3" /><circle r="3.4" fill="#ff4f8d" />
          </g>
        )}
      </g>
      {mood === 'thinking' && !reduce && (
        <g className="mascot-dots" fill="currentColor">
          <circle cx="100" cy="18" r="3" /><circle cx="108" cy="10" r="2.2" /><circle cx="114" cy="4" r="1.5" />
        </g>
      )}
      {mood === 'sleepy' && <text x="96" y="20" fontSize="13" fontWeight="600" fill="currentColor" opacity="0.6">z</text>}
    </svg>
  );
}

export const Mascot = memo(MascotImpl);
