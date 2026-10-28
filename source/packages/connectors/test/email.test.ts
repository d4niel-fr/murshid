import { describe, expect, it } from 'vitest';
import { parseLmsEmail } from '../src/providers/email/inbox';
import { parseDateExpression } from '../src/providers/email/dates';
import { decodeEncodedWords, decodeQuotedPrintable } from '../src/providers/email/mime';
import { fixture, STUDENT } from './helpers/mockFetch';

const parse = (f: string) => parseLmsEmail(fixture(`email/${f}`), { studentId: STUDENT });

describe('email-forward inbox parser', () => {
  it('Google Classroom (QP, encoded-word subject, year inferred)', () => {
    const r = parse('google-classroom.eml')!;
    expect(r.lms).toBe('google_classroom');
    expect(r.courseName).toBe('Grade 11 Physics');
    expect(r.material).toMatchObject({ title: 'Lab Report 2: Projectile Motion', kind: 'assignment', due_at: '2026-10-15T19:59:00.000Z', source: 'email_forward' });
    expect(r.material.file_url).toBe('https://classroom.google.com/c/NjAx/a/NzAx/details');
    expect(r.task?.title).toBe('Lab Report 2: Projectile Motion');
  });

  it('Teams (base64 HTML only)', () => {
    const r = parse('teams.eml')!;
    expect(r.lms).toBe('teams');
    expect(r.courseName).toBe('Grade 11 Chemistry');
    expect(r.material).toMatchObject({ title: 'Titration practical write-up', due_at: '2026-10-16T19:59:00.000Z' });
    expect(r.material.file_url).toContain('teams.microsoft.com');
  });

  it('ManageBac manually forwarded by the student', () => {
    const r = parse('managebac-forwarded.eml')!;
    expect(r.lms).toBe('managebac');
    expect(r.courseName).toBe('Mathematics: Analysis & Approaches HL');
    expect(r.material).toMatchObject({ title: 'Math IA First Draft', kind: 'assignment', due_at: '2026-10-20T04:00:00.000Z' });
  });

  it('ManageBac summative -> exam -> revision task', () => {
    const r = parse('managebac-exam.eml')!;
    expect(r.material).toMatchObject({ kind: 'exam', due_at: '2026-11-02T05:00:00.000Z' });
    expect(r.task).toMatchObject({ kind: 'study', title: 'Revise: Paper 1 Mock' });
  });

  it('GEMS Phoenix (day-first date, no time => 23:59 Dubai)', () => {
    const r = parse('phoenix.eml')!;
    expect(r.lms).toBe('phoenix');
    expect(r.courseName).toBe('Chemistry');
    expect(r.material).toMatchObject({ title: 'Chemistry worksheet 4', due_at: '2026-10-18T19:59:00.000Z' });
  });

  it('ignores non-LMS mail', () => {
    expect(parse('newsletter.eml')).toBeNull();
  });

  it('stable external ids (idempotent re-ingest)', () => {
    expect(parse('teams.eml')!.material.external_id).toBe(parse('teams.eml')!.material.external_id);
  });
});

describe('date expressions', () => {
  const reference = new Date('2026-10-10T05:00:00Z');
  const cases: [string, string | null][] = [
    ['Oct 15, 2026, 11:59 PM', '2026-10-15T19:59:00.000Z'],
    ['October 16, 2026 11:59 PM', '2026-10-16T19:59:00.000Z'],
    ['20 Oct 2026 at 8:00 AM', '2026-10-20T04:00:00.000Z'],
    ['16/10/2026', '2026-10-16T19:59:00.000Z'],
    ['16/10/2026 14:30', '2026-10-16T10:30:00.000Z'],
    ['2026-10-16', '2026-10-16T19:59:00.000Z'],
    ['tomorrow 8am', '2026-10-11T04:00:00.000Z'],
    ['Jan 5', '2027-01-05T19:59:00.000Z'],
    ['12 pm Sept 3, 2026', '2026-09-03T19:59:00.000Z'],
    ['no date here', null],
  ];
  it.each(cases)('%s', (input, expected) => {
    expect(parseDateExpression(input, { reference })).toBe(expected);
  });
});

describe('mime primitives', () => {
  it('decodes encoded words and QP', () => {
    expect(decodeEncodedWords('=?UTF-8?B?2YXYsdin2KzYudip?= test')).toBe('مراجعة test');
    expect(decodeQuotedPrintable('caf=C3=A9 =\nok').toString('utf8')).toBe('café ok');
  });
});
