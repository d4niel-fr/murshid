import type { Opportunity, OpportunityType, Source } from '../types.js';
import { cleanText, isoDateTime, stableUuid, todayIso } from '../util.js';
import { findDeadline, findEventDate } from './dates.js';
import {
  extractCost,
  extractEligibilityText,
  extractGradeRange,
  extractNationality,
  inferEmirate,
  inferTags,
  inferType,
} from './heuristics.js';

export interface RawItem {
  title: string;
  url: string;
  text: string; // full visible text of the item (used by heuristics)
  organizer?: string;
  deadline?: string | null; // pre-parsed (e.g. from API)
  type?: OpportunityType;
  tags?: string[];
  cost_aed?: number | null;
  country?: string | null;
  /** Listing items describe different programmes, so the source's topical tags don't apply to each. Default true. */
  inheritSourceTags?: boolean;
}

export interface BuildOptions {
  now: Date;
  eventDateAsDeadline?: boolean;
}

/** Turn a raw scraped item into a normalized contract Opportunity using generic heuristics. */
export function buildOpportunity(raw: RawItem, source: Source, opts: BuildOptions): Opportunity {
  const text = cleanText(raw.text);
  const title = cleanText(raw.title).slice(0, 200) || source.name;
  const both = `${title}. ${text}`;
  const grades = extractGradeRange(both);
  const cost = raw.cost_aed !== undefined ? { cost_aed: raw.cost_aed } : extractCost(text);
  let deadline = raw.deadline !== undefined ? raw.deadline : findDeadline(text, opts.now);
  if (!deadline && opts.eventDateAsDeadline) deadline = findEventDate(text, opts.now);
  const fallbackType: OpportunityType = source.type === 'mixed' ? 'competition' : source.type;
  const type = raw.type ?? (source.type === 'mixed' ? inferType(both, fallbackType) : inferTypeKeepingSource(both, fallbackType));
  const emirate = source.region === 'UAE' || /\buae\b|emirates/i.test(both) ? inferEmirate(both) : null;
  const country = raw.country !== undefined ? raw.country : source.region === 'UAE' ? 'UAE' : /\bonline|virtual\b/i.test(both) ? 'Online' : null;
  const status = deadline ? (deadline < todayIso(opts.now) ? 'closed' : 'open') : 'unknown';
  return {
    id: stableUuid(source.id, raw.url, title.toLowerCase()),
    title,
    organizer: cleanText(raw.organizer) || source.organizer,
    type,
    url: raw.url,
    emirate,
    country,
    min_grade: grades.min,
    max_grade: grades.max,
    eligibility_text: extractEligibilityText(text),
    nationality_restriction: extractNationality(both),
    cost_aed: cost.cost_aed,
    deadline,
    tags: inferTags(both, [...(raw.inheritSourceTags === false ? [] : source.tags), ...(raw.tags ?? [])]).filter((t) => t !== 'aggregator'),
    source_id: source.id,
    last_seen_at: isoDateTime(opts.now),
    status,
  };
}

/** Sources with a specific type keep it, except generic 'competition' sources whose text is clearly a hackathon/olympiad/MUN. */
function inferTypeKeepingSource(text: string, sourceType: OpportunityType): OpportunityType {
  const t = inferType(text, sourceType);
  return ['hackathon', 'olympiad', 'mun'].includes(t) && t !== sourceType && sourceType === 'competition' ? t : sourceType;
}
