/**
 * Fuzzy matching for the smart search: every query character must appear in order. Matches score higher when they
 * are consecutive, start a word, or start the string; whole-word substring matches score highest.
 * Returns null when there is no match, else the score and the matched character positions (for highlighting).
 */
export function fuzzy(query: string, text: string): { score: number; hits: number[] } | null {
  const q = query.trim().toLowerCase(); const t = text.toLowerCase();
  if (!q) return { score: 0, hits: [] };
  const sub = t.indexOf(q);
  if (sub >= 0) {
    const wordStart = sub === 0 || /[\s\-_/·(]/.test(t[sub - 1]!);
    return { score: 100 + (wordStart ? 40 : 0) + (sub === 0 ? 20 : 0) - Math.min(sub, 30) - t.length / 50, hits: Array.from({ length: q.length }, (_, i) => sub + i) };
  }
  let ti = 0; let score = 0; let prev = -2; const hits: number[] = [];
  for (const ch of q) {
    if (ch === ' ') continue;
    const at = t.indexOf(ch, ti);
    if (at < 0) return null;
    score += at === prev + 1 ? 6 : 1;
    if (at === 0 || /[\s\-_/·(]/.test(t[at - 1]!)) score += 4;
    hits.push(at); prev = at; ti = at + 1;
  }
  return { score: score - (hits[hits.length - 1]! - hits[0]!) / 10 - t.length / 80, hits };
}

/** Best matches first, limited to `limit`. */
export function rank<T>(query: string, items: T[], text: (x: T) => string, limit = 50): { item: T; score: number; hits: number[] }[] {
  const out: { item: T; score: number; hits: number[] }[] = [];
  for (const item of items) { const m = fuzzy(query, text(item)); if (m) out.push({ item, ...m }); }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
