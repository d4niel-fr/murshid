import { describe, expect, it } from 'vitest';
import type { Opportunity } from '../src/domain';
import { scoreOpportunity } from '../src/services/matching';
import { NOW, setup } from './helpers';

const student = { grade: 11, interests: ['robotics', 'physics'], strengths: ['maths'], emirate: 'Dubai', nationality: 'IN' };
const opp = (p: Partial<Opportunity>): Opportunity => ({
  id: 'o', title: 'Thing', organizer: 'Org', type: 'competition', url: null, emirate: null, country: 'AE', min_grade: null,
  max_grade: null, eligibility_text: null, nationality_restriction: null, cost_aed: 0, deadline: null, tags: [],
  source_id: null, last_seen_at: null, status: 'open', ...p,
});
const inDays = (d: number) => new Date(NOW.getTime() + d * 86400_000).toISOString();

describe('opportunity matching (unit)', () => {
  it('scores a strong match highly with reasons', () => {
    const m = scoreOpportunity(student, opp({ tags: ['robotics', 'physics', 'maths'], emirate: 'Dubai', min_grade: 9, max_grade: 12, deadline: inDays(20) }), { now: NOW, goalCategories: ['university'] });
    // 45 interests + 15 grade + 15 goal + 10 deadline + 10 emirate + 5 free
    expect(m).toMatchObject({ score: 100, eligible: true });
    expect(m.matched_terms).toEqual(['robotics', 'physics', 'maths']);
    expect(m.reasons).toContain('in Dubai');
  });

  it('ranks interest overlap above no overlap', () => {
    const a = scoreOpportunity(student, opp({ tags: ['robotics'] }), { now: NOW });
    const b = scoreOpportunity(student, opp({ tags: ['fashion'] }), { now: NOW });
    expect(a.score).toBeGreaterThan(b.score);
    expect(a.score - b.score).toBe(15);
  });

  it('applies hard eligibility rules', () => {
    expect(scoreOpportunity(student, opp({ min_grade: 12 }), { now: NOW })).toMatchObject({ eligible: false, score: 0 });
    expect(scoreOpportunity(student, opp({ max_grade: 10 }), { now: NOW }).ineligible_reasons).toEqual(['only up to grade 10']);
    expect(scoreOpportunity(student, opp({ nationality_restriction: ['AE'] }), { now: NOW }).eligible).toBe(false);
    expect(scoreOpportunity({ ...student, nationality: 'AE' }, opp({ nationality_restriction: ['ae'] }), { now: NOW }).eligible).toBe(true);
    expect(scoreOpportunity(student, opp({ deadline: inDays(-1) }), { now: NOW }).ineligible_reasons).toContain('deadline has passed');
    expect(scoreOpportunity(student, opp({ status: 'closed' }), { now: NOW }).eligible).toBe(false);
  });

  it('weights deadline, location and cost', () => {
    const base = { tags: [] as string[] };
    const s = (p: Partial<Opportunity>) => scoreOpportunity(student, opp({ ...base, ...p }), { now: NOW }).score;
    expect(s({ deadline: inDays(10) })).toBeGreaterThan(s({ deadline: inDays(2) }));
    expect(s({ emirate: 'Dubai' })).toBeGreaterThan(s({ country: 'GB' }));
    expect(s({ cost_aed: 0 })).toBeGreaterThan(s({ cost_aed: 5000 }));
  });

  it('does not match short tags inside longer words', () => {
    const m = scoreOpportunity({ ...student, interests: ['ai'], strengths: [] }, opp({ tags: ['maths'], title: 'Training camp' }), { now: NOW });
    expect(m.matched_terms).toEqual([]);
  });
});

describe('GET /opportunities', () => {
  it('returns matches sorted by score and hides closed by default', async () => {
    const { aisha } = await setup();
    const r = await aisha('GET', '/opportunities');
    expect(r.status).toBe(200);
    const items = r.body.items;
    expect(items[0].title).toBe('UAE Robotics Challenge (Test)');
    expect(items.every((o: any) => o.status !== 'closed')).toBe(true);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].match.score).toBeGreaterThanOrEqual(items[i].match.score);
    const withClosed = await aisha('GET', '/opportunities?include_closed=true');
    expect(withClosed.body.total).toBe(items.length + 1);
  });

  it('filters by grade, type, deadline, tag and text', async () => {
    const { aisha } = await setup();
    const g12 = (await aisha('GET', '/opportunities?grade=12')).body.items.map((o: any) => o.title);
    expect(g12).toContain('Emirati Excellence Scholarship (Test)');
    const g9 = (await aisha('GET', '/opportunities?grade=9')).body.items.map((o: any) => o.title);
    expect(g9).not.toContain('Youth Physics Olympiad (Test)');
    const types = (await aisha('GET', '/opportunities?type=olympiad,mun')).body.items.map((o: any) => o.type);
    expect(new Set(types)).toEqual(new Set(['olympiad', 'mun']));
    const soon = (await aisha('GET', `/opportunities?deadline_before=${encodeURIComponent(inDays(12))}&sort=deadline`)).body.items;
    expect(soon.map((o: any) => o.title)).toEqual(['Community Food Drive Volunteers (Test)', 'Youth Physics Olympiad (Test)']);
    expect((await aisha('GET', '/opportunities?tag=debate')).body.items).toHaveLength(1);
    expect((await aisha('GET', '/opportunities?q=fintech')).body.items).toHaveLength(1);
    expect((await aisha('GET', '/opportunities?type=party')).status).toBe(400);
  });

  it('eligible_only uses the student profile (nationality/grade)', async () => {
    const { rohan } = await setup();
    const items = (await rohan('GET', '/opportunities?eligible_only=true')).body.items;
    expect(items.map((o: any) => o.title)).not.toContain('Emirati Excellence Scholarship (Test)');
    expect(items[0].title).toBe('Fintech Internship (Test)');
  });

  it('gets one with match; only admins create', async () => {
    const { aisha, call } = await setup();
    const id = (await aisha('GET', '/opportunities')).body.items[0].id;
    expect((await aisha('GET', `/opportunities/${id}`)).body.match.eligible).toBe(true);
    const body = { title: 'New Comp', organizer: 'Org', type: 'competition', tags: ['physics'] };
    expect((await aisha('POST', '/opportunities', body)).status).toBe(403);
    const created = await call('POST', '/opportunities', { as: 'admin1', role: 'admin', body });
    expect(created.status).toBe(201);
    expect(created.body.status).toBe('open');
  });
});
