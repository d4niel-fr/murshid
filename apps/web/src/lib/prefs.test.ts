import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT, MASCOT_NAME, parsePrefs, serializePrefs } from './prefs';
import { hits, simplify, type Stroke } from './notebook';
import { contrast, readableEyes } from '@/components/mascot/bot-face';
import { eyeColour, MASCOT_FILL, MASCOT_GLOW } from '@/components/mascot/mascot';

const raw = (mascot: unknown) => serializePrefs({ ...parsePrefs(null), mascot } as never);

describe('mascot prefs', () => {
  it('defaults to a flat Murshid-blue orb with automatic (dark) eyes, called Murshid', () => {
    expect(parsePrefs(null).mascot).toEqual(DEFAULT_MASCOT);
    expect(DEFAULT_MASCOT).toEqual({ shape: 'orb', face: 'tall', color: 'royal', glow: 'auto', v: 2 });
    expect(MASCOT_NAME).toEqual({ en: 'Murshid', ar: 'مرشد' });
  });
  it('keeps every choice the bot still has', () => {
    expect(parsePrefs(raw({ shape: 'capsule', face: 'mono', color: 'graphite', glow: 'lime' })).mascot).toEqual({ shape: 'capsule', face: 'mono', color: 'graphite', glow: 'lime', v: 2 });
    expect(parsePrefs(raw({ shape: 'cube', face: 'tall', color: 'navy', glow: 'white', v: 2 })).mascot).toEqual({ shape: 'cube', face: 'tall', color: 'navy', glow: 'white', v: 2 });
  });
  it('moves bots saved with the old default white eyes to the new automatic eyes', () => {
    expect(parsePrefs(raw({ shape: 'pebble', face: 'round', color: 'coral', glow: 'white' })).mascot).toEqual({ shape: 'pebble', face: 'round', color: 'coral', glow: 'auto', v: 2 });
  });
  it('carries older looks over where they still exist, and drops the rest', () => {
    // star shape, mint eyes and accessories are gone; the colour stays
    expect(parsePrefs(raw({ shape: 'star', face: 'round', color: 'teal', glow: 'mint', accessory: 'antenna' })).mascot).toEqual({ shape: 'orb', face: 'round', color: 'teal', glow: 'auto', v: 2 });
    expect(parsePrefs(raw({ kind: 'guide', skin: 'deep', hair: 'curly', name: 'Rashid' })).mascot).toEqual(DEFAULT_MASCOT);
  });
});

describe('notebook geometry', () => {
  const line: Stroke = { id: 's', tool: 'pen', color: '#000', size: 4, points: [[0, 0, 50], [100, 0, 50]] };
  it('the eraser hits a stroke near its path and misses it further away', () => {
    expect(hits(line, 50, 10, 14)).toBe(true);
    expect(hits(line, 50, 30, 14)).toBe(false);
    expect(hits(line, 120, 0, 14)).toBe(false);
  });
  it('simplify keeps the ends and drops points that are too close together', () => {
    const pts = Array.from({ length: 50 }, (_, i) => [i * 0.5, 0, 50] as [number, number, number]);
    const out = simplify(pts);
    expect(out[0]).toEqual(pts[0]);
    expect(out[out.length - 1]).toEqual(pts[pts.length - 1]);
    expect(out.length).toBeLessThan(pts.length / 2);
  });
});

describe('mascot prefs without a saved mascot', () => {
  it('uses the default bot', () => {
    const raw = encodeURIComponent(JSON.stringify({ band: 'g11-12', companion: true }));
    expect(parsePrefs(raw).mascot).toEqual(DEFAULT_MASCOT);
  });
});

describe('mascot eyes stay readable', () => {
  it('keeps a chosen eye colour that stands out', () => {
    expect(readableEyes(MASCOT_GLOW.white, MASCOT_FILL.royal)).toBe(MASCOT_GLOW.white);
    expect(readableEyes(MASCOT_GLOW.lime, MASCOT_FILL.navy)).toBe(MASCOT_GLOW.lime);
  });
  it('swaps eyes that would vanish into the body', () => {
    for (const [eye, body] of [['ink', 'graphite'], ['lime', 'lime'], ['sky', 'sky']] as const) {
      const out = readableEyes(MASCOT_GLOW[eye], MASCOT_FILL[body]);
      expect(out).not.toBe(MASCOT_GLOW[eye]);
      expect(contrast(out, MASCOT_FILL[body])).toBeGreaterThanOrEqual(2.6);
    }
  });
});

describe('automatic eyes', () => {
  it('are near-black on light bodies and white on dark ones', () => {
    for (const c of ['royal', 'sky', 'teal', 'violet', 'coral', 'lime'] as const) expect(eyeColour('auto', MASCOT_FILL[c])).toBe(MASCOT_GLOW.ink);
    for (const c of ['navy', 'graphite'] as const) expect(eyeColour('auto', MASCOT_FILL[c])).toBe(MASCOT_GLOW.white);
  });
});

describe('notebook shapes and lasso', async () => {
  const { recognise, lassoed } = await import('@/lib/notebook');
  const loop = (pts: [number, number][]) => pts.map(([x, y]) => [x, y, 50] as [number, number, number]);
  it('straightens a wobbly line', () => {
    const line = loop(Array.from({ length: 20 }, (_, i) => [100 + i * 10, 200 + (i % 2 ? 3 : -3)]));
    expect(recognise(line)).toHaveLength(2);
  });
  it('turns a rough box into a box and a rough circle into an ellipse', () => {
    const box = loop([[100, 100], [200, 102], [300, 100], [302, 200], [300, 300], [200, 298], [100, 300], [98, 200], [102, 104]]);
    expect(recognise(box)).toHaveLength(5);
    const circle = loop(Array.from({ length: 40 }, (_, i) => { const t = (i / 39) * Math.PI * 2; return [400 + Math.cos(t) * 100, 400 + Math.sin(t) * 80]; }));
    expect(recognise(circle)).toHaveLength(49);
  });
  it('leaves handwriting alone and finds strokes inside the lasso', () => {
    const scribble = loop([[100, 100], [140, 160], [120, 90], [180, 170], [150, 80], [210, 150]]);
    expect(recognise(scribble)).toBeNull();
    const s = { id: 'a', tool: 'pen' as const, color: '#000', size: 3, points: loop([[110, 110], [120, 120]]) };
    const far = { id: 'b', tool: 'pen' as const, color: '#000', size: 3, points: loop([[900, 900], [910, 910]]) };
    expect(lassoed([s, far], loop([[100, 100], [200, 100], [200, 200], [100, 200]]))).toEqual(['a']);
  });
});
