import type { Opportunity, Source } from '../types.js';
import { RuleBasedExtractor, type OpportunityExtractor } from '../ai.js';
import { PoliteFetcher } from './fetcher.js';

export interface SourceCrawlReport {
  source_id: string;
  url: string;
  ok: boolean;
  http_status: number;
  from_cache: boolean;
  blocked_by_robots: boolean;
  skipped?: 'manual' | 'not-due';
  error?: string;
  count: number;
}

export interface CrawlResult {
  opportunities: Opportunity[];
  reports: SourceCrawlReport[];
}

export interface CrawlDeps {
  fetcher?: PoliteFetcher;
  extractor?: OpportunityExtractor;
  now?: Date;
  /** Max sources fetched in parallel (different hosts; per-host politeness still applies). */
  concurrency?: number;
}

/** Devpost needs query params for open/upcoming events. */
function fetchUrlFor(source: Source): string {
  if (source.parser === 'api' && source.url.includes('devpost.com/api/hackathons') && !source.url.includes('?')) {
    return `${source.url}?status[]=upcoming&status[]=open`;
  }
  return source.url;
}

export async function crawlSource(source: Source, deps: CrawlDeps = {}): Promise<{ opportunities: Opportunity[]; report: SourceCrawlReport }> {
  const now = deps.now ?? new Date();
  const fetcher = deps.fetcher ?? new PoliteFetcher();
  const extractor = deps.extractor ?? new RuleBasedExtractor();
  const base = { source_id: source.id, url: source.url, from_cache: false, blocked_by_robots: false, count: 0 };
  if (source.parser === 'manual') {
    return { opportunities: [], report: { ...base, ok: true, http_status: 0, skipped: 'manual' } };
  }
  const url = fetchUrlFor(source);
  const res = await fetcher.fetch(url);
  if (res.blockedByRobots) return { opportunities: [], report: { ...base, ok: false, http_status: 0, blocked_by_robots: true } };
  if (!res.body || (res.status !== 304 && (res.status < 200 || res.status >= 300))) {
    return { opportunities: [], report: { ...base, ok: false, http_status: res.status, error: res.error ?? `HTTP ${res.status}` } };
  }
  try {
    const opportunities = await extractor.extract({ body: res.body, contentType: res.contentType, source, url: source.url, now });
    return {
      opportunities,
      report: { ...base, ok: true, http_status: res.status, from_cache: res.fromCache, count: opportunities.length },
    };
  } catch (e) {
    return { opportunities: [], report: { ...base, ok: false, http_status: res.status, error: (e as Error).message } };
  }
}

const DUE_MS: Record<Source['crawl_frequency'], number> = {
  daily: 20 * 3600e3,
  weekly: 6 * 86400e3,
  monthly: 27 * 86400e3,
  manual: Number.POSITIVE_INFINITY,
};

/** Whether a source should be crawled now given when it was last crawled. */
export function isDue(source: Source, lastCrawledAt: string | null | undefined, now: Date): boolean {
  if (source.parser === 'manual' || source.crawl_frequency === 'manual') return false;
  if (!lastCrawledAt) return true;
  return now.getTime() - new Date(lastCrawledAt).getTime() >= DUE_MS[source.crawl_frequency];
}

export async function crawlSources(sources: Source[], deps: CrawlDeps = {}): Promise<CrawlResult> {
  const fetcher = deps.fetcher ?? new PoliteFetcher();
  const conc = Math.max(1, deps.concurrency ?? 4);
  const queue = [...sources];
  const all: Opportunity[] = [];
  const reports: SourceCrawlReport[] = [];
  const worker = async () => {
    for (;;) {
      const s = queue.shift();
      if (!s) return;
      const { opportunities, report } = await crawlSource(s, { ...deps, fetcher });
      all.push(...opportunities);
      reports.push(report);
    }
  };
  await Promise.all(Array.from({ length: conc }, worker));
  return { opportunities: all, reports };
}
