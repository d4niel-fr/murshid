/**
 * Scheduler entry points. Framework-agnostic handlers + Inngest-shaped definitions.
 *
 * Integration (notify / api team): with Inngest installed, wire each definition as
 *   inngest.createFunction({ id: def.id }, { cron: def.cron }, ({ step }) => def.handler(ctx))
 * or call the handlers from any cron (Supabase pg_cron → edge function, GitHub Actions, etc.).
 * Cron times are UTC: weekly crawl Sun 23:00 UTC = Mon 03:00 Asia/Dubai; nightly expiry 20:30 UTC = 00:30 Dubai.
 */
import { isoDateTime } from './util.js';
import type { Source } from './types.js';
import type { OpportunityStore } from './store.js';
import { crawlSources, isDue, type CrawlDeps, type SourceCrawlReport } from './crawler/crawl.js';
import { dedupe } from './pipeline/dedupe.js';
import { applyExpiry } from './pipeline/lifecycle.js';

export interface SchedulerContext {
  store: OpportunityStore;
  sources: Source[];
  deps?: CrawlDeps;
  now?: () => Date;
  log?: (msg: string, data?: unknown) => void;
}

export interface CrawlRunSummary {
  crawled: number;
  skipped: number;
  extracted: number;
  stored: number;
  failures: SourceCrawlReport[];
}

/** Weekly crawl: crawl every due source, dedupe against stored rows, apply expiry, persist. */
export async function runWeeklyCrawl(ctx: SchedulerContext, opts: { force?: boolean } = {}): Promise<CrawlRunSummary> {
  const now = ctx.now?.() ?? new Date();
  const due: Source[] = [];
  for (const s of ctx.sources) {
    if (opts.force ? s.parser !== 'manual' : isDue(s, await ctx.store.getSourceLastCrawled(s.id), now)) due.push(s);
  }
  const { opportunities, reports } = await crawlSources(due, { ...ctx.deps, now });
  for (const r of reports) if (r.ok) await ctx.store.setSourceLastCrawled(r.source_id, isoDateTime(now));
  const existing = await ctx.store.listAll();
  const merged = applyExpiry(dedupe([...opportunities, ...existing]), now);
  if (ctx.store.replaceAll) await ctx.store.replaceAll(merged);
  else await ctx.store.upsertMany(merged);
  const summary = {
    crawled: due.length,
    skipped: ctx.sources.length - due.length,
    extracted: opportunities.length,
    stored: merged.length,
    failures: reports.filter((r) => !r.ok),
  };
  ctx.log?.('opportunities.weekly-crawl', summary);
  return summary;
}

/** Nightly expiry: close past-deadline items, mark long-unseen undated items 'unknown'. */
export async function runNightlyExpiry(ctx: SchedulerContext): Promise<{ closed: number; total: number }> {
  const now = ctx.now?.() ?? new Date();
  const all = await ctx.store.listAll();
  const updated = applyExpiry(all, now);
  const changed = updated.filter((u, i) => u.status !== all[i]!.status);
  await ctx.store.upsertMany(changed);
  const res = { closed: changed.filter((c) => c.status === 'closed').length, total: all.length };
  ctx.log?.('opportunities.nightly-expiry', res);
  return res;
}

export interface CronDefinition {
  id: string;
  cron: string; // UTC
  description: string;
  handler: (ctx: SchedulerContext) => Promise<unknown>;
}

export const scheduleDefinitions: CronDefinition[] = [
  { id: 'opportunities-weekly-crawl', cron: '0 23 * * 0', description: 'Crawl due sources (Mon 03:00 Dubai)', handler: (ctx) => runWeeklyCrawl(ctx) },
  { id: 'opportunities-nightly-expiry', cron: '30 20 * * *', description: 'Close past-deadline opportunities (00:30 Dubai)', handler: (ctx) => runNightlyExpiry(ctx) },
];
