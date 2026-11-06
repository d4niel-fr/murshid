import { describe, expect, it } from 'vitest';
import { merge3, same } from './sync';

describe('merging the same store from two devices', () => {
  const base = { decks: [{ id: 'a', title: 'Forces' }, { id: 'b', title: 'Poems' }], xp: { total: 10 } };
  it('keeps an edit made on each device to different items', () => {
    const phone = { ...base, decks: [{ id: 'a', title: 'Forces and motion' }, base.decks[1]!] };
    const ipad = { ...base, decks: [...base.decks, { id: 'c', title: 'Cells' }] };
    expect(merge3(base, phone, ipad)).toEqual({ decks: [{ id: 'a', title: 'Forces and motion' }, { id: 'b', title: 'Poems' }, { id: 'c', title: 'Cells' }], xp: { total: 10 } });
  });
  it('a delete on one device stays deleted, unless the other device changed that item', () => {
    const phone = { ...base, decks: [base.decks[0]!] }; // deleted b
    expect(merge3(base, phone, base)).toEqual(phone);
    const ipad = { ...base, decks: [base.decks[0]!, { id: 'b', title: 'Poems (exam)' }] }; // edited b meanwhile
    expect(merge3(base, phone, ipad)).toEqual(ipad);
  });
  it('when both change the same field, this device wins; fields changed on one side are taken from it', () => {
    const local = { ...base, xp: { total: 25 } };
    const remote = { ...base, xp: { total: 30 }, extra: true };
    expect(merge3(base, local, remote)).toEqual({ decks: base.decks, xp: { total: 25 }, extra: true });
  });
  it('without a base (first sync on a device) nothing is treated as deleted', () => {
    expect(merge3(undefined, { decks: [{ id: 'x' }] }, { decks: [{ id: 'y' }] })).toEqual({ decks: [{ id: 'y' }, { id: 'x' }] });
  });
  it('compares regardless of key order', () => {
    expect(same({ a: 1, b: { c: [1, { d: 2, e: 3 }] } }, { b: { c: [1, { e: 3, d: 2 }] }, a: 1 })).toBe(true);
    expect(merge3({ a: 1, b: 2 }, { b: 2, a: 1 }, { a: 1, b: 3 })).toEqual({ a: 1, b: 3 });
  });
});
