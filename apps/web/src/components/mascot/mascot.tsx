'use client';

import { memo, useEffect, useId, useMemo, useRef } from 'react';
import { useReducedMotion } from 'motion/react';
import type { MascotColor, MascotFace, MascotGlow, MascotShape } from '@/lib/prefs';
import { cn } from '@/lib/utils';
import { bodyPath, distance, eyePaths, mix, moodPose, readableEyes, type BotMood, type Pose } from './bot-face';

/**
 * Murshid, the companion bot: one solid, flat-coloured head and two chunky eyes, nothing else. The eyes live on a 3D
 * sphere, so when the bot looks toward the pointer they slide and foreshorten like a real turning head; moods morph
 * the eyes with a spring; it blinks now and then. Students pick the shape, the eyes and both colours in Settings.
 * No gloss, gradients or outlines: the silhouette and the way the eyes move carry it.
 *
 * Kept light: one shared pointer listener, one animation frame loop per bot that runs only while something moves,
 * and every frame writes SVG paths directly (React renders once per prop change).
 */
export type Mood = BotMood;

/** Body colours: one family, similar weight, built around Murshid blue and the brand lime. */
export const MASCOT_FILL: Record<MascotColor, string> = {
  royal: '#5a84ec', navy: '#1f3f7c', sky: '#8dbdf6', teal: '#2a9cb8', violet: '#8477ee', coral: '#f07a62', lime: '#c2e029', graphite: '#2b303d',
};
/** Eye colours. "auto" is near-black ink, or white on a dark body. */
export const MASCOT_GLOW: Record<Exclude<MascotGlow, 'auto'>, string> = { ink: '#10131c', white: '#ffffff', sky: '#d6e6ff', lime: '#dcf26e' };

/** The eye colour actually drawn: the chosen one when it stands out on the body, else ink or white. */
export function eyeColour(glow: MascotGlow, body: string): string {
  return readableEyes(glow === 'auto' ? MASCOT_GLOW.ink : (MASCOT_GLOW[glow] ?? MASCOT_GLOW.ink), body);
}

const CX = 60; const CY = 56; const R = 44;

/* ---- one pointer listener for every bot on the page ---- */
type Look = (x: number, y: number) => void;
const lookers = new Map<Element, Look>();
let raf = 0; let pointer: { x: number; y: number } | null = null;
function flush() {
  raf = 0; if (!pointer) return;
  const vw = window.innerWidth; const vh = window.innerHeight;
  for (const [el, look] of lookers) {
    const r = el.getBoundingClientRect();
    if (r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
    const dx = pointer.x - (r.left + r.width / 2); const dy = pointer.y - (r.top + r.height / 2);
    const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 420);
    look((dx / d) * k, (dy / d) * k);
  }
}
const onMove = (e: PointerEvent) => { pointer = { x: e.clientX, y: e.clientY }; if (!raf) raf = requestAnimationFrame(flush); };
function follow(el: Element, look: Look) {
  lookers.set(el, look);
  if (lookers.size === 1) window.addEventListener('pointermove', onMove, { passive: true });
  return () => { lookers.delete(el); if (!lookers.size) { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); raf = 0; } };
}

function MascotImpl({
  size = 96, mood = 'idle', shape = 'orb', face = 'tall', color = 'royal', glow = 'auto', track = true, grounded = true, className, label,
}: {
  size?: number; mood?: Mood; shape?: MascotShape; face?: MascotFace; color?: MascotColor; glow?: MascotGlow;
  /** eyes and head follow the pointer */
  track?: boolean;
  /** a faint contact shadow underneath */
  grounded?: boolean;
  className?: string; label?: string;
}) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const svg = useRef<SVGSVGElement>(null);
  const eye0 = useRef<SVGPathElement>(null); const eye1 = useRef<SVGPathElement>(null);
  const base = MASCOT_FILL[color] ?? MASCOT_FILL.royal;
  const ink = eyeColour(glow, base);
  const body = useMemo(() => bodyPath(shape, CX, CY, R), [shape]);
  const first = useMemo(() => eyePaths(moodPose(mood, face), CX, CY, R), [mood, face]);

  // live state for the frame loop (not React state: nothing re-renders per frame)
  const live = useRef<{ cur: Pose; look: { x: number; y: number }; blinkUntil: number; frame: number; last: number } | null>(null);

  useEffect(() => {
    const el = svg.current; if (!el) return;
    const st = live.current ?? (live.current = { cur: moodPose(mood, face), look: { x: 0, y: 0 }, blinkUntil: 0, frame: 0, last: 0 });
    const draw = (p: Pose) => {
      const [a, b] = eyePaths(p, CX, CY, R);
      eye0.current?.setAttribute('d', a);
      eye1.current?.setAttribute('d', b ?? '');
    };
    if (reduce) { st.cur = moodPose(mood, face); draw(st.cur); return; }
    const target = (now: number): Pose => {
      const p = moodPose(mood, face);
      // a real head turn: wide enough that the eyes visibly wrap around the face
      const t = { ...p, yaw: p.yaw + st.look.x * 0.6, pitch: p.pitch - st.look.y * 0.42, roll: p.roll + st.look.x * 0.06 };
      if (mood === 'talking') { t.pitch += Math.sin(now / 90) * 0.045; t.open = 0.9 + Math.sin(now / 70) * 0.08; }
      if (now < st.blinkUntil && mood !== 'happy' && mood !== 'sleepy') t.open = 0.08;
      return t;
    };
    const step = (now: number) => {
      st.frame = 0;
      const dt = Math.min(0.05, (now - (st.last || now)) / 1000); st.last = now;
      const goal = target(now);
      st.cur = mix(st.cur, goal, 1 - Math.exp(-dt * (now < st.blinkUntil ? 38 : 10)));
      draw(st.cur);
      if (mood === 'talking' || now < st.blinkUntil + 160 || distance(st.cur, goal) > 0.002) st.frame = requestAnimationFrame(step);
      else st.last = 0;
    };
    const kick = () => { if (!st.frame) st.frame = requestAnimationFrame(step); };
    kick();
    const stopLook = track ? follow(el, (x, y) => { st.look = { x, y }; kick(); }) : undefined;
    // blink every few seconds
    let blink: ReturnType<typeof setTimeout>;
    const loop = () => { blink = setTimeout(() => { st.blinkUntil = performance.now() + 120; kick(); loop(); }, 2400 + Math.random() * 3600); };
    if (mood !== 'sleepy') loop();
    return () => { stopLook?.(); clearTimeout(blink); cancelAnimationFrame(st.frame); st.frame = 0; st.last = 0; };
  }, [mood, face, track, reduce]);

  const g = (k: string) => `${uid}-${k}`;
  return (
    <svg ref={svg} viewBox="0 0 120 120" width={size} height={size} {...(label === '' ? { 'aria-hidden': true } : { role: 'img', 'aria-label': label ?? 'Murshid' })}
      className={cn('mascot select-none overflow-visible', !reduce && `mascot-${mood}`, className)}>
      {grounded && (
        <>
          <defs>
            <radialGradient id={g('ground')} cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" className="mascot-ground-stop" stopColor="#0b1430" stopOpacity="0.14" />
              <stop offset="1" className="mascot-ground-stop" stopColor="#0b1430" stopOpacity="0" />
            </radialGradient>
          </defs>
          <ellipse cx="60" cy="109" rx="30" ry="4.5" fill={`url(#${g('ground')})`} />
        </>
      )}
      <g className="mascot-body">
        <path d={body} fill={base} />
        {/* a faint edge so dark bodies still read on the dark theme (transparent in light) */}
        <path d={body} fill="none" className="mascot-rim" strokeWidth="1" />
        <g fill={ink}>
          <path ref={eye0} d={first[0]} /><path ref={eye1} d={first[1] ?? ''} />
        </g>
      </g>
    </svg>
  );
}

export const Mascot = memo(MascotImpl);
