import { describe, expect, it } from 'vitest';
import { DEFAULT_MASCOT, MASCOT_NAME, parsePrefs, serializePrefs } from './prefs';
import { hits, simplify, type Stroke } from './notebook';

const raw = (mascot: unknown) => serializePrefs({ ...parsePrefs(null), mascot } as never);

describe('mascot prefs', () => {
  it('defaults to a navy Murshid bot', () => {
    expect(parsePrefs(null).mascot).toEqual(DEFAULT_MASCOT);
    expect(DEFAULT_MASCOT).toEqual({ shape: 'orb', face: 'round', color: 'navy', glow: 'sky', accessory: 'antenna' });
    expect(MASCOT_NAME).toEqual({ en: 'Murshid', ar: 'مرشد' });
  });
  it('keeps the colour and accessory from older settings, and drops anything human or renamed', () => {
    const m = parsePrefs(raw({ kind: 'guide', color: 'teal', accessory: 'headphones', skin: 'deep', hair: 'curly', name: 'Rashid' })).mascot;
    expect(m).toEqual({ shape: 'orb', face: 'round', color: 'teal', glow: 'sky', accessory: 'headphones' });
  });
  it('turns the old star character into the star shape', () => {
    expect(parsePrefs(raw({ kind: 'star', color: 'royal', accessory: 'bow', name: 'Nour' })).mascot).toMatchObject({ shape: 'star', color: 'royal', accessory: 'bow' });
  });
  it('drops accessories the bot no longer has', () => {
    expect(parsePrefs(raw({ color: 'navy', accessory: 'glasses' })).mascot?.accessory).toBe('none');
  });
  it('keeps every bot choice and rejects unknown values', () => {
    expect(parsePrefs(raw({ shape: 'capsule', face: 'mono', color: 'violet', glow: 'mint', accessory: 'cap' })).mascot).toEqual({ shape: 'capsule', face: 'mono', color: 'violet', glow: 'mint', accessory: 'cap' });
    expect(parsePrefs(raw({ shape: 'human', face: 'smile', glow: 'rainbow', accessory: 'wig' })).mascot).toEqual({ ...DEFAULT_MASCOT, accessory: 'antenna' });
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
  it('uses the default bot, antenna included', () => {
    const raw = encodeURIComponent(JSON.stringify({ band: 'g11-12', companion: true }));
    expect(parsePrefs(raw).mascot).toEqual(DEFAULT_MASCOT);
  });
});
