import { describe, expect, it } from 'vitest';
import { parseRobots } from '../src/crawler/robots.js';
import { MemoryCache, PoliteFetcher } from '../src/crawler/fetcher.js';
import { crawlSource, crawlSources, isDue } from '../src/crawler/crawl.js';
import { fixture, mockFetch, NOW, source } from './helpers.js';

describe('robots.txt', () => {
  const txt = fixture('robots-sample.txt');
  it('applies wildcard group with longest-match precedence', () => {
    const p = parseRobots(txt, 'MurshidBot/0.1');
    expect(p.isAllowed('/programs')).toBe(true);
    expect(p.isAllowed('/private/x')).toBe(false);
    expect(p.isAllowed('/private/public-page')).toBe(true);
    expect(p.isAllowed('/search?q=1')).toBe(false);
    expect(p.crawlDelaySeconds).toBe(3);
  });
  it('honours agent-specific groups', () => {
    expect(parseRobots(txt, 'BadBot/1.0').isAllowed('/anything')).toBe(false);
  });
  it('empty robots allows all; * and $ patterns work', () => {
    expect(parseRobots('', 'x').isAllowed('/a')).toBe(true);
    const p = parseRobots('User-agent: *\nDisallow: /*.pdf$', 'x');
    expect(p.isAllowed('/file.pdf')).toBe(false);
    expect(p.isAllowed('/file.pdf.html')).toBe(true);
  });
});

describe('PoliteFetcher', () => {
  it('skips URLs disallowed by robots.txt without fetching them', async () => {
    const { impl, calls } = mockFetch({
      'https://site.example/robots.txt': { body: 'User-agent: *\nDisallow: /private' },
      'https://site.example/private/page': { body: 'secret' },
    });
    const f = new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} });
    const r = await f.fetch('https://site.example/private/page');
    expect(r.blockedByRobots).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(['https://site.example/robots.txt']);
  });

  it('uses ETag / Last-Modified for conditional GET and serves cached body on 304', async () => {
    let n = 0;
    const { impl, calls } = mockFetch({
      'https://site.example/robots.txt': { status: 404 },
      'https://site.example/opps': (h) => {
        n++;
        if (h['If-None-Match'] === '"v1"') return { status: 304 };
        return { body: '<h1>v1</h1>', headers: { ETag: '"v1"', 'Last-Modified': 'Wed, 01 Apr 2026 00:00:00 GMT', 'Content-Type': 'text/html' } };
      },
    });
    const cache = new MemoryCache();
    const f = new PoliteFetcher({ fetchImpl: impl, cache, minIntervalMs: 0, sleep: async () => {} });
    const first = await f.fetch('https://site.example/opps');
    const second = await f.fetch('https://site.example/opps');
    expect(first).toMatchObject({ status: 200, fromCache: false, body: '<h1>v1</h1>' });
    expect(second).toMatchObject({ status: 304, fromCache: true, body: '<h1>v1</h1>' });
    expect(n).toBe(2);
    const cond = calls.filter((c) => c.url.endsWith('/opps'))[1]!.headers;
    expect(cond['If-None-Match']).toBe('"v1"');
    expect(cond['If-Modified-Since']).toBe('Wed, 01 Apr 2026 00:00:00 GMT');
    expect(cond['User-Agent']).toMatch(/MurshidBot/);
  });

  it('rate-limits per host (and honours Crawl-delay)', async () => {
    let clock = 0;
    const sleeps: number[] = [];
    const { impl } = mockFetch({
      'https://a.example/robots.txt': { body: 'User-agent: *\nCrawl-delay: 5' },
      'https://a.example/1': { body: 'x' },
      'https://a.example/2': { body: 'y' },
      'https://b.example/robots.txt': { status: 404 },
      'https://b.example/1': { body: 'z' },
    });
    const f = new PoliteFetcher({
      fetchImpl: impl,
      minIntervalMs: 1000,
      clock: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms);
        clock += ms;
      },
    });
    await f.fetch('https://a.example/1');
    await f.fetch('https://a.example/2');
    await f.fetch('https://b.example/1');
    // a.example: robots (t=0) → /1 waits 1000 (min interval) → /2 waits 5000 (crawl-delay)
    expect(sleeps).toEqual([1000, 5000, 1000]);
  });

  it('5xx on robots.txt → conservative disallow', async () => {
    const { impl } = mockFetch({ 'https://down.example/robots.txt': { status: 503 }, 'https://down.example/x': { body: 'x' } });
    const f = new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} });
    expect((await f.fetch('https://down.example/x')).blockedByRobots).toBe(true);
  });
});

describe('crawlSource / crawlSources', () => {
  it('crawls an html source end-to-end from a mocked network', async () => {
    const src = source('uae-ku-ektashif');
    const { impl } = mockFetch({
      'https://www.ku.ac.ae/robots.txt': { body: 'User-agent: *\nDisallow: /wp-admin/' },
      [src.url]: { body: fixture('ku-ektashif.html') },
    });
    const fetcher = new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} });
    const { opportunities, report } = await crawlSource(src, { fetcher, now: NOW });
    expect(report).toMatchObject({ ok: true, http_status: 200, count: 1 });
    expect(opportunities[0]!.source_id).toBe('uae-ku-ektashif');
  });

  it('reports failures and skips manual sources', async () => {
    const { impl } = mockFetch({});
    const fetcher = new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} });
    const res = await crawlSources([source('uae-nyuad-hs'), source('uae-volunteers')], { fetcher, now: NOW });
    const nyu = res.reports.find((r) => r.source_id === 'uae-nyuad-hs')!;
    const vol = res.reports.find((r) => r.source_id === 'uae-volunteers')!;
    expect(nyu).toMatchObject({ ok: false, http_status: 404 });
    expect(vol).toMatchObject({ ok: true, skipped: 'manual' });
  });

  it('devpost api url gets open/upcoming filters', async () => {
    const src = source('g-devpost');
    const { impl, calls } = mockFetch({
      'https://devpost.com/robots.txt': { status: 404 },
      'https://devpost.com/api/hackathons?status[]=upcoming&status[]=open': { body: fixture('devpost-api.json') },
    });
    const fetcher = new PoliteFetcher({ fetchImpl: impl, minIntervalMs: 0, sleep: async () => {} });
    const { report } = await crawlSource(src, { fetcher, now: NOW });
    expect(report.ok).toBe(true);
    expect(calls.at(-1)!.url).toContain('status[]=open');
  });

  it('isDue respects crawl_frequency', () => {
    const weekly = source('uae-nyuad-hs');
    expect(isDue(weekly, null, NOW)).toBe(true);
    expect(isDue(weekly, new Date(NOW.getTime() - 2 * 86400e3).toISOString(), NOW)).toBe(false);
    expect(isDue(weekly, new Date(NOW.getTime() - 7 * 86400e3).toISOString(), NOW)).toBe(true);
    expect(isDue(source('uae-volunteers'), null, NOW)).toBe(false);
  });
});
