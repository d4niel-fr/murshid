'use client';

import { useEffect, useId, useRef, useState } from 'react';

/** The element's width in CSS pixels, so the SVG draws at 1:1 and its text stays readable on a phone. */
function useWidth(fallback = 520) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => { const v = Math.round(e!.contentRect.width); if (v > 0) setW(Math.max(260, v)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/*
 * Two small charts for a student's page, drawn as SVG (no chart library in the portal).
 * Thin marks, a recessive grid, one label on the latest value, a tooltip on hover/focus/tap,
 * and an equivalent table for screen readers. Text uses text colours, never the series colour.
 */

export interface StudyWeek { label: string; studyMinutes: number; handedIn: number; set: number; onTimeRate: number | null }

export function StudyBars({ weeks, height = 190 }: { weeks: StudyWeek[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const [box, W] = useWidth();
  const H = height; const padL = 34; const padB = 24; const padT = 18;
  const hours = weeks.map((w) => w.studyMinutes / 60);
  const top = Math.max(2, Math.ceil(Math.max(...hours) / 2) * 2);
  const slot = (W - padL) / weeks.length; const bw = Math.min(34, slot - 8);
  const y = (h: number) => padT + (H - padT - padB) * (1 - h / top);
  const ticks = [0, top / 2, top];
  const active = hover ?? weeks.length - 1;
  const w = weeks[active];
  return (
    <figure className="m-0">
      <div className="relative" ref={box}>
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-t`}>
          <title id={`${id}-t`}>Study time per week, last {weeks.length} weeks</title>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={padL} x2={W} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
              <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{t}h</text>
            </g>
          ))}
          {weeks.map((wk, i) => {
            const h = hours[i]!; const x = padL + i * slot + (slot - bw) / 2; const yTop = y(h); const last = i === weeks.length - 1;
            return (
              <g key={wk.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)} tabIndex={0} role="button" aria-label={`Week of ${wk.label}: ${h.toFixed(1)} hours`} className="cursor-pointer outline-none">
                <rect x={padL + i * slot} y={padT} width={slot} height={H - padT - padB} fill="transparent" />
                <path d={`M${x},${y(0)} V${yTop + 4} Q${x},${yTop} ${x + 4},${yTop} H${x + bw - 4} Q${x + bw},${yTop} ${x + bw},${yTop + 4} V${y(0)} Z`}
                  fill={last ? 'var(--deep)' : 'var(--accent)'} opacity={hover === null || hover === i ? 1 : 0.45} />
                <text x={x + bw / 2} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{wk.label}</text>
                {last && hover === null && <text x={x + bw / 2} y={yTop - 6} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">{h.toFixed(1)}h</text>}
              </g>
            );
          })}
        </svg>
        {w && (
          <div className="pointer-events-none mt-1 text-xs text-[var(--text-muted)]" aria-live="polite">
            <span className="font-medium text-[var(--text)]">Week of {w.label}</span> · {(w.studyMinutes / 60).toFixed(1)} h studied · {w.set ? `${w.handedIn} of ${w.set} handed in${w.onTimeRate !== null ? `, ${w.onTimeRate}% on time` : ''}` : 'no work due'}
          </div>
        )}
      </div>
      <div className="sr-only"><table><caption>Study time per week</caption><thead><tr><th>Week of</th><th>Hours</th><th>Handed in</th></tr></thead>
        <tbody>{weeks.map((wk) => <tr key={wk.label}><td>{wk.label}</td><td>{(wk.studyMinutes / 60).toFixed(1)}</td><td>{wk.handedIn} of {wk.set}</td></tr>)}</tbody></table></div>
    </figure>
  );
}

export interface GradePoint { label: string; title: string; grade: number }

export function GradeLine({ points, height = 190 }: { points: GradePoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const [box, W] = useWidth();
  if (points.length < 2) return <p className="py-10 text-center text-sm text-[var(--text-muted)]">Not enough marked work yet.</p>;
  const H = height; const padL = 34; const padR = 16; const padB = 24; const padT = 18;
  const lo = Math.max(0, Math.floor((Math.min(...points.map((p) => p.grade)) - 10) / 10) * 10);
  const x = (i: number) => padL + ((W - padL - padR) * i) / (points.length - 1);
  const y = (g: number) => padT + (H - padT - padB) * (1 - (g - lo) / (100 - lo));
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.grade).toFixed(1)}`).join(' ');
  const ticks = [lo, Math.round((lo + 100) / 2), 100];
  const active = hover ?? points.length - 1;
  const p = points[active]!;
  const every = Math.ceil(points.length / Math.max(3, Math.floor(W / 90)));
  return (
    <figure className="m-0" ref={box}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full overflow-visible" role="img" aria-labelledby={`${id}-t`}>
        <title id={`${id}-t`}>Marks over time</title>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-muted)">{t}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((pt, i) => (
          <g key={`${pt.label}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} onClick={() => setHover(i)} tabIndex={0} role="button" aria-label={`${pt.label}: ${pt.title}, ${pt.grade}%`} className="cursor-pointer outline-none">
            <circle cx={x(i)} cy={y(pt.grade)} r={14} fill="transparent" />
            <circle cx={x(i)} cy={y(pt.grade)} r={hover === i ? 5.5 : 4} fill={i === points.length - 1 ? 'var(--deep)' : 'var(--accent)'} stroke="var(--bg)" strokeWidth={2} />
            {(i % every === 0 || i === points.length - 1) && <text x={x(i)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--text-muted)">{pt.label.replace(/^\w+ /, '')}</text>}
            {i === points.length - 1 && hover === null && <text x={x(i)} y={y(pt.grade) - 10} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--text)">{pt.grade}%</text>}
          </g>
        ))}
      </svg>
      <div className="mt-1 truncate text-xs text-[var(--text-muted)]" aria-live="polite"><span className="font-medium text-[var(--text)]">{p.grade}%</span> · {p.title} · {p.label}</div>
      <div className="sr-only"><table><caption>Marks over time</caption><thead><tr><th>Due</th><th>Work</th><th>Mark</th></tr></thead>
        <tbody>{points.map((pt, i) => <tr key={i}><td>{pt.label}</td><td>{pt.title}</td><td>{pt.grade}%</td></tr>)}</tbody></table></div>
    </figure>
  );
}
