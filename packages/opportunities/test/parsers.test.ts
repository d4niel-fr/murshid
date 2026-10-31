import { describe, expect, it } from 'vitest';
import { extractFromHtml } from '../src/extract/html.js';
import { extractFromFeed } from '../src/extract/rss.js';
import { extractFromApi } from '../src/extract/api.js';
import type { Source } from '../src/types.js';
import { fixture, NOW, source } from './helpers.js';

describe('html-rules parser on saved real pages (no network)', () => {
  it('Khalifa University Ektashif camp: grades + deadline from page', () => {
    const [o] = extractFromHtml(fixture('ku-ektashif.html'), source('uae-ku-ektashif'), NOW);
    expect(o).toBeDefined();
    expect(o!.title).toBe('Ektashif Camp');
    expect([o!.min_grade, o!.max_grade]).toEqual([10, 12]);
    // The live page literally says "Application Deadline: [20 June 2025]" — extracted faithfully, so it reads as closed.
    expect(o!.deadline).toBe('2025-06-20');
    expect(o!.status).toBe('closed');
    expect(o!.country).toBe('UAE');
    expect(o!.type).toBe('summer_program');
  });

  it('NYUAD high school programs: tuition, emirate', () => {
    const [o] = extractFromHtml(fixture('nyuad-hs-programs.html'), source('uae-nyuad-hs'), NOW);
    expect(o!.cost_aed).toBe(6000);
    expect(o!.emirate).toBe('Abu Dhabi');
    expect(o!.min_grade).not.toBeNull();
  });

  it('EYSC: title from h1, grades 5-12', () => {
    const [o] = extractFromHtml(fixture('eysc2026.html'), source('uae-eysc'), NOW);
    expect(o!.title).toBe('Emirates Young Scientist Competition 2026');
    expect([o!.min_grade, o!.max_grade]).toEqual([5, 12]);
    expect(o!.nationality_restriction).toBeNull();
  });

  it('AUS outreach hub: container split into many boot camps, event date used as deadline', () => {
    const list = extractFromHtml(fixture('aus-cen-hub.html'), source('uae-aus-cen-outreach'), NOW);
    expect(list.length).toBeGreaterThanOrEqual(8);
    const chbe = list.find((o) => /9th Chemical and Biological/.test(o.title));
    expect(chbe).toBeDefined();
    expect(chbe!.deadline).toBe('2026-06-08');
    expect([chbe!.min_grade, chbe!.max_grade]).toEqual([10, 12]);
    expect(chbe!.url).toBe('https://forms.gle/XCC2MTW74TiKD3Ri6');
    expect(chbe!.emirate).toBe('Sharjah');
    // non-student accordion entries (industry partners) are filtered out by requireText
    expect(list.some((o) => /Recruitment/i.test(o.title))).toBe(false);
  });

  it('per-source CSS card rules on a synthetic listing', () => {
    const src: Source = {
      id: 'test-board', name: 'Test Board', url: 'https://board.example/opps', type: 'mixed', region: 'UAE',
      crawl_frequency: 'weekly', parser: 'html-rules', organizer: 'Test Board', tags: [],
      rules: { item: '.opp-card', title: 'h3', link: 'h3 a', description: '.desc', deadline: '.dl' },
    };
    const list = extractFromHtml(fixture('synthetic-listing.html'), src, NOW);
    expect(list).toHaveLength(3);
    const [robot, essay, camp] = list;
    expect(robot).toMatchObject({ url: 'https://board.example/opps/robotics-challenge', min_grade: 8, max_grade: 11, cost_aed: 0, deadline: '2026-11-15', emirate: 'Dubai', status: 'open' });
    expect(robot!.tags).toContain('robotics');
    expect(essay).toMatchObject({ url: 'https://example.org/essay', min_grade: 9, max_grade: 13, cost_aed: 50, deadline: '2026-12-01', nationality_restriction: 'UAE nationals only' });
    expect(essay!.tags).toContain('writing');
    expect(camp).toMatchObject({ min_grade: 9, max_grade: 12, cost_aed: 4407, deadline: '2026-12-20', emirate: 'Abu Dhabi', type: 'summer_program' });
  });

  it('generic fallback ignores nav/footer noise', () => {
    const src: Source = { id: 'g', name: 'G', url: 'https://board.example/', type: 'competition', region: 'global', crawl_frequency: 'weekly', parser: 'html-rules', organizer: 'G', tags: [] };
    const [o] = extractFromHtml(fixture('synthetic-listing.html'), src, NOW);
    expect(o!.title).toBe('Opportunities for students');
    expect(o!.deadline).not.toBe('2030-01-01'); // footer date must not leak in
  });

  it('ids are stable across runs', () => {
    const a = extractFromHtml(fixture('eysc2026.html'), source('uae-eysc'), NOW)[0]!.id;
    const b = extractFromHtml(fixture('eysc2026.html'), source('uae-eysc'), new Date('2026-06-01'))[0]!.id;
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('rss parser', () => {
  it('parses Opportunity Desk feed items', () => {
    const list = extractFromFeed(fixture('opportunitydesk-feed.xml'), source('agg-opportunitydesk'), NOW);
    expect(list.length).toBe(10);
    for (const o of list) {
      expect(o.title.length).toBeGreaterThan(3);
      expect(o.url).toMatch(/^https:\/\/opportunitydesk\.org\//);
      expect(o.source_id).toBe('agg-opportunitydesk');
      expect(o.tags).not.toContain('aggregator');
    }
    expect(list.filter((o) => o.deadline !== null).length).toBeGreaterThan(5);
  });
});

describe('api parsers', () => {
  it('Devpost: submission end date becomes the deadline', () => {
    const list = extractFromApi(fixture('devpost-api.json'), source('g-devpost'), NOW);
    expect(list.length).toBeGreaterThan(0);
    const amz = list.find((o) => o.title.startsWith('Build, Ship, Shape'));
    expect(amz).toMatchObject({ type: 'hackathon', deadline: '2026-10-23', country: 'Online', organizer: 'Amazon' });
    expect(amz!.tags).toContain('ai');
  });
  it('Codeforces: only upcoming contests, free, online', () => {
    const list = extractFromApi(fixture('codeforces-api.json'), source('g-codeforces'), NOW);
    expect(list.length).toBeGreaterThan(0);
    for (const o of list) expect(o).toMatchObject({ cost_aed: 0, country: 'Online', organizer: 'Codeforces' });
  });
});
