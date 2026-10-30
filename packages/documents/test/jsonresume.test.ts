import { describe, expect, it } from 'vitest';
import {
  expectedGraduationYear,
  splitTitle,
  toHighlights,
  toJsonResume,
  validateJsonResume,
} from '../src/index.js';
import { achievements, aisha, NOW, rohan, school } from './fixtures.js';

describe('toJsonResume', () => {
  const r = toJsonResume({ student: aisha, achievements, school, contact: { email: 'aisha.test@example.com' }, target: 'university', now: NOW });

  it('produces a schema-valid resume', () => {
    expect(validateJsonResume(r)).toEqual([]);
    expect(r.$schema).toContain('jsonresume');
    expect(r.basics.name).toBe('Aisha Test');
    expect(r.basics.location).toEqual({ city: 'Dubai', countryCode: 'AE' });
  });

  it('maps every achievement category to the right section', () => {
    expect(r.work?.[0]).toMatchObject({ name: 'Test Health Labs', position: 'Summer Intern', startDate: '2026-07-01' });
    expect(r.work?.[0]?.highlights?.length).toBe(3);
    expect(r.volunteer?.[0]).toMatchObject({ organization: 'Test Community Centre', position: 'Volunteer Tutor' });
    expect(r.awards?.map((x) => x.title)).toEqual(['Top in Year', 'Gold Medal']);
    expect(r.awards?.[1]?.awarder).toBe('UAE Science Olympiad');
    expect(r.certificates?.[0]).toMatchObject({ name: 'Google Data Analytics Certificate', issuer: 'Coursera' });
    expect(r.projects?.map((p) => p.type).sort()).toEqual(['leadership', 'project', 'sport']);
  });

  it('builds education with expected graduation year (British → Year 13)', () => {
    expect(r.education?.[0]).toMatchObject({ institution: 'Test Academy Dubai', endDate: '2028', studyType: 'High School' });
  });

  it('omits DOB and nationality by default (minor-safe)', () => {
    const s = JSON.stringify(r);
    expect(s).not.toContain('2009-05-02');
    expect(s).not.toContain('Emirati');
    const withPersonal = toJsonResume({ student: aisha, achievements, includePersonalDetails: true, now: NOW });
    expect(JSON.stringify(withPersonal)).toContain('Emirati');
  });

  it('has no undefined keys and handles sparse students', () => {
    const sparse = toJsonResume({ student: rohan, achievements: [], now: NOW });
    expect(validateJsonResume(sparse)).toEqual([]);
    expect(sparse.work).toBeUndefined();
    expect(sparse.basics.summary).toContain('Grade 11 student');
    expect(sparse.education?.[0]?.endDate).toBe('2028');
  });

  it('flags invalid resumes', () => {
    expect(validateJsonResume({ basics: { name: '' }, awards: [{ title: 'x', date: '14/03/2026' }] })).toHaveLength(2);
  });
});

describe('helpers', () => {
  it('splitTitle', () => {
    expect(splitTitle('Intern at ACME')).toEqual({ role: 'Intern', org: 'ACME' });
    expect(splitTitle('Captain — Team')).toEqual({ role: 'Captain', org: 'Team' });
    expect(splitTitle('Solo')).toEqual({ role: 'Solo' });
  });
  it('toHighlights splits sentences and bullets', () => {
    expect(toHighlights('Did A. Did B.\n• Did C')).toEqual(['Did A.', 'Did B.', 'Did C']);
  });
  it('graduation year rolls over in August', () => {
    expect(expectedGraduationYear(12, 'ib', new Date('2026-06-01Z'))).toBe(2026);
    expect(expectedGraduationYear(12, 'ib', new Date('2026-09-01Z'))).toBe(2027);
  });
});
