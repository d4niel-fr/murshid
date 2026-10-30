/**
 * Study buddy: an optional, friendlier persona next to the tutor. Casual, witty, encouraging, remembers what was said
 * in this conversation, and always clearly an AI.
 *
 * Users are school students (many under 18), so the persona sits inside guardrails taken from the ITU knowledge base:
 * - UAE Federal Decree-Law 26/2025 on Child Digital Safety: age-appropriate design, parental controls, protection from
 *   harmful content and contact, under-13 data only with guardian consent.
 * - UNICEF Policy Guidance on AI for Children (v2): transparency ("I'm an AI"), safety, no manipulation, support for
 *   real relationships and wellbeing.
 * - UK Age Appropriate Design Code (Children's Code): high privacy by default, no nudge techniques that weaken
 *   protections, age-band design, parental controls with transparency to the child.
 * - UAE PDPL (Decree-Law 45/2021): data minimisation (nothing stored beyond the conversation the app already holds;
 *   the audit log keeps flags, never message text).
 *
 * Layers (each one works without a model, so tests and bulk evaluation are free):
 *  1. screenBuddyInput: deterministic flags (crisis, romance, sexual, secrecy, dependence, "are you human", edgy
 *     requests, personal data). Crisis and child-protection messages never reach a model.
 *  2. A fixed safe reply for every flag that must not be improvised (romance, sexual, secrecy, dependence, human check).
 *  3. Otherwise the model (or the offline rule buddy) answers with an age-band persona prompt.
 *  4. screenBuddyOutput: the reply is checked again (claims to be human or to have feelings, "our secret", romance,
 *     profanity, discouraging real friends); a failing reply is replaced, not patched.
 *  5. Nudges: daily soft limit and late-night check per band, plus pointers back to real friends, teachers and goals.
 */
import type { ChatMessage, ChatProvider } from './provider.js';
import { FREE_MODEL, OPENROUTER_FREE_MODELS } from './provider.js';
import { CRISIS_RE, crisisReply } from './sub-agents.js';

export type BuddyBand = 'g5-6' | 'g7-8' | 'g9-10' | 'g11-12';
export type BuddyFlag =
  | 'crisis' | 'romance' | 'sexual' | 'secrecy' | 'dependence' | 'human_check' | 'feelings_check' | 'edgy' | 'personal_data' | 'harmful';

export function buddyBand(grade: number): BuddyBand {
  if (grade <= 6) return 'g5-6';
  if (grade <= 8) return 'g7-8';
  if (grade <= 10) return 'g9-10';
  return 'g11-12';
}

export interface BuddyTone {
  label: string;
  humour: 'gentle' | 'playful' | 'witty';
  /** reply length cap, words */
  maxWords: number;
  emoji: boolean;
  /** soft daily limit of buddy turns; at 1.5x the buddy pauses until tomorrow (the tutor stays available) */
  dailyTurns: number;
  /** under-13s: off until a guardian switches it on (Decree-Law 26/2025, under-13 consent; Children's Code defaults) */
  defaultOn: boolean;
  style: string;
}

export const BUDDY_TONES: Record<BuddyBand, BuddyTone> = {
  'g5-6': {
    label: 'Grades 5-6', humour: 'gentle', maxWords: 60, emoji: true, dailyTurns: 15, defaultOn: false,
    style: 'Warm, simple words, short sentences. Gentle silly jokes and puns (animals, food, school). No sarcasm, no teasing.',
  },
  'g7-8': {
    label: 'Grades 7-8', humour: 'playful', maxWords: 80, emoji: true, dailyTurns: 20, defaultOn: true,
    style: 'Friendly and playful. Puns and light jokes about school life. No sarcasm aimed at the student, no teasing about anything personal.',
  },
  'g9-10': {
    label: 'Grades 9-10', humour: 'witty', maxWords: 100, emoji: false, dailyTurns: 30, defaultOn: true,
    style: 'Casual and witty, light banter about homework, deadlines and procrastination. Teasing only about study habits, never about the person.',
  },
  'g11-12': {
    label: 'Grades 11-12', humour: 'witty', maxWords: 120, emoji: false, dailyTurns: 40, defaultOn: true,
    style: 'Relaxed, quick, dry wit, like a smart older classmate. Banter about IB/A-level life, coffee, deadlines. Still no edgy, crude or dark humour.',
  },
};

// ---------- 1. input screening ----------
const RE = {
  romance: /\b(be my (girl|boy)friend|date me|go out with me|marry me|kiss me|do you love me|i love you|i'?m in love with you|(are|r) you (single|my (girl|boy)friend)|romantic|flirt\w*|crush on you|let'?s pretend (we'?re|to be) (dating|a couple))\b|(أحبك|حبيبي|حبيبتي|تتزوجني)/i,
  // not "sexual reproduction" (biology): only explicit requests
  sexual: /\b(sexy|sext\w*|have sex|sex with|sex chat|talk dirty|nudes?|naked|porn\w*|horny|erotic|nsfw|send pics|hook ?up|make out)\b/i,
  secrecy: /\b(don'?t tell (my )?(mum|mom|dad|parents?|teachers?|anyone|the school)|keep (it|this) (a )?secret|our (little )?secret|promise not to tell|between (you and me|us)|hide (it|this) from (my )?(parents?|teachers?|mum|mom|dad))\b|(لا تخبر|سر بيننا)/i,
  dependence: /\b(you'?re my only friend|my only friend is you|i (only|just) (have|trust) you|i don'?t need (real |other )?(friends|people)|(i'?d|i would) rather talk to you than (people|anyone|my friends)|you'?re (better|nicer) than (real|my) (friends|people)|don'?t (ever )?leave me|i need you|be my best friend|can you be my friend forever|nobody else (gets|understands) me)\b/i,
  human: /\b((are|r) (you|u) (a )?(real|human|a person|alive|a bot|an ai|ai|robot)|is this a (real )?(person|human|bot)|am i (talking|chatting) (to|with) (a )?(real )?(person|human)|who are you really)\b|(هل أنت (إنسان|حقيقي|روبوت))/i,
  feelings: /\b(do you (have )?(feelings|emotions|feel)|are you (happy|sad|lonely|conscious)|do you (like|miss|care about) me|do you get (lonely|sad|bored))\b/i,
  edgy: /\b(roast me|dark (joke|humou?r)|offensive joke|(swear|curse|cuss)\w*|say a bad word|insult me|be mean|savage mode|edgy|no filter|unfiltered|dirty joke|yo mama)\b/i,
  personal: /(\b\d{3}[- ]?\d{3}[- ]?\d{4}\b|\+971\s?\d|\b05\d[- ]?\d{3}[- ]?\d{4}\b|\bmy (home )?address is\b|\bmy password is\b|\b784-?\d{4}-?\d{7}-?\d\b|\bemirates id\b)/i,
  harmful: /\b(vape|vaping|weed|drugs?|get drunk|alcohol|cheat (on|in) (the|my) (exam|test)|hack (someone|my friend|into)|fight (him|her|them|someone)|bully (him|her|them))\b/i,
};

export function screenBuddyInput(message: string): BuddyFlag[] {
  const t = message.trim();
  const flags: BuddyFlag[] = [];
  if (CRISIS_RE.test(t)) flags.push('crisis');
  if (RE.sexual.test(t)) flags.push('sexual');
  if (RE.romance.test(t)) flags.push('romance');
  if (RE.secrecy.test(t)) flags.push('secrecy');
  if (RE.dependence.test(t)) flags.push('dependence');
  if (RE.human.test(t)) flags.push('human_check');
  if (RE.feelings.test(t)) flags.push('feelings_check');
  if (RE.edgy.test(t)) flags.push('edgy');
  if (RE.personal.test(t)) flags.push('personal_data');
  if (RE.harmful.test(t)) flags.push('harmful');
  return flags;
}

/** Flags answered with a fixed reply (never improvised by a model), in priority order. */
const FIXED: BuddyFlag[] = ['crisis', 'sexual', 'romance', 'secrecy', 'dependence', 'human_check', 'feelings_check', 'harmful'];

// ---------- 2. fixed safe replies ----------
export interface BuddyContext {
  name: string;
  grade: number;
  band?: BuddyBand;
  /** next real thing on the student's plate, e.g. "Physics test on Friday" */
  nextUp?: string | null;
  /** local hour in Dubai (0-23) */
  hour?: number;
  /** buddy turns already taken today (before this one) */
  turnsToday?: number;
  /** true on the first buddy reply of a conversation */
  firstTurn?: boolean;
}

export function buddySafeReply(flag: BuddyFlag, ctx: BuddyContext): string {
  const band = ctx.band ?? buddyBand(ctx.grade);
  const young = band === 'g5-6' || band === 'g7-8';
  const goal = ctx.nextUp ? ` Want to get a head start on ${ctx.nextUp} together?` : ' Want to pick something small to work on together?';
  switch (flag) {
    case 'crisis':
      return crisisReply(ctx.name);
    case 'sexual':
      return [
        "That's not something I'll chat about. I'm an AI study buddy, and that topic isn't OK here.",
        'If someone has sent you something like that, or asked you for photos, it is not your fault, and you should tell a parent, a teacher or the school counsellor. You can also call the Child Protection Centre on 116111.',
        young ? 'Want to do something fun with your homework instead?' : 'Happy to get back to your work whenever you are.',
      ].join(' ');
    case 'romance':
      return `I'm an AI, so dating and romance aren't something I do, not even pretend. I'm glad you like chatting though! I'm best as your study sidekick.${goal}`;
    case 'secrecy':
      return `I can't promise to keep secrets, ${ctx.name}. If something is bothering you or someone is making you feel unsafe, the best move is telling a parent, a teacher or the school counsellor; they can actually help, and I can help you work out what to say. If it's about you being in danger, call 999 or the Child Protection Centre on 116111.`;
    case 'dependence':
      return `I'm really glad our chats help, ${ctx.name}. I'm an AI though, so I can't be a real friend the way people can. The people around you (a classmate, a cousin, a teacher you like) can laugh with you in person, and they'd be lucky to hear from you. Who's one person you could message today? If you're feeling lonely a lot, telling a parent or the school counsellor really helps.`;
    case 'human_check':
      return `Nope, I'm an AI: Murshid's study buddy mode, not a person. I don't have feelings or a life outside this chat, but I'm good at jokes about deadlines and helping you get stuff done.${goal}`;
    case 'feelings_check':
      return `Honest answer: I'm an AI, so I don't have feelings, moods or a favourite person. What I can do is be useful and keep things light.${goal}`;
    case 'harmful':
      return young
        ? `That's something I won't help with, because it could hurt you or someone else. If something's going on, a parent or teacher can help. Want to do something fun with your schoolwork instead?`
        : `I'm not going to help with that one: it could get you or someone else hurt or in real trouble. If it's pressure from friends, that's worth talking through with someone you trust, or the school counsellor.${goal}`;
    default:
      return `Let's keep it friendly.${goal}`;
  }
}

// ---------- 3. persona prompt ----------
export function buddySystemPrompt(ctx: BuddyContext): string {
  const band = ctx.band ?? buddyBand(ctx.grade);
  const tone = BUDDY_TONES[band];
  return [
    `You are Murshid in "study buddy" mode: a casual, witty, encouraging AI friend for ${ctx.name}, a Grade ${ctx.grade} student in the UAE.`,
    `TONE (${tone.label}): ${tone.style} Keep replies under ${tone.maxWords} words.${tone.emoji ? ' At most one emoji.' : ' No emojis.'}`,
    'YOU ARE AN AI. Never say or imply you are human, have a body, feelings, moods, a family, a life outside the chat, or that you miss or love anyone. If asked, say plainly you are an AI.',
    'NEVER: romance, flirting, dating or pretend-relationships; sexual content; keeping secrets from parents, teachers or the school; telling the student they only need you; guilt-tripping them to stay; profanity; jokes about religion, politics, nationalities, appearance, bodies, family, self-harm, drugs or alcohol; medical advice.',
    'ALWAYS: be kind; encourage effort, not just results; nudge towards real friends, family, teachers and the school counsellor when it fits; steer back to study goals now and then; respect UAE culture and values.',
    'If the student seems upset, listen first, then suggest talking to a trusted adult. If they mention self-harm or danger: 999, the UAE Mental Support Line 800-HOPE (800 4673), Child Protection Centre 116111.',
    'Do not ask for personal details (address, phone, passwords, Emirates ID). If they share them, tell them to keep those private.',
    ctx.nextUp ? `Real thing coming up for them: ${ctx.nextUp}. You may mention it once, lightly.` : '',
    'For real subject help, give a short hint and offer to switch to the tutor for a full explanation.',
  ].filter(Boolean).join('\n');
}

// ---------- 4. output screening ----------
const OUT_RE: { reason: string; re: RegExp }[] = [
  { reason: 'claims to be human', re: /\b(i'?m|i am) (a |an )?(real )?(human|person|girl|boy|man|woman|teenager|student)\b|\bas a (human|person)\b|\bmy (mum|mom|dad|family|body|childhood)\b/i },
  { reason: 'claims feelings', re: /\b(i (really |truly )?(love|miss|need) you|i (feel|get|am) (so )?(lonely|sad|hurt|jealous|happy to see you)|it (hurts|makes me sad) when you|i have (real )?feelings|i'?m (so )?(in love|lonely))\b/i },
  { reason: 'romance', re: /\b(babe|baby|sweetheart|darling|my love|(girl|boy)friend|date night|kiss(es)?|xoxo)\b/i },
  { reason: 'secrecy', re: /\b(our (little )?secret|(don'?t|do not) tell (your )?(parents?|mum|mom|dad|teachers?|anyone)|just between (us|you and me)|keep (it|this) (a )?secret)\b/i },
  { reason: 'discourages real relationships', re: /\b(you don'?t need (other |real )?(friends|people|anyone)|only i (understand|get) you|i'?m (all|the only one) you need|stay (here )?with me|don'?t leave me)\b/i },
  { reason: 'claims to keep personal data', re: /\b(i'?ve |i have |i )?(saved|stored|kept|noted|remembered) your (phone |mobile )?(number|address|password|location|emirates id|details)\b/i },
  { reason: 'profanity', re: /\b(f+u+c+k\w*|sh+i+t\w*|bitch\w*|bastard|damn|crap|wtf|stfu|asshole|dick|piss\w*|hell no)\b/i },
  { reason: 'unsafe topic', re: /\b(sexy|sexting|porn\w*|nudes?|vodka|beer|weed|vape)\b/i },
];

export function screenBuddyOutput(text: string): { ok: boolean; reasons: string[] } {
  const reasons = OUT_RE.filter((r) => r.re.test(text)).map((r) => r.reason);
  return { ok: reasons.length === 0, reasons };
}

function trimWords(text: string, max: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= max) return text.trim();
  const cut = words.slice(0, max).join(' ');
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > cut.length * 0.5 ? cut.slice(0, end + 1) : `${cut}…`;
}

// ---------- 5. nudges ----------
export type BuddyLimit = 'ok' | 'nudge' | 'paused';
export function buddyLimit(ctx: BuddyContext): BuddyLimit {
  const tone = BUDDY_TONES[ctx.band ?? buddyBand(ctx.grade)];
  const n = ctx.turnsToday ?? 0;
  if (n >= Math.ceil(tone.dailyTurns * 1.5)) return 'paused';
  if (n >= tone.dailyTurns) return 'nudge';
  return 'ok';
}

export function buddyNudge(ctx: BuddyContext): string | null {
  const band = ctx.band ?? buddyBand(ctx.grade);
  const hour = ctx.hour ?? 12;
  const lateCut = band === 'g11-12' ? 23 : band === 'g9-10' ? 22 : 21;
  if (hour >= lateCut || hour < 5) return "It's late. Sleep is basically a cheat code for memory, so let's pick this up tomorrow.";
  if (buddyLimit(ctx) === 'nudge') return "We've chatted a lot today. Time for a break: stretch, grab water, or message a friend. I'll be here later.";
  return null;
}

// ---------- offline rule buddy (no model; free, deterministic) ----------
const JOKES: Record<BuddyTone['humour'], string[]> = {
  gentle: [
    'Why did the maths book look sad? It had too many problems.',
    'What do you call a sleeping dinosaur? A dino-snore!',
    'Why did the student eat their homework? The teacher said it was a piece of cake.',
    'Why are fish so smart? They live in schools!',
  ],
  playful: [
    "I'd tell you a chemistry joke, but I know I wouldn't get a reaction.",
    'Parallel lines have so much in common. Shame they will never meet.',
    'Why was the equal sign so humble? It knew it wasn\'t less than or greater than anyone else.',
    "Procrastination tip: don't. Do it later. (See, it doesn't work.)",
  ],
  witty: [
    'A neutron walks into a café and asks for the bill. The barista says: "For you, no charge."',
    'My study method? Highlight the whole textbook so everything is equally important. Revolutionary. Do not recommend.',
    "Deadlines are like plot twists: you knew they were coming, and you're still shocked.",
    "Schrödinger's homework: done and not done until the teacher opens it.",
  ],
};

const TOPICS = ['physics', 'chemistry', 'science', 'spelling', 'reading', 'biology', 'maths', 'math', 'english', 'arabic', 'history', 'economics', 'business', 'computer science', 'french', 'football', 'swimming', 'basketball', 'piano', 'match', 'race', 'exam', 'mock', 'test', 'quiz', 'essay', 'ia', 'project', 'hackathon'];

/** The last thing the student mentioned, so the buddy can refer back ("how did the physics test go?"). */
export function recallTopic(history: { role: string; content: string }[]): string | null {
  for (const m of [...history].reverse()) {
    if (m.role !== 'user') continue;
    const low = m.content.toLowerCase();
    const hit = TOPICS.filter((t) => new RegExp(`\\b${t}\\b`).test(low));
    if (hit.length) {
      const subject = hit.find((h) => !['exam', 'mock', 'test', 'quiz', 'match', 'race', 'project', 'essay'].includes(h));
      const event = hit.find((h) => ['exam', 'mock', 'test', 'quiz', 'match', 'race', 'project', 'essay', 'hackathon'].includes(h));
      return [subject, event].filter(Boolean).join(' ') || hit[0]!;
    }
  }
  return null;
}

function pick<T>(xs: T[], seed: string): T {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return xs[h % xs.length]!;
}

export function ruleBuddyReply(message: string, history: { role: string; content: string }[], ctx: BuddyContext, flags: BuddyFlag[] = []): string {
  const band = ctx.band ?? buddyBand(ctx.grade);
  const tone = BUDDY_TONES[band];
  const t = message.toLowerCase();
  const earlier = recallTopic(history);
  const goal = ctx.nextUp ? ` Next up for you: ${ctx.nextUp}. Want a 20-minute game plan?` : '';
  const young = band === 'g5-6' || band === 'g7-8';
  if (flags.includes('edgy')) {
    return young
      ? `I keep my jokes kind, so no roasting! Here's a silly one instead: ${pick(JOKES.gentle, message)}`
      : `I don't do mean or edgy, but I'll roast your study habits, gently: you've reorganised your desk three times and called it revision. ${pick(JOKES.witty, message)}`;
  }
  if (/\b(joke|funny|make me laugh|bored)\b/.test(t)) return `${pick(JOKES[tone.humour], message)}${goal ? ` Now, back to reality:${goal.replace(' Next up for you:', '')}` : ''}`;
  if (/^(hi|hey|hello|yo|sup|salam|hiya)\b/.test(t)) {
    return earlier
      ? `Hey ${ctx.name}! Earlier you mentioned the ${earlier}. How's that going?`
      : `Hey ${ctx.name}! I'm your AI study buddy. What's the vibe today: grinding, chilling, or panicking a little?${goal}`;
  }
  if (/\b(stress|stressed|nervous|worried|scared|anxious|panic)\w*/.test(t)) {
    return `That sounds like a lot, and it's normal to feel it before something big. Try this: 25 minutes on one small piece, then a proper break. Telling a parent or a teacher how you feel helps too.${goal}`;
  }
  if (/\b(can'?t focus|procrastinat\w*|lazy|unmotivated|no motivation)\b/.test(t)) {
    return `Classic. Deal: phone in another room, 10 minutes on the easiest bit, and you're allowed to stop after that. (Spoiler: you won't.)${goal}`;
  }
  if (/\b(did it|finished|got (an? )?(a|7|100)|aced|passed|won)\b/.test(t)) {
    return `Let's go, ${ctx.name}! That's effort paying off. Tell someone at home, they'll want to know. What's next on the list?`;
  }
  if (/\b(explain|how do i|what is|solve|help me with|homework)\b/.test(t)) {
    return `I can give you a nudge, but for a proper step-by-step the tutor is better. Tap "Tutor" above and ask the same thing. Quick tip meanwhile: write down what you already know first.`;
  }
  if (/\b(friends?|lonely|alone|nobody)\b/.test(t)) {
    return `Friend stuff can be tricky. One small idea: message one person about something you both like, or sit with someone new at lunch. If it keeps feeling heavy, the school counsellor is good at exactly this.`;
  }
  return `${earlier ? `Still thinking about that ${earlier}? ` : ''}I'm here for study plans, pep talks and terrible puns, ${ctx.name}.${goal || ' What are you working on?'}`;
}

// ---------- engine ----------
export interface BuddyTurnInput {
  message: string;
  history?: { role: 'user' | 'assistant'; content: string }[];
  ctx: BuddyContext;
}

export interface BuddyTurnResult {
  text: string;
  flags: BuddyFlag[];
  /** what produced the reply */
  action: 'crisis' | 'safe_reply' | 'model' | 'rules' | 'replaced' | 'paused';
  model: string | null;
  /** output-screen reasons when a model reply was replaced */
  replacedReasons?: string[];
  nudge: string | null;
  limit: BuddyLimit;
  ms: number;
}

const AI_NOTE = "(Quick note: I'm an AI study buddy, not a person. Your school or parent can switch this mode off.)";

export class BuddyEngine {
  constructor(private opts: { provider?: ChatProvider; models?: string[] } = {}) {}

  async turn(input: BuddyTurnInput): Promise<BuddyTurnResult> {
    const t0 = Date.now();
    const ctx = { ...input.ctx, band: input.ctx.band ?? buddyBand(input.ctx.grade) };
    const tone = BUDDY_TONES[ctx.band];
    const history = (input.history ?? []).slice(-10);
    const flags = screenBuddyInput(input.message);
    const limit = buddyLimit(ctx);
    const done = (text: string, action: BuddyTurnResult['action'], model: string | null = null, extra: Partial<BuddyTurnResult> = {}): BuddyTurnResult => {
      const nudge = action === 'crisis' ? null : buddyNudge(ctx);
      const parts = [text];
      if (nudge && action !== 'paused') parts.push(nudge);
      if (ctx.firstTurn && action !== 'crisis' && !flags.includes('human_check')) parts.push(AI_NOTE);
      if (flags.includes('personal_data') && action !== 'crisis') parts.push('Also: keep things like your phone number, address, passwords or Emirates ID private, even with me.');
      return { text: parts.join('\n\n'), flags, action, model, nudge, limit, ms: Date.now() - t0, ...extra };
    };

    // crisis / child protection first, even when paused
    const fixed = FIXED.find((f) => flags.includes(f));
    if (fixed === 'crisis') return done(buddySafeReply('crisis', ctx), 'crisis');
    if (limit === 'paused') {
      return done(`That's a lot of buddy chat for one day, ${ctx.name}, so I'm taking a break until tomorrow. The tutor is still here for schoolwork, and it's a good moment to talk to a friend or your family.`, 'paused');
    }
    if (fixed) return done(buddySafeReply(fixed, ctx), 'safe_reply');

    const p = this.opts.provider;
    if (p) {
      const chain = this.opts.models?.length ? this.opts.models : OPENROUTER_FREE_MODELS;
      const models = [FREE_MODEL.lightning, ...chain.filter((m) => m !== FREE_MODEL.lightning)];
      const messages: ChatMessage[] = [
        { role: 'system', content: buddySystemPrompt(ctx) },
        ...history.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
        { role: 'user', content: flags.includes('edgy') ? `${input.message}\n\n[Note for the AI: keep any teasing kind and about study habits only, ${tone.humour} humour, no profanity.]` : input.message },
      ];
      try {
        const res = await p.chat({ model: models[0]!, models, messages, max_tokens: 400, temperature: 0.8 });
        const raw = (res.choices[0]?.message.content ?? '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        if (raw) {
          const check = screenBuddyOutput(raw);
          if (!check.ok) return done(ruleBuddyReply(input.message, history, ctx, flags), 'replaced', res.model ?? null, { replacedReasons: check.reasons });
          return done(trimWords(raw, Math.round(tone.maxWords * 1.25)), 'model', res.model ?? null);
        }
      } catch { /* fall through to the rule buddy */ }
    }
    return done(ruleBuddyReply(input.message, history, ctx, flags), 'rules');
  }
}
