import { describe, expect, it } from 'vitest';
import { PoliteFetcher } from '../src/crawler/fetcher.js';
import { MemoryStore } from '../src/store.js';
import { runNightlyExpiry, runWeeklyCrawl, scheduleDefinitions } from '../src/scheduler.js';
import { RuleBasedExtractor } from '../src/ai.js';
import { fixture, mockFetch, NOW, opp, source, SOURCES } from './helpers.js';

describe('sources.json registry', () => {
  it('has 60+ unique, well-formed sources', () => {
    expect(SOURCES.length).toBeGreaterThanOrEqual(60);
    expect(new Set(SOURCES.map((s) => s.id)).size).toBe(SOURCES.length);
    const types = ['competition', 'internship', 'scholarship', 'summer_program', 'volunteering', 'olympiad', 'mun', 'hackathon', 'course', 'mixed'];
    for (const s of SOURCES) {
      expect(s.url).toMatch(/^https:\/\//);
      expect(types).toContain(s.type);
      expect(['html-rules', 'rss', 'api', 'manual']).toContain(s.parser);
      expect(['daily', 'weekly', 'monthly', 'manual']).toContain(s.crawl_frequency);
      expect(s.name.length).toBeGreaterThan(2);
      expect(s.organizer.length).toBeGreaterThan(1);
    }
  });
  it('covers UAE and global sources and every opportunity family', () => {
    expect(SOURCES.filter((s) => s.region === 'UAE').length).toBeGreaterThanOrEqual(25);
    for (const t of ['olympiad', 'summer_program', 'hackathon', 'mun', 'volunteering', 'scholarship', 'competition']) {
      expect(SOURCES.some((s) => s.type === t)).toBe(true);
    }
  });
  it('records a verification result for every source', () => {
    for (const s of SOURCES) expect(s.verification?.status).toMatch(/ok|bot-challenge/);
  });
});

describe('scheduler', () => {
  const subset = [source('uae-ku-ektashif'), source('uae-aus-cen-outreach'), source('g-devpost')];
  const routes = {
    'https://www.ku.ac.ae/robots.txt': { status: 404 },
    'https://www.aus.edu/robots.txt': { body: 'User-agent: *\nDisallow: /admin' },
    'https://devpost.com/robots.txt': { status: 404 },
    [subset[0]!.url]: { body: fixture('ku-ektashif.html') },
    [subset[1]!.url]: { body: fixture('aus-cen-hub.html') },
    'https://devpost.com/api/hackathons?status[]=upcoming&status[]=open': { body: fixture('devpost-api.json') },
  };

  it('weekly crawl stores deduped, expiry-applied rows and records last crawl', async () => {
    const store = new MemoryStore();
    const { impl } = mockFetch(routes);
    const ctx = { store, sources: subset, now: () => NOW, deps: { fetcher: new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} }), extractor: new RuleBasedExtractor() } };
    const s1 = await runWeeklyCrawl(ctx);
    expect(s1.crawled).toBe(3);
    expect(s1.failures).toHaveLength(0);
    expect(s1.stored).toBeGreaterThan(10);
    const rows = await store.listAll();
    expect(rows.find((r) => r.source_id === 'uae-ku-ektashif')!.status).toBe('closed');
    // Second run the same day: nothing is due, rows unchanged (no duplicates)
    const s2 = await runWeeklyCrawl(ctx);
    expect(s2.crawled).toBe(0);
    expect((await store.listAll()).length).toBe(rows.length);
  });

  it('nightly expiry closes items whose deadline passed', async () => {
    const store = new MemoryStore();
    await store.upsertMany([opp({ id: 'a', deadline: '2026-04-30', status: 'open' }), opp({ id: 'b', deadline: '2026-06-30', status: 'open' })]);
    const res = await runNightlyExpiry({ store, sources: [], now: () => NOW });
    expect(res).toEqual({ closed: 1, total: 2 });
    expect((await store.listAll()).find((o) => o.id === 'a')!.status).toBe('closed');
  });

  it('exports cron definitions (UTC) for weekly crawl and nightly expiry', () => {
    expect(scheduleDefinitions.map((d) => [d.id, d.cron])).toEqual([
      ['opportunities-weekly-crawl', '0 23 * * 0'],
      ['opportunities-nightly-expiry', '30 20 * * *'],
    ]);
  });
});
