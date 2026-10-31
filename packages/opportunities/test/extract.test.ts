import { describe, expect, it } from 'vitest';
import { findDates, findDeadline, findEventDate } from '../src/extract/dates.js';
import { extractCost, extractGradeRange, extractNationality, inferEmirate, inferTags, inferType } from '../src/extract/heuristics.js';
import { NOW } from './helpers.js';

describe('dates', () => {
  it.each([
    ['Deadline: 2026-06-19', '2026-06-19'],
    ['Apply by June 19, 2026', '2026-06-19'],
    ['Applications close 19 June 2026', '2026-06-19'],
    ['Application Deadline: [20th of June, 2026]', '2026-06-20'],
    ['deadline 19/06/2026', '2026-06-19'],
    ['deadline 19.06.2026', '2026-06-19'],
    ['Register by Dec 20th, 2026', '2026-12-20'],
    ['Submissions due Sept 3 2026', '2026-09-03'],
    ['Last date: 5 July', '2026-07-05'], // year inferred (next occurrence after NOW)
    ['Deadline: March 3', '2027-03-03'], // already passed this year → next year
  ])('%s → %s', (text, iso) => {
    expect(findDeadline(text, NOW)).toBe(iso);
  });

  it('ignores dates that are not anchored to a deadline keyword', () => {
    expect(findDeadline('The camp runs July 6-10, 2026 on campus.', NOW)).toBeNull();
  });

  it('prefers the earliest upcoming deadline among several', () => {
    const t = 'Early round deadline: 1 March 2026. Final deadline: 30 June 2026. Late deadline: 30 July 2026.';
    expect(findDeadline(t, NOW)).toBe('2026-06-30');
  });

  it('returns latest past deadline when everything has passed (signals closed)', () => {
    expect(findDeadline('Deadline: 1 Jan 2026. Extended deadline: 1 Feb 2026', NOW)).toBe('2026-02-01');
  });

  it('parses date ranges to the first day and event dates', () => {
    expect(findDates('July 6-10, 2026', NOW)[0]?.iso).toBe('2026-07-06');
    expect(findDates('8-10 June 2026', NOW)[0]?.iso).toBe('2026-06-08');
    expect(findEventDate('Date: December 15-16, 2026 Time: 10am', NOW)).toBe('2026-12-15');
  });

  it('uses the page year for yearless dates (no false "next year" reopenings)', () => {
    expect(findEventDate('Date: June 28 and July 5, 2026', NOW)).toBe('2026-06-28');
    const page = 'Registration deadline: 31 March, 2026. Submission deadline: 31 May. Results: 30 June, 2026.';
    expect(findDeadline(page, NOW)).toBe('2026-05-31');
  });

  it('does not treat age rules ("born before 1 July") as deadlines', () => {
    expect(findDeadline('Contestants must have been born less than twenty years before 1 July in the year of participation.', NOW)).toBeNull();
  });

  it('rejects impossible dates', () => {
    expect(findDates('31/02/2026 and 2026-13-01', NOW)).toHaveLength(0);
  });
});

describe('grade / age eligibility', () => {
  it.each([
    ['High school students (Grades 10–12)', 10, 12],
    ['students from Grade 5 to Grade 12', 5, 12],
    ['open to grades 9 through 12', 9, 12],
    ['for 11th-12th grade students', 11, 12],
    ['Year 10 - Year 13 students', 9, 12],
    ['Open to grades 10-12 or years 11-13', 10, 12],
    ['students aged 13–17', 8, 12],
    ['for 14-18 year olds', 9, 13],
    ['open to rising seniors', 11, 12],
    ['for high school students worldwide', 9, 12],
  ])('%s → %i-%i', (text, lo, hi) => {
    const r = extractGradeRange(text);
    expect([r.min, r.max]).toEqual([lo, hi]);
  });

  it('prefers ages over UK-year counters like "Year 1 Year 2"', () => {
    expect(extractGradeRange('students aged 13–17 ... Impact Snapshot Year 1 Year 2 Year 3')).toMatchObject({ min: 8, max: 12 });
  });

  it('returns nulls when no signal', () => {
    expect(extractGradeRange('A prize for innovators.')).toEqual({ min: null, max: null, evidence: null });
  });
});

describe('cost', () => {
  it('detects free', () => {
    expect(extractCost('Registration is free on a competitive basis.').cost_aed).toBe(0);
    expect(extractCost('This program is fully funded.').cost_aed).toBe(0);
  });
  it('prefers tuition over application fee and converts currency', () => {
    expect(extractCost('Application Fee : AED 184 (non-refundable) Tuition : AED 6,000').cost_aed).toBe(6000);
    expect(extractCost('Tuition: USD 1,200 per student').cost_aed).toBe(4407);
    expect(extractCost('Program fee £500').cost_aed).toBe(2300);
  });
  it('ignores prize money', () => {
    expect(extractCost('Win a prize of $10,000 and travel').cost_aed).toBeNull();
  });
});

describe('nationality, type, tags, emirate', () => {
  it('nationality restrictions', () => {
    expect(extractNationality('Applicants must hold an Emirati passport')).toBe('UAE nationals only');
    expect(extractNationality('Both UAE national and non-UAE national students are eligible')).toBeNull();
    expect(extractNationality('Must be a US citizen or permanent resident')).toBe('US citizens/residents only');
    expect(extractNationality('Open to everyone')).toBeNull();
  });
  it('type inference', () => {
    expect(inferType('UAE Informatics Olympiad Qualifier')).toBe('olympiad');
    expect(inferType('Dubai Model United Nations 2026')).toBe('mun');
    expect(inferType('Global AI Hackathon')).toBe('hackathon');
    expect(inferType('Chemical Engineering Boot Camp')).toBe('summer_program');
    expect(inferType('Merit scholarship for Grade 11')).toBe('scholarship');
  });
  it('tags and emirate', () => {
    expect(inferTags('Build robots with Python and AI, online')).toEqual(expect.arrayContaining(['robotics', 'coding', 'ai', 'online']));
    expect(inferEmirate('Held at Saadiyat Island, Abu Dhabi')).toBe('Abu Dhabi');
    expect(inferEmirate('American University of Sharjah, Sharjah')).toBe('Sharjah');
    expect(inferEmirate('Online event')).toBeNull();
  });
});
