/**
 * Rule-based due-date extraction for notification emails. Interprets wall-clock
 * times in the student's zone (default Asia/Dubai, UTC+4, no DST). UAE numeric
 * dates are day-first (16/10/2026 = 16 Oct).
 */
const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// hour must be followed by :mm or am/pm so stray numbers are not read as times
const TIME = '(?:,?\\s*(?:at\\s+)?(\\d{1,2})(?=:\\d{2}|\\s*[ap]\\.?m\\b)(?::(\\d{2}))?(?:\\s*([ap])\\.?m\\b\\.?)?)?';

export interface DueParseOptions {
  /** reference instant (email Date header) for year inference and today/tomorrow */
  reference: Date;
  tzOffsetMinutes?: number;
}

function toUtcIso(y: number, mo: number, d: number, hh: number | null, mi: number, ampm: string | undefined, off: number): string | null {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let h = hh ?? 23;
  let m = hh === null ? 59 : mi;
  if (ampm) {
    const pm = ampm.toLowerCase().startsWith('p');
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  if (h > 23 || m > 59) return null;
  return new Date(Date.UTC(y, mo - 1, d, h, m) - off * 60_000).toISOString();
}

function localParts(ref: Date, off: number) {
  const l = new Date(ref.getTime() + off * 60_000);
  return { y: l.getUTCFullYear(), mo: l.getUTCMonth() + 1, d: l.getUTCDate() };
}

/** When the year is missing pick the first occurrence not more than ~2 months before the reference. */
function inferYear(mo: number, d: number, ref: Date, off: number): number {
  const { y } = localParts(ref, off);
  const candidate = Date.UTC(y, mo - 1, d);
  return candidate < ref.getTime() - 60 * 86_400_000 ? y + 1 : y;
}

const num = (s: string | undefined) => (s === undefined ? null : Number(s));

/** Parse a single date expression ("Oct 15, 2026, 11:59 PM", "16/10/2026", "tomorrow 8am"...). */
export function parseDateExpression(text: string, opts: DueParseOptions): string | null {
  const off = opts.tzOffsetMinutes ?? 240;
  const t = text.replace(/\s+/g, ' ').trim();
  let m: RegExpExecArray | null;

  // ISO 2026-10-16[ T]23:59
  if ((m = /\b(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(t))) {
    return toUtcIso(+m[1]!, +m[2]!, +m[3]!, num(m[4]), num(m[5]) ?? 0, undefined, off);
  }
  // Month D[, YYYY][, h:mm am]   (optional weekday prefix is ignored)
  if ((m = new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?!\\d)(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${TIME}`, 'i').exec(t))) {
    const key = m[1]!.toLowerCase();
    const mo = MONTHS[key] ?? MONTHS[key.slice(0, 3)]!;
    const d = +m[2]!;
    const y = m[3] ? +m[3] : inferYear(mo, d, opts.reference, off);
    return toUtcIso(y, mo, d, num(m[4]), num(m[5]) ?? 0, m[6], off);
  }
  // D Month [YYYY][ at h:mm am]
  if ((m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}\\.?(?:,?\\s+(\\d{4}))?${TIME}`, 'i').exec(t))) {
    const key = m[2]!.toLowerCase();
    const mo = MONTHS[key] ?? MONTHS[key.slice(0, 3)]!;
    const d = +m[1]!;
    const y = m[3] ? +m[3] : inferYear(mo, d, opts.reference, off);
    return toUtcIso(y, mo, d, num(m[4]), num(m[5]) ?? 0, m[6], off);
  }
  // DD/MM/YYYY or DD-MM-YYYY (day-first, UAE)
  if ((m = new RegExp(`\\b(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})${TIME}`, 'i').exec(t))) {
    return toUtcIso(+m[3]!, +m[2]!, +m[1]!, num(m[4]), num(m[5]) ?? 0, m[6], off);
  }
  // today / tomorrow [at] h[:mm] am
  if ((m = new RegExp(`\\b(today|tomorrow|tonight)${TIME}`, 'i').exec(t))) {
    const base = localParts(opts.reference, off);
    const shift = m[1]!.toLowerCase() === 'tomorrow' ? 1 : 0;
    const dt = new Date(Date.UTC(base.y, base.mo - 1, base.d + shift));
    return toUtcIso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), num(m[2]), num(m[3]) ?? 0, m[4], off);
  }
  return null;
}

/** Find the due-date line in a body and parse it. */
export function findDueDate(text: string, opts: DueParseOptions): string | null {
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const m = /\b(?:due(?:\s*date)?|deadline|submit\s+by|closes?)\b\s*(?:on|by)?\s*[:\-–]?\s*(.+)$/i.exec(line);
    if (m) {
      const iso = parseDateExpression(m[1]!, opts);
      if (iso) return iso;
    }
  }
  return null;
}
