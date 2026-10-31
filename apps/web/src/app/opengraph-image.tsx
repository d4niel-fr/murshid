import { ImageResponse } from 'next/og';

export const alt = 'Murshid: the AI study planner for UAE students and schools';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const STAR = 'M60 9 L68.8 38.8 L96 24 L81.3 51.2 L111 60 L81.3 68.8 L96 96 L68.8 81.3 L60 111 L51.2 81.3 L24 96 L38.8 68.8 L9 60 L38.8 51.2 L24 24 L51.2 38.8 Z';

/** The share card: navy, the week columns, the headline and the star. */
export default function OgImage() {
  const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#0f2f63', color: '#fff', fontFamily: 'sans-serif' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          {days.map((d, i) => <div key={d} style={{ flex: 1, borderLeft: i ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', paddingTop: 96, paddingLeft: 18, fontSize: 14, letterSpacing: 4, color: 'rgba(255,255,255,0.22)' }}>{d}</div>)}
        </div>
        <div style={{ position: 'absolute', left: 72, top: 64, display: 'flex', alignItems: 'center', gap: 12, fontSize: 24, letterSpacing: 6 }}>MURSHID</div>
        <div style={{ position: 'absolute', left: 72, top: 230, display: 'flex', flexDirection: 'column', fontSize: 84, lineHeight: 0.95, letterSpacing: -2, fontWeight: 600 }}>
          <span>OWN THE WEEK</span>
          <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 56, marginTop: 18 }}>Ask once, plan the week.</span>
        </div>
        <div style={{ position: 'absolute', left: 72, bottom: 64, display: 'flex', fontSize: 22, color: 'rgba(255,255,255,0.7)' }}>The AI study planner for UAE students and schools · English and Arabic</div>
        <svg width="330" height="330" viewBox="0 0 120 120" style={{ position: 'absolute', right: 70, top: 130 }}>
          <path d={STAR} fill="#eef3ff" stroke="#eef3ff" strokeWidth="9" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    size,
  );
}
