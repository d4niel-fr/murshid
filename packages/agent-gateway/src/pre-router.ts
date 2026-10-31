/**
 * Rule-based pre-router: runs BEFORE any model. Cheap, deterministic, and
 * catches requests that need no model at all (greetings, "what's due",
 * reminders, opportunity search) or that clearly belong to one task type.
 *
 * AI-LATER: when no rule matches with confidence, the gateway may call the
 * `router` task model to classify intent. In this phase, unmatched → `chat`.
 */
import type { TaskType } from './registry.js';

export interface GatewayInput {
  text: string;
  attachments?: { kind: 'image' | 'pdf' | 'material'; id: string }[];
  /** Set by caller when the student is working in Arabic UI. */
  locale?: 'en' | 'ar';
}

export type PreRoute =
  | { kind: 'canned'; ruleId: string; reply: string }
  | { kind: 'tool'; ruleId: string; tool: string; args: Record<string, unknown> }
  | { kind: 'model'; ruleId: string; task: TaskType };

interface Rule {
  id: string;
  test: (input: GatewayInput, text: string) => boolean;
  route: (input: GatewayInput) => PreRoute;
}

const ARABIC = /[\u0600-\u06FF]/g;
export function arabicRatio(text: string): number {
  const letters = text.replace(/[\s\d\p{P}]/gu, '');
  if (!letters.length) return 0;
  return (text.match(ARABIC) ?? []).length / letters.length;
}

const OPPORTUNITY = /\b(opportunit(y|ies)|competitions?|internships?|scholarships?|olympiads?|hackathons?|summer (program|programme|school)s?|volunteer(ing)?|mun|model un)\b/i;

export const PRE_ROUTER_RULES: Rule[] = [
  {
    id: 'R-EMPTY',
    test: (_i, t) => t.length === 0,
    route: () => ({ kind: 'canned', ruleId: 'R-EMPTY', reply: 'What would you like to work on?' }),
  },
  {
    id: 'R-GREETING',
    test: (_i, t) => /^(hi|hey|hello|salam|salaam|assalamu alaikum|good (morning|afternoon|evening)|مرحبا|السلام عليكم|أهلا|اهلا)[!. ]*$/i.test(t),
    route: (i) => ({
      kind: 'canned',
      ruleId: 'R-GREETING',
      reply: i.locale === 'ar' || arabicRatio(i.text) > 0.5 ? 'أهلاً! على ماذا تريد أن نعمل اليوم؟' : 'Hi! What are we working on today?',
    }),
  },
  {
    id: 'R-THANKS',
    test: (_i, t) => /^(thanks|thank you|thx|ty|شكرا|شكراً)[!. ]*$/i.test(t),
    route: () => ({ kind: 'canned', ruleId: 'R-THANKS', reply: "You're welcome. Good luck!" }),
  },
  {
    id: 'R-OCR',
    test: (i) => (i.attachments ?? []).some((a) => a.kind === 'image'),
    route: () => ({ kind: 'model', ruleId: 'R-OCR', task: 'ocr' }),
  },
  {
    id: 'R-WHATS-DUE',
    test: (_i, t) => /\b(what'?s|what is) (due|coming up)\b|\b(my|upcoming) deadlines\b|\bdue (today|tomorrow|this week)\b/i.test(t),
    route: () => ({ kind: 'tool', ruleId: 'R-WHATS-DUE', tool: 'connectors.list_upcoming', args: { days: 7 } }),
  },
  {
    id: 'R-REMIND',
    test: (_i, t) => /^remind me\b/i.test(t) || /^ذكرني/.test(t),
    // AI-LATER: parse time/date with the router model; for now the notify tool asks a follow-up.
    route: (i) => ({ kind: 'tool', ruleId: 'R-REMIND', tool: 'notify.create_reminder', args: { text: i.text } }),
  },
  {
    id: 'R-OPPORTUNITY-SEARCH',
    test: (_i, t) => OPPORTUNITY.test(t) && /\b(find|show|search|any|list|look for|recommend)\b/i.test(t),
    route: (i) => ({ kind: 'tool', ruleId: 'R-OPPORTUNITY-SEARCH', tool: 'opportunities.search', args: { query: i.text } }),
  },
  {
    id: 'R-NOTES',
    test: (i, t) =>
      (i.attachments ?? []).some((a) => a.kind === 'material' || a.kind === 'pdf') ||
      /\b(summari[sz]e|quiz me( on)?|flashcards?|key points)\b.*\b(notes?|chapter|lesson|slides|reading)\b/i.test(t),
    route: () => ({ kind: 'model', ruleId: 'R-NOTES', task: 'notes_reading' }),
  },
  {
    id: 'R-CV-ESSAY',
    test: (_i, t) => /\b(cv|resume|résumé|personal statement|cover letter|essay|statement of purpose|common app)\b/i.test(t),
    route: () => ({ kind: 'model', ruleId: 'R-CV-ESSAY', task: 'cv_essay' }),
  },
  {
    id: 'R-PLANNING',
    test: (_i, t) => /\b(plan|schedule|timetable|study plan|revision plan|organi[sz]e my|prioriti[sz]e|break (it|this) down)\b/i.test(t),
    route: () => ({ kind: 'model', ruleId: 'R-PLANNING', task: 'planning' }),
  },
  {
    id: 'R-ARABIC',
    test: (i, t) => i.locale === 'ar' || arabicRatio(t) > 0.4,
    route: () => ({ kind: 'model', ruleId: 'R-ARABIC', task: 'arabic' }),
  },
];

export function preRoute(input: GatewayInput, rules: Rule[] = PRE_ROUTER_RULES): PreRoute {
  const text = input.text.trim();
  for (const r of rules) if (r.test(input, text)) return r.route(input);
  return { kind: 'model', ruleId: 'R-DEFAULT', task: 'chat' };
}
