/**
 * Rule-based parser for LMS notification emails a student forwards to their Murshid inbox
 * (Google Classroom, Teams, Phoenix, ManageBac, Toddle, or a teacher's own email).
 * AI-LATER: an LLM extractor can replace this behind the same `ParsedLmsEmail` shape.
 *
 * Dates: UAE convention is day-first (14/10/2026). Times default to 23:59 Asia/Dubai.
 */
import type { MaterialKind } from '../domain';
import { addDays, dubaiDate, dubaiInstant, weekday } from '../lib/time';
import { z } from 'zod';

export interface ParsedLmsEmail {
  kind: z.infer<typeof MaterialKind>;
  title: string;
  course_name: string | null;
  due_at: string | null;
  lms: 'google_classroom' | 'teams' | 'managebac' | 'toddle' | 'phoenix' | 'other';
  matched_rules: string[];
  confidence: number; // 0..1, crude: share of fields we found
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2, wednesday: 3, wed: 3, thursday: 4, thu: 4,
  thurs: 4, friday: 5, fri: 5, saturday: 6, sat: 6,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

function stripHtml(html: string): string {
  return html.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/[ \t]+/g, ' ');
}

function cleanSubject(s: string): string {
  return s.replace(/^\s*((fwd?|fw|re)\s*:\s*)+/i, '').trim();
}

/** Parse a time like "11:59 PM", "5pm", "17:00" → minutes after midnight. */
function parseTime(s: string): number | null {
  const ampm = s.match(/\b(\d{1,2})(?:[:.](\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (ampm) {
    let h = Number(ampm[1]) % 12;
    if (/^p/i.test(ampm[3]!)) h += 12;
    return h * 60 + Number(ampm[2] ?? 0);
  }
  const h24 = s.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (h24) return Number(h24[1]) * 60 + Number(h24[2]);
  if (/\bmidnight\b/i.test(s)) return 23 * 60 + 59;
  if (/\bnoon\b/i.test(s)) return 12 * 60;
  return null;
}

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Infer the year for a day/month with no year: the next occurrence not more than 7 days in the past. */
function inferYear(m: number, d: number, ref: Date): number {
  const refDate = dubaiDate(ref);
  const y = Number(refDate.slice(0, 4));
  const candidate = `${y}-${pad(m)}-${pad(d)}`;
  return candidate < addDays(refDate, -7) ? y + 1 : y;
}

/** Find the first date in `text`. Returns YYYY-MM-DD (Dubai) or null. */
export function findDate(text: string, ref: Date): { date: string; index: number } | null {
  const t = text.toLowerCase();
  const cands: { date: string; index: number }[] = [];
  const push = (y: number, m: number, d: number, index: number) => {
    if (validYmd(y, m, d)) cands.push({ date: `${y}-${pad(m)}-${pad(d)}`, index });
  };
  for (const m of t.matchAll(/\b(\d{4})-(\d{2})-(\d{2})/g)) push(Number(m[1]), Number(m[2]), Number(m[3]), m.index);
  for (const m of t.matchAll(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/g)) {
    // skip things that look like times (11.59) when no year and followed by am/pm
    if (!m[3] && /^\s*(am|pm|a\.m|p\.m)/.test(t.slice(m.index + m[0].length))) continue;
    if (!m[3] && m[0].includes('.')) continue;
    let a = Number(m[1]);
    let b = Number(m[2]);
    if (b > 12 && a <= 12) [a, b] = [b, a]; // clearly month-first (US style)
    const y = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : inferYear(b, a, ref);
    push(y, b, a, m.index);
  }
  for (const m of t.matchAll(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\.?(?:,?\\s+(\\d{4}))?`, 'g'))) {
    const d = Number(m[1]);
    const mo = MONTHS[m[2]!.slice(0, m[2]!.startsWith('sept') ? 4 : 3)]!;
    push(m[3] ? Number(m[3]) : inferYear(mo, d, ref), mo, d, m.index);
  }
  for (const m of t.matchAll(new RegExp(`\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, 'g'))) {
    const d = Number(m[2]);
    const mo = MONTHS[m[1]!.slice(0, m[1]!.startsWith('sept') ? 4 : 3)]!;
    push(m[3] ? Number(m[3]) : inferYear(mo, d, ref), mo, d, m.index);
  }
  const refDate = dubaiDate(ref);
  for (const m of t.matchAll(/\b(today|tonight|tomorrow)\b/g)) {
    cands.push({ date: m[1] === 'tomorrow' ? addDays(refDate, 1) : refDate, index: m.index });
  }
  for (const m of t.matchAll(/\b(?:(this|next)\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/g)) {
    const target = WEEKDAYS[m[2]!]!;
    let diff = (target - weekday(refDate) + 7) % 7;
    if (diff === 0) diff = 7;
    // "next Monday" is treated as the coming Monday (common UAE school usage)
    cands.push({ date: addDays(refDate, diff), index: m.index });
  }
  cands.sort((a, b) => a.index - b.index);
  return cands[0] ?? null;
}

function detectLms(from: string, body: string): ParsedLmsEmail['lms'] {
  const s = `${from}\n${body}`.toLowerCase();
  if (s.includes('classroom.google') || s.includes('google classroom')) return 'google_classroom';
  if (s.includes('teams.microsoft') || s.includes('microsoft teams')) return 'teams';
  if (s.includes('managebac')) return 'managebac';
  if (s.includes('toddle')) return 'toddle';
  if (s.includes('phoenix')) return 'phoenix';
  return 'other';
}

export function parseLmsEmail(
  email: { subject: string; text: string; html?: string; from?: string; date?: string },
  opts: { now: Date; knownCourses?: string[] },
): ParsedLmsEmail {
  const rules: string[] = [];
  const subject = cleanSubject(email.subject);
  const body = email.text?.trim() ? email.text : email.html ? stripHtml(email.html) : '';
  const all = `${subject}\n${body}`;
  const ref = email.date ? new Date(email.date) : opts.now;

  // kind
  let kind: ParsedLmsEmail['kind'] = 'note';
  if (/\b(assignment|homework|coursework|submission|hand[- ]?in|worksheet|essay|project)\b/i.test(all)) {
    kind = 'assignment'; rules.push('kind:assignment-keyword');
  } else if (/\b(exam|test|quiz|assessment|mock)\b/i.test(all)) {
    kind = 'exam'; rules.push('kind:exam-keyword');
  } else if (/\b(announcement|posted|reminder|notice)\b/i.test(all)) {
    kind = 'announcement'; rules.push('kind:announcement-keyword');
  }
  if (kind === 'note' && /\bdue\b/i.test(all)) { kind = 'assignment'; rules.push('kind:due-keyword'); }

  // title
  let title = '';
  const quoted = subject.match(/["“'‘](.+?)["”'’]/);
  const afterColon = subject.match(/^(?:new\s+)?(?:assignment|homework|material|announcement|question|quiz|exam|test|due\s+\w+)(?:\s+in\s+[^:]+)?\s*:\s*(.+)$/i);
  if (quoted) { title = quoted[1]!.trim(); rules.push('title:quoted'); }
  else if (afterColon) { title = afterColon[1]!.trim(); rules.push('title:after-prefix'); }
  else title = subject || body.split('\n').find((l) => l.trim())?.trim().slice(0, 120) || 'Forwarded item';
  title = title.replace(/\s+is due.*$/i, '').trim();

  // course
  let course_name: string | null = null;
  const known = [...(opts.knownCourses ?? [])].sort((a, b) => b.length - a.length);
  const lowerAll = all.toLowerCase();
  const k = known.find((c) => c && lowerAll.includes(c.toLowerCase()));
  if (k) { course_name = k; rules.push('course:known'); }
  else {
    const pats = [
      /posted (?:a )?new (?:assignment|material|announcement|question|quiz)\s+in\s+([^\n.:"]+)/i,
      /^new (?:assignment|material|announcement|question|quiz) in ([^:]+):/i,
      /\b(?:class|course|subject)\s*:\s*([^\n]+)/i,
      /\bin\s+(?:your\s+)?class\s+([^\n.:"]+)/i,
    ];
    for (const p of pats) {
      const m = subject.match(p) ?? body.match(p);
      if (m) { course_name = m[1]!.trim().slice(0, 80); rules.push('course:pattern'); break; }
    }
  }

  // due date: prefer the text right after "due"
  let due_at: string | null = null;
  const dueMatch = all.match(/\b(?:due|deadline|submit(?:\s+it)?\s+by|hand[- ]in\s+by|closes)\b(?:\s+date)?\s*(?:on|by|:|-)?\s*([^\n]{0,80})/i);
  let dateHit: { date: string } | null = null;
  let timeSrc = '';
  if (dueMatch) {
    dateHit = findDate(dueMatch[1]!, ref);
    timeSrc = dueMatch[1]!;
    if (dateHit) rules.push('due:after-keyword');
  }
  if (!dateHit && (kind === 'assignment' || kind === 'exam')) {
    const any = findDate(all, ref);
    if (any) {
      dateHit = any;
      timeSrc = all.slice(any.index, any.index + 60);
      rules.push('due:first-date');
    }
  }
  if (dateHit) {
    const mins = parseTime(timeSrc) ?? (kind === 'exam' ? 8 * 60 : 23 * 60 + 59);
    due_at = dubaiInstant(dateHit.date, mins).toISOString();
  }

  const found = [kind !== 'note', !!quoted || !!afterColon, !!course_name, !!due_at].filter(Boolean).length;
  return { kind, title, course_name, due_at, lms: detectLms(email.from ?? '', body), matched_rules: rules, confidence: found / 4 };
}
