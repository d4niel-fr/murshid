import { describe, expect, it } from 'vitest';
import { rankOpportunities, scoreOpportunity, studentInterestTags } from '../src/match/rank.js';
import type { GoalLite, StudentProfile } from '../src/types.js';
import { NOW, opp } from './helpers.js';

const aisha: StudentProfile = { id: 's1', grade: 11, emirate: 'Dubai', nationality: 'India', interests: ['robotics', 'machine learning'], budget_aed: 5000 };
const goals: GoalLite[] = [{ title: 'Get into a top engineering university', category: 'university', status: 'active' }];

describe('matching', () => {
  it('maps free-text interests and goals to tags', () => {
    const t = studentInterestTags(aisha, goals);
    expect([...t]).toEqual(expect.arrayContaining(['robotics', 'ai', 'engineering', 'university-prep']));
  });

  it('scores a great fit high with explainable reasons', () => {
    const r = scoreOpportunity(
      opp({ title: 'Dubai Robotics Camp', min_grade: 10, max_grade: 12, tags: ['robotics', 'ai'], emirate: 'Dubai', country: 'UAE', cost_aed: 0, deadline: '2026-05-20', status: 'open' }),
      aisha, goals, NOW,
    );
    expect(r.eligible).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(80);
    expect(r.reasons).toEqual(expect.arrayContaining([
      "Open to Grades 10–12 (you're in Grade 11)",
      'Matches your interests: robotics, ai',
      'Free to take part',
      'In Dubai, your emirate',
    ]));
    expect(r.reasons.some((x) => x.startsWith('Deadline in 19 days'))).toBe(true);
  });

  it('marks wrong grade, nationality restriction and closed as ineligible with warnings', () => {
    const wrongGrade = scoreOpportunity(opp({ min_grade: 5, max_grade: 8 }), aisha, [], NOW);
    expect(wrongGrade.eligible).toBe(false);
    expect(wrongGrade.warnings[0]).toMatch(/Grades 5–8/);

    const emiratiOnly = scoreOpportunity(opp({ nationality_restriction: 'UAE nationals only' }), aisha, [], NOW);
    expect(emiratiOnly.eligible).toBe(false);
    expect(emiratiOnly.warnings).toContain('Restricted: UAE nationals only');
    const forEmirati = scoreOpportunity(opp({ nationality_restriction: 'UAE nationals only' }), { ...aisha, nationality: 'UAE' }, [], NOW);
    expect(forEmirati.eligible).toBe(true);

    const closed = scoreOpportunity(opp({ status: 'closed', deadline: '2026-04-01' }), aisha, [], NOW);
    expect(closed.eligible).toBe(false);
  });

  it('flags over-budget cost and next-year eligibility', () => {
    const pricey = scoreOpportunity(opp({ cost_aed: 20000 }), aisha, [], NOW);
    expect(pricey.warnings.some((w) => w.includes('above your budget'))).toBe(true);
    const nextYear = scoreOpportunity(opp({ min_grade: 12, max_grade: 12 }), aisha, [], NOW);
    expect(nextYear.warnings).toContain("Starts at Grade 12 — you'll be eligible next year");
  });

  it('ranks by score, filters ineligible by default, ties broken by earlier deadline', () => {
    const list = [
      opp({ id: 'far', tags: ['robotics'], deadline: '2026-12-01', status: 'open' }),
      opp({ id: 'soon', tags: ['robotics'], deadline: '2026-05-05', status: 'open' }),
      opp({ id: 'nomatch', tags: ['biology'], status: 'open' }),
      opp({ id: 'young', min_grade: 6, max_grade: 8, tags: ['robotics'] }),
    ];
    const ranked = rankOpportunities(list, aisha, goals, { now: NOW });
    expect(ranked.map((r) => r.opportunity.id)).toEqual(['soon', 'far', 'nomatch']);
    expect(rankOpportunities(list, aisha, goals, { now: NOW, includeIneligible: true })).toHaveLength(4);
  });

  it('aggregator posts without grade info rank below school-targeted ones', () => {
    const a = scoreOpportunity(opp({ min_grade: null, max_grade: null, source_id: 'agg-opportunitydesk' }), aisha, [], NOW);
    const b = scoreOpportunity(opp({ min_grade: null, max_grade: null, source_id: 'uae-ku-outreach' }), aisha, [], NOW);
    expect(a.score).toBeLessThan(b.score);
  });
});
