import { describe, expect, it } from 'vitest';
import { SURVEYS, summarizeSurvey, validateSurvey } from '../src/index';

const student = { grade: 'Grade 11', workload: 4, missed: '1', clustering: 'Most weeks', tracking: ['Teams / school portal', 'I just remember'], activities: 'Often', would_use: 5, family_pay: 'Yes, up to AED 30 a month', wish: 'email me at a@b.com' };

describe('survey', () => {
  it('has about eight questions per version, with consent required and no personal fields', () => {
    for (const s of Object.values(SURVEYS)) {
      expect(s.questions.length).toBeGreaterThanOrEqual(8);
      expect(s.questions.length).toBeLessThanOrEqual(9);
      expect(s.questions.some((q) => /name|email|phone/i.test(q.id))).toBe(false);
    }
    expect(validateSurvey({ version: 'student', answers: student })).toMatchObject({ ok: false, error: 'consent is required' });
  });
  it('validates options and strips contact details from free text', () => {
    const r = validateSurvey({ version: 'student', answers: student, consent: true });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.answers.wish).toBe('email me at [email removed]');
    expect(validateSurvey({ version: 'student', answers: { ...student, missed: '12' }, consent: true }).ok).toBe(false);
    expect(validateSurvey({ version: 'student', answers: { ...student, workload: undefined }, consent: true }).ok).toBe(false);
    expect(validateSurvey({ version: 'student', answers: { ...student, grade: undefined }, consent: true }).ok).toBe(true);
  });
  it('summarises counts and scale means', () => {
    const s = summarizeSurvey([
      { version: 'student', answers: { workload: 4, tracking: ['Teams / school portal'] }, created_at: '2026-10-16T08:00:00Z' },
      { version: 'student', answers: { workload: 2, tracking: ['Teams / school portal', 'I just remember'] }, created_at: '2026-10-17T08:00:00Z' },
      { version: 'teacher', answers: { would_use: 5 }, created_at: '2026-10-18T08:00:00Z' },
    ]);
    expect(s.byVersion).toEqual({ student: 2, teacher: 1 });
    const wl = s.versions.student.find((q) => q.id === 'workload')!;
    expect(wl.mean).toBe(3);
    expect(s.versions.student.find((q) => q.id === 'tracking')!.counts[0]).toEqual({ label: 'Teams / school portal', n: 2 });
  });
});
