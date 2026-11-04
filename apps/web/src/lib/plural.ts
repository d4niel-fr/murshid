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

/** The nouns the app counts, in each Arabic number form. `two` is the subject form, `two2` the object/after-a-preposition form. */
const NOUNS = {
  card: { one: 'بطاقة واحدة', two: 'بطاقتان', two2: 'بطاقتين', few: 'بطاقات', many: 'بطاقة', other: 'بطاقة' },
  item: { one: 'عنصر واحد', two: 'عنصران', two2: 'عنصرين', few: 'عناصر', many: 'عنصراً', other: 'عنصر' },
  page: { one: 'صفحة واحدة', two: 'صفحتان', two2: 'صفحتين', few: 'صفحات', many: 'صفحة', other: 'صفحة' },
  question: { one: 'سؤال واحد', two: 'سؤالان', two2: 'سؤالين', few: 'أسئلة', many: 'سؤالاً', other: 'سؤال' },
  minute: { one: 'دقيقة واحدة', two: 'دقيقتان', two2: 'دقيقتين', few: 'دقائق', many: 'دقيقة', other: 'دقيقة' },
  day: { one: 'يوم واحد', two: 'يومان', two2: 'يومين', few: 'أيام', many: 'يوماً', other: 'يوم' },
  player: { one: 'لاعب واحد', two: 'لاعبان', two2: 'لاعبَين', few: 'لاعبين', many: 'لاعباً', other: 'لاعب' },
  point: { one: 'نقطة واحدة', two: 'نقطتان', two2: 'نقطتين', few: 'نقاط', many: 'نقطة', other: 'نقطة' },
  topic: { one: 'موضوع واحد', two: 'موضوعان', two2: 'موضوعين', few: 'مواضيع', many: 'موضوعاً', other: 'موضوع' },
} as const;
export type ArNoun = keyof typeof NOUNS;

/**
 * "8 بطاقات", "بطاقتان", "11 بطاقة": a count with the right Arabic noun form.
 * Pass `object` when the phrase is the object of a verb or follows a preposition ("راجعت بطاقتين", "بعد يومين").
 */
export function nAr(n: number, noun: ArNoun, object = false): string {
  const f = NOUNS[noun];
  return countAr(n, { ...f, two: object ? f.two2 : f.two });
}
