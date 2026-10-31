import { createHash } from 'node:crypto';

/** Deterministic UUID (v5-style layout from SHA-1) so re-crawls produce stable ids. */
export function stableUuid(...parts: string[]): string {
  const h = createHash('sha1').update(parts.join('\u241F')).digest('hex');
  const variant = ((parseInt(h.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const STOP = new Set(['the', 'a', 'an', 'of', 'for', 'and', 'in', 'on', 'at', 'to', '&', 'program', 'programme', 'edition']);

/** Normalize a title for dedupe: lowercase, strip years/ordinals/punctuation/stopwords. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(19|20)\d{2}(?:[-/]\d{2,4})?\b/g, ' ')
    .replace(/\b\d+(st|nd|rd|th)\b/g, ' ')
    .replace(/[^a-z0-9\u0600-\u06ff]+/g, ' ')
    .split(' ')
    .filter((w) => w && !STOP.has(w))
    .join(' ')
    .trim();
}

export function normalizeOrganizer(org: string): string {
  return org
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(the|university|of|foundation|inc|ltd|llc)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Sørensen–Dice coefficient on character bigrams (0..1). */
export function diceSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = (s: string) => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };
  const A = grams(a);
  const B = grams(b);
  let inter = 0;
  for (const [g, n] of A) inter += Math.min(n, B.get(g) ?? 0);
  return (2 * inter) / (a.length - 1 + (b.length - 1));
}

export function cleanText(s: string | undefined | null): string {
  return (s ?? '').replace(/\s+/g, ' ').trim();
}

export function absoluteUrl(href: string | undefined, base: string): string {
  if (!href) return base;
  try {
    return new URL(href, base).toString();
  } catch {
    return base;
  }
}

const p2 = (n: number) => String(n).padStart(2, '0');

/** ISO-8601 UTC timestamp (equivalent to Date#toISOString, kept explicit for clarity/testability). */
export function isoDateTime(d: Date): string {
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}T${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}.${String(d.getUTCMilliseconds()).padStart(3, '0')}Z`;
}

/** YYYY-MM-DD (UTC). */
export function todayIso(now: Date): string {
  return isoDateTime(now).slice(0, 10);
}
