import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import type { Source } from './types.js';

export * from './types.js';
export * from './util.js';
export * from './extract/dates.js';
export * from './extract/heuristics.js';
export * from './extract/build.js';
export * from './extract/html.js';
export * from './extract/rss.js';
export * from './extract/api.js';
export * from './ai.js';
export * from './crawler/robots.js';
export * from './crawler/fetcher.js';
export * from './crawler/crawl.js';
export * from './pipeline/dedupe.js';
export * from './pipeline/lifecycle.js';
export * from './match/rank.js';
export * from './store.js';
export * from './scheduler.js';

/** Load the curated source registry (sources.json at the package root). */
export function loadSources(path?: string): Source[] {
  const p = path ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'sources.json');
  return JSON.parse(readFileSync(p, 'utf8')) as Source[];
}
