const rules = new Intl.PluralRules('en-GB');

/** "1 card", "3 cards", "0 cards": an English count with its noun. (Arabic copy is written per phrase.) */
export function count(n: number, one: string, other = `${one}s`): string {
  return `${n} ${rules.select(n) === 'one' ? one : other}`;
}
