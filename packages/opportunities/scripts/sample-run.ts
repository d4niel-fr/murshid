/**
 * Live crawl over a small set of sources (NETWORK). Writes data/sample-run.json.
 * Usage: pnpm crawl:sample [id1,id2,...]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  FileCache,
  PoliteFetcher,
  applyExpiry,
  crawlSources,
  dedupe,
  freshnessScore,
  loadSources,
  rankOpportunities,
  type StudentProfile,
} from '../src/index.js';

const DEFAULT_IDS = [
  'uae-eysc',
  'uae-nyuad-hs',
  'uae-ku-ektashif',
  'uae-aus-cen-outreach',
  'uae-iof-math',
  'uae-dff-tks',
  'g-devpost',
  'g-codeforces',
  'agg-opportunitydesk',
  'g-john-locke',
];

async function main() {
  const ids = process.argv[2]?.split(',') ?? DEFAULT_IDS;
  const all = loadSources();
  const sources = all.filter((s) => ids.includes(s.id));
  const now = new Date();
  const fetcher = new PoliteFetcher({
    cache: new FileCache(join(process.cwd(), '.cache', 'http')),
    minIntervalMs: Number(process.env.CRAWLER_MIN_INTERVAL_MS ?? 2000),
  });
  const { opportunities, reports } = await crawlSources(sources, { fetcher, now, concurrency: 4 });
  const merged = applyExpiry(dedupe(opportunities), now);

  // Demo ranking for a synthetic student (contract: synthetic data only).
  const rohan: StudentProfile = { id: 'seed-rohan', grade: 11, emirate: 'Dubai', nationality: 'India', interests: ['robotics', 'AI', 'math'], budget_aed: 8000 };
  const ranked = rankOpportunities(merged, rohan, [{ title: 'Study engineering at a top university', category: 'university', status: 'active' }], { now, limit: 10 });

  const out = {
    generated_at: now.toISOString(),
    note: 'Live crawl sample produced by scripts/sample-run.ts. Synthetic student "Rohan Test" used for the ranking demo.',
    sources: reports,
    totals: { extracted: opportunities.length, after_dedupe: merged.length, open: merged.filter((o) => o.status === 'open').length },
    opportunities: merged.map((o) => ({ ...o, _freshness: freshnessScore(o, now) })),
    demo_ranking_for_rohan_test: ranked.map((r) => ({ title: r.opportunity.title, score: r.score, reasons: r.reasons, warnings: r.warnings })),
  };
  mkdirSync(join(process.cwd(), 'data'), { recursive: true });
  writeFileSync(join(process.cwd(), 'data', 'sample-run.json'), JSON.stringify(out, null, 2));
  for (const r of reports) console.log(`${r.ok ? 'OK ' : 'ERR'} ${r.source_id.padEnd(24)} http=${r.http_status} n=${r.count}${r.error ? ' ' + r.error : ''}${r.blocked_by_robots ? ' (robots)' : ''}`);
  console.log(`extracted=${out.totals.extracted} deduped=${out.totals.after_dedupe} open=${out.totals.open}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
