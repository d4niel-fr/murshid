import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT, MASCOT_NAME, parsePrefs, serializePrefs } from './prefs';
import { hits, simplify, type Stroke } from './notebook';

const raw = (mascot: unknown) => serializePrefs({ ...parsePrefs(null), mascot } as never);

describe('mascot prefs', () => {
  it('defaults to a Murshid-blue orb with white eyes, called Murshid', () => {
    expect(parsePrefs(null).mascot).toEqual(DEFAULT_MASCOT);
    expect(DEFAULT_MASCOT).toEqual({ shape: 'orb', face: 'tall', color: 'royal', glow: 'white' });
    expect(MASCOT_NAME).toEqual({ en: 'Murshid', ar: 'مرشد' });
  });
  it('keeps every choice the bot still has', () => {
    expect(parsePrefs(raw({ shape: 'capsule', face: 'mono', color: 'graphite', glow: 'lime' })).mascot).toEqual({ shape: 'capsule', face: 'mono', color: 'graphite', glow: 'lime' });
  });
  it('carries older looks over where they still exist, and drops the rest', () => {
    // star shape, mint eyes and accessories are gone; the colour stays
    expect(parsePrefs(raw({ shape: 'star', face: 'round', color: 'teal', glow: 'mint', accessory: 'antenna' })).mascot).toEqual({ shape: 'orb', face: 'round', color: 'teal', glow: 'white' });
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
