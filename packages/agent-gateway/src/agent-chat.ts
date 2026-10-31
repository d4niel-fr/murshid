/**
 * v1 chat agent (docs/V1-WEB-CONTRACT.md: POST /chat).
 *
 * `AgentChat` speaks the OpenAI tool-calling shape to any `ChatProvider`. Today the provider is
 * `RuleChatProvider`, a deterministic rule-based intent parser (English + simple Arabic) that never
 * calls a model. A real model replaces it later by passing a different provider: the tools, the
 * system prompt and the parsing of `tool_calls` stay the same.
 *
 * Tools the agent can call (the API resolves them into data the UI renders):
 *   render_chart       { area: string, areas?: string[], range: '4w'|'12w'|'term'|'year', compare?: boolean }
 *   show_tasks         { scope: 'today'|'week'|'overdue'|'upcoming' }
 *   show_opportunities { type?: string, limit?: number }
 */
import { estimateTokens } from './pricing.js';
import type { ChatCompletionRequest, ChatCompletionResponse, ChatMessage, ChatProvider, OpenAITool } from './provider.js';

export type ChatIntent = 'progress' | 'compare' | 'upcoming' | 'tasks' | 'opportunities' | 'greeting' | 'help' | 'unknown';
export type ChatRange = '4w' | '12w' | 'term' | 'year';
export type ChatLang = 'en' | 'ar';

/** A chartable area the student has, with words that refer to it (any language). */
export interface AreaVocab { id: string; label: string; labelAr?: string; aliases: string[] }

export interface ParsedIntent {
  intent: ChatIntent;
  lang: ChatLang;
  areas: string[];
  range: ChatRange;
  rangeExplicit: boolean;
  opportunityType?: string;
  taskScope?: 'today' | 'week' | 'overdue';
}

export interface AgentToolCall { name: 'render_chart' | 'show_tasks' | 'show_opportunities'; args: Record<string, unknown> }
export interface AgentTurn { text: string; toolCalls: AgentToolCall[]; intent: ChatIntent; lang: ChatLang; provider: string; model: string }

const AR = /[\u0600-\u06FF]/;

/** Built-in vocabulary; the caller adds the student's own subjects/goals/activities. */
export const DEFAULT_AREAS: AreaVocab[] = [
  { id: 'athletics', label: 'Athletics', labelAr: 'ألعاب القوى', aliases: ['athletics', 'running', 'run', 'sprint', 'sprints', 'track', '100m', 'ألعاب القوى', 'العاب القوى', 'الجري', 'جري', 'العدو'] },
  { id: 'gym', label: 'Gym', labelAr: 'النادي الرياضي', aliases: ['gym', 'workout', 'workouts', 'lifting', 'weights', 'strength', 'النادي', 'الجيم', 'جيم', 'تمارين', 'التمارين'] },
  { id: 'hackathon', label: 'Hackathons', labelAr: 'الهاكاثونات', aliases: ['hackathon', 'hackathons', 'hack', 'هاكاثون', 'الهاكاثون', 'هاكاثونات'] },
  { id: 'robotics', label: 'Robotics', labelAr: 'الروبوتات', aliases: ['robotics', 'robot', 'robots', 'الروبوت', 'روبوت', 'الروبوتات'] },
  { id: 'music', label: 'Music', labelAr: 'الموسيقى', aliases: ['music', 'piano', 'guitar', 'violin', 'practice music', 'الموسيقى', 'موسيقى', 'البيانو'] },
  { id: 'academics', label: 'Academics', labelAr: 'الدراسة', aliases: ['academics', 'academic', 'grades', 'marks', 'school', 'studies', 'all subjects', 'subjects', 'الدرجات', 'درجاتي', 'الدراسة', 'المواد', 'علاماتي'] },
  { id: 'extracurriculars', label: 'Activities', labelAr: 'الأنشطة', aliases: ['extracurriculars', 'extracurricular', 'activities', 'clubs', 'الأنشطة', 'الانشطة', 'نشاطاتي'] },
  { id: 'goals', label: 'Goals', labelAr: 'الأهداف', aliases: ['goals', 'my goals', 'أهدافي', 'الأهداف', 'اهدافي'] },
];

const RANGE_RULES: { range: ChatRange; re: RegExp }[] = [
  { range: '4w', re: /\b(4|four)\s*weeks?\b|\b(this|last|past)\s+month\b|\bmonthly\b|4\s*أسابيع|أربعة أسابيع|اربعة اسابيع|هذا الشهر|الشهر الماضي/i },
  { range: '12w', re: /\b(12|twelve)\s*weeks?\b|\b(3|three)\s*months?\b|\bquarter\b|12\s*أسبوع|ثلاثة أشهر|3\s*أشهر/i },
  { range: 'term', re: /\b(this|the|current|last)\s+(term|semester)\b|\bterm\b|\bsemester\b|هذا الفصل|الفصل الدراسي|الفصل/i },
  { range: 'year', re: /\b(this|the|last|past|whole)\s+year\b|\byearly\b|\b12\s*months\b|\bannual\b|هذه السنة|هذا العام|السنة|العام/i },
];

const INTENT_RULES: { intent: ChatIntent; re: RegExp }[] = [
  { intent: 'compare', re: /\bcompare\b|\bcomparison\b|\bvs\.?\b|\bversus\b|\bcompared\b|قارن|مقارنة|قارني/i },
  { intent: 'opportunities', re: /\bopportunit\w*|\bcompetitions?\b|\binternships?\b|\bscholarships?\b|\bolympiads?\b|\bsummer (camp|program\w*)\b|\bevents? to (join|apply)\b|فرص|فرصة|مسابقات|مسابقة|منح|منحة|تدريب صيفي|برامج صيفية/i },
  { intent: 'upcoming', re: /\bupcoming\b|\bcoming up\b|\bnext (week|few days)\b|\bdeadlines?\b|\bexams?\b|\btests?\b|\bschedule\b|\bwhat'?s next\b|القادم|القادمة|المواعيد|موعد|امتحانات|امتحان|اختبارات|الأسبوع القادم/i },
  { intent: 'tasks', re: /\btasks?\b|\bto-?dos?\b|\bhomework\b|\bwhat should i do\b|\bwhat do i (have|need)\b|\btoday\b|\bplan for\b|مهام|مهامي|واجبات|واجباتي|اليوم|ماذا أفعل/i },
  { intent: 'progress', re: /\bprogress\b|\bimprov\w*|\bhow am i doing\b|\bhow (is|are|did)\b.*\bgoing\b|\btrend\b|\bchart\b|\bgraph\b|\bshow me\b|\bstats?\b|\bdoing in\b|\bperformance\b|تقدم|تقدمي|تطور|أدائي|ادائي|رسم بياني|مستواي|كيف حالي في/i },
  { intent: 'greeting', re: /^\s*(hi|hello|hey|salam|salaam|marhaba|good (morning|afternoon|evening))\b|^\s*(مرحبا|السلام عليكم|أهلا|اهلا|صباح الخير|مساء الخير)/i },
  { intent: 'help', re: /\bhelp\b|\bwhat can you do\b|ماذا تستطيع|مساعدة|ساعدني/i },
];

const OPP_TYPES: { type: string; re: RegExp }[] = [
  { type: 'competition', re: /competitions?|مسابق/i },
  { type: 'internship', re: /internships?|تدريب/i },
  { type: 'scholarship', re: /scholarships?|منح/i },
  { type: 'summer_program', re: /summer|صيفي/i },
  { type: 'olympiad', re: /olympiads?|أولمبياد|اولمبياد/i },
  { type: 'hackathon', re: /hackathons?|هاكاثون/i },
  { type: 'volunteering', re: /volunteer\w*|تطوع/i },
  { type: 'mun', re: /\bmun\b|model un|نموذج الأمم/i },
];

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Whole-word match for Latin aliases; substring match for Arabic (prefixes like و/بـ/الـ attach). */
function mentions(text: string, alias: string): number {
  const a = alias.trim().toLowerCase();
  if (!a) return -1;
  if (AR.test(a)) return text.indexOf(a);
  const m = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(a)}(?=$|[^\\p{L}\\p{N}])`, 'iu').exec(text);
  return m ? m.index + m[1]!.length : -1;
}

/** Deterministic intent parser used by the rule provider (and handy for tests / analytics). */
export function parseIntent(message: string, vocab: AreaVocab[] = DEFAULT_AREAS): ParsedIntent {
  const text = message.toLowerCase().normalize('NFC');
  const lang: ChatLang = AR.test(text) ? 'ar' : 'en';

  // areas, in order of first mention; longer aliases win ties ("further maths" over "maths")
  const found: { id: string; at: number; len: number }[] = [];
  for (const v of vocab) {
    let best: { at: number; len: number } | null = null;
    for (const alias of [v.id, v.label, ...v.aliases]) {
      const at = mentions(text, alias);
      if (at >= 0 && (!best || alias.length > best.len)) best = { at, len: alias.length };
    }
    if (best) found.push({ id: v.id, ...best });
  }
  // drop areas whose matched alias sits inside a longer match (e.g. "maths" inside "further maths")
  const areas = found
    .filter((f) => !found.some((g) => g !== f && g.len > f.len && f.at >= g.at && f.at + f.len <= g.at + g.len))
    .sort((a, b) => a.at - b.at)
    .map((f) => f.id)
    .filter((id, i, arr) => arr.indexOf(id) === i);

  const rangeHit = RANGE_RULES.find((r) => r.re.test(text));
  const range: ChatRange = rangeHit?.range ?? '4w';

  let intent: ChatIntent = INTENT_RULES.find((r) => r.re.test(text))?.intent ?? 'unknown';
  if (intent === 'compare' && areas.length < 2 && !areas.includes('extracurriculars') && !areas.includes('academics')) {
    intent = areas.length ? 'progress' : 'compare';
  }
  if (intent !== 'compare' && areas.length >= 2 && /\band\b|\bwith\b|\bor\b| و/.test(text) && /progress|how|chart|show|تقدم|رسم|أداء/.test(text)) {
    intent = 'compare';
  }
  // an area mentioned with no other cue ("gym this term", "الرياضيات") is a progress question
  if ((intent === 'unknown' || intent === 'greeting') && areas.length) intent = areas.length >= 2 ? 'compare' : 'progress';
  if (intent === 'upcoming' && /\btoday\b|اليوم/.test(text) && !/\bdeadline|exam|test|امتحان|اختبار/.test(text)) intent = 'tasks';

  const out: ParsedIntent = { intent, lang, areas, range, rangeExplicit: Boolean(rangeHit) };
  if (intent === 'opportunities') {
    const t = OPP_TYPES.find((o) => o.re.test(text));
    if (t) out.opportunityType = t.type;
  }
  if (intent === 'tasks') {
    out.taskScope = /\boverdue\b|\blate\b|متأخر/.test(text) ? 'overdue' : /\bweek\b|الأسبوع/.test(text) ? 'week' : 'today';
  }
  return out;
}

/** OpenAI-format tool definitions for the v1 chat tools (a real model gets exactly these). */
export const V1_CHAT_TOOLS: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'render_chart',
      description: "Render a progress chart of one area (or compare several) over a time range. Areas: athletics, gym, hackathon, robotics, music, academics, extracurriculars, goals, a subject id or a goal id.",
      parameters: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          areas: { type: 'array', items: { type: 'string' }, description: 'two or more areas to compare' },
          range: { type: 'string', enum: ['4w', '12w', 'term', 'year'] },
        },
        required: ['area', 'range'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_tasks',
      description: "Show the student's tasks (today, the next 7 days, overdue) or upcoming assessments, deadlines and events.",
      parameters: { type: 'object', properties: { scope: { type: 'string', enum: ['today', 'week', 'overdue', 'upcoming'] } }, required: ['scope'] },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_opportunities',
      description: 'Show matching opportunities (competitions, programmes, scholarships, hackathons…).',
      parameters: { type: 'object', properties: { type: { type: 'string' }, limit: { type: 'number' } } },
    },
  },
];

const AREAS_HEADER = 'Student areas (id | label | aliases):';

/** System prompt for the chat agent; carries the student's own areas so the model (or rules) can name them. */
export function buildChatSystemPrompt(opts: { studentName: string; lang?: ChatLang; areas: AreaVocab[] }): string {
  return [
    `You are Murshid, a calm study companion for ${opts.studentName}, a UAE school student.`,
    'Answer briefly and kindly. Use tools to show charts, tasks or opportunities instead of describing data in prose.',
    'Always write one or two short sentences of reply text, even when you call a tool. Only call a tool when it directly helps; for advice or wellbeing questions, answer in words first.',
    `Reply in ${opts.lang === 'ar' ? 'Arabic' : "the student's language"}.`,
    AREAS_HEADER,
    ...opts.areas.map((a) => `- ${a.id} | ${a.label}${a.labelAr ? ` / ${a.labelAr}` : ''} | ${a.aliases.join(', ')}`),
  ].join('\n');
}

function areasFromSystem(messages: ChatMessage[]): AreaVocab[] | null {
  const sys = messages.find((m) => m.role === 'system' && m.content.includes(AREAS_HEADER));
  if (!sys) return null;
  const lines = sys.content.split('\n').slice(sys.content.split('\n').indexOf(AREAS_HEADER) + 1);
  return lines
    .filter((l) => l.startsWith('- '))
    .map((l) => {
      const [id = '', labels = '', aliases = ''] = l.slice(2).split(' | ');
      const [label = '', labelAr] = labels.split(' / ');
      return {
        id: id.trim(), label: label.trim(), ...(labelAr ? { labelAr: labelAr.trim() } : {}),
        aliases: aliases.split(',').map((s) => s.trim()).filter(Boolean),
      };
    })
    .filter((a) => a.id);
}

const RANGE_WORDS: Record<ChatLang, Record<ChatRange, string>> = {
  en: { '4w': 'the last 4 weeks', '12w': 'the last 12 weeks', term: 'this term', year: 'the past year' },
  ar: { '4w': 'آخر 4 أسابيع', '12w': 'آخر 12 أسبوعًا', term: 'هذا الفصل', year: 'العام الماضي' },
};

/** Reply text + tool calls for a parsed intent (what the rule "model" says). */
export function ruleReply(p: ParsedIntent, vocab: AreaVocab[]): { text: string; toolCalls: AgentToolCall[] } {
  const ar = p.lang === 'ar';
  const name = (id: string) => { const v = vocab.find((x) => x.id === id); return (ar ? v?.labelAr : undefined) ?? v?.label ?? id; };
  const rw = RANGE_WORDS[p.lang][p.range];
  switch (p.intent) {
    case 'progress': {
      const area = p.areas[0] ?? 'academics';
      return {
        text: ar ? `هذا تقدمك في ${name(area)} خلال ${rw}.` : `Here's your ${name(area)} progress over ${rw}.`,
        toolCalls: [{ name: 'render_chart', args: { area, range: p.range } }],
      };
    }
    case 'compare': {
      const areas = p.areas.length >= 2 ? p.areas.slice(0, 4) : p.areas.includes('academics') ? ['academics'] : ['extracurriculars'];
      const label = areas.map(name).join(ar ? ' و' : ' vs ');
      return {
        text: ar ? `مقارنة ${label} خلال ${rw}.` : `Comparing ${label} over ${rw}.`,
        toolCalls: [{ name: 'render_chart', args: { area: areas[0], areas, range: p.range, compare: true } }],
      };
    }
    case 'upcoming':
      return {
        text: ar ? 'هذا ما ينتظرك قريبًا.' : "Here's what's coming up.",
        toolCalls: [{ name: 'show_tasks', args: { scope: 'upcoming' } }],
      };
    case 'tasks':
      return {
        text: ar ? 'هذه مهامك.' : p.taskScope === 'overdue' ? 'These need catching up on.' : p.taskScope === 'week' ? 'Your tasks for this week.' : "Here's your plan for today.",
        toolCalls: [{ name: 'show_tasks', args: { scope: p.taskScope ?? 'today' } }],
      };
    case 'opportunities':
      return {
        text: ar ? 'هذه بعض الفرص المناسبة لك.' : 'A few opportunities that fit you.',
        toolCalls: [{ name: 'show_opportunities', args: { ...(p.opportunityType ? { type: p.opportunityType } : {}), limit: 3 } }],
      };
    case 'greeting':
      return {
        text: ar ? 'أهلًا! اسألني عن تقدمك أو مهامك أو الفرص المتاحة.' : 'Hi! Ask me about your progress, your tasks, or opportunities.',
        toolCalls: [],
      };
    case 'help':
    case 'unknown':
    default:
      return {
        text: ar
          ? 'أستطيع عرض تقدمك (مثل: "تقدمي في الرياضيات هذا الفصل")، ومقارنة الأنشطة، ومهامك القادمة، والفرص.'
          : 'I can chart your progress ("How is my gym going this term?"), compare areas ("compare athletics and gym"), list what\'s coming up, your tasks, or opportunities.',
        toolCalls: [],
      };
  }
}

/**
 * Deterministic provider: parses the last user message and answers with OpenAI-style tool_calls.
 * Drop-in for a real `ChatProvider` (LiteLLM/OpenRouter) later.
 */
export class RuleChatProvider implements ChatProvider {
  readonly name = 'rules';
  private seq = 0;
  async chat(req: ChatCompletionRequest): Promise<ChatCompletionResponse> {
    const vocab = areasFromSystem(req.messages) ?? DEFAULT_AREAS;
    const lastUser = [...req.messages].reverse().find((m) => m.role === 'user')?.content ?? '';
    const parsed = parseIntent(lastUser, vocab);
    const { text, toolCalls } = ruleReply(parsed, vocab);
    const id = ++this.seq;
    const tool_calls = toolCalls.map((t, i) => ({
      id: `call_${id}_${i}`, type: 'function' as const, function: { name: t.name, arguments: JSON.stringify(t.args) },
    }));
    const prompt_tokens = req.messages.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);
    const completion_tokens = estimateTokens(text);
    return {
      id: `rules-${id}`, object: 'chat.completion', created: 0, model: req.model,
      choices: [{
        index: 0,
        message: { role: 'assistant', content: text, ...(tool_calls.length ? { tool_calls } : {}), name: `intent:${parsed.intent}:${parsed.lang}` },
        finish_reason: tool_calls.length ? 'tool_calls' : 'stop',
      }],
      usage: { prompt_tokens, completion_tokens, total_tokens: prompt_tokens + completion_tokens },
    };
  }
}

const TOOL_NAMES = new Set(['render_chart', 'show_tasks', 'show_opportunities']);

/** One chat turn through a provider (rules today, a model later). */
export class AgentChat {
  constructor(private opts: { provider?: ChatProvider; model?: string } = {}) {}

  get provider(): ChatProvider {
    return (this.opts.provider ??= new RuleChatProvider());
  }

  async turn(input: {
    message: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    studentName: string;
    studentKey?: string;
    areas?: AreaVocab[];
  }): Promise<AgentTurn> {
    const areas = [...DEFAULT_AREAS.filter((d) => !(input.areas ?? []).some((a) => a.id === d.id)), ...(input.areas ?? [])];
    const lang: ChatLang = AR.test(input.message) ? 'ar' : 'en';
    const model = this.opts.model ?? 'murshid-rules-v1';
    const res = await this.provider.chat({
      model,
      messages: [
        { role: 'system', content: buildChatSystemPrompt({ studentName: input.studentName, lang, areas }) },
        ...(input.history ?? []).slice(-10),
        { role: 'user', content: input.message },
      ],
      tools: V1_CHAT_TOOLS,
      tool_choice: 'auto',
      ...(input.studentKey ? { user: input.studentKey } : {}),
    });
    const msg = res.choices[0]?.message;
    const toolCalls: AgentToolCall[] = [];
    for (const tc of msg?.tool_calls ?? []) {
      if (!TOOL_NAMES.has(tc.function.name)) continue;
      let args: Record<string, unknown> = {};
      try {
        const parsed = JSON.parse(tc.function.arguments || '{}');
        if (parsed && typeof parsed === 'object') args = parsed as Record<string, unknown>;
      } catch {
        continue; // malformed model output: drop the call, keep the text
      }
      toolCalls.push({ name: tc.function.name as AgentToolCall['name'], args });
    }
    const tag = /^intent:(\w+):(en|ar)$/.exec(msg?.name ?? '');
    return {
      text: msg?.content ?? '',
      toolCalls,
      intent: (tag?.[1] as ChatIntent | undefined) ?? (toolCalls.length ? 'progress' : 'unknown'),
      lang: (tag?.[2] as ChatLang | undefined) ?? lang,
      provider: this.provider.name,
      model: res.model,
    };
  }
}
