'use client';

import { createLocalStore, uid } from './local-store';

/* ------------------------------------------------------------------ types */
export interface Deck { id: string; title: string; subject: string; createdAt: number; updatedAt: number;
  /** where the cards came from ("Lesson 4 slides.pptx", "Shared by a classmate") */ source?: string;
  /** a test this deck is for: the hub counts down and paces reviews to it */ examDate?: string;
  /** best Match time in ms, best Challenge score */ best?: { match?: number; challenge?: number } }
export interface Card {
  id: string; deckId: string; front: string; back: string; createdAt: number;
  /** spaced repetition (SM-2 style): next review time, interval in days, ease factor, successful reps in a row */
  due: number; interval: number; ease: number; reps: number; lapses: number; reviewedAt?: number;
  /** what kind of card the generator made (definition, formula, list, cloze…) */ kind?: string;
  starred?: boolean;
  /** Learn mode: 0 new, 1 recognised (multiple choice), 2 recalled (typed), 3 mastered */ learn?: 0 | 1 | 2 | 3;
}
export interface Note { id: string; title: string; body: string; subject: string; tags: string[]; pinned?: boolean; createdAt: number; updatedAt: number }
export interface FocusSession { id: string; startedAt: number; minutes: number; label: string }
/** 0 not started, 1 shaky, 2 getting there, 3 confident */
export type Confidence = 0 | 1 | 2 | 3;
export interface Topic { id: string; subject: string; name: string; confidence: Confidence; updatedAt: number }
export interface QuizResult { id: string; deckId: string; at: number; score: number; total: number }
/** XP earned per day (YYYY-MM-DD, local) and the daily goal. */
export interface Xp { total: number; days: Record<string, number>; goal: number }
export interface StudyState { decks: Deck[]; cards: Card[]; notes: Note[]; sessions: FocusSession[]; topics: Topic[]; quizzes: QuizResult[]; xp: Xp; achievements: Record<string, number> }

export const SUBJECTS = ['Physics', 'Mathematics', 'Economics', 'English', 'Business Studies', 'Chemistry', 'Biology', 'Arabic', 'Other'];

/* ------------------------------------------------------------------ spaced repetition */
export type Grade = 0 | 1 | 2 | 3; // again, hard, good, easy
const DAY = 86_400_000;

/** The card after a review with `grade` at time `now`. */
export function review(card: Card, grade: Grade, now = Date.now()): Card {
  let { interval, ease, reps, lapses } = card;
  if (grade === 0) {
    reps = 0; lapses += 1; ease = Math.max(1.3, ease - 0.2);
    return { ...card, interval: 0, ease, reps, lapses, due: now + 10 * 60_000, reviewedAt: now };
  }
  if (grade === 1) { interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2)); ease = Math.max(1.3, ease - 0.15); }
  if (grade === 2) interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(Math.max(interval, 1) * ease);
  if (grade === 3) { interval = reps === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3); ease += 0.15; }
  return { ...card, interval, ease, reps: reps + 1, lapses, due: now + interval * DAY, reviewedAt: now };
}

/** What each grade button would schedule, for the labels under them. */
export function preview(card: Card, now = Date.now()): Record<Grade, string> {
  const out = {} as Record<Grade, string>;
  for (const g of [0, 1, 2, 3] as Grade[]) {
    const next = review(card, g, now); const ms = next.due - now;
    out[g] = ms < DAY ? `${Math.round(ms / 60_000)}m` : ms < 30 * DAY ? `${Math.round(ms / DAY)}d` : `${Math.round(ms / (30 * DAY))}mo`;
  }
  return out;
}

export const isDue = (c: Card, now = Date.now()) => c.due <= now;

/* ------------------------------------------------------------------ seed: a starter kit for a Grade 11 student */
function seed(): StudyState {
  const now = Date.now();
  // stable ids, so the server render and the first client render agree
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const mk = (title: string, subject: string, cards: [string, string][]): [Deck, Card[]] => {
    const deck: Deck = { id: `deck_${key(title)}`, title, subject, createdAt: now, updatedAt: now };
    return [deck, cards.map(([front, back], i) => ({ id: `card_${key(title)}_${i}`, deckId: deck.id, front, back, createdAt: now, due: now - i * 1000, interval: 0, ease: 2.5, reps: 0, lapses: 0 }))];
  };
  const decks: [Deck, Card[]][] = [
    mk('Forces and motion', 'Physics', [
      ["Newton's first law", 'An object stays at rest or moves at constant velocity unless a resultant force acts on it.'],
      ["Newton's second law", 'F = ma: the resultant force equals mass times acceleration.'],
      ["Newton's third law", 'When A exerts a force on B, B exerts an equal and opposite force on A.'],
      ['Momentum (formula and unit)', 'p = mv, measured in kg m/s.'],
      ['Impulse', 'Force × time = change in momentum (N s).'],
      ['Terminal velocity', 'The constant speed reached when drag equals weight, so the resultant force is zero.'],
      ['Weight vs mass', 'Mass is the amount of matter (kg); weight is the gravitational force on it, W = mg (N).'],
      ['Work done', 'W = F × d (in the direction of the force), measured in joules.'],
    ]),
    mk('Integration', 'Mathematics', [
      ['∫ xⁿ dx (n ≠ −1)', 'xⁿ⁺¹ / (n + 1) + C'],
      ['∫ 1/x dx', 'ln|x| + C'],
      ['∫ eˣ dx', 'eˣ + C'],
      ['∫ sin x dx', '−cos x + C'],
      ['∫ cos x dx', 'sin x + C'],
      ['Integration by parts', '∫ u dv = uv − ∫ v du'],
      ['Area between two curves', '∫ (top − bottom) dx over the interval where they meet'],
    ]),
    mk('Market structures', 'Economics', [
      ['Perfect competition', 'Many firms, identical products, no barriers to entry; firms are price takers.'],
      ['Monopoly', 'One firm, high barriers to entry, a price maker.'],
      ['Oligopoly', 'A few large firms that are interdependent; prices are often sticky.'],
      ['Monopolistic competition', 'Many firms with differentiated products and low barriers to entry.'],
      ['Concentration ratio', 'The market share of the largest n firms, e.g. CR4.'],
      ['Price elasticity of demand', '% change in quantity demanded ÷ % change in price.'],
    ]),
    mk('Poetry terms', 'English', [
      ['Enjambment', 'A sentence that runs on past the end of a line without punctuation.'],
      ['Caesura', 'A pause in the middle of a line, often marked by punctuation.'],
      ['Volta', 'A turn in thought or argument, often near the end of a poem.'],
      ['Free verse', 'Poetry without a regular rhyme scheme or metre.'],
      ['Imagery', 'Language that appeals to the senses to create a picture in the mind.'],
    ]),
  ];
  const notes: Note[] = [
    {
      id: 'note_newtons-laws', title: "Newton's laws: one-page summary", subject: 'Physics', tags: ['mid-term', 'forces'], pinned: true, createdAt: now - 3 * DAY, updatedAt: now - 2 * DAY,
      body: `## The three laws\n\n1. **First law:** no resultant force, no change in velocity.\n2. **Second law:** F = ma. Double the force, double the acceleration.\n3. **Third law:** forces come in equal and opposite pairs, on *different* objects.\n\n## Worked example\n\nA 2 kg trolley is pushed with a 6 N force against 2 N of friction.\n\n- Resultant force = 6 − 2 = 4 N\n- a = F / m = 4 / 2 = **2 m/s²**\n\n## Common mistakes\n\n- Putting both forces of a third-law pair on the same object.\n- Forgetting friction or drag in the resultant force.\n\n> Exam tip: always draw a free-body diagram first.\n\n## Flashcards\n\nResultant force :: The single force that has the same effect as all the forces acting together\nFree-body diagram :: A sketch of one object showing every force acting on it`,
    },
    {
      id: 'note_keeping-quiet', title: 'Keeping Quiet: analysis plan', subject: 'English', tags: ['essay'], createdAt: now - DAY, updatedAt: now - DAY,
      body: `## Thesis\n\nNeruda asks us to stop, so we can see what our busyness costs.\n\n## Quotations to use\n\n- "Now we will count to twelve / and we will all keep still" — the counting slows the reader down.\n- "Perhaps the earth can teach us" — the volta: nature as the teacher.\n\n## Structure (300 words)\n\n- [x] Introduction with the thesis\n- [ ] Paragraph on stillness and repetition\n- [ ] Paragraph on the volta\n- [ ] Conclusion: what the silence offers`,
    },
    {
      id: 'note_market-structures', title: 'Market structures cheat sheet', subject: 'Economics', tags: ['unit 4'], createdAt: now - 5 * DAY, updatedAt: now - 4 * DAY,
      body: `## At a glance\n\n| Structure | Firms | Barriers |\n|---|---|---|\n| Perfect competition | Many | None |\n| Monopolistic competition | Many | Low |\n| Oligopoly | Few | High |\n| Monopoly | One | Very high |\n\n## Remember\n\nOligopolists watch each other: a price cut by one firm is usually matched.`,
    },
  ];
  const topic = (subject: string, name: string, confidence: Confidence): Topic => ({ id: `topic_${key(subject)}_${key(name)}`, subject, name, confidence, updatedAt: now });
  const topics: Topic[] = [
    topic('Physics', 'Forces and motion', 2), topic('Physics', 'Energy and work', 1), topic('Physics', 'Waves', 0), topic('Physics', 'Electricity', 1),
    topic('Mathematics', 'Differentiation', 3), topic('Mathematics', 'Integration', 1), topic('Mathematics', 'Trigonometry', 2), topic('Mathematics', 'Probability', 2),
    topic('Economics', 'Market structures', 2), topic('Economics', 'Elasticity', 1), topic('Economics', 'Market failure', 0),
    topic('English', 'Poetry analysis', 2), topic('English', 'Essay structure', 3),
    topic('Business Studies', 'Marketing mix', 2), topic('Business Studies', 'Cash flow', 1),
  ];
  const sessions: FocusSession[] = [
    { id: 'fs_seed_1', startedAt: now - DAY - 3 * 3_600_000, minutes: 25, label: 'Physics revision' },
    { id: 'fs_seed_2', startedAt: now - DAY - 2 * 3_600_000, minutes: 25, label: 'Physics revision' },
    { id: 'fs_seed_3', startedAt: now - 2 * DAY, minutes: 50, label: 'Integration practice' },
  ];
  return { decks: decks.map(([d]) => d), cards: decks.flatMap(([, c]) => c), notes, sessions, topics, quizzes: [], xp: { total: 0, days: {}, goal: 50 }, achievements: {} };
}

export const studyStore = createLocalStore<StudyState>('study', seed, {
  migrate: (raw) => {
    const r = raw as Partial<StudyState> | null;
    if (!r || !Array.isArray(r.decks) || !Array.isArray(r.cards)) return null;
    return { decks: r.decks, cards: r.cards, notes: r.notes ?? [], sessions: r.sessions ?? [], topics: r.topics ?? [], quizzes: r.quizzes ?? [], xp: r.xp ?? { total: 0, days: {}, goal: 50 }, achievements: r.achievements ?? {} };
  },
});
export const useStudy = () => studyStore.use();

/* ------------------------------------------------------------------ actions */
const touchDeck = (s: StudyState, deckId: string): Deck[] => s.decks.map((d) => (d.id === deckId ? { ...d, updatedAt: Date.now() } : d));

export const study = {
  addDeck(title: string, subject: string): string {
    const id = uid('deck_'); const now = Date.now();
    studyStore.set((s) => ({ ...s, decks: [{ id, title: title.trim() || 'Untitled deck', subject, createdAt: now, updatedAt: now }, ...s.decks] }));
    return id;
  },
  renameDeck(id: string, title: string, subject?: string) {
    studyStore.set((s) => ({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, title: title.trim() || d.title, subject: subject ?? d.subject, updatedAt: Date.now() } : d)) }));
  },
  removeDeck(id: string) { studyStore.set((s) => ({ ...s, decks: s.decks.filter((d) => d.id !== id), cards: s.cards.filter((c) => c.deckId !== id) })); },
  restoreDeck(deck: Deck, cards: Card[]) { studyStore.set((s) => ({ ...s, decks: [deck, ...s.decks.filter((d) => d.id !== deck.id)], cards: [...s.cards.filter((c) => c.deckId !== deck.id), ...cards] })); },
  addCards(deckId: string, pairs: [string, string][]) {
    const now = Date.now();
    const cards = pairs.filter(([f, b]) => f.trim() && b.trim()).map(([front, back]) => ({ id: uid('card_'), deckId, front: front.trim(), back: back.trim(), createdAt: now, due: now, interval: 0, ease: 2.5, reps: 0, lapses: 0 }));
    studyStore.set((s) => ({ ...s, cards: [...s.cards, ...cards], decks: touchDeck(s, deckId) }));
    return cards.length;
  },
  updateCard(id: string, patch: Partial<Pick<Card, 'front' | 'back'>>) { studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })); },
  removeCard(id: string) { studyStore.set((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) })); },
  grade(id: string, g: Grade) { studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? review(c, g) : c)) })); study.addXp(g === 0 ? 2 : 5); },
  addNote(subject = 'Other'): string {
    const id = uid('note_'); const now = Date.now();
    studyStore.set((s) => ({ ...s, notes: [{ id, title: '', body: '', subject, tags: [], createdAt: now, updatedAt: now }, ...s.notes] }));
    return id;
  },
  saveNote(id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) {
    studyStore.set((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n)) }));
  },
  removeNote(id: string): Note | undefined {
    const note = studyStore.get().notes.find((n) => n.id === id);
    studyStore.set((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }));
    return note;
  },
  restoreNote(note: Note) { studyStore.set((s) => ({ ...s, notes: [note, ...s.notes.filter((n) => n.id !== note.id)] })); },
  logFocus(minutes: number, label: string) {
    studyStore.set((s) => ({ ...s, sessions: [...s.sessions, { id: uid('fs_'), startedAt: Date.now() - minutes * 60_000, minutes, label: label.trim() || 'Focus' }] }));
  },
  setConfidence(id: string, confidence: Confidence) { studyStore.set((s) => ({ ...s, topics: s.topics.map((t) => (t.id === id ? { ...t, confidence, updatedAt: Date.now() } : t)) })); },
  addTopic(subject: string, name: string) {
    if (!name.trim()) return;
    studyStore.set((s) => ({ ...s, topics: [...s.topics, { id: uid('topic_'), subject, name: name.trim(), confidence: 0, updatedAt: Date.now() }] }));
  },
  renameTopic(id: string, name: string) { if (!name.trim()) return; studyStore.set((s) => ({ ...s, topics: s.topics.map((t) => (t.id === id ? { ...t, name: name.trim().slice(0, 80), updatedAt: Date.now() } : t)) })); },
  removeTopic(id: string) { studyStore.set((s) => ({ ...s, topics: s.topics.filter((t) => t.id !== id) })); },
  logQuiz(deckId: string, score: number, total: number) {
    studyStore.set((s) => ({ ...s, quizzes: [...s.quizzes.slice(-49), { id: uid('quiz_'), deckId, at: Date.now(), score, total }] }));
    if (total >= 5 && score === total) study.unlock('perfect');
  },
  /** A whole deck at once (from Create, an import or a shared link). Returns the new deck's id. */
  createDeck(title: string, subject: string, cards: { front: string; back: string; kind?: string }[], source?: string): string {
    const id = uid('deck_'); const now = Date.now();
    const made = cards.filter((c) => c.front.trim() && c.back.trim()).map((c, i): Card => ({ id: uid('card_'), deckId: id, front: c.front.trim(), back: c.back.trim(), createdAt: now, due: now - i, interval: 0, ease: 2.5, reps: 0, lapses: 0, ...(c.kind ? { kind: c.kind } : {}) }));
    studyStore.set((s) => ({ ...s, decks: [{ id, title: title.trim() || 'New deck', subject, createdAt: now, updatedAt: now, ...(source ? { source } : {}) }, ...s.decks], cards: [...s.cards, ...made] }));
    study.unlock('first-deck');
    return id;
  },
  setDeck(id: string, patch: Partial<Pick<Deck, 'examDate' | 'source' | 'subject'>>) {
    studyStore.set((s) => ({ ...s, decks: s.decks.map((d) => (d.id === id ? { ...d, ...patch } : d)) }));
  },
  /** Keep a personal best (lower is better for match times, higher for scores). */
  best(id: string, key: 'match' | 'challenge', value: number): boolean {
    const d = studyStore.get().decks.find((x) => x.id === id); if (!d) return false;
    const old = d.best?.[key];
    const better = old === undefined || (key === 'match' ? value < old : value > old);
    if (better) studyStore.set((s) => ({ ...s, decks: s.decks.map((x) => (x.id === id ? { ...x, best: { ...x.best, [key]: value } } : x)) }));
    return better;
  },
  star(id: string, on?: boolean) { studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, starred: on ?? !c.starred } : c)) })); },
  setLearn(id: string, stage: 0 | 1 | 2 | 3) { studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, learn: stage } : c)) })); },
  resetLearn(deckId: string) { studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (c.deckId === deckId ? { ...c, learn: 0 } : c)) })); },
  /** Mark cards as due now (missed in a test, so they come back first). */
  dueNow(ids: string[]) { const now = Date.now(); const set = new Set(ids); studyStore.set((s) => ({ ...s, cards: s.cards.map((c) => (set.has(c.id) ? { ...c, due: now } : c)) })); },
  /** XP for studying: answers, reviews, games. Returns the day's new total. */
  addXp(n: number): number {
    if (n <= 0) return 0;
    const day = dayKey(Date.now()); let today = 0;
    studyStore.set((s) => { today = (s.xp.days[day] ?? 0) + n; const days = { ...s.xp.days, [day]: today }; return { ...s, xp: { ...s.xp, total: s.xp.total + n, days: Object.fromEntries(Object.entries(days).slice(-60)) } }; });
    const st = studyStore.get();
    if (today >= st.xp.goal && today - n < st.xp.goal) study.unlock('goal');
    if (st.xp.total >= 1000) study.unlock('xp-1000');
    if (studyStreak(st) >= 7) study.unlock('streak-7');
    return today;
  },
  setGoal(goal: number) { studyStore.set((s) => ({ ...s, xp: { ...s.xp, goal: Math.max(10, Math.min(500, Math.round(goal))) } })); },
  unlock(key: string) { if (!studyStore.get().achievements[key]) studyStore.set((s) => ({ ...s, achievements: { ...s.achievements, [key]: Date.now() } })); },
};

export const dayKey = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
/** XP this week (Monday first) and today. */
export function xpStats(state: StudyState, now = Date.now()) {
  const d = new Date(now); const dow = (d.getDay() + 6) % 7; const mon = new Date(d); mon.setHours(0, 0, 0, 0); mon.setDate(d.getDate() - dow);
  let week = 0; for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); week += state.xp.days[dayKey(x.getTime())] ?? 0; }
  return { today: state.xp.days[dayKey(now)] ?? 0, week, goal: state.xp.goal, total: state.xp.total };
}

/** Badges a student can earn; the hub shows them, earned or still to get. */
export const ACHIEVEMENTS: { key: string; en: string; ar: string; hint: [string, string] }[] = [
  { key: 'first-deck', en: 'First deck', ar: 'أول مجموعة', hint: ['Make or import a deck', 'أنشئ مجموعة أو استوردها'] },
  { key: 'goal', en: 'Daily goal', ar: 'الهدف اليومي', hint: ['Reach your daily XP goal', 'حقق هدفك اليومي'] },
  { key: 'perfect', en: 'Perfect test', ar: 'اختبار كامل', hint: ['Get every question right (5 or more)', 'أجب عن كل الأسئلة صحيحاً'] },
  { key: 'mastered', en: 'Deck mastered', ar: 'إتقان مجموعة', hint: ['Master every card in Learn', 'أتقن كل البطاقات في وضع التعلم'] },
  { key: 'speedy', en: 'Speed matcher', ar: 'سرعة المطابقة', hint: ['Finish Match in under 25 seconds', 'أنهِ المطابقة في أقل من 25 ثانية'] },
  { key: 'survivor', en: 'Survivor', ar: 'الصامد', hint: ['Score 15+ in Challenge', 'احصل على 15+ في التحدي'] },
  { key: 'streak-7', en: '7-day streak', ar: 'سلسلة 7 أيام', hint: ['Study 7 days in a row', 'ادرس 7 أيام متتالية'] },
  { key: 'xp-1000', en: '1,000 XP', ar: '1000 نقطة', hint: ['Earn 1,000 XP in total', 'اجمع 1000 نقطة'] },
];

/** Flashcard pairs written in a note as `front :: back` lines. */
export function cardsFromText(text: string): [string, string][] {
  return text.split('\n').map((l) => l.split('::')).filter((p) => p.length === 2 && p[0]!.trim() && p[1]!.trim()).map(([f, b]) => [f!.replace(/^[-*]\s*/, '').trim(), b!.trim()]);
}

/* ------------------------------------------------------------------ derived */
export function weekFocusMinutes(sessions: FocusSession[], now = Date.now()) {
  return sessions.filter((s) => now - s.startedAt < 7 * DAY).reduce((a, s) => a + s.minutes, 0);
}
export function todayFocusMinutes(sessions: FocusSession[], now = new Date()) {
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  return sessions.filter((s) => s.startedAt >= start.getTime()).reduce((a, s) => a + s.minutes, 0);
}
/** Days in a row (ending today or yesterday) with at least one focus session or card review. */
export function studyStreak(state: StudyState, now = new Date()): number {
  const days = new Set<string>();
  const key = (t: number) => new Date(t).toDateString();
  for (const s of state.sessions) days.add(key(s.startedAt));
  for (const c of state.cards) if (c.reviewedAt) days.add(key(c.reviewedAt));
  let n = 0; const d = new Date(now);
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export function readingMinutes(text: string) { return Math.max(1, Math.round(text.trim().split(/\s+/).filter(Boolean).length / 200)); }
