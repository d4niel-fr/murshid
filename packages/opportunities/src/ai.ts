/**
 * AI-LATER: LLM-based extraction will plug in here (e.g. turning messy pages into structured
 * Opportunity fields, or summarising eligibility). This phase ships ONLY the deterministic
 * rule-based implementation; no model calls are made anywhere in this package.
 */
import type { Opportunity, Source } from './types.js';
import { extractFromHtml } from './extract/html.js';
import { extractFromFeed } from './extract/rss.js';
import { extractFromApi } from './extract/api.js';

export interface ExtractInput {
  body: string;
  contentType: string | null;
  source: Source;
  url: string;
  now: Date;
}

// AI-LATER: an `LlmOpportunityExtractor implements OpportunityExtractor` routed through
// packages/agent-gateway will be added; it must return the same contract shape.
export interface OpportunityExtractor {
  readonly kind: 'rules' | 'llm';
  extract(input: ExtractInput): Promise<Opportunity[]>;
}

export class RuleBasedExtractor implements OpportunityExtractor {
  readonly kind = 'rules' as const;
  async extract({ body, source, url, now }: ExtractInput): Promise<Opportunity[]> {
    switch (source.parser) {
      case 'rss':
        return extractFromFeed(body, source, now);
      case 'api':
        return extractFromApi(body, source, now);
      case 'html-rules':
        return extractFromHtml(body, source, now, url);
      case 'manual':
        return [];
    }
  }
}
