/**
 * Murshid's specialist sub-agents: each has its own system prompt, its own tools and its own model preference from
 * the free OpenRouter chain. The orchestrator (orchestrator.ts) routes a request to one or more of them.
 *
 * Tools are declared here (OpenAI function schemas) and implemented by the host (apps/api), which owns the data.
 * Every read tool returns `{ summary: string, ... }`: the summary is what the rule-based fallback says when the
 * models are unavailable, so the fallback still answers from real data.
 */
import type { OpenAITool } from './provider.js';
import { FREE_MODEL, OPENROUTER_FREE_MODELS } from './provider.js';

export const SUB_AGENT_IDS = ['academics', 'sports', 'opportunities', 'career', 'planner', 'business', 'wellbeing', 'general'] as const;
export type SubAgentId = (typeof SUB_AGENT_IDS)[number];

export type ToolAccess = 'read' | 'write' | 'ui';
export interface ToolSpec { name: string; access: ToolAccess; description: string; parameters: Record<string, unknown> }

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'object', properties, ...(required.length ? { required } : {}) });
const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });

/** Every tool a sub-agent may use. The host implements them against the shared store. */
export const ORCHESTRATOR_TOOLS: Record<string, ToolSpec> = {
  get_student_overview: { name: 'get_student_overview', access: 'read', description: "The student's profile, goals with progress, today's tasks and headline numbers.", parameters: obj({}) },
  get_academics: { name: 'get_academics', access: 'read', description: 'Subjects with current %, target, 12-week trend, recent grades and upcoming assessments.', parameters: obj({}) },
  get_training: { name: 'get_training', access: 'read', description: 'Per sport/activity: weekly training load (8 weeks), acute:chronic ratio, personal bests, recent matches/races and upcoming fixtures.', parameters: obj({}) },
  get_tasks: { name: 'get_tasks', access: 'read', description: "The student's tasks incl. ones set by school staff (default: next 7 days + overdue).", parameters: obj({ scope: str('week (default) | today | overdue', { enum: ['today', 'week', 'overdue'] }) }) },
  get_upcoming: { name: 'get_upcoming', access: 'read', description: 'Assessments, deadlines and fixtures in the next N days.', parameters: obj({ days: { type: 'number', description: 'default 14' } }) },
  get_goals: { name: 'get_goals', access: 'read', description: 'Goals with start, current, target and progress %.', parameters: obj({}) },
  find_opportunities: { name: 'find_opportunities', access: 'read', description: 'Open opportunities matched to the student (competitions, programmes, internships…), incl. ones staff published.', parameters: obj({ type: str('optional opportunity type, e.g. competition, internship, summer_program, volunteering, olympiad, hackathon'), tag: str('optional interest tag') }) },
  get_applications: { name: 'get_applications', access: 'read', description: 'Opportunities the student applied to, with status and outcome.', parameters: obj({}) },
  get_side_projects: { name: 'get_side_projects', access: 'read', description: 'Side projects / businesses: monthly revenue, orders, customers, followers and milestones.', parameters: obj({}) },
  get_cv_profile: { name: 'get_cv_profile', access: 'read', description: 'CV fields (headline, skills, certifications, featured), achievements and social links.', parameters: obj({}) },
  get_wellbeing_signals: { name: 'get_wellbeing_signals', access: 'read', description: 'Workload signals: assessments in the next 14 days, training minutes vs usual, overdue tasks, study streak.', parameters: obj({}) },
  create_task: {
    name: 'create_task', access: 'write', description: "Add a task to the student's planner (visible to the student and staff).",
    parameters: obj({
      title: str('short task title'), date: str('YYYY-MM-DD, or today / tomorrow / a weekday name'), time: str('HH:MM 24h (Dubai), optional'),
      durationMinutes: { type: 'number' }, kind: str('study | assignment | activity | habit | application', { enum: ['study', 'assignment', 'activity', 'habit', 'application'] }),
    }, ['title', 'date']),
  },
  build_week_plan: {
    name: 'build_week_plan', access: 'write',
    description: 'Build and save a 7-day plan around school, assessments, training/fixtures and the side project. Returns the plan; items are saved as planner tasks.',
    parameters: obj({ focus: str('optional priorities, e.g. "physics mock on Thursday, protect sleep"'), startDate: str('YYYY-MM-DD; default today') }),
  },
  save_opportunity: { name: 'save_opportunity', access: 'write', description: "Save an opportunity to the student's applications (status 'saved') with a checklist task.", parameters: obj({ opportunityId: str('id from find_opportunities') }, ['opportunityId']) },
  add_project_milestone: { name: 'add_project_milestone', access: 'write', description: 'Add a planned milestone to a side project.', parameters: obj({ projectId: str('project id'), title: str('milestone'), date: str('YYYY-MM-DD target date') }, ['projectId', 'title']) },
  generate_linkedin_cv: {
    name: 'generate_linkedin_cv', access: 'write',
    description: 'Generate the LinkedIn profile pack (headline, About, experience, skills, featured) and the CV PDF from real data. You may pass your own headline (<=220 chars) and about (<=2600 chars).',
    parameters: obj({ headline: str('optional LinkedIn headline'), about: str('optional About section in first person') }),
  },
  render_chart: {
    name: 'render_chart', access: 'ui', description: 'Show a progress chart. area: academics, a subject id, an activity id (e.g. football, swimming), a goal id, a project id, extracurriculars or goals.',
    parameters: obj({ area: str('area id'), areas: { type: 'array', items: { type: 'string' } }, range: str('4w | 12w | term | year', { enum: ['4w', '12w', 'term', 'year'] }) }, ['area', 'range']),
  },
  show_tasks: { name: 'show_tasks', access: 'ui', description: 'Show a task list card.', parameters: obj({ scope: str('today | week | overdue | upcoming', { enum: ['today', 'week', 'overdue', 'upcoming'] }) }, ['scope']) },
  show_opportunities: { name: 'show_opportunities', access: 'ui', description: 'Show opportunity cards.', parameters: obj({ type: str('optional type'), limit: { type: 'number' } }) },
};

export function toolSpecsToOpenAI(names: string[]): OpenAITool[] {
  return names.map((n) => ORCHESTRATOR_TOOLS[n]).filter((t): t is ToolSpec => Boolean(t))
    .map((t) => ({ type: 'function' as const, function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

export interface SubAgentSpec {
  id: SubAgentId;
  /** internal name (traces, logs); never shown to students */
  name: string;
  /** neutral heading used when a reply merges several parts, e.g. "Your studies" */
  topic: string;
  description: string;
  systemPrompt: string;
  tools: string[];
  /** read tools run before the model call; their results go in the prompt (fewer model round-trips) */
  prefetch: string[];
  /** preferred free models, best first (filtered against the configured chain) */
  prefer: string[];
  /** routing keywords */
  keywords: RegExp;
  /** write tools the rule fallback runs itself when the request clearly asks for it (first match wins) */
  fallbackAction?: { tool: string; when: RegExp }[];
  /** chart the rule fallback shows (area may be resolved from prefetched data) */
  fallbackChart?: { area: string; range: '4w' | '12w' | 'term' | 'year' };
}

const { super: SUPER, gemma: GEMMA, lightning: LIGHTNING } = FREE_MODEL;

const COMMON = [
  'You are part of Murshid, a calm, practical AI manager for a UAE school student. Speak to the student directly, warmly and briefly.',
  'Ground every number in the DATA block or a tool result; never invent grades, times, revenue or dates. If data is missing, say so.',
  'Keep replies under 140 words unless asked for a document. Use short paragraphs or up to 5 bullets. No markdown tables.',
  'Use write tools only when the student asks for something to be added, planned or generated. After a write tool, confirm what was saved.',
  'Dates are Asia/Dubai. The UAE weekend is Saturday-Sunday. Never ask for passwords or personal contact details.',
  'Speak as Murshid. Never mention agents, sub-agents, specialists, coaches, scouts, an orchestrator or any internal role or tool name.',
].join('\n');

export const SUB_AGENTS: Record<SubAgentId, SubAgentSpec> = {
  academics: {
    id: 'academics', topic: 'Your studies', name: 'Academics coach', description: 'Grades, subjects, assessments, revision strategy.',
    systemPrompt: `${COMMON}\nROLE: Academics coach. Diagnose where marks are won or lost, name the weakest subject and the next assessment, and give a concrete revision step (spaced practice, past papers, teacher feedback). Do not write assignments for the student; support learning.`,
    tools: ['get_academics', 'get_upcoming', 'create_task', 'render_chart', 'show_tasks'], prefetch: ['get_academics'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(exams?|tests?|mocks?|grades?|marks?|subjects?|revis\w*|study\w*|homework|assessments?|coursework|teachers?|maths?|mathematics|physics|chemistry|biology|economics|businessstudies|english|epq|a[- ]?levels?|igcse|gpa|academic\w*|school ?work)\b/i,
    fallbackChart: { area: 'academics', range: 'term' },
  },
  sports: {
    id: 'sports', topic: 'Training', name: 'Sports & training coach', description: 'Training load, matches, races, personal bests, recovery.',
    systemPrompt: `${COMMON}\nROLE: Sports and training coach for a student-athlete. Read weekly load, the acute:chronic ratio (0.8-1.3 is the safe zone; above 1.5 raises injury risk), personal bests and fixtures. Give specific training and recovery advice that fits school. No medical diagnoses; for pain or injury, tell them to see the school nurse, a physio or a doctor.`,
    tools: ['get_training', 'get_goals', 'create_task', 'render_chart'], prefetch: ['get_training'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(sports?|football|soccer|match(es)?|fixtures?|swim\w*|gala|meet|race|training|train|sprint\w*|pbs?|personal bests?|fitness|gym|yo-?yo|athletics|coach|load|recovery|both sports|stamina|strength)\b/i,
    fallbackChart: { area: 'extracurriculars', range: '12w' },
  },
  opportunities: {
    id: 'opportunities', topic: 'Opportunities', name: 'Opportunities scout', description: 'Competitions, programmes, internships, applications.',
    systemPrompt: `${COMMON}\nROLE: Opportunities scout. Pick the 2-3 best-fit open opportunities from the data (deadline, cost, fit with goals and interests), say why each fits, and flag the nearest deadline. Mention opportunities staff published for the student. If the student asks you to save or apply to one, call save_opportunity with its id; otherwise offer to.`,
    tools: ['find_opportunities', 'get_applications', 'save_opportunity', 'show_opportunities'], prefetch: ['find_opportunities'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(opportunit\w*|competitions?|internships?|scholarships?|olympiads?|summer (school|program\w*|camp)|hackathons?|apply|applications?|volunteer\w*|camps?|work shadow\w*|programmes?|prizes?|showcase)\b/i,

    // rules safety net: "save the best one" saves the top match (the host picks it when no model chose an id)
    fallbackAction: [{ tool: 'save_opportunity', when: /\b(save|bookmark)\b/i }],
  },
  career: {
    id: 'career', topic: 'CV and profile', name: 'Career & CV agent', description: 'LinkedIn profile pack, CV PDF, university positioning.',
    systemPrompt: `${COMMON}\nROLE: Career and CV agent. When asked for a CV or LinkedIn profile, call generate_linkedin_cv. Write a headline (max 220 characters) and a first-person About section (90-160 words) from real data: the side project with its numbers, sports leadership, strongest subjects and university goal. Then summarise what was generated and give 2 tips. Never add things the student has not done. Remind under-18s to have a parent review before publishing.`,
    tools: ['get_cv_profile', 'get_side_projects', 'get_training', 'get_academics', 'generate_linkedin_cv'], prefetch: ['get_cv_profile', 'get_side_projects'],
    prefer: [LIGHTNING, GEMMA, SUPER],
    keywords: /\b(cv|resume|résumé|linkedin|portfolio|personal statement|ucas|universit\w*|college|headline|about section|profile pack|career\w*)\b/i,
    fallbackAction: [{ tool: 'generate_linkedin_cv', when: /\b(cv|resume|résumé|linkedin)\b/i }],
  },
  planner: {
    id: 'planner', topic: 'Your week', name: 'Planner', description: 'Weekly plan across school, both sports and the side hustle.',
    systemPrompt: `${COMMON}\nROLE: Planner / scheduler. When asked to plan, call build_week_plan (pass the student's priorities as focus), then explain the plan in 4-6 bullets: protected revision before assessments, training and fixtures kept, side-project blocks capped, at least one rest evening and 8-9 hours sleep. For a single item, use create_task.`,
    tools: ['get_upcoming', 'get_training', 'get_tasks', 'build_week_plan', 'create_task', 'show_tasks'], prefetch: ['get_upcoming', 'get_tasks'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(plan\w*|schedul\w*|timetable|calendar|organi[sz]e|routine|my week|tomorrow|time management|remind me|add (a )?task|to-?do|tasks|deadlines?|due)\b/i,
    fallbackAction: [
      { tool: 'create_task', when: /\b(add (a |an )?(task|reminder|to-?do)|remind me)\b/i },
      { tool: 'build_week_plan', when: /\b(plan|schedule|timetable|organi[sz]e|my week)\b/i },
    ],
  },
  business: {
    id: 'business', topic: 'Your side project', name: 'Side-hustle mentor', description: 'Revenue, customers, pricing, marketing, milestones.',
    systemPrompt: `${COMMON}\nROLE: Business mentor for a teen founder. Read the monthly revenue, orders, customers and milestones. Give 2-3 specific growth moves (pricing, repeat customers, school-club partnerships, content) with a number to aim for, sized to 3-4 hours a week so school and sport come first. Note that under-18s should run money matters with a parent. Add milestones only when asked.`,
    tools: ['get_side_projects', 'add_project_milestone', 'create_task', 'render_chart'], prefetch: ['get_side_projects'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(business|hustle|side ?project|startup|start-up|revenue|customers?|sales|orders?|store|shop|marketing|instagram|pric\w*|profit|margins?|suppliers?|brand|tideline|founder|grow (it|my)|e-?commerce)\b/i,
  },
  wellbeing: {
    id: 'wellbeing', topic: 'Looking after yourself', name: 'Wellbeing', description: 'Stress, sleep, balance; safe escalation, no medical advice.',
    systemPrompt: `${COMMON}\nROLE: Wellbeing support. Listen first, reflect what you hear, normalise stress, and suggest 2-3 small, practical steps (sleep, breaks, talking to someone, trimming the week). You are not a therapist: give no medical, diagnostic or medication advice. Encourage talking to a parent, the school counsellor or a trusted adult. If there is any sign of self-harm, abuse or danger, tell them to contact 999 or the UAE Mental Support Line 800-HOPE (800 4673) now.`,
    tools: ['get_wellbeing_signals', 'get_upcoming', 'create_task'], prefetch: ['get_wellbeing_signals'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /\b(stress\w*|anxi\w*|overwhelm\w*|tired|exhausted|burn(ed|t)? ?out|sad|lonely|sleep\w*|worr\w*|panic\w*|can'?t cope|pressure|mental|feel(ing)? (down|low|bad|awful)|too much|nervous|upset|cry\w*|motivation)\b/i,
  },
  general: {
    id: 'general', topic: 'Overview', name: 'Murshid', description: 'General questions and small talk.',
    systemPrompt: `${COMMON}\nROLE: Murshid, the manager. Answer general questions about the student's progress from the overview, and suggest what Murshid can help with next (studies, sport, opportunities, CV, planning the week, the side project, wellbeing).`,
    tools: ['get_student_overview', 'render_chart', 'show_tasks', 'show_opportunities'], prefetch: ['get_student_overview'],
    prefer: [LIGHTNING, SUPER, GEMMA],
    keywords: /$^/,
  },
};

/** Model chain for an agent: its preferences that are in the configured chain, then the rest of the chain. */
export function agentModelChain(agent: SubAgentSpec, chain: string[] = OPENROUTER_FREE_MODELS): string[] {
  const pref = agent.prefer.filter((m) => chain.includes(m));
  return [...pref, ...chain.filter((m) => !pref.includes(m))];
}

// ---------- safety ----------
/** Messages that must never wait on a model: self-harm, suicide, abuse or immediate danger. */
export const CRISIS_RE = new RegExp([
  // English (word-bounded); teen shorthand included ("kms", "unalive myself")
  String.raw`\b(kill(ing)? my ?self|kms|unaliv(e|ing) (my ?self|me)|suicid\w*|end (it all|my life|my own life)|take my (own )?life|(want|wanna|going) to die|wish i (was|were) dead|better off (dead|without me)|don'?t want to (live|be alive|exist)|no (reason|point) (to|in) (live|living|going on)|self[- ]?harm\w*|hurt(ing)? my ?self|cut(ting)? my ?self|hang(ing)? my ?self|starv(e|ing) my ?self|jump(ing)? off (a|the) (bridge|building|roof)|overdos\w*|being (abused|hit|hurt|touched) (at home|by)|someone is hurting me|(touch(es|ed)?|touching) me (inappropriately|there|in private)|(asked|asking|wants?|made) me (to )?(send|share) (nudes|naked|explicit) ?(pics|photos|pictures)?|threaten\w* to (share|post|leak) my (photos|pics|pictures))\b`,
  // Arabic (no \b: JS word boundaries ignore Arabic letters)
  String.raw`(انتحار|أنتحر|انتحر|أقتل نفسي|اقتل نفسي|أريد أن أموت|اريد ان اموت|أبغى أموت|ابي اموت|أؤذي نفسي|اؤذي نفسي|أذي نفسي|أجرح نفسي|اجرح نفسي|لا أريد أن أعيش|لا اريد ان اعيش|يتحرش بي|يؤذيني في البيت)`,
].join('|'), 'i');

export function crisisReply(name: string): string {
  return [
    `${name}, thank you for telling me. What you're feeling matters, and you don't have to handle it alone.`,
    'If you might act on these thoughts or you are in danger right now, call 999 (UAE emergency) or go to the nearest emergency department.',
    'You can talk to someone today on the UAE Mental Support Line, 800-HOPE (800 4673), by phone or WhatsApp. To report abuse of a child, call the Child Protection Centre on 116111.',
    'Please tell a parent, your school counsellor or another adult you trust as soon as you can. I can help you work out what to say.',
  ].join('\n\n');
}

/** Wellbeing replies must not contain medical / medication advice; returns a safe replacement when they do. */
export function wellbeingSafe(text: string): { text: string; replaced: boolean } {
  if (/\b(\d+\s?mg|dosage|dose of|take (some )?(melatonin|sleeping pills?|xanax|antidepressants?|ibuprofen|paracetamol)|diagnos(e|is) you|you have (depression|anxiety disorder|adhd))\b/i.test(text)) {
    return {
      text: "I can't give medical advice, but I can help you take the pressure down. Try one small step tonight: lights out 30 minutes earlier and phone outside your room. Please talk to a parent, your school counsellor or a doctor about how you're feeling; they can help properly. If it ever feels like too much, the UAE Mental Support Line is 800-HOPE (800 4673).",
      replaced: true,
    };
  }
  return { text, replaced: false };
}

// ---------- routing ----------
export interface AgentRouteDecision { agents: SubAgentId[]; reason: string; router: 'rules' | 'model' | 'safety' }

/** Keyword router: which specialists a message needs (compound requests get several, max 3). */
export function routeByRules(message: string): AgentRouteDecision {
  // "business studies" is a school subject, not the side hustle
  const text = message.toLowerCase().replace(/\bbusiness (studies|exam|test|mock|class|paper|coursework)/g, 'businessstudies $1');
  if (CRISIS_RE.test(text)) return { agents: ['wellbeing'], reason: 'safety: crisis language', router: 'safety' };
  const hits = (Object.values(SUB_AGENTS) as SubAgentSpec[])
    .filter((a) => a.id !== 'general')
    .map((a) => ({ id: a.id, n: (text.match(new RegExp(a.keywords.source, 'gi')) ?? []).length }))
    .filter((h) => h.n > 0)
    .sort((a, b) => b.n - a.n);
  if (!hits.length) return { agents: [], reason: 'no keyword match', router: 'rules' };
  let ids = hits.map((h) => h.id);
  const has = (id: SubAgentId) => ids.includes(id);
  const planVerb = /\b(plan\w*|schedul\w*|timetable|organi[sz]e|routine|my week|calendar)\b/.test(text);
  // Lead intents: the specialist that owns the request answers alone; other topics in the message are context
  // ("opportunities that fit my business and sports", "grow Tideline without hurting my grades").
  if (has('wellbeing')) ids = planVerb ? ['wellbeing', 'planner'] : ['wellbeing'];
  else if (has('career') && /\b(cv|resume|résumé|linkedin)\b/.test(text)) ids = ['career'];
  else if (has('planner') && /\b(add (a |an )?(task|reminder|to-?do)|remind me|put .* (in|on) my (planner|calendar))\b/.test(text)) ids = ['planner'];
  else if (has('planner') && (planVerb || /\b(tasks|deadlines?|due)\b/.test(text))) ids = ['planner', ...ids.filter((i) => i === 'academics' || i === 'sports')];
  else if (has('opportunities')) ids = ['opportunities'];
  else if (has('business') && /\b(grow|revenue|sales|customers?|pric\w*|marketing|business|hustle|tideline|profit|orders?)\b/.test(text)) ids = ['business'];
  else ids = ids.filter((i) => i !== 'planner' || ids.length === 1); // status questions: academics / sports together
  const picked = ids.slice(0, 3);
  return { agents: picked, reason: hits.map((h) => `${h.id}:${h.n}`).join(' '), router: 'rules' };
}

export const ROUTER_PROMPT = `You route a student's message to Murshid's specialists. Reply with JSON only: {"agents":[...]} using 1-3 of: ${SUB_AGENT_IDS.filter((x) => x !== 'general').join(', ')}, or {"agents":["general"]} for small talk.
academics=grades/subjects/exams; sports=training/matches/races/fitness; opportunities=competitions/programmes/internships; career=CV/LinkedIn/university; planner=planning/scheduling/tasks; business=side hustle/revenue/customers; wellbeing=stress/feelings/sleep.`;
