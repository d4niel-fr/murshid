const rules = new Intl.PluralRules('en-GB');

/** "1 card", "3 cards", "0 cards": an English count with its noun. (Arabic copy is written per phrase.) */
export function count(n: number, one: string, other = `${one}s`): string {
  return `${n} ${rules.select(n) === 'one' ? one : other}`;
}

const ar = new Intl.PluralRules('ar');
/**
 * An Arabic count with its noun, which changes form with the number:
 * 1 سؤال واحد · 2 سؤالان · 3–10 أسئلة · 11–99 سؤالاً · 100+ سؤال.
 */
export function countAr(n: number, f: { one: string; two: string; few: string; many: string; other: string }): string {
  const c = ar.select(n);
  if (c === 'one') return f.one;
  if (c === 'two') return f.two;
  return `${n} ${c === 'few' ? f.few : c === 'many' ? f.many : f.other}`;
}
