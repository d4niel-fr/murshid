/**
 * Academic-integrity rule set.
 *
 * Murshid is a coach, not a ghostwriter. Each task carries ai_use_level
 * (set by the teacher/school policy or the student, aligned with ADEK's AI
 * guidance for schools):
 *   none    - no AI help on the work itself. Only logistics (planning time,
 *             reminders, breaking into steps) are allowed.
 *   support - AI may explain concepts, give feedback, ask questions, suggest
 *             structure. It must not produce the submitted work.
 *   led     - AI may draft with the student; usage is logged and the student
 *             is reminded to declare AI use.
 *
 * This is rule/keyword based for now.  // AI-LATER: replace `KeywordIntegrityClassifier`
 * with a model-based classifier behind the same `IntegrityClassifier` interface.
 */
import type { AiUseLevel } from './types.js';

export type RequestIntent =
  | 'ghostwrite' // produce the final assessed artefact
  | 'solve_assessed' // give answers to graded questions/test
  | 'paraphrase_evade' // rewrite to avoid plagiarism detection
  | 'generate_content' // draft content (not necessarily final)
  | 'feedback' // review my work, give feedback
  | 'explain' // explain concept
  | 'logistics'; // plan, schedule, remind, break down

export interface IntegrityClassifier {
  classify(text: string): { intents: RequestIntent[]; matchedRules: string[] };
}

interface Rule {
  id: string;
  intent: RequestIntent;
  patterns: RegExp[];
}

const ASSESSED = '(essay|assignment|coursework|homework|assessment|report|project|ia|ee|extended essay|tok essay|lab report|paper|thesis|personal statement|sop|statement of purpose|answers?)';

export const INTEGRITY_RULES: Rule[] = [
  {
    id: 'GW-1',
    intent: 'ghostwrite',
    patterns: [
      new RegExp(`\\b(write|do|finish|complete|make)\\s+(my|the|this|our)\\s+(whole\\s+|entire\\s+|full\\s+|final\\s+|graded\\s+|assessed\\s+)*${ASSESSED}\\b`, 'i'),
      new RegExp(`\\b(write|do)\\s+(it|this)\\s+for\\s+me\\b`, 'i'),
      new RegExp(`\\b${ASSESSED}\\s+for\\s+me\\b`, 'i'),
      new RegExp(`\\bwrite\\s+(a|an)\\s+\\d{3,5}[-\\s]?words?\\b`, 'i'),
      new RegExp(`\\b(ready|good)\\s+to\\s+submit\\b`, 'i'),
      // Arabic: "اكتب لي مقال/بحث/واجب" , "حل الواجب"
      /اكتب\s*(لي|عني)?\s*(ال)?(مقال|مقالة|بحث|واجب|تقرير|موضوع\s*تعبير)/,
      /(حل|سوّ|سو)\s*(لي)?\s*(ال)?واجب/,
    ],
  },
  {
    id: 'SA-1',
    intent: 'solve_assessed',
    patterns: [
      /\b(give|tell|send)\s+me\s+(the\s+)?answers?\b/i,
      /\b(answers?|solutions?)\s+(to|for)\s+(my|the|this)\s+(test|exam|quiz|worksheet|homework|assignment|past paper)\b/i,
      /\b(solve|do)\s+(all\s+)?(these|the|my)\s+(questions|problems)\b.*\b(graded|assessed|homework|test|quiz)\b/i,
      /\bduring\s+(the|my)\s+(test|exam|quiz)\b/i,
    ],
  },
  {
    id: 'PE-1',
    intent: 'paraphrase_evade',
    patterns: [
      /\b(avoid|bypass|beat|pass)\s+(turnitin|plagiarism|ai\s*detect(or|ion)?|gptzero)\b/i,
      /\b(make|sound)\s+(it|this)\s+(sound\s+)?(human|less\s+ai|not\s+ai)\b/i,
      /\bhumani[sz]e\b/i,
      /\b(reword|paraphrase|rephrase|spin)\b.*\b(so|to)\b.*\b(not|isn'?t|won'?t)\b.*\b(detect|caught|flag)/i,
    ],
  },
  {
    id: 'GC-1',
    intent: 'generate_content',
    patterns: [
      /\b(write|draft|generate|compose|create)\b.*\b(intro(duction)?|conclusion|paragraph|essay|outline|thesis statement|poem|story|report|summary)\b/i,
      /\b(rewrite|improve|polish)\s+(my|this)\b/i,
    ],
  },
  {
    id: 'FB-1',
    intent: 'feedback',
    patterns: [/\b(feedback|review|check|critique|mark|grade)\b.*\b(my|this)\b/i, /\bwhat\s+can\s+i\s+improve\b/i],
  },
  {
    id: 'EX-1',
    intent: 'explain',
    patterns: [/\b(explain|what\s+is|what\s+are|how\s+does|why\s+does|help\s+me\s+understand|teach\s+me)\b/i, /اشرح/],
  },
  {
    id: 'LG-1',
    intent: 'logistics',
    patterns: [/\b(plan|schedule|remind|deadline|break\s+(it|this)\s+down|timetable|when\s+should\s+i|how\s+long)\b/i],
  },
];

export class KeywordIntegrityClassifier implements IntegrityClassifier {
  constructor(private rules: Rule[] = INTEGRITY_RULES) {}
  classify(text: string) {
    const intents = new Set<RequestIntent>();
    const matchedRules: string[] = [];
    for (const r of this.rules) {
      if (r.patterns.some((p) => p.test(text))) {
        intents.add(r.intent);
        matchedRules.push(r.id);
      }
    }
    return { intents: [...intents], matchedRules };
  }
}

export type IntegrityDecision = 'allow' | 'allow_with_guidance' | 'block';

export interface IntegrityResult {
  decision: IntegrityDecision;
  intents: RequestIntent[];
  matchedRules: string[];
  /** Coach-style message to show the student when not a plain allow. */
  coachMessage?: string;
  /** Student should declare AI use on submission. */
  declareAiUse: boolean;
}

const ALWAYS_BLOCK: RequestIntent[] = ['paraphrase_evade', 'solve_assessed'];

const MSG = {
  noneBlock:
    "This task is marked 'no AI'. I can't help with the work itself, but I can help you plan your time, break it into steps, or set reminders. Want a plan?",
  ghostwrite:
    "I won't write assessed work for you, but I can help you get there: let's outline your ideas together, or I can give feedback on a draft you write.",
  evade: "I can't help with getting around plagiarism or AI checks. I'm happy to help you write it in your own words from scratch.",
  answers: "I can't give answers to graded work. I can explain the topic or walk through a similar practice example.",
  led: 'AI-led is allowed on this task. Remember to declare AI use the way your teacher asks.',
  supportGenerate: "On 'AI support' tasks I'll suggest structure and questions rather than writing the text. Let's start with your main point.",
} as const;

/** Decide whether a request is allowed for a task's ai_use_level. */
export function evaluateIntegrity(
  text: string,
  level: AiUseLevel,
  classifier: IntegrityClassifier = new KeywordIntegrityClassifier(),
): IntegrityResult {
  const { intents, matchedRules } = classifier.classify(text);
  const has = (i: RequestIntent) => intents.includes(i);
  const base = { intents, matchedRules };

  if (has('paraphrase_evade')) return { ...base, decision: 'block', coachMessage: MSG.evade, declareAiUse: false };
  if (has('solve_assessed')) return { ...base, decision: 'block', coachMessage: MSG.answers, declareAiUse: false };

  if (level === 'none') {
    const onlyLogistics = intents.length > 0 && intents.every((i) => i === 'logistics');
    if (onlyLogistics) return { ...base, decision: 'allow', declareAiUse: false };
    return { ...base, decision: 'block', coachMessage: MSG.noneBlock, declareAiUse: false };
  }

  if (level === 'support') {
    if (has('ghostwrite')) return { ...base, decision: 'block', coachMessage: MSG.ghostwrite, declareAiUse: false };
    if (has('generate_content')) return { ...base, decision: 'allow_with_guidance', coachMessage: MSG.supportGenerate, declareAiUse: true };
    return { ...base, decision: 'allow', declareAiUse: intents.some((i) => i === 'feedback' || i === 'explain') };
  }

  // led
  if (has('ghostwrite') || has('generate_content')) {
    return { ...base, decision: 'allow_with_guidance', coachMessage: MSG.led, declareAiUse: true };
  }
  return { ...base, decision: 'allow', declareAiUse: true };
}

export { ALWAYS_BLOCK };
