'use client';

import { createLocalStore } from './local-store';

/**
 * Practice tools that run in the browser: reading aloud (words correct per minute and accuracy, like Reading Progress),
 * a speaking coach (pace, filler words, repeats, pauses), an immersive reader's settings, and maths practice that
 * adapts its level. The scoring here is plain code, so it works offline and needs no key.
 */

/* ------------------------------------------------------------------ words */

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;
/** Lower case, no punctuation, Arabic without short vowels and with one form of alef/yaa/taa marbuta. */
export function normWord(w: string): string {
  return w.toLowerCase().replace(TASHKEEL, '').replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[’']/g, '').replace(/[^\p{L}\p{N}]+/gu, '');
}
export function words(text: string): string[] {
  return text.split(/\s+/).map(normWord).filter(Boolean);
}
export const isArabic = (text: string) => (text.match(/[؀-ۿ]/g)?.length ?? 0) > text.length * 0.2;

const NUM: Record<string, string> = { zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6', seven: '7', eight: '8', nine: '9', ten: '10', eleven: '11', twelve: '12', twenty: '20', hundred: '100' };
/** Close enough: the same word, a number said as a word, or one letter off on a longer word (accents, plurals). */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (NUM[a] === b || NUM[b] === a) return true;
  if (a.length >= 5 && b.length >= 5 && Math.abs(a.length - b.length) <= 1) {
    let i = 0; while (i < a.length && a[i] === b[i]) i++;
    let j = 0; while (j < a.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
    return i + j >= Math.max(a.length, b.length) - 1;
  }
  return false;
}

export type WordMark = 'ok' | 'wrong' | 'missed' | 'pending';
/**
 * Line up what was heard against the passage (edit-distance alignment). Words after the last one heard are
 * `pending` (not read yet), not `missed`, so a reader who stops early is scored on what they read.
 */
export function align(expected: string[], heard: string[]): { marks: WordMark[]; correct: number; read: number; inserted: number } {
  const n = expected.length; const m = heard.length;
  if (!m) return { marks: expected.map(() => 'pending'), correct: 0, read: 0, inserted: 0 };
  // cost[i][j] = edits to match expected[0..i) with heard[0..j)
  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
    const sub = cost[i - 1]![j - 1]! + (sameWord(expected[i - 1]!, heard[j - 1]!) ? 0 : 1);
    cost[i]![j] = Math.min(sub, cost[i - 1]![j]! + 1, cost[i]![j - 1]! + 1);
  }
  // the reader may have stopped early: the passage position that best explains everything heard (the furthest on a tie)
  let end = 0; let best = Infinity;
  for (let i = 0; i <= n; i++) { const c = cost[i]![m]!; if (c <= best) { best = c; end = i; } }
  const marks: WordMark[] = expected.map((_, i) => (i < end ? 'missed' : 'pending'));
  let inserted = 0;
  for (let i = end, j = m; i > 0 || j > 0;) {
    if (i > 0 && j > 0 && cost[i]![j] === cost[i - 1]![j - 1]! + (sameWord(expected[i - 1]!, heard[j - 1]!) ? 0 : 1)) {
      marks[i - 1] = sameWord(expected[i - 1]!, heard[j - 1]!) ? 'ok' : 'wrong'; i--; j--;
    } else if (i > 0 && cost[i]![j] === cost[i - 1]![j]! + 1) { marks[i - 1] = 'missed'; i--; }
    else { inserted++; j--; }
  }
  const correct = marks.filter((x) => x === 'ok').length;
  return { marks, correct, read: end, inserted };
}

/** Words correct per minute, the usual reading-fluency number. */
export const wcpm = (correct: number, seconds: number) => (seconds > 0 ? Math.round((correct / seconds) * 60) : 0);

/** A rough guide for read-aloud fluency by grade (words correct per minute, spring, middle of the class). */
export function fluencyGuide(grade: number | null): number {
  if (!grade) return 150;
  return grade <= 5 ? 140 : grade <= 6 ? 150 : grade <= 8 ? 155 : 160;
}

/* ------------------------------------------------------------------ speaking */

const FILLERS_EN = ['um', 'umm', 'uh', 'uhh', 'er', 'erm', 'ah', 'like', 'you know', 'basically', 'actually', 'literally', 'i mean', 'kind of', 'sort of', 'so yeah'];
const FILLERS_AR = ['يعني', 'طيب', 'اممم', 'امم', 'ام', 'اه', 'آه', 'بس', 'يعنى', 'زي ما', 'شي'];
export function fillers(text: string): { word: string; n: number }[] {
  const t = ` ${text.toLowerCase().replace(/[.,!?؟،;:]/g, ' ').replace(/\s+/g, ' ')} `;
  const list = isArabic(text) ? FILLERS_AR : FILLERS_EN;
  const out: { word: string; n: number }[] = [];
  for (const f of list) {
    // "like" only counts as a filler when it is not "I like" / "would like" / "looks like"
    let n = 0; let at = 0;
    for (;;) {
      const i = t.indexOf(` ${f} `, at); if (i < 0) break;
      const before = t.slice(Math.max(0, i - 12), i);
      const prev = before.trim().split(' ').pop() ?? '';
      if (!(f === 'like' && /^(i|you|we|they|would|looks|look|feel|feels|seems|just|really|don't|didn't|is|was|be)$/.test(prev))) n++;
      at = i + f.length + 1;
    }
    if (n) out.push({ word: f, n });
  }
  return out.sort((a, b) => b.n - a.n);
}
/** The same word twice in a row ("the the"). */
export function repeats(text: string): number {
  const w = words(text); let n = 0;
  for (let i = 1; i < w.length; i++) if (w[i] === w[i - 1] && w[i]!.length > 1) n++;
  return n;
}
export type Pace = 'slow' | 'good' | 'fast';
export const paceOf = (wpm: number): Pace => (wpm < 110 ? 'slow' : wpm > 170 ? 'fast' : 'good');

export function speakingReport(text: string, seconds: number, pauses: number[]) {
  const w = words(text);
  const wpm = seconds > 0 ? Math.round((w.length / seconds) * 60) : 0;
  const f = fillers(text);
  const unique = new Set(w).size;
  return {
    words: w.length, seconds, wpm, pace: paceOf(wpm), fillers: f, fillerCount: f.reduce((t, x) => t + x.n, 0),
    repeats: repeats(text), longPauses: pauses.filter((p) => p >= 3).length, longestPause: Math.round(Math.max(0, ...pauses) * 10) / 10,
    variety: w.length ? Math.round((unique / w.length) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ maths */

export type Skill = 'add' | 'subtract' | 'multiply' | 'divide' | 'fractions' | 'percent' | 'equations' | 'powers';
export const SKILLS: { id: Skill; en: string; ar: string }[] = [
  { id: 'add', en: 'Adding', ar: 'الجمع' }, { id: 'subtract', en: 'Subtracting', ar: 'الطرح' }, { id: 'multiply', en: 'Times tables and multiplying', ar: 'جدول الضرب والضرب' },
  { id: 'divide', en: 'Dividing', ar: 'القسمة' }, { id: 'fractions', en: 'Fractions', ar: 'الكسور' }, { id: 'percent', en: 'Percentages', ar: 'النسب المئوية' },
  { id: 'equations', en: 'Solving equations', ar: 'حل المعادلات' }, { id: 'powers', en: 'Powers and roots', ar: 'القوى والجذور' },
];
export interface Question { prompt: string; answer: number; answerText: string; steps: string[]; fraction?: boolean }

/** Small seeded random numbers, so a question can be rebuilt from its seed. */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : Math.abs(a));

export function makeQuestion(skill: Skill, level: number, seed: number): Question {
  const r = seeded(seed); const L = Math.max(1, Math.min(5, level));
  const int = (lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
  switch (skill) {
    case 'add': {
      const hi = [20, 100, 1000, 10000, 100000][L - 1]!; const a = int(hi / 10, hi); const b = int(hi / 10, hi);
      return { prompt: `${a} + ${b}`, answer: a + b, answerText: String(a + b), steps: [`Add the ones, then the tens, carrying when a column passes 9.`, `${a} + ${b} = ${a + b}`] };
    }
    case 'subtract': {
      const hi = [20, 100, 1000, 10000, 100000][L - 1]!; let a = int(hi / 10, hi); let b = int(hi / 10, hi); if (b > a) [a, b] = [b, a];
      return { prompt: `${a} − ${b}`, answer: a - b, answerText: String(a - b), steps: [`Take away column by column, borrowing from the next column when you need to.`, `${a} − ${b} = ${a - b}`] };
    }
    case 'multiply': {
      const [a, b] = L <= 2 ? [int(2, L === 1 ? 10 : 12), int(2, 12)] : L === 3 ? [int(12, 99), int(2, 9)] : L === 4 ? [int(12, 99), int(11, 99)] : [int(100, 999), int(11, 99)];
      return { prompt: `${a} × ${b}`, answer: a * b, answerText: String(a * b), steps: b > 10 ? [`Split ${b} into ${Math.floor(b / 10) * 10} + ${b % 10}.`, `${a} × ${Math.floor(b / 10) * 10} = ${a * Math.floor(b / 10) * 10}; ${a} × ${b % 10} = ${a * (b % 10)}`, `Add them: ${a * b}`] : [`${a} × ${b} = ${a * b}`] };
    }
    case 'divide': {
      const b = int(2, L <= 2 ? 10 : 12 + L * 3); const q = int(2, [10, 12, 25, 99, 250][L - 1]!);
      return { prompt: `${b * q} ÷ ${b}`, answer: q, answerText: String(q), steps: [`How many ${b}s make ${b * q}?`, `${b} × ${q} = ${b * q}, so the answer is ${q}.`] };
    }
    case 'fractions': {
      const d1 = int(2, 4 + L); const d2 = L <= 2 ? d1 : int(2, 4 + L); const n1 = int(1, d1 - 1); const n2 = int(1, d2 - 1);
      const op = L >= 4 && r() < 0.5 ? '×' : r() < 0.5 || L < 3 ? '+' : '−';
      let num = op === '×' ? n1 * n2 : op === '+' ? n1 * d2 + n2 * d1 : n1 * d2 - n2 * d1; let den = d1 * d2;
      if (op !== '×' && d1 === d2) { num = op === '+' ? n1 + n2 : n1 - n2; den = d1; }
      const g = gcd(num, den) || 1; const sn = num / g; const sd = den / g;
      const ans = sd === 1 ? String(sn) : `${sn}/${sd}`;
      return { prompt: `${n1}/${d1} ${op} ${n2}/${d2}`, answer: sn / sd, answerText: ans, fraction: true,
        steps: op === '×' ? [`Multiply the tops and the bottoms: ${n1 * n2}/${d1 * d2}.`, `Simplify: ${ans}.`] : d1 === d2 ? [`Same bottom number, so ${op === '+' ? 'add' : 'take away'} the tops: ${num}/${den}.`, `Simplify: ${ans}.`] : [`Use a common bottom number: ${d1 * d2}.`, `${n1 * d2}/${den} ${op} ${n2 * d1}/${den} = ${num}/${den}`, `Simplify: ${ans}.`] };
    }
    case 'percent': {
      const p = [10, 25, 50, 20, 5, 15, 12.5, 35, 75, 40][int(0, Math.min(9, L * 2 + 1))]!; const base = int(2, 4 * L) * (p === 12.5 ? 8 : 20);
      const ans = Math.round(((p * base) / 100) * 100) / 100;
      return { prompt: `${p}% of ${base}`, answer: ans, answerText: String(ans), steps: [`${p}% means ${p} out of 100.`, `${base} ÷ 100 × ${p} = ${ans}`] };
    }
    case 'equations': {
      const x = int(-3 * L, 4 * L) || 2; const a = int(2, 2 + L * 2); const b = int(-10 * L, 10 * L); const c = a * x + b;
      const sign = b < 0 ? `− ${-b}` : `+ ${b}`;
      return { prompt: `${a}x ${sign} = ${c}`, answer: x, answerText: String(x), steps: [`${b < 0 ? 'Add' : 'Take away'} ${Math.abs(b)} on both sides: ${a}x = ${c - b}.`, `Divide both sides by ${a}: x = ${x}.`] };
    }
    case 'powers': {
      if (r() < 0.5) { const b = int(2, 5 + L * 2); return { prompt: `${b}²`, answer: b * b, answerText: String(b * b), steps: [`${b}² means ${b} × ${b} = ${b * b}.`] }; }
      const b = int(2, 6 + L * 3); return { prompt: `√${b * b}`, answer: b, answerText: String(b), steps: [`Which number times itself makes ${b * b}? ${b} × ${b} = ${b * b}.`] };
    }
  }
}

/** Accepts "3/4", "0.75", "-2", "1 1/2", Arabic digits and a comma decimal. */
export function readAnswer(raw: string): number | null {
  const s = raw.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/−/g, '-').replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!s) return null;
  const mixed = /^(-?\d+) (\d+)\/(\d+)$/.exec(s);
  if (mixed) { const w = Number(mixed[1]); const f = Number(mixed[2]) / Number(mixed[3]); return w < 0 ? w - f : w + f; }
  const frac = /^(-?\d+)\/(-?\d+)$/.exec(s);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
export const isRight = (q: Question, raw: string) => { const v = readAnswer(raw); return v !== null && Math.abs(v - q.answer) < 1e-6 + Math.abs(q.answer) * 1e-9; };

/** Level up after 3 right in a row, down after 2 wrong in a row. */
export function nextLevel(level: number, history: boolean[]): number {
  const last3 = history.slice(-3); const last2 = history.slice(-2);
  if (last3.length === 3 && last3.every(Boolean)) return Math.min(5, level + 1);
  if (last2.length === 2 && last2.every((x) => !x)) return Math.max(1, level - 1);
  return level;
}

/* ------------------------------------------------------------------ saved on the device (and synced) */

export interface ReadingRun { id: string; at: number; title: string; words: number; seconds: number; wcpm: number; accuracy: number; practise: string[] }
export interface SpeakingRun { id: string; at: number; title: string; seconds: number; words: number; wpm: number; fillers: number; repeats: number }
export interface MathsRun { id: string; at: number; skill: Skill; level: number; correct: number; total: number; seconds: number; mistakes: { prompt: string; answer: string; given: string }[] }
export interface ReaderPrefs { size: number; spacing: number; letter: number; theme: 'paper' | 'white' | 'blue' | 'dark'; font: 'sans' | 'serif' | 'wide'; rate: number; focus: 0 | 1 | 3 }
export interface Practice { reading: ReadingRun[]; speaking: SpeakingRun[]; maths: MathsRun[]; levels: Partial<Record<Skill, number>>; reader: ReaderPrefs }

export const practiceStore = createLocalStore<Practice>('practice', () => ({ reading: [], speaking: [], maths: [], levels: {}, reader: { size: 22, spacing: 1.9, letter: 0, theme: 'paper', font: 'sans', rate: 1, focus: 0 } }));
export const usePractice = () => practiceStore.use();
const id = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const practice = {
  addReading: (r: Omit<ReadingRun, 'id' | 'at'>) => practiceStore.set((s) => ({ ...s, reading: [...s.reading, { ...r, id: id(), at: Date.now() }].slice(-100) })),
  addSpeaking: (r: Omit<SpeakingRun, 'id' | 'at'>) => practiceStore.set((s) => ({ ...s, speaking: [...s.speaking, { ...r, id: id(), at: Date.now() }].slice(-100) })),
  addMaths: (r: Omit<MathsRun, 'id' | 'at'>) => practiceStore.set((s) => ({ ...s, maths: [...s.maths, { ...r, id: id(), at: Date.now() }].slice(-200), levels: { ...s.levels, [r.skill]: r.level } })),
  setReader: (p: Partial<ReaderPrefs>) => practiceStore.set((s) => ({ ...s, reader: { ...s.reader, ...p } })),
};

/* ------------------------------------------------------------------ speech in the browser */

/* eslint-disable @typescript-eslint/no-explicit-any */
export function speechRecognition(): (new () => any) | null {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any };
  return W.SpeechRecognition ?? W.webkitSpeechRecognition ?? null;
}
/** Say a word or sentence with the device's voice (in Arabic when the text is Arabic). */
export function say(text: string, rate = 1) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = isArabic(text) ? 'ar-AE' : 'en-GB'; u.rate = rate;
  window.speechSynthesis.speak(u);
}
