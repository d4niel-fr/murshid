/** Date parsing for deadlines in many human formats. Pure, deterministic, no network. */
import { todayIso } from '../util.js';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5,
  jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD = '(\\d{1,2})(?:st|nd|rd|th)?';

export interface FoundDate {
  iso: string; // YYYY-MM-DD
  index: number; // position in text
  raw: string;
  yearInferred: boolean;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function valid(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 2000 || y > 2100) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function toIso(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** When a year is missing, choose the next occurrence on/after `now` (minus a 30-day grace). */
function inferYear(m: number, d: number, now: Date): number {
  const y = now.getUTCFullYear();
  const candidate = Date.UTC(y, m - 1, d);
  const grace = 30 * 86400000;
  return candidate + grace < now.getTime() ? y + 1 : y;
}

/**
 * The year a page is "about": the most frequent year among explicit full dates (ties → latest).
 * Used for yearless dates like "June 28 and July 5, 2026" or "Deadline: 31 May" on a 2026 page.
 */
function contextYear(text: string): number | null {
  const counts = new Map<number, number>();
  const re = new RegExp(`(?:${MON}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\.?,?\\s+)(20\\d{2})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const y = Number(m[3]);
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestN = 0;
  for (const [y, n] of counts) if (n > bestN || (n === bestN && best !== null && y > best)) [best, bestN] = [y, n];
  return best;
}

/**
 * Find every date in `text`. Supports:
 *  2026-06-19 | 19/06/2026 (day-first, UAE/UK convention) | 19.06.2026 |
 *  June 19, 2026 | June 19th 2026 | 19 June 2026 | 20th of June, 2026 | Jun 19 (year inferred) |
 *  ranges like "July 6-10, 2026" / "8-10 June 2026" (first day returned).
 */
export function findDates(text: string, now: Date = new Date()): FoundDate[] {
  const out: FoundDate[] = [];
  const ctxYear = contextYear(text);
  const yearFor = (mo: number, d: number) => ctxYear ?? inferYear(mo, d, now);
  const taken: Array<[number, number]> = [];
  const push = (index: number, raw: string, y: number, m: number, d: number, inferred: boolean) => {
    if (!valid(y, m, d)) return;
    const end = index + raw.length;
    if (taken.some(([s, e]) => index < e && end > s)) return;
    taken.push([index, end]);
    out.push({ iso: toIso(y, m, d), index, raw, yearInferred: inferred });
  };
  const run = (re: RegExp, fn: (m: RegExpExecArray) => void) => {
    let mm: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((mm = re.exec(text)) !== null) fn(mm);
  };

  // ISO 2026-06-19
  run(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, (m) => push(m.index, m[0], +m[1]!, +m[2]!, +m[3]!, false));
  // Month D(-D), YYYY
  run(new RegExp(`\\b${MON}\\.?\\s+${ORD}(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?,?\\s+(20\\d{2})\\b`, 'gi'), (m) =>
    push(m.index, m[0], +m[3]!, MONTHS[m[1]!.toLowerCase()]!, +m[2]!, false),
  );
  // D(-D) (of) Month(,) YYYY
  run(new RegExp(`\\b${ORD}(?:\\s*[-–]\\s*\\d{1,2}(?:st|nd|rd|th)?)?\\s+(?:of\\s+)?${MON}\\.?,?\\s+(20\\d{2})\\b`, 'gi'), (m) =>
    push(m.index, m[0], +m[3]!, MONTHS[m[2]!.toLowerCase()]!, +m[1]!, false),
  );
  // DD/MM/YYYY or DD.MM.YYYY (day-first)
  run(/\b(\d{1,2})[/.](\d{1,2})[/.](20\d{2})\b/g, (m) => {
    let d = +m[1]!, mo = +m[2]!;
    if (mo > 12 && d <= 12) [d, mo] = [mo, d]; // obviously US-style
    push(m.index, m[0], +m[3]!, mo, d, false);
  });
  // Month D (no year)
  run(new RegExp(`\\b${MON}\\.?\\s+${ORD}\\b(?![,\\s]*\\d{4})`, 'gi'), (m) => {
    const mo = MONTHS[m[1]!.toLowerCase()]!;
    const d = +m[2]!;
    push(m.index, m[0], yearFor(mo, d), mo, d, true);
  });
  // D Month (no year)
  run(new RegExp(`\\b${ORD}\\s+(?:of\\s+)?${MON}\\b(?![.,]?\\s*\\d{4})`, 'gi'), (m) => {
    const mo = MONTHS[m[2]!.toLowerCase()]!;
    const d = +m[1]!;
    push(m.index, m[0], yearFor(mo, d), mo, d, true);
  });
  return out.sort((a, b) => a.index - b.index);
}

const DEADLINE_KW =
  /(deadline|apply\s+by|applications?\s+(?:close|closes|due|deadline|end|ends)|closing\s+date|last\s+date|register\s+by|registration\s+(?:closes|deadline|ends)|submissions?\s+(?:due|close|deadline)|due\s+(?:date|by)|nominations?\s+close)/gi;

/**
 * Find the deadline: the first date that appears within 80 chars after a deadline keyword.
 * Returns null when no keyword-anchored date exists (we never guess from event dates here).
 */
export function findDeadline(text: string, now: Date = new Date()): string | null {
  const dates = findDates(text, now);
  if (dates.length === 0) return null;
  const candidates: FoundDate[] = [];
  let m: RegExpExecArray | null;
  DEADLINE_KW.lastIndex = 0;
  while ((m = DEADLINE_KW.exec(text)) !== null) {
    const kwEnd = m.index + m[0].length;
    const d = dates.find((x) => x.index >= kwEnd && x.index - kwEnd <= 80);
    if (d) candidates.push(d);
  }
  if (candidates.length === 0) return null;
  // Prefer the earliest upcoming deadline; else the latest past one (signals "closed").
  const today = todayIso(now);
  const upcoming = candidates.filter((c) => c.iso >= today).sort((a, b) => a.iso.localeCompare(b.iso));
  if (upcoming.length) return upcoming[0]!.iso;
  return candidates.map((c) => c.iso).sort().at(-1) ?? null;
}

/** First date following an event-date label ("Date:", "Dates:", "held on"). */
export function findEventDate(text: string, now: Date = new Date()): string | null {
  const re = /(dates?\s*:|held\s+on|takes\s+place\s+on|starts?\s*:)/gi;
  const dates = findDates(text, now);
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const end = m.index + m[0].length;
    const d = dates.find((x) => x.index >= end && x.index - end <= 40);
    if (d) return d.iso;
  }
  return null;
}

