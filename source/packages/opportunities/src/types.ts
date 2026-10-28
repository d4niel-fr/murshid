/**
 * Local copies of the canonical domain types from docs/CONTRACT.md.
 * Integration note: replace with imports from @murshid/core once the db team publishes it.
 */

export type OpportunityType =
  | 'competition'
  | 'internship'
  | 'scholarship'
  | 'summer_program'
  | 'volunteering'
  | 'olympiad'
  | 'mun'
  | 'hackathon'
  | 'course';

export type OpportunityStatus = 'open' | 'closed' | 'unknown';

export type Emirate =
  | 'Abu Dhabi'
  | 'Dubai'
  | 'Sharjah'
  | 'Ajman'
  | 'Umm Al Quwain'
  | 'Ras Al Khaimah'
  | 'Fujairah';

/** Canonical Opportunity (contract). Dates are ISO-8601 strings; deadline is a date (YYYY-MM-DD) or null. */
export interface Opportunity {
  id: string;
  title: string;
  organizer: string;
  type: OpportunityType;
  url: string;
  emirate: Emirate | null;
  country: string | null; // ISO-ish country name/code, 'UAE' for UAE, 'Online' or null when global
  min_grade: number | null;
  max_grade: number | null;
  eligibility_text: string | null;
  nationality_restriction: string | null; // e.g. 'UAE nationals only'; null = open to all
  cost_aed: number | null; // 0 = free, null = unknown
  deadline: string | null; // YYYY-MM-DD
  tags: string[];
  source_id: string;
  last_seen_at: string; // ISO datetime
  status: OpportunityStatus;
}

export type ParserKind = 'html-rules' | 'rss' | 'api' | 'manual';
export type CrawlFrequency = 'daily' | 'weekly' | 'monthly' | 'manual';

/** Per-source CSS extraction rules for the html-rules parser. All selectors optional. */
export interface HtmlRules {
  /** Selector for repeated items (cards). If absent the whole page is one opportunity. */
  item?: string;
  /** Selector for a container whose inner HTML is split into items by a separator tag (e.g. 'hr'). */
  container?: string;
  split?: string;
  title?: string;
  link?: string;
  description?: string;
  deadline?: string;
  /** Regex (case-insensitive) an item's text must match to be kept, e.g. 'grades?\\s*\\d'. */
  requireText?: string;
  /** Use the first event date found ("Date: ...") as the deadline when no explicit deadline exists. */
  eventDateAsDeadline?: boolean;
}

export interface Source {
  id: string;
  name: string;
  url: string;
  type: OpportunityType | 'mixed';
  region: string; // 'UAE' | 'global' | 'UK' | 'Europe' ...
  crawl_frequency: CrawlFrequency;
  parser: ParserKind;
  organizer: string;
  tags: string[];
  notes?: string;
  rules?: HtmlRules;
  verification?: { status: 'ok' | 'bot-challenge' | 'failed'; method: string; checked_at: string };
}

/** Minimal Student/Goal shapes needed for matching (subset of contract). */
export interface StudentProfile {
  id: string;
  grade: number; // 6-13
  emirate?: Emirate | string | null;
  nationality?: string | null; // e.g. 'UAE', 'India'
  interests: string[];
  strengths?: string[];
  /** Max the family is willing to pay, AED. undefined = no limit given. */
  budget_aed?: number;
}

export interface GoalLite {
  title: string;
  category: 'academic' | 'university' | 'career' | 'sport' | 'skill' | 'personal';
  status?: 'active' | 'done' | 'paused';
}

export interface MatchResult {
  opportunity: Opportunity;
  score: number; // 0-100
  eligible: boolean;
  reasons: string[];
  warnings: string[];
}
