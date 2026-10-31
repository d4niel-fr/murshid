import { describe, expect, it } from 'vitest';
import {
  bandForCurriculum,
  bandForGrade,
  classLabel,
  curriculumMapping,
  gradeFromCurriculum,
  isSupportedGrade,
} from '../src/index.js';

describe('bandForGrade', () => {
  it.each([
    [5, 'g5-6'], [6, 'g5-6'], [7, 'g7-8'], [8, 'g7-8'],
    [9, 'g9-10'], [10, 'g9-10'], [11, 'g11-12'], [12, 'g11-12'],
  ] as const)('grade %i → %s', (g, band) => expect(bandForGrade(g)).toBe(band));

  it('clamps out-of-range grades', () => {
    expect(bandForGrade(3)).toBe('g5-6');
    expect(bandForGrade(13)).toBe('g11-12');
  });

  it('throws on non-integers', () => {
    expect(() => bandForGrade(5.5)).toThrow(RangeError);
    expect(() => bandForGrade(Number.NaN)).toThrow(RangeError);
  });

  it('isSupportedGrade', () => {
    expect(isSupportedGrade(5)).toBe(true);
    expect(isSupportedGrade(12)).toBe(true);
    expect(isSupportedGrade(4)).toBe(false);
    expect(isSupportedGrade(13)).toBe(false);
  });
});

describe('curriculumMapping', () => {
  it('Grade 5 = Year 6 (KS2) = PYP 5 = Class V', () => {
    const m = curriculumMapping(5);
    expect(m.british).toMatchObject({ year: 6, label: 'Year 6', keyStage: 'KS2' });
    expect(m.ib).toMatchObject({ programme: 'PYP', label: 'PYP 5' });
    expect(m.cbse.label).toBe('Class V');
    expect(m.american.school).toBe('Elementary');
    expect(m.moe.cycle).toBe(2);
    expect(m.typicalAge).toEqual([10, 11]);
  });

  it('Grade 6..10 map to MYP 1..5 and KS3/KS4', () => {
    expect(curriculumMapping(6).ib.label).toBe('MYP 1');
    expect(curriculumMapping(8).british.keyStage).toBe('KS3');
    expect(curriculumMapping(10).ib.label).toBe('MYP 5');
    expect(curriculumMapping(10).british).toMatchObject({ year: 11, keyStage: 'KS4' });
    expect(curriculumMapping(10).cbse.milestone).toMatch(/board/i);
  });

  it('Grade 11–12 = Year 12–13 (KS5) = DP1–2 = Class XI–XII; American Junior/Senior; MoE cycle 3', () => {
    expect(curriculumMapping(11).british.label).toBe('Year 12');
    expect(curriculumMapping(12).british).toMatchObject({ year: 13, keyStage: 'KS5' });
    expect(curriculumMapping(11).ib.label).toBe('DP1');
    expect(curriculumMapping(12).ib.label).toBe('DP2');
    expect(curriculumMapping(12).cbse.label).toBe('Class XII');
    expect(curriculumMapping(11).american.label).toContain('Junior');
    expect(curriculumMapping(12).american.label).toContain('Senior');
    expect(curriculumMapping(9).moe.cycle).toBe(3);
  });

  it('American middle school is grades 6–8', () => {
    expect(curriculumMapping(6).american.school).toBe('Middle');
    expect(curriculumMapping(8).american.school).toBe('Middle');
    expect(curriculumMapping(9).american.school).toBe('High');
  });

  it('rejects unsupported grades', () => {
    expect(() => curriculumMapping(4)).toThrow();
  });
});

describe('gradeFromCurriculum / bandForCurriculum / classLabel', () => {
  it('British Year N → grade N-1', () => {
    expect(gradeFromCurriculum('british', 6)).toBe(5);
    expect(gradeFromCurriculum('british', 'Year 13')).toBe(12);
    expect(bandForCurriculum('british', 'Year 9')).toBe('g7-8');
  });

  it('IB labels', () => {
    expect(gradeFromCurriculum('ib', 'PYP5')).toBe(5);
    expect(gradeFromCurriculum('ib', 'MYP 1')).toBe(6);
    expect(gradeFromCurriculum('ib', 'myp5')).toBe(10);
    expect(gradeFromCurriculum('ib', 'DP2')).toBe(12);
    expect(bandForCurriculum('ib', 'MYP4')).toBe('g9-10');
    expect(() => gradeFromCurriculum('ib', 'Year 7')).toThrow();
  });

  it('CBSE / American / MoE are identity', () => {
    expect(gradeFromCurriculum('cbse', 'Class 10')).toBe(10);
    expect(gradeFromCurriculum('american', 7)).toBe(7);
    expect(gradeFromCurriculum('moe', '12')).toBe(12);
  });

  it('rejects levels outside Grade 5–12', () => {
    expect(() => gradeFromCurriculum('british', 'Year 5')).toThrow();
    expect(() => gradeFromCurriculum('cbse', 4)).toThrow();
  });

  it('round-trips every grade through every curriculum label', () => {
    for (let g = 5; g <= 12; g++) {
      for (const c of ['british', 'ib', 'cbse', 'american', 'moe'] as const) {
        const label = classLabel(c, g);
        const level = c === 'cbse' ? g : label.replace(/\s*\(.*\)$/, '');
        expect(gradeFromCurriculum(c, level)).toBe(g);
      }
    }
  });
});
