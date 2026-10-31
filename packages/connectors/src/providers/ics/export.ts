import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NormalizedCalendarEvent, NormalizedTask } from '../../core/types';

/**
 * ICS feed generator for Apple Calendar / any CalDAV-less subscriber
 * (webcal://.../feed/<token>.ics). Output is RFC 5545: CRLF line endings,
 * 75-octet folding, escaped TEXT, UTC DATE-TIME values.
 */
export interface FeedOptions {
  calendarName: string;
  /** used as PRODID + UID domain */
  domain?: string;
  now?: Date;
  /** suggested refresh for subscribers, minutes (default 60) */
  refreshMinutes?: number;
}

export type FeedTask = Pick<NormalizedTask, 'title' | 'due_at' | 'status'> & { external_id?: string };

export function escapeText(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold to 75 octets (UTF-8 safe). */
export function foldLine(line: string): string {
  const bytes = Buffer.from(line, 'utf8');
  if (bytes.length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let curLen = 0;
  let limit = 75;
  for (const ch of line) {
    const l = Buffer.byteLength(ch, 'utf8');
    if (curLen + l > limit) {
      parts.push(cur);
      cur = '';
      curLen = 0;
      limit = 74; // continuation lines start with a space
    }
    cur += ch;
    curLen += l;
  }
  parts.push(cur);
  return parts.join('\r\n ');
}

export function toIcsUtc(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

export function buildIcsFeed(
  events: Pick<NormalizedCalendarEvent, 'title' | 'start_at' | 'end_at' | 'source' | 'external_id'>[],
  tasks: FeedTask[],
  opts: FeedOptions,
): string {
  const domain = opts.domain ?? 'murshid.app';
  const stamp = toIcsUtc((opts.now ?? new Date()).toISOString());
  const refresh = opts.refreshMinutes ?? 60;
  const L: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//Murshid//Connectors//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(opts.calendarName)}`,
    'X-WR-TIMEZONE:Asia/Dubai',
    `REFRESH-INTERVAL;VALUE=DURATION:PT${refresh}M`,
    `X-PUBLISHED-TTL:PT${refresh}M`,
  ];
  for (const e of events) {
    L.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(`${e.source}-${e.external_id}`)}@${domain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(e.start_at)}`,
      `DTEND:${toIcsUtc(e.end_at)}`,
      `SUMMARY:${escapeText(e.title)}`,
      'END:VEVENT',
    );
  }
  // Apple Calendar ignores VTODO in subscribed calendars, so deadlines are
  // published as 15-minute VEVENTs ending at the due time, with an alarm.
  tasks.forEach((t, i) => {
    if (!t.due_at || t.status === 'done' || t.status === 'skipped') return;
    const end = new Date(t.due_at);
    const start = new Date(end.getTime() - 15 * 60_000);
    const id = t.external_id ?? `task-${i}-${toIcsUtc(t.due_at)}`;
    L.push(
      'BEGIN:VEVENT',
      `UID:${escapeText(`deadline-${id}`)}@${domain}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toIcsUtc(start.toISOString())}`,
      `DTEND:${toIcsUtc(end.toISOString())}`,
      `SUMMARY:${escapeText(`Due: ${t.title}`)}`,
      'CATEGORIES:Murshid deadline',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(`Due soon: ${t.title}`)}`,
      'TRIGGER:-PT24H',
      'END:VALARM',
      'END:VEVENT',
    );
  });
  L.push('END:VCALENDAR');
  return L.map(foldLine).join('\r\n') + '\r\n';
}

/**
 * Unguessable per-student feed tokens (subscribe URLs cannot carry auth headers).
 * token = base64url(studentId) + "." + HMAC-SHA256(secret, studentId + "." + version)
 * Rotate by bumping `version` (stored on the student) to invalidate old URLs.
 */
export function signFeedToken(studentId: string, secret: string, version = 1): string {
  const mac = createHmac('sha256', secret).update(`${studentId}.${version}`).digest('base64url');
  return `${Buffer.from(studentId).toString('base64url')}.${version}.${mac}`;
}

export function verifyFeedToken(token: string, secret: string, currentVersion = 1): string | null {
  const [sid64, ver, mac] = token.split('.');
  if (!sid64 || !ver || !mac || Number(ver) !== currentVersion) return null;
  const studentId = Buffer.from(sid64, 'base64url').toString('utf8');
  const expected = createHmac('sha256', secret).update(`${studentId}.${ver}`).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b) ? studentId : null;
}
