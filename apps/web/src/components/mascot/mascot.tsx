'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { MascotAccessory, MascotColor } from '@/lib/prefs';
import { cn } from '@/lib/utils';

/**
 * Nour (renamable): Murshid's mascot. One character, drawn from the Murshid star, with a face that blinks, follows
 * the pointer, and changes with the conversation. Students pick its colour, an accessory and its name in Settings.
 */
export type Mood = 'idle' | 'happy' | 'thinking' | 'talking' | 'listening' | 'sleepy';

export const MASCOT_FILL: Record<MascotColor, { body: string; shade: string; ink: string }> = {
  navy: { body: '#0f2f63', shade: '#1d4485', ink: '#0a1a36' },
  royal: { body: '#2563c9', shade: '#3f7ad8', ink: '#0a1a36' },
  teal: { body: '#0b6e97', shade: '#1c86b0', ink: '#06283a' },
  lime: { body: '#a9c71f', shade: '#c2e029', ink: '#1d2a05' },
  coral: { body: '#e0603f', shade: '#ee7b5c', ink: '#3a120a' },
  violet: { body: '#6250d6', shade: '#7a6ae2', ink: '#1a1340' },
};

// the eight-point Murshid star, on a 120 x 120 canvas
const STAR = [[60, 9], [68.8, 38.8], [96, 24], [81.3, 51.2], [111, 60], [81.3, 68.8], [96, 96], [68.8, 81.3], [60, 111], [51.2, 81.3], [24, 96], [38.8, 68.8], [9, 60], [38.8, 51.2], [24, 24], [51.2, 38.8]];
const starPath = (k = 1, dx = 0, dy = 0) => `M${STAR.map(([x, y]) => `${(60 + (x! - 60) * k + dx).toFixed(1)} ${(60 + (y! - 60) * k + dy).toFixed(1)}`).join(' L')}Z`;

export function Mascot({
  size = 96, mood = 'idle', color = 'navy', accessory = 'none', talk = 0, track = true, className, label,
}: {
  size?: number; mood?: Mood; color?: MascotColor; accessory?: MascotAccessory;
  /** 0..1: how open the mouth is (drive it from speech or streaming text) */
  talk?: number;
  /** eyes follow the pointer */
  track?: boolean; className?: string; label?: string;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<SVGSVGElement>(null);
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [blink, setBlink] = useState(false);
  const clip = useId().replace(/:/g, '');
  const f = MASCOT_FILL[color];

  // eyes follow the pointer (smoothly, at most one update per frame)
  useEffect(() => {
    if (!track || reduce) return;
    let raf = 0; let pending: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => {
      pending = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const el = ref.current; if (!el || !pending) return;
        const r = el.getBoundingClientRect(); const dx = pending.clientX - (r.left + r.width / 2); const dy = pending.clientY - (r.top + r.height / 2);
        const d = Math.hypot(dx, dy) || 1; const k = Math.min(1, d / 320);
        setLook({ x: (dx / d) * k, y: (dy / d) * k });
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => { window.removeEventListener('pointermove', onMove); cancelAnimationFrame(raf); };
  }, [track, reduce]);

  // blink every few seconds
  useEffect(() => {
    if (reduce || mood === 'sleepy') return;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); loop(); }, 2400 + Math.random() * 3200); };
    loop();
    return () => clearTimeout(t);
  }, [reduce, mood]);

  const gaze = mood === 'thinking' ? { x: 0.7, y: -0.75 } : look;
  const px = gaze.x * 2.8; const py = gaze.y * 2.6;
  const eyeY = 56;
  const happyEyes = mood === 'happy';
  const open = mood === 'talking' ? 1.2 + Math.max(0, Math.min(1, talk)) * 5.2 : 0;

  return (
    <svg
      ref={ref} viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label ?? 'Murshid mascot'}
      className={cn('mascot select-none overflow-visible', !reduce && `mascot-${mood}`, className)}
    >
      <defs><clipPath id={clip}><path d={starPath()} /></clipPath></defs>
      <g className="mascot-body">
        {/* soft ground shadow */}
        <ellipse cx="60" cy="116" rx="26" ry="3.2" fill="currentColor" opacity="0.12" className="mascot-shadow" />
        {/* body with rounded tips, a lighter facet for volume */}
        <path d={starPath()} fill={f.body} stroke={f.body} strokeWidth="9" strokeLinejoin="round" />
        <g clipPath={`url(#${clip})`}>
          <path d={starPath(0.78, -5, -6)} fill={f.shade} opacity="0.55" />
        </g>
        {accessory === 'headphones' && (
          <g>
            <path d="M33 52 C33 26, 87 26, 87 52" fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
            <rect x="26" y="48" width="11" height="18" rx="5" fill="#111827" /><rect x="83" y="48" width="11" height="18" rx="5" fill="#111827" />
            <rect x="28.5" y="51" width="6" height="12" rx="3" fill="#c2e029" /><rect x="85.5" y="51" width="6" height="12" rx="3" fill="#c2e029" />
          </g>
        )}
        {/* face */}
        <g className="mascot-face">
          <ellipse cx="42.5" cy="69" rx="5" ry="3" fill="#ff8a7a" opacity="0.38" />
          <ellipse cx="77.5" cy="69" rx="5" ry="3" fill="#ff8a7a" opacity="0.38" />
          {happyEyes ? (
            <g fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round">
              <path d="M44 58 Q49.5 51 55 58" /><path d="M65 58 Q70.5 51 76 58" />
            </g>
          ) : (
            <g className="mascot-eyes" style={{ transform: `scaleY(${blink || mood === 'sleepy' ? 0.12 : 1})`, transformOrigin: `60px ${eyeY}px`, transition: 'transform 90ms ease-out' }}>
              <ellipse cx="49.5" cy={eyeY} rx="7.2" ry="8.4" fill="#fff" />
              <ellipse cx="70.5" cy={eyeY} rx="7.2" ry="8.4" fill="#fff" />
              <g style={{ transform: `translate(${px}px, ${py}px)`, transition: 'transform 140ms ease-out' }}>
                <circle cx="49.5" cy={eyeY + 1} r="3.9" fill={f.ink} /><circle cx="70.5" cy={eyeY + 1} r="3.9" fill={f.ink} />
                <circle cx="50.9" cy={eyeY - 0.6} r="1.3" fill="#fff" /><circle cx="71.9" cy={eyeY - 0.6} r="1.3" fill="#fff" />
              </g>
            </g>
          )}
          {mood === 'thinking' && <path d="M64.5 44.5 Q70.5 41.5 76.5 44" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.9" />}
          {mood === 'talking' ? (
            <ellipse cx="60" cy="73" rx={4.6 + open * 0.25} ry={open} fill={f.ink} stroke="#fff" strokeWidth="1.6" />
          ) : mood === 'listening' ? (
            <circle cx="60" cy="73.5" r="2.6" fill="none" stroke="#fff" strokeWidth="2.4" />
          ) : mood === 'thinking' ? (
            <path d="M55 74.5 Q59 73 65 72.5" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          ) : mood === 'happy' ? (
            <path d="M51 70.5 Q60 81 69 70.5 Z" fill="#fff" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round" />
          ) : mood === 'sleepy' ? (
            <path d="M56 74 Q60 76 64 74" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
          ) : (
            <path d="M52.5 71.5 Q60 78 67.5 71.5" fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" />
          )}
        </g>
        {accessory === 'glasses' && (
          <g fill="none" stroke="#111827" strokeWidth="2.6">
            <circle cx="49.5" cy={eyeY} r="10" /><circle cx="70.5" cy={eyeY} r="10" /><path d="M59.5 55 Q60 53.5 60.5 55" />
            <path d="M39.5 54 L33 51" strokeLinecap="round" /><path d="M80.5 54 L87 51" strokeLinecap="round" />
          </g>
        )}
        {accessory === 'cap' && (
          <g>
            <path d="M60 12 L92 24 L60 36 L28 24 Z" fill="#111827" />
            <path d="M42 29 L42 37 Q60 45 78 37 L78 29 L60 36 Z" fill="#1f2937" />
            <path d="M88 25 L88 40" stroke="#c2e029" strokeWidth="2" /><circle cx="88" cy="42" r="2.6" fill="#c2e029" />
          </g>
        )}
        {accessory === 'bow' && (
          <g transform="translate(84 30) rotate(-18)">
            <path d="M0 0 L-12 -8 L-12 8 Z" fill="#ff6fa3" /><path d="M0 0 L12 -8 L12 8 Z" fill="#ff6fa3" /><circle r="3.6" fill="#ff4f8d" />
          </g>
        )}
      </g>
      {mood === 'thinking' && !reduce && (
        <g className="mascot-dots" fill="currentColor">
          <circle cx="98" cy="20" r="3" /><circle cx="107" cy="12" r="2.2" /><circle cx="113" cy="5" r="1.5" />
        </g>
      )}
      {mood === 'sleepy' && <text x="92" y="22" fontSize="13" fontWeight="600" fill="currentColor" opacity="0.6">z</text>}
    </svg>
  );
}
