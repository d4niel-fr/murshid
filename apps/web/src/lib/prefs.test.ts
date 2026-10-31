import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT, parsePrefs, serializePrefs } from './prefs';
import { hits, simplify, type Stroke } from './notebook';

const raw = (mascot: unknown) => serializePrefs({ ...parsePrefs(null), mascot } as never);

describe('mascot prefs', () => {
  it('defaults to Rashid in a navy hoodie', () => {
    expect(parsePrefs(null).mascot).toEqual(DEFAULT_MASCOT);
    expect(DEFAULT_MASCOT).toMatchObject({ kind: 'guide', color: 'navy', name: 'Rashid' });
  });
  it('moves settings saved before characters existed to the new character, keeping colour and accessory', () => {
    expect(parsePrefs(raw({ color: 'teal', accessory: 'glasses', name: 'Nour' })).mascot).toMatchObject({ kind: 'guide', color: 'teal', accessory: 'glasses', name: 'Rashid' });
  });
  it('keeps a name the student chose', () => {
    expect(parsePrefs(raw({ color: 'navy', accessory: 'none', name: 'Sami' })).mascot?.name).toBe('Sami');
  });
  it('keeps the star for students who picked it, with its own name', () => {
    expect(parsePrefs(raw({ kind: 'star', color: 'royal', accessory: 'bow', skin: 'deep', hair: 'curly', name: 'Nour' })).mascot).toMatchObject({ kind: 'star', name: 'Nour' });
  });
  it('rejects unknown values and unsafe names', () => {
    const m = parsePrefs(raw({ kind: 'robot', skin: 'green', hair: 'mohawk', name: '<script>' })).mascot;
    expect(m).toMatchObject({ kind: 'guide', skin: DEFAULT_MASCOT.skin, hair: DEFAULT_MASCOT.hair, name: 'script' });
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
