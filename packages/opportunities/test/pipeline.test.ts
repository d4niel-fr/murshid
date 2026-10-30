import { describe, expect, it } from 'vitest';
import { dedupe, isDuplicate } from '../src/pipeline/dedupe.js';
import { applyExpiry, freshnessScore } from '../src/pipeline/lifecycle.js';
import { normalizeTitle } from '../src/util.js';
import { NOW, opp } from './helpers.js';

describe('dedupe', () => {
  it('normalizes titles (years, ordinals, punctuation, stopwords)', () => {
    expect(normalizeTitle('The 9th Emirates Young Scientist Competition 2026!')).toBe('emirates young scientist competition');
  });

  it('merges same title + organizer across years/editions', () => {
    const a = opp({ title: 'Emirates Young Scientist Competition 2026', organizer: 'UAE Ministry of Education', deadline: '2026-09-20' });
    const b = opp({ title: 'Emirates Young Scientist Competition (EYSC)', organizer: 'UAE Ministry of Education', url: 'https://other.example' });
    expect(isDuplicate(a, b)).toBe(true); // acronym suffix + year stripped → same competition
    const c = opp({ title: 'Emirates Young Scientists Competition', organizer: 'UAE Ministry of Education', url: 'https://c.example' });
    expect(isDuplicate(a, c)).toBe(true); // fuzzy: plural difference
  });

  it('prefers the primary source over an aggregator when merging, and fills gaps', () => {
    const agg = opp({ id: '1', title: 'Breakthrough Junior Challenge 2026', organizer: 'Opportunity Desk', source_id: 'agg-opportunitydesk', url: 'https://opportunitydesk.org/x', deadline: '2026-06-25', tags: ['video'] });
    const primary = opp({ id: '2', title: 'Breakthrough Junior Challenge', organizer: 'Breakthrough Prize Foundation', source_id: 'g-breakthrough', url: 'https://breakthroughjuniorchallenge.org/', deadline: null, cost_aed: 0, tags: ['science'] });
    const out = dedupe([agg, primary]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: '2', source_id: 'g-breakthrough', deadline: '2026-06-25', cost_aed: 0 });
    expect(out[0]!.tags).toEqual(['science', 'video']);
  });

  it('keeps genuinely different items apart', () => {
    const list = [
      opp({ title: 'International Physics Olympiad', url: 'https://ipho.example' }),
      opp({ title: 'International Chemistry Olympiad', url: 'https://icho.example' }),
      opp({ title: 'International Biology Olympiad', url: 'https://ibo.example' }),
      // same listing URL but different programmes must stay separate too
      opp({ title: 'Civil Engineering Bootcamp', url: 'https://hub.example' }),
      opp({ title: 'Sumo Robot Competition', url: 'https://hub.example' }),
    ];
    expect(dedupe(list)).toHaveLength(5);
  });

  it('same URL + similar title → duplicate; same URL different title (listing page) → not', () => {
    const u = 'https://www.aus.edu/cen/outreach/hub';
    expect(isDuplicate(opp({ url: u, title: 'Civil Engineering Bootcamp' }), opp({ url: u + '/', title: 'Civil Engineering Boot camp', organizer: 'x' }))).toBe(true);
    expect(isDuplicate(opp({ url: u, title: 'Civil Engineering Bootcamp' }), opp({ url: u, title: 'Sumo Robot Competition' }))).toBe(false);
  });
});

describe('expiry & freshness', () => {
  it('closes past-deadline items and opens future ones', () => {
    const out = applyExpiry([opp({ deadline: '2026-04-30', status: 'open' }), opp({ deadline: '2026-05-01', status: 'unknown' })], NOW);
    expect(out.map((o) => o.status)).toEqual(['closed', 'open']);
  });

  it('marks long-unseen undated items unknown', () => {
    const old = new Date(NOW.getTime() - 60 * 86400e3).toISOString();
    const [o] = applyExpiry([opp({ deadline: null, status: 'open', last_seen_at: old })], NOW);
    expect(o!.status).toBe('unknown');
  });

  it('freshness decays with age and is 0 when closed', () => {
    const fresh = freshnessScore(opp({ deadline: '2026-06-01', status: 'open' }), NOW);
    const stale = freshnessScore(opp({ last_seen_at: new Date(NOW.getTime() - 60 * 86400e3).toISOString() }), NOW);
    expect(fresh).toBe(1);
    expect(stale).toBeLessThan(0.3);
    expect(freshnessScore(opp({ status: 'closed' }), NOW)).toBe(0);
  });
});
