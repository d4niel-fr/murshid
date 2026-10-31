/**
 * Mock rule-based intent parser for chat (no live AI). Mirrors what POST /chat does server-side:
 * message → { area, range, chart type, compare } → reply text + tool calls.
 */
import type { MockWorld } from './mock/data';
import { buildChartSpec, findActivity, findSubject, RANGE_LABEL, type Locale } from './progress';
import type { ChartRange, ChartType, ChatReply } from './types';

export type Intent =
  | { kind: 'chart'; area: string; range: ChartRange; type?: ChartType; compare?: string[] }
  | { kind: 'tasks' }
  | { kind: 'opportunities'; topic?: string }
  | { kind: 'greeting' }
  | { kind: 'help' };

const SUBJECT_WORDS: Array<[RegExp, string]> = [
  [/\bmath(s|ematics)?\b|رياضيات/, 'maths'],
  [/\bphysics\b|فيزياء/, 'physics'],
  [/\bchem(istry)?\b|كيمياء/, 'chemistry'],
  [/\bbio(logy)?\b|أحياء/, 'biology'],
  [/\benglish\b|إنجليزي|الانجليزية|الإنجليزية/, 'english'],
  [/\barabic\b|عربي|العربية/, 'arabic'],
  [/\bscience\b|علوم/, 'science'],
  [/\b(cs|computer science|computing)\b|حاسوب|حاسب/, 'cs'],
  [/\becon(omics)?\b|اقتصاد/, 'economics'],
];

const AREA_WORDS: Array<[RegExp, string]> = [
  [/\bgym\b|\bworkout|\blift(ing)?\b|\bstrength\b|\bbench\b|جيم|النادي الرياضي|تمارين القوة/, 'gym'],
  [/\bathletic|\brun(ning)?\b|\btrack\b|\bsprint|\b800m\b|\b5k\b|جري|ألعاب القوى|العاب القوى/, 'athletics'],
  [/\bhack(athon)?s?\b|هاكاثون/, 'hackathon'],
  [/\bswim(ming)?\b|سباحة/, 'swimming'],
  [/\bfootball\b|\bsoccer\b|كرة القدم/, 'football'],
  [/\bpiano\b|بيانو/, 'piano'],
  [/\bdebate\b|\bmun\b|مناظرة/, 'debate'],
  [/\bcoding\b|\brobotics\b|برمجة|روبوت/, 'coding'],
  [/\bclubs?\b|نادي|النوادي/, 'club'],
  [/\bgoals?\b|أهداف|هدف/, 'goals'],
  [/\bbalance\b|\bwhere (does )?my time go|\btime split\b|توازن|وقتي/, 'balance'],
  [/\bextracurricular|\bactivities\b|الأنشطة|أنشطة/, 'extracurriculars'],
  [/\bacademic|\bgrades?\b|\bmarks?\b|\bschool ?work\b|\bsubjects?\b|درجات|دراسة|المواد|علامات/, 'academics'],
];

export function parseRange(text: string, fallback: ChartRange): ChartRange {
  const t = text.toLowerCase();
  if (/\b(year|annual|12 months|all time)\b|سنة|العام|عام/.test(t)) return 'year';
  if (/\bterm\b|\bsemester\b|فصل/.test(t)) return 'term';
  if (/\b(3|three) months\b|\b12 ?w(eeks)?\b|\bquarter\b|ثلاثة أشهر|١٢ أسبوع|12 أسبوع/.test(t)) return '12w';
  if (/\b(month|4 ?w(eeks)?|four weeks|30 days|recent(ly)?|lately)\b|شهر|٤ أسابيع|4 أسابيع/.test(t)) return '4w';
  if (/\b(week|this week|7 days)\b|أسبوع/.test(t)) return '4w';
  return fallback;
}

export function parseChartType(text: string): ChartType | undefined {
  const t = text.toLowerCase();
  if (/\bstacked\b|مكدس/.test(t)) return 'stacked-bar';
  if (/\bpie\b|\bdonut\b|دائري/.test(t)) return 'pie';
  if (/\bradial\b|\bring\b/.test(t)) return 'radial';
  if (/\barea\b/.test(t)) return 'area';
  if (/\bbar\b|\bcolumns?\b|أعمدة/.test(t)) return 'bar';
  if (/\bline\b|\btrend\b|خطي|اتجاه/.test(t)) return 'line';
  return undefined;
}

export function parseIntent(message: string, defaultRange: ChartRange = '12w'): Intent {
  const t = message.toLowerCase().trim();
  if (!t) return { kind: 'help' };

  const subjects = SUBJECT_WORDS.filter(([re]) => re.test(t)).map(([, id]) => id);
  const range = parseRange(t, defaultRange);
  const type = parseChartType(t);
  const wantsCompare = /\bcompare\b|\bvs\.?\b|\bversus\b|\band\b|قارن|مقابل|و/.test(t);

  if (subjects.length >= 2 && wantsCompare) return { kind: 'chart', area: 'academics', range, type, compare: subjects };

  if (/\b(tasks?|to-?do|today'?s plan|what should i do|what'?s next|due today|my day)\b|مهام|مهامي|ماذا أفعل/.test(t)) return { kind: 'tasks' };
  if (/\b(opportunit(y|ies)|competitions?|olympiads?|internships?|summer (program|school)s?|scholarships?|volunteer(ing)?)\b|فرص|فرصة|مسابق|منح|تدريب صيفي/.test(t)) {
    const topic = AREA_WORDS.find(([re]) => re.test(t))?.[1] ?? subjects[0];
    return { kind: 'opportunities', topic };
  }

  const area = AREA_WORDS.find(([re]) => re.test(t))?.[1];
  if (area && area !== 'academics') return { kind: 'chart', area, range, type };
  if (subjects.length === 1) return { kind: 'chart', area: subjects[0]!, range, type };
  if (area === 'academics') return { kind: 'chart', area, range, type };
  if (/\b(progress|how am i doing|chart|graph|stats|show me)\b|تقدم|تقدمي|رسم/.test(t)) return { kind: 'chart', area: 'academics', range, type };

  if (/^(hi|hey|hello|salam|salaam|good (morning|afternoon|evening))\b|مرحبا|السلام|أهلا|اهلا/.test(t)) return { kind: 'greeting' };
  return { kind: 'help' };
}

const L = (locale: Locale, en: string, ar: string) => (locale === 'ar' ? ar : en);

/** Full mock agent turn: intent → text + tool calls (render_chart / show_tasks / show_opportunities). */
export function mockChatReply(message: string, world: MockWorld, opts: { locale?: Locale; defaultRange?: ChartRange } = {}): ChatReply {
  const locale = opts.locale ?? 'en';
  const intent = parseIntent(message, opts.defaultRange ?? '12w');
  const name = world.dashboard.student.firstName;

  switch (intent.kind) {
    case 'chart': {
      const spec = buildChartSpec(world, { area: intent.area, range: intent.range, type: intent.type, compare: intent.compare, locale });
      const r = RANGE_LABEL[intent.range];
      const act = findActivity(world, intent.area);
      const subj = findSubject(world, intent.area);
      const cmp = intent.compare?.map((c) => findSubject(world, c)?.name).filter(Boolean) as string[] | undefined;
      let lead: string;
      if (cmp && cmp.length >= 2) lead = L(locale, `Here's ${cmp.join(' vs ')} over the ${r.en}.`, `إليك ${cmp.join(' مقابل ')} خلال ${r.ar}.`);
      else if (act) lead = L(locale, `Here's your ${act.name.toLowerCase()} progress over the ${r.en}.`, `إليك تقدمك في ${act.name} خلال ${r.ar}.`);
      else if (subj) lead = L(locale, `Here's your ${subj.name} trend over the ${r.en}.`, `إليك اتجاه ${subj.name} خلال ${r.ar}.`);
      else if (['academics', 'goals', 'balance', 'extracurriculars', 'club'].includes(intent.area)) lead = L(locale, `Here's ${spec.title.toLowerCase()} for the ${r.en}.`, `إليك ${spec.title} خلال ${r.ar}.`);
      else lead = L(locale, `I don't see ${intent.area} in your logged activities yet, so here's how your time splits across what you do log.`, `لا أرى ${intent.area} في أنشطتك المسجلة بعد، لذلك إليك توزيع وقتك على ما تسجله.`);
      const next = act
        ? L(locale, 'Log today\'s session and the chart updates straight away.', 'سجّل جلسة اليوم وسيتحدث الرسم فوراً.')
        : subj || cmp
          ? L(locale, 'Want a short revision plan for this week?', 'هل تريد خطة مراجعة قصيرة لهذا الأسبوع؟')
          : '';
      // `query` is a web-only extra (not in the ChartSpec contract) so the inline card can re-range itself.
      const query = { area: intent.area, range: intent.range, type: intent.type, compare: intent.compare };
      return { text: next ? `${lead} ${next}` : lead, toolCalls: [{ name: 'render_chart', args: { ...spec, query } as unknown as Record<string, unknown> }] };
    }
    case 'tasks': {
      const open = world.dashboard.today.filter((t) => !t.done);
      return {
        text: L(locale, `You have ${open.length} thing${open.length === 1 ? '' : 's'} left today. Start with the one that has a time on it.`, `لديك ${open.length} مهام متبقية اليوم. ابدأ بالمهمة المحددة بوقت.`),
        toolCalls: [{ name: 'show_tasks', args: { tasks: world.dashboard.today } }],
      };
    }
    case 'opportunities': {
      const topic = intent.topic;
      const list = world.opportunities.filter((o) => !topic || o.tags.some((tg) => tg.includes(topic)) || o.kind.includes(topic));
      const items = (list.length ? list : world.opportunities).slice(0, 4);
      return {
        text: L(locale, `These ${items.length} match your profile best right now, sorted by fit.`, `هذه ${items.length} فرص هي الأنسب لملفك الآن، مرتبة حسب الملاءمة.`),
        toolCalls: [{ name: 'show_opportunities', args: { opportunities: items } }],
      };
    }
    case 'greeting':
      return { text: L(locale, `Hi ${name}! Ask me about your progress, like "How's my gym progress?" or "Compare my maths and physics".`, `أهلاً ${world.dashboard.student.nameAr}! اسألني عن تقدمك، مثل "كيف تقدمي في الجيم؟" أو "قارن الرياضيات والفيزياء".`), toolCalls: [] };
    default:
      return {
        text: L(locale,
          'I can chart your progress (gym, athletics, hackathons, any subject), compare subjects, show today\'s tasks, or find opportunities. Try "Show my hackathon progress this year".',
          'أستطيع رسم تقدمك (الجيم، ألعاب القوى، الهاكاثونات، أي مادة)، ومقارنة المواد، وعرض مهام اليوم، وإيجاد الفرص. جرّب "اعرض تقدمي في الهاكاثون هذا العام".'),
        toolCalls: [],
      };
  }
}
