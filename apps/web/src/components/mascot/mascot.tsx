'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { MascotAccessory, MascotColor, MascotHair, MascotKind, MascotSkin } from '@/lib/prefs';
import { cn } from '@/lib/utils';

/**
 * Murshid's mascot, renamable. Two characters share one face system (eyes that blink and follow the pointer, a mouth
 * that moves with speech, moods that follow the conversation): Rashid, a boy in a Murshid-blue hoodie with the star on
 * his chest (the default), and the original Murshid star. Students pick the character, colour, skin, hair, an
 * accessory and the name in Settings.
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

export const MASCOT_SKIN: Record<MascotSkin, { skin: string; shade: string }> = {
  light: { skin: '#f6d7bd', shade: '#e8b998' },
  fair: { skin: '#eab88f', shade: '#d69a6f' },
  medium: { skin: '#c98d61', shade: '#ad7149' },
  tan: { skin: '#a36a42', shade: '#87532f' },
  deep: { skin: '#6f4529', shade: '#56341d' },
};
const HAIR = '#1f1712';
const INK = '#1d1410';

export function Mascot({
  size = 96, mood = 'idle', kind = 'guide', color = 'navy', accessory = 'none', skin = 'medium', hair = 'swoop', talk = 0, track = true, className, label,
}: {
  size?: number; mood?: Mood; kind?: MascotKind; color?: MascotColor; accessory?: MascotAccessory; skin?: MascotSkin; hair?: MascotHair;
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

  if (kind === 'guide') {
    const k = MASCOT_SKIN[skin];
    const gx = gaze.x * 1.7; const gy = gaze.y * 1.5;
    const ey = 55;
    const shut = blink || mood === 'sleepy';
    const mouthOpen = mood === 'talking' ? 1 + Math.max(0, Math.min(1, talk)) * 4.2 : 0;
    const browL = mood === 'sleepy' ? 'M44.5 48 Q50 47 55 48' : 'M44.5 47 Q50 44.2 55 46.2';
    const browR = mood === 'thinking' ? 'M65 43.6 Q70.5 40.2 75.5 43' : mood === 'sleepy' ? 'M65 48 Q70 47 75.5 48' : 'M65 46.2 Q70 44.2 75.5 47';
    return (
      <svg
        ref={ref} viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={label ?? 'Murshid mascot'}
        className={cn('mascot mascot-guide select-none overflow-visible', !reduce && `guide-${mood}`, className)}
      >
        <defs><clipPath id={clip}><path d="M10 120 C10 101, 26 90, 45 87.5 L75 87.5 C94 90, 110 101, 110 120 Z" /></clipPath></defs>
        <g className="mascot-body">
          {/* hoodie: body, a lighter panel for volume, the hood resting behind the neck */}
          <path d="M10 120 C10 101, 26 90, 45 87.5 L75 87.5 C94 90, 110 101, 110 120 Z" fill={f.body} stroke={f.body} strokeWidth="2" strokeLinejoin="round" />
          <g clipPath={`url(#${clip})`}><path d="M2 128 C6 104, 26 94, 48 92 L56 128 Z" fill={f.shade} opacity="0.5" /></g>
          <path d="M33 93 C33 80, 45 75.5, 60 75.5 C75 75.5, 87 80, 87 93 C79 99, 41 99, 33 93 Z" fill={f.shade} />
          {/* neck */}
          <path d="M51.5 70 L68.5 70 L68.5 86 Q60 92 51.5 86 Z" fill={k.shade} />
          {/* collar opening and drawstrings */}
          <path d="M44 89.5 Q60 101 76 89.5" fill="none" stroke={f.body} strokeWidth="5" strokeLinecap="round" />
          <g stroke="#e6edfb" strokeWidth="1.9" strokeLinecap="round" fill="none"><path d="M54 95 Q53 101 54 107" /><path d="M66 95 Q67 101 66 107" /></g>
          <circle cx="54" cy="108.2" r="1.6" fill="#e6edfb" /><circle cx="66" cy="108.2" r="1.6" fill="#e6edfb" />
          {/* the Murshid star on the chest */}
          <path d={starPath(0.1, 24.5, 47)} fill="#c2e029" stroke="#c2e029" strokeWidth="1.4" strokeLinejoin="round" />
          {accessory === 'bow' && (
            <g transform="translate(60 91)">
              <path d="M0 0 L-9 -5.5 L-9 5.5 Z" fill="#c2e029" /><path d="M0 0 L9 -5.5 L9 5.5 Z" fill="#c2e029" /><rect x="-2.4" y="-2.6" width="4.8" height="5.2" rx="1.6" fill="#a9c71f" />
            </g>
          )}
          <g className="mascot-head">
          {/* head */}
          <ellipse cx="35.5" cy="57" rx="4.6" ry="6.2" fill={k.skin} /><ellipse cx="84.5" cy="57" rx="4.6" ry="6.2" fill={k.skin} />
          <ellipse cx="36" cy="57.5" rx="2" ry="3.4" fill={k.shade} /><ellipse cx="84" cy="57.5" rx="2" ry="3.4" fill={k.shade} />
          <ellipse cx="60" cy="52" rx="25" ry="27.5" fill={k.skin} />
          {/* hair */}
          {hair === 'swoop' && <path d="M34.6 52 C31 32, 44 21, 61 21.5 C79 22, 89 33, 85.4 52 C83.6 44.5, 80 40, 74 38.5 C66 37, 57 35.5, 51 30 C48 37.5, 42 44, 34.6 52 Z" fill={HAIR} />}
          {hair === 'fade' && <path d="M35.2 47 C34.5 30, 46 22.5, 60 22.5 C74 22.5, 85.5 30, 84.8 47 C80.5 39.5, 71 36.5, 60 36.5 C49 36.5, 39.5 39.5, 35.2 47 Z" fill={HAIR} />}
          {hair === 'buzz' && <path d="M35.4 46 C35 30, 46.5 24.6, 60 24.6 C73.5 24.6, 85 30, 84.6 46 C80 40.5, 70.5 38.6, 60 38.6 C49.5 38.6, 40 40.5, 35.4 46 Z" fill={HAIR} opacity="0.72" />}
          {hair === 'curly' && (
            <g fill={HAIR}>
              <path d="M35 49 C33 33, 45 23.5, 60 23.5 C75 23.5, 87 33, 85 49 C80 41, 71 38, 60 38 C49 38, 40 41, 35 49 Z" />
              {[[37.5, 44, 6], [40.5, 35, 7], [48, 27.5, 7.2], [57.5, 23.5, 7.4], [67.5, 24.5, 7.2], [76, 29.5, 7], [81.5, 37.5, 6.6], [83, 45, 5.6], [52.5, 33.5, 5.2], [64, 32.5, 5.2]].map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
            </g>
          )}
          {accessory === 'headphones' && (
            <g>
              <path d="M33.5 54 C32 22, 88 22, 86.5 54" fill="none" stroke="#111827" strokeWidth="4.6" strokeLinecap="round" />
              <rect x="27.5" y="49" width="11" height="17" rx="5" fill="#111827" /><rect x="81.5" y="49" width="11" height="17" rx="5" fill="#111827" />
              <rect x="30" y="52" width="6" height="11" rx="3" fill="#c2e029" /><rect x="84" y="52" width="6" height="11" rx="3" fill="#c2e029" />
            </g>
          )}
          {/* face */}
          <g className="mascot-face">
            <ellipse cx="43" cy="64" rx="4.4" ry="2.5" fill="#ff7a68" opacity="0.28" />
            <ellipse cx="77" cy="64" rx="4.4" ry="2.5" fill="#ff7a68" opacity="0.28" />
            <g fill="none" stroke={HAIR} strokeWidth="2.5" strokeLinecap="round"><path d={browL} /><path d={browR} /></g>
            {mood === 'happy' ? (
              <g fill="none" stroke={INK} strokeWidth="2.8" strokeLinecap="round"><path d="M45.5 56.5 Q50 51.5 54.5 56.5" /><path d="M65.5 56.5 Q70 51.5 74.5 56.5" /></g>
            ) : (
              <g className="mascot-eyes" style={{ transform: `scaleY(${shut ? 0.1 : 1})`, transformOrigin: `60px ${ey}px`, transition: 'transform 90ms ease-out' }}>
                <g style={{ transform: `translate(${gx}px, ${gy}px)`, transition: 'transform 140ms ease-out' }}>
                  <ellipse cx="50" cy={ey} rx="3.5" ry="4.4" fill={INK} /><ellipse cx="70" cy={ey} rx="3.5" ry="4.4" fill={INK} />
                  <circle cx="51.2" cy={ey - 1.5} r="1.25" fill="#fff" /><circle cx="71.2" cy={ey - 1.5} r="1.25" fill="#fff" />
                </g>
              </g>
            )}
            <path d="M60.4 59.5 Q58 62.8 60.8 63.4" fill="none" stroke={k.shade} strokeWidth="1.8" strokeLinecap="round" />
            {mood === 'talking' ? (
              <ellipse cx="60" cy="69" rx={3.6 + mouthOpen * 0.3} ry={mouthOpen} fill="#4a1d18" />
            ) : mood === 'listening' ? (
              <circle cx="60" cy="69" r="2.2" fill="none" stroke={INK} strokeWidth="2.2" />
            ) : mood === 'thinking' ? (
              <path d="M55 69.5 Q59 68.6 65 67.6" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
            ) : mood === 'happy' ? (
              <path d="M52.5 66.5 Q60 75.5 67.5 66.5 Z" fill="#fff" stroke={INK} strokeWidth="2.1" strokeLinejoin="round" />
            ) : mood === 'sleepy' ? (
              <path d="M56.5 69 Q60 70.4 63.5 69" fill="none" stroke={INK} strokeWidth="2.1" strokeLinecap="round" />
            ) : (
              <path d="M54 67.2 Q60 72 66 67.2" fill="none" stroke={INK} strokeWidth="2.3" strokeLinecap="round" />
            )}
          </g>
          {accessory === 'glasses' && (
            <g fill="none" stroke="#111827" strokeWidth="2.2">
              <circle cx="50" cy={ey} r="7.6" /><circle cx="70" cy={ey} r="7.6" /><path d="M57.6 54.6 Q60 53 62.4 54.6" />
              <path d="M42.4 54 L36.5 52.5" strokeLinecap="round" /><path d="M77.6 54 L83.5 52.5" strokeLinecap="round" />
            </g>
          )}
          {accessory === 'cap' && (
            <g>
              <path d="M60 9 L93 20.5 L60 32 L27 20.5 Z" fill="#111827" />
              <path d="M42.5 25 L42.5 32.5 Q60 39.5 77.5 32.5 L77.5 25 L60 32 Z" fill="#1f2937" />
              <path d="M89 21.5 L89 37" stroke="#c2e029" strokeWidth="2" /><circle cx="89" cy="39" r="2.6" fill="#c2e029" />
            </g>
          )}
          </g>
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
