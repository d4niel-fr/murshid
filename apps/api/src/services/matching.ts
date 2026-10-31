/**
 * Rule-based opportunity match score (0-100). AI-LATER: semantic matching on eligibility_text
 * and the student's achievements can replace/augment the keyword overlap below.
 *
 * Hard eligibility (score forced to 0, eligible=false):
 *   status 'closed', deadline passed, grade outside [min_grade, max_grade], nationality restriction not met.
 * Points:
 *   interests/strengths ↔ tags/title overlap ... up to 45 (15 per matched term, max 3)
 *   grade fit ................................... 15 inside explicit range, 10 if no range given
 *   goal alignment (goal category ↔ type) ....... 15
 *   deadline ..................................... 10 (4–30 days), 8 (31–90), 5 (>90 or none), 4 (≤3 days)
 *   location ..................................... 10 same emirate, 6 elsewhere in UAE, 2 abroad
 *   cost ......................................... 5 free, 3 ≤ 500 AED, 0 otherwise
 */
import type { Goal, Opportunity, Student } from '../domain';
import { daysBetween } from '../lib/time';

export interface MatchResult {
  score: number;
  eligible: boolean;
  reasons: string[];
  ineligible_reasons: string[];
  matched_terms: string[];
}

const GOAL_TYPE_AFFINITY: Record<Goal['category'], Opportunity['type'][]> = {
  academic: ['olympiad', 'competition', 'course'],
  university: ['scholarship', 'summer_program', 'competition', 'olympiad'],
  career: ['internship', 'course', 'hackathon'],
  sport: ['competition'],
  skill: ['course', 'hackathon', 'competition', 'mun'],
  personal: ['volunteering', 'mun'],
};

const norm = (s: string) => s.toLowerCase().trim();

export function scoreOpportunity(
  student: Pick<Student, 'grade' | 'interests' | 'strengths' | 'emirate' | 'nationality'>,
  opp: Opportunity,
  ctx: { now: Date; goalCategories?: Goal['category'][] },
): MatchResult {
  const reasons: string[] = [];
  const ineligible: string[] = [];

  if (opp.status === 'closed') ineligible.push('opportunity is closed');
  const daysLeft = opp.deadline ? daysBetween(ctx.now, new Date(opp.deadline)) : null;
  if (daysLeft !== null && daysLeft < 0) ineligible.push('deadline has passed');
  if (opp.min_grade !== null && student.grade < opp.min_grade) ineligible.push(`requires grade ${opp.min_grade}+`);
  if (opp.max_grade !== null && student.grade > opp.max_grade) ineligible.push(`only up to grade ${opp.max_grade}`);
  if (opp.nationality_restriction && opp.nationality_restriction.length > 0) {
    const allowed = opp.nationality_restriction.map(norm);
    if (!student.nationality || !allowed.includes(norm(student.nationality))) {
      ineligible.push(`restricted to nationality: ${opp.nationality_restriction.join(', ')}`);
    }
  }

  // interest overlap
  const terms = [...new Set([...student.interests, ...student.strengths].map(norm).filter(Boolean))];
  const tags = opp.tags.map(norm);
  const title = norm(opp.title);
  // substring matches only for terms of 4+ chars, to avoid e.g. "ai" matching "maths"
  const loose = (a: string, b: string) => a.length >= 4 && b.includes(a);
  const matched = terms.filter(
    (t) => tags.some((tag) => tag === t || loose(t, tag) || loose(tag, t)) || loose(t, title),
  );
  let score = Math.min(matched.length, 3) * 15;
  if (matched.length) reasons.push(`matches your interests: ${matched.join(', ')}`);

  // grade
  if (opp.min_grade !== null || opp.max_grade !== null) {
    score += 15;
    if (!ineligible.some((r) => r.includes('grade'))) reasons.push(`open to grade ${student.grade}`);
  } else score += 10;

  // goals
  const goalCats = ctx.goalCategories ?? [];
  const alignedGoal = goalCats.find((g) => GOAL_TYPE_AFFINITY[g].includes(opp.type));
  if (alignedGoal) {
    score += 15;
    reasons.push(`supports your ${alignedGoal} goal`);
  }

  // deadline
  if (daysLeft === null) score += 5;
  else if (daysLeft >= 0) {
    const d = Math.ceil(daysLeft);
    if (d <= 3) { score += 4; reasons.push(`deadline in ${d} day${d === 1 ? '' : 's'} — act now`); }
    else if (d <= 30) { score += 10; reasons.push(`deadline in ${d} days`); }
    else if (d <= 90) score += 8;
    else score += 5;
  }

  // location
  const country = opp.country ? opp.country.toUpperCase() : null;
  if (opp.emirate && student.emirate && norm(opp.emirate) === norm(student.emirate)) {
    score += 10;
    reasons.push(`in ${opp.emirate}`);
  } else if (!country || country === 'AE' || country === 'UAE' || opp.emirate) score += 6;
  else score += 2;

  // cost
  if (opp.cost_aed === null || opp.cost_aed === 0) { score += 5; reasons.push('free'); }
  else if (opp.cost_aed <= 500) score += 3;

  const eligible = ineligible.length === 0;
  return {
    score: eligible ? Math.min(100, Math.round(score)) : 0,
    eligible,
    reasons,
    ineligible_reasons: ineligible,
    matched_terms: matched,
  };
}
