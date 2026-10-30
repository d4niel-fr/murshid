/**
 * Rule-based matching & ranking. Deterministic and explainable: every point awarded comes with a
 * human-readable reason string. AI-LATER: semantic interest matching (embeddings) can replace
 * `interestOverlap` behind the same signature.
 */
import type { GoalLite, MatchResult, Opportunity, StudentProfile } from '../types.js';
import { freshnessScore } from '../pipeline/lifecycle.js';
import { todayIso } from '../util.js';

export interface RankWeights {
  grade: number;
  interests: number;
  urgency: number;
  cost: number;
  freshness: number;
  local: number;
}

export const DEFAULT_WEIGHTS: RankWeights = { grade: 25, interests: 35, urgency: 15, cost: 10, freshness: 5, local: 10 };

/** Synonyms so free-text interests/goals ("I love building robots") hit our tag vocabulary. */
const SYNONYMS: Record<string, string[]> = {
  ai: ['ai', 'artificial intelligence', 'machine learning', 'ml'],
  robotics: ['robot', 'robotics'],
  coding: ['coding', 'programming', 'software', 'computer science', 'cs', 'informatics', 'apps', 'developer'],
  math: ['math', 'maths', 'mathematics'],
  physics: ['physics'],
  chemistry: ['chemistry'],
  biology: ['biology', 'bio', 'genetics'],
  medicine: ['medicine', 'medical', 'doctor', 'health'],
  space: ['space', 'astronomy', 'astrophysics', 'satellite'],
  engineering: ['engineering', 'engineer'],
  research: ['research', 'science fair'],
  sustainability: ['sustainability', 'climate', 'environment', 'water'],
  entrepreneurship: ['entrepreneurship', 'startup', 'business'],
  finance: ['finance', 'investing', 'economics'],
  writing: ['writing', 'essay', 'literature', 'poetry'],
  debate: ['debate', 'mun', 'model un', 'public speaking'],
  arts: ['art', 'design', 'film', 'music'],
  leadership: ['leadership'],
  community: ['volunteering', 'community', 'social impact'],
  'university-prep': ['university', 'college', 'admissions', 'ivy', 'oxbridge'],
  cybersecurity: ['cybersecurity', 'security', 'hacking'],
  'data-science': ['data science', 'data', 'analytics'],
};

export function studentInterestTags(student: StudentProfile, goals: GoalLite[] = []): Set<string> {
  const text = [...student.interests, ...(student.strengths ?? []), ...goals.filter((g) => g.status !== 'done' && g.status !== 'paused').map((g) => g.title)]
    .join(' | ')
    .toLowerCase();
  const tags = new Set<string>();
  for (const [tag, words] of Object.entries(SYNONYMS)) {
    if (words.some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text))) tags.add(tag);
  }
  for (const i of student.interests) tags.add(i.toLowerCase().trim());
  if (goals.some((g) => g.category === 'university')) tags.add('university-prep');
  return tags;
}

function isUaeNational(n: string | null | undefined): boolean {
  return !!n && /^(uae|ae|are|emirati|united arab emirates)$/i.test(n.trim());
}

/** Returns null if the student meets the restriction, else a warning string. */
function nationalityBlock(restriction: string | null, nationality: string | null | undefined): string | null {
  if (!restriction) return null;
  if (/uae nationals/i.test(restriction)) return isUaeNational(nationality) ? null : `Restricted: ${restriction}`;
  if (/gcc/i.test(restriction))
    return nationality && /^(uae|ae|emirati|saudi|ksa|sa|qatar|qa|kuwait|kw|bahrain|bh|oman|om)$/i.test(nationality) ? null : `Restricted: ${restriction}`;
  if (/us citizens/i.test(restriction)) return nationality && /^(us|usa|american|united states)$/i.test(nationality) ? null : `Restricted: ${restriction}`;
  if (/indian nationals/i.test(restriction)) return nationality && /^(in|ind|india|indian)$/i.test(nationality) ? null : `Restricted: ${restriction}`;
  if (/uk residents/i.test(restriction)) return `Restricted: ${restriction} (check residency)`;
  return `Check eligibility: ${restriction}`;
}

export function scoreOpportunity(
  opp: Opportunity,
  student: StudentProfile,
  goals: GoalLite[] = [],
  now: Date = new Date(),
  w: RankWeights = DEFAULT_WEIGHTS,
): MatchResult {
  const reasons: string[] = [];
  const warnings: string[] = [];
  let eligible = true;
  let score = 0;

  // Status
  if (opp.status === 'closed') {
    eligible = false;
    warnings.push('Applications are closed');
  }

  // Grade fit
  const g = student.grade;
  if (opp.min_grade === null && opp.max_grade === null) {
    // Aggregator posts with no school-age signal are usually aimed at adults.
    score += w.grade * (opp.source_id.startsWith('agg-') ? 0.15 : 0.5);
    warnings.push('Grade eligibility not stated — check the page');
  } else {
    const lo = opp.min_grade ?? 1;
    const hi = opp.max_grade ?? 13;
    if (g >= lo && g <= hi) {
      score += w.grade;
      reasons.push(lo === hi ? `For Grade ${lo} — that's you` : `Open to Grades ${lo}–${hi} (you're in Grade ${g})`);
    } else if (g === lo - 1) {
      score += w.grade * 0.3;
      eligible = false;
      warnings.push(`Starts at Grade ${lo} — you'll be eligible next year`);
    } else {
      eligible = false;
      warnings.push(`For Grades ${lo}–${hi}; you're in Grade ${g}`);
    }
  }

  // Interests / goals overlap
  const mine = studentInterestTags(student, goals);
  const overlap = opp.tags.filter((t) => mine.has(t));
  if (overlap.length) {
    const frac = Math.min(1, overlap.length / 2); // 2+ matching tags = full marks
    score += w.interests * frac;
    reasons.push(`Matches your interests: ${overlap.slice(0, 3).join(', ')}`);
    const goalHit = goals.find((gg) => gg.status !== 'done' && overlap.some((t) => (SYNONYMS[t] ?? [t]).some((s) => gg.title.toLowerCase().includes(s))));
    if (goalHit) reasons.push(`Supports your goal "${goalHit.title}"`);
  }

  // Deadline urgency: closer (but not past) deadlines rank higher; >120 days gets little urgency.
  if (opp.deadline) {
    const days = Math.round((Date.parse(opp.deadline) - Date.parse(todayIso(now))) / 86400e3);
    if (days >= 0) {
      const u = days <= 7 ? 1 : days <= 30 ? 0.8 : days <= 60 ? 0.5 : days <= 120 ? 0.25 : 0.1;
      score += w.urgency * u;
      reasons.push(days === 0 ? 'Deadline is today' : days <= 30 ? `Deadline in ${days} day${days === 1 ? '' : 's'} (${opp.deadline})` : `Deadline ${opp.deadline}`);
      if (days <= 7) warnings.push('Deadline is very close');
    }
  } else {
    score += w.urgency * 0.1;
  }

  // Nationality
  const block = nationalityBlock(opp.nationality_restriction, student.nationality);
  if (block) {
    if (block.startsWith('Restricted')) eligible = false;
    warnings.push(block);
  } else if (opp.nationality_restriction) {
    reasons.push(`You meet the nationality requirement (${opp.nationality_restriction})`);
  }

  // Cost
  if (opp.cost_aed === 0) {
    score += w.cost;
    reasons.push('Free to take part');
  } else if (opp.cost_aed !== null) {
    if (student.budget_aed !== undefined && opp.cost_aed > student.budget_aed) {
      warnings.push(`Costs about AED ${opp.cost_aed.toLocaleString('en-US')} — above your budget of AED ${student.budget_aed.toLocaleString('en-US')}`);
    } else {
      score += w.cost * (opp.cost_aed <= 1000 ? 0.7 : opp.cost_aed <= 10000 ? 0.4 : 0.1);
      reasons.push(`Costs about AED ${opp.cost_aed.toLocaleString('en-US')}`);
    }
  } else {
    score += w.cost * 0.3;
  }

  // Local (same emirate / UAE / online) bonus
  if (opp.emirate && student.emirate && opp.emirate.toLowerCase() === String(student.emirate).toLowerCase()) {
    score += w.local;
    reasons.push(`In ${opp.emirate}, your emirate`);
  } else if (opp.country === 'UAE') {
    score += w.local * 0.7;
    reasons.push('Based in the UAE');
  } else if (opp.country === 'Online' || opp.tags.includes('online')) {
    score += w.local * 0.6;
    reasons.push('Online — join from anywhere');
  }

  // Freshness
  score += w.freshness * freshnessScore(opp, now);

  if (!eligible) score *= 0.25;
  return { opportunity: opp, score: Math.round(Math.max(0, Math.min(100, score))), eligible, reasons, warnings };
}

export interface RankOptions {
  includeIneligible?: boolean;
  limit?: number;
  weights?: RankWeights;
  now?: Date;
}

export function rankOpportunities(opps: Opportunity[], student: StudentProfile, goals: GoalLite[] = [], o: RankOptions = {}): MatchResult[] {
  const now = o.now ?? new Date();
  return opps
    .map((x) => scoreOpportunity(x, student, goals, now, o.weights))
    .filter((r) => o.includeIneligible || r.eligible)
    .sort((a, b) => b.score - a.score || (a.opportunity.deadline ?? '9999').localeCompare(b.opportunity.deadline ?? '9999'))
    .slice(0, o.limit ?? 50);
}
