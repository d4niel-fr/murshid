import type { Opportunity } from '../types.js';
import { diceSimilarity, normalizeOrganizer, normalizeTitle } from '../util.js';

export interface DedupeOptions {
  /** Title similarity threshold (Dice on bigrams) for same organizer. */
  titleThreshold?: number;
  /** Stricter threshold when organizers differ (cross-posted on aggregators). */
  crossOrganizerThreshold?: number;
}

function sameUrl(a: string, b: string): boolean {
  const n = (u: string) => u.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').toLowerCase();
  return n(a) === n(b);
}

export function isDuplicate(a: Opportunity, b: Opportunity, o: DedupeOptions = {}): boolean {
  const t1 = normalizeTitle(a.title);
  const t2 = normalizeTitle(b.title);
  const sameOrg = normalizeOrganizer(a.organizer) === normalizeOrganizer(b.organizer);
  // A listing page and its detail pages share a URL, so the URL alone is not enough: titles must agree too.
  if (sameUrl(a.url, b.url) && diceSimilarity(t1, t2) >= 0.8) return true;
  if (!t1 || !t2) return false;
  if (t1 === t2 && sameOrg) return true;
  const sim = diceSimilarity(t1, t2);
  if (sameOrg) return sim >= (o.titleThreshold ?? 0.85);
  return sim >= (o.crossOrganizerThreshold ?? 0.93);
}

/** Merge b into a, preferring the more complete / more authoritative values. */
export function mergeOpportunities(a: Opportunity, b: Opportunity): Opportunity {
  const pick = <T>(x: T | null, y: T | null): T | null => (x !== null && x !== undefined ? x : y);
  const aIsAggregator = a.source_id.startsWith('agg-');
  const primary = aIsAggregator && !b.source_id.startsWith('agg-') ? b : a;
  const secondary = primary === a ? b : a;
  return {
    ...primary,
    organizer: primary.organizer || secondary.organizer,
    emirate: pick(primary.emirate, secondary.emirate),
    country: pick(primary.country, secondary.country),
    min_grade: pick(primary.min_grade, secondary.min_grade),
    max_grade: pick(primary.max_grade, secondary.max_grade),
    eligibility_text: pick(primary.eligibility_text, secondary.eligibility_text),
    nationality_restriction: pick(primary.nationality_restriction, secondary.nationality_restriction),
    cost_aed: pick(primary.cost_aed, secondary.cost_aed),
    deadline: pick(primary.deadline, secondary.deadline),
    tags: [...new Set([...primary.tags, ...secondary.tags])].sort(),
    last_seen_at: primary.last_seen_at > secondary.last_seen_at ? primary.last_seen_at : secondary.last_seen_at,
    status: primary.status !== 'unknown' ? primary.status : secondary.status,
  };
}

/** Greedy O(n²) clustering — fine for a few thousand rows per run. */
export function dedupe(list: Opportunity[], o: DedupeOptions = {}): Opportunity[] {
  const out: Opportunity[] = [];
  for (const item of list) {
    const idx = out.findIndex((x) => isDuplicate(x, item, o));
    if (idx >= 0) out[idx] = mergeOpportunities(out[idx]!, item);
    else out.push(item);
  }
  return out;
}
