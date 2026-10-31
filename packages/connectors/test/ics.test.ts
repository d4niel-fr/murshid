import { describe, expect, it } from 'vitest';
import { icsDateToIso, parseIcs, unfold } from '../src/providers/ics/parse';
import { buildIcsFeed, foldLine, signFeedToken, verifyFeedToken } from '../src/providers/ics/export';
import { assertSafeIcsUrl, IcsImportConnector } from '../src/providers/ics/connector';
import { InMemoryTokenVault } from '../src/core/vault';
import { fixture, mockFetch, STUDENT } from './helpers/mockFetch';

describe('ICS parse', () => {
  const ics = fixture('ics/school.ics');

  it('parses events with TZID, all-day, DURATION, escaping, folding', () => {
    const { events, todos, calendarName } = parseIcs(ics);
    expect(calendarName).toBe('GEMS Test School Calendar');
    const mock = events.find((e) => e.uid === 'term1-exams@school.example')!;
    expect(mock).toMatchObject({ summary: 'Mock exams, Paper 1', start: '2026-11-02T04:00:00.000Z', end: '2026-11-02T06:00:00.000Z', allDay: false });
    expect(mock.description).toBe('Bring a calculator\nand ID card');
    const hol = events.find((e) => e.uid.startsWith('national-day'))!;
    expect(hol).toMatchObject({ allDay: true, start: '2026-12-01T20:00:00.000Z', end: '2026-12-03T20:00:00.000Z' });
    const club = events.find((e) => e.uid.startsWith('club'))!;
    expect(club.end).toBe('2026-10-14T12:30:00.000Z');
    expect(club.rrule).toBe('FREQ=WEEKLY;COUNT=10');
    expect(todos[0]).toMatchObject({ summary: 'Return permission slip', due: '2026-10-19T11:00:00.000Z' });
  });

  it('handles GMT offsets and IANA zones', () => {
    expect(icsDateToIso({ name: 'DTSTART', params: { TZID: 'GMT+05:30' }, value: '20260101T053000' }).iso).toBe('2026-01-01T00:00:00.000Z');
    expect(icsDateToIso({ name: 'DTSTART', params: { TZID: 'Europe/London' }, value: '20260701T120000' }).iso).toBe('2026-07-01T11:00:00.000Z');
    expect(unfold('A:1\r\n 2\r\nB:3')).toEqual(['A:12', 'B:3']);
  });

  it('connector maps to normalized rows, skips cancelled, warns on RRULE', async () => {
    const vault = new InMemoryTokenVault();
    const f = mockFetch([{ match: 'https://school.example/calendar.ics', fixture: 'ics/school.ics' }]);
    const c = new IcsImportConnector({ vault, http: { fetch: f } });
    const g = await c.handleCallback({ kind: 'api_token', token: 'webcal://school.example/calendar.ics' });
    const r = await c.sync({ studentId: STUDENT, tokenRef: g.token_ref });
    expect(r.events.map((e) => e.title)).not.toContain('Cancelled assembly');
    expect(r.events).toHaveLength(3);
    expect(r.events[0]!.source).toBe('ics');
    expect(r.materials[0]).toMatchObject({ title: 'Return permission slip', kind: 'assignment', due_at: '2026-10-19T11:00:00.000Z' });
    expect(r.warnings[0]).toMatch(/RRULE/);
    const fileResult = await c.sync({ studentId: STUDENT, tokenRef: g.token_ref, options: { icsText: fixture('ics/school.ics') } });
    expect(fileResult.events[0]!.external_id.startsWith('file:')).toBe(true);
  });

  it('blocks SSRF-ish URLs', () => {
    for (const bad of ['http://school.example/a.ics', 'https://localhost/a.ics', 'https://10.0.0.5/a.ics', 'https://192.168.1.1/x', 'https://169.254.169.254/latest']) {
      expect(() => assertSafeIcsUrl(bad)).toThrow();
    }
  });
});

describe('ICS export feed (Apple Calendar)', () => {
  it('produces valid CRLF, folded, escaped feed with deadline alarms', () => {
    const out = buildIcsFeed(
      [{ title: 'Study: Physics; ch 3, part 2', start_at: '2026-10-13T12:00:00Z', end_at: '2026-10-13T13:00:00Z', source: 'google_calendar', external_id: 'e1' }],
      [
        { title: 'Lab Report 2', due_at: '2026-10-15T19:59:00Z', status: 'todo', external_id: 'coursework:701' },
        { title: 'Done thing', due_at: '2026-10-15T19:59:00Z', status: 'done' },
      ],
      { calendarName: "Aisha's Murshid plan", now: new Date('2026-10-10T00:00:00Z') },
    );
    expect(out.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(out.endsWith('END:VCALENDAR\r\n')).toBe(true);
    expect(out).toContain('SUMMARY:Study: Physics\\; ch 3\\, part 2');
    expect(out).toContain('DTSTART:20261013T120000Z');
    expect(out).toContain('SUMMARY:Due: Lab Report 2');
    expect(out).toContain('TRIGGER:-PT24H');
    expect(out).not.toContain('Done thing');
    for (const line of out.split('\r\n')) expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    // round-trips through our own parser
    const back = parseIcs(out);
    expect(back.events.map((e) => e.summary)).toEqual(['Study: Physics; ch 3, part 2', 'Due: Lab Report 2']);
    expect(back.events[1]!.end).toBe('2026-10-15T19:59:00.000Z');
  });

  it('folds multibyte text safely', () => {
    const line = 'SUMMARY:' + 'مراجعة الفيزياء '.repeat(10);
    const folded = foldLine(line);
    for (const l of folded.split('\r\n')) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    expect(unfold(folded).join('')).toBe(line);
  });

  it('feed tokens verify and rotate', () => {
    const tok = signFeedToken(STUDENT, 'feed-secret', 1);
    expect(verifyFeedToken(tok, 'feed-secret', 1)).toBe(STUDENT);
    expect(verifyFeedToken(tok, 'feed-secret', 2)).toBeNull();
    expect(verifyFeedToken(tok, 'other', 1)).toBeNull();
    expect(verifyFeedToken(tok.slice(0, -2) + 'xx', 'feed-secret', 1)).toBeNull();
  });
});
