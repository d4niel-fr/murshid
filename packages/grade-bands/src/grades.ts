import type { BandId, CurriculumId } from './types.js';

export const MIN_GRADE = 5;
export const MAX_GRADE = 12;

/**
 * Map a UAE/US-style grade number (5..12) to a band.
 * Out-of-range grades clamp (Grade 4 → g5-6, Year 13 passed as 13 → g11-12) so the UI never crashes;
 * non-integers or non-finite values throw.
 */
export function bandForGrade(grade: number): BandId {
  if (!Number.isFinite(grade) || !Number.isInteger(grade)) {
    throw new RangeError(`bandForGrade: grade must be an integer, got ${grade}`);
  }
  const g = Math.min(MAX_GRADE, Math.max(MIN_GRADE, grade));
  if (g <= 6) return 'g5-6';
  if (g <= 8) return 'g7-8';
  if (g <= 10) return 'g9-10';
  return 'g11-12';
}

export function isSupportedGrade(grade: number): boolean {
  return Number.isInteger(grade) && grade >= MIN_GRADE && grade <= MAX_GRADE;
}

export interface CurriculumMapping {
  /** UAE / American grade number, the canonical key Murshid stores. */
  grade: number;
  typicalAge: [number, number];
  british: { year: number; label: string; keyStage: 'KS2' | 'KS3' | 'KS4' | 'KS5'; milestone?: string };
  ib: { programme: 'PYP' | 'MYP' | 'DP'; year: number; label: string; milestone?: string };
  cbse: { class: number; label: string; milestone?: string };
  american: { grade: number; label: string; school: 'Elementary' | 'Middle' | 'High'; milestone?: string };
  moe: { grade: number; cycle: 2 | 3; label: string };
}

const KS = (year: number): CurriculumMapping['british']['keyStage'] =>
  year <= 6 ? 'KS2' : year <= 9 ? 'KS3' : year <= 11 ? 'KS4' : 'KS5';

const BRITISH_MILESTONE: Record<number, string> = {
  6: 'KS2 SATs (UK) / end of primary',
  9: 'GCSE options chosen',
  10: 'GCSE / IGCSE year 1',
  11: 'GCSE / IGCSE exams',
  12: 'AS / A-level year 1',
  13: 'A-level exams + UCAS',
};
const AMERICAN_LABEL: Record<number, string> = { 9: 'Freshman', 10: 'Sophomore', 11: 'Junior', 12: 'Senior' };
const AMERICAN_MILESTONE: Record<number, string> = {
  10: 'PSAT', 11: 'SAT/ACT + AP', 12: 'College applications',
};
const CBSE_MILESTONE: Record<number, string> = {
  9: 'Stream thinking begins', 10: 'CBSE Class X board exam', 11: 'Stream (Science/Commerce/Humanities)', 12: 'CBSE Class XII board exam + JEE/NEET/CUET',
};

/** Typical UAE mapping. Schools differ slightly (some American schools start Middle at Grade 5). */
export function curriculumMapping(grade: number): CurriculumMapping {
  if (!isSupportedGrade(grade)) throw new RangeError(`curriculumMapping: unsupported grade ${grade}`);
  const year = grade + 1;
  const ib: CurriculumMapping['ib'] =
    grade <= 5
      ? { programme: 'PYP', year: grade, label: `PYP ${grade}`, milestone: 'PYP Exhibition' }
      : grade <= 10
        ? {
            programme: 'MYP',
            year: grade - 5,
            label: `MYP ${grade - 5}`,
            ...(grade === 10 ? { milestone: 'MYP Personal Project + eAssessment' } : {}),
          }
        : {
            programme: 'DP',
            year: grade - 10,
            label: `DP${grade - 10}`,
            milestone: grade === 11 ? 'IA / EE / CAS begin' : 'DP exams (May) + applications',
          };
  const roman = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][grade]!;
  return {
    grade,
    typicalAge: [grade + 5, grade + 6],
    british: {
      year,
      label: `Year ${year}`,
      keyStage: KS(year),
      ...(BRITISH_MILESTONE[year] ? { milestone: BRITISH_MILESTONE[year] } : {}),
    },
    ib,
    cbse: { class: grade, label: `Class ${roman}`, ...(CBSE_MILESTONE[grade] ? { milestone: CBSE_MILESTONE[grade] } : {}) },
    american: {
      grade,
      label: AMERICAN_LABEL[grade] ? `Grade ${grade} (${AMERICAN_LABEL[grade]})` : `Grade ${grade}`,
      school: grade <= 5 ? 'Elementary' : grade <= 8 ? 'Middle' : 'High',
      ...(AMERICAN_MILESTONE[grade] ? { milestone: AMERICAN_MILESTONE[grade] } : {}),
    },
    moe: { grade, cycle: grade <= 8 ? 2 : 3, label: `Grade ${grade}` },
  };
}

/**
 * Convert a curriculum-native level to the canonical grade.
 *  british: Year N → grade N-1 · ib: 'PYP5' | 'MYP1'..'MYP5' | 'DP1' | 'DP2' · cbse/american/moe: same number.
 */
export function gradeFromCurriculum(curriculum: CurriculumId, level: number | string): number {
  let grade: number;
  if (curriculum === 'ib') {
    const m = /^(PYP|MYP|DP)\s*(\d)$/i.exec(String(level).trim());
    if (!m) throw new RangeError(`gradeFromCurriculum: bad IB level ${level}`);
    const n = Number(m[2]);
    const prog = m[1]!.toUpperCase();
    grade = prog === 'PYP' ? n : prog === 'MYP' ? n + 5 : n + 10;
  } else {
    const n = typeof level === 'number' ? level : Number(String(level).replace(/[^\d]/g, ''));
    if (!Number.isFinite(n)) throw new RangeError(`gradeFromCurriculum: bad level ${level}`);
    grade = curriculum === 'british' ? n - 1 : n;
  }
  if (!isSupportedGrade(grade)) throw new RangeError(`gradeFromCurriculum: ${curriculum} ${level} → grade ${grade} is outside 5..12`);
  return grade;
}

export function bandForCurriculum(curriculum: CurriculumId, level: number | string): BandId {
  return bandForGrade(gradeFromCurriculum(curriculum, level));
}

/** Human label in the student's own curriculum, e.g. classLabel('british', 7) → "Year 8". */
export function classLabel(curriculum: CurriculumId, grade: number): string {
  const m = curriculumMapping(grade);
  switch (curriculum) {
    case 'british': return m.british.label;
    case 'ib': return m.ib.label;
    case 'cbse': return m.cbse.label;
    case 'american': return m.american.label;
    case 'moe': return m.moe.label;
  }
}
