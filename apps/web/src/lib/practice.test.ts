import { describe, expect, it } from 'vitest';
import { align, fillers, isRight, makeQuestion, nextLevel, normWord, readAnswer, repeats, SKILLS, speakingReport, wcpm, words } from './practice';

describe('reading aloud', () => {
  it('normalises English and Arabic words', () => {
    expect(normWord('Hello,')).toBe('hello');
    expect(normWord('don’t')).toBe('dont');
    expect(normWord('مَدْرَسَةٌ')).toBe('مدرسه');
    expect(normWord('أحمد')).toBe('احمد');
  });
  it('scores a clean read', () => {
    const r = align(words('The cat sat on the mat'), words('the cat sat on the mat'));
    expect(r.correct).toBe(6);
    expect(r.marks.every((m) => m === 'ok')).toBe(true);
  });
  it('marks a skipped and a misread word, and leaves the unread end pending', () => {
    const exp = words('Camels can walk for days across the hot desert without water');
    const r = align(exp, words('camels can for days across the hat desert'));
    expect(r.marks.slice(0, 9)).toEqual(['ok', 'ok', 'missed', 'ok', 'ok', 'ok', 'ok', 'wrong', 'ok']);
    expect(r.marks.slice(9)).toEqual(['pending', 'pending']);
    expect(r.correct).toBe(7);
  });
  it('accepts numbers said as words and small slips on long words', () => {
    expect(align(words('I have 3 brothers'), words('i have three brothers')).correct).toBe(4);
    expect(align(words('the scientists'), words('the scientist')).correct).toBe(2);
  });
  it('works out words correct per minute', () => {
    expect(wcpm(120, 60)).toBe(120);
    expect(wcpm(50, 30)).toBe(100);
    expect(wcpm(10, 0)).toBe(0);
  });
});

describe('speaking coach', () => {
  it('counts filler words but not "I like"', () => {
    const f = fillers('So um I like football and, like, um basically it is fun you know');
    expect(f.find((x) => x.word === 'um')?.n).toBe(2);
    expect(f.find((x) => x.word === 'like')?.n).toBe(1);
    expect(f.find((x) => x.word === 'basically')?.n).toBe(1);
    expect(f.find((x) => x.word === 'you know')?.n).toBe(1);
  });
  it('counts Arabic fillers and repeated words', () => {
    expect(fillers('يعني أنا يعني أحب القراءة').find((x) => x.word === 'يعني')?.n).toBe(2);
    expect(repeats('the the cat sat sat down')).toBe(2);
  });
  it('reports pace', () => {
    const r = speakingReport(Array.from({ length: 140 }, () => 'word').join(' '), 60, [1, 4, 0.5]);
    expect(r).toMatchObject({ wpm: 140, pace: 'good', longPauses: 1, longestPause: 4 });
    expect(speakingReport('a b c', 60, []).pace).toBe('slow');
  });
});

describe('maths practice', () => {
  it('reads answers in many forms', () => {
    expect(readAnswer('3/4')).toBe(0.75);
    expect(readAnswer('0,75')).toBe(0.75);
    expect(readAnswer('1 1/2')).toBe(1.5);
    expect(readAnswer('−4')).toBe(-4);
    expect(readAnswer('١٢')).toBe(12);
    expect(readAnswer('abc')).toBeNull();
    expect(readAnswer('1/0')).toBeNull();
  });
  it('makes questions whose answers check out, for every skill and level', () => {
    for (const s of SKILLS) for (let level = 1; level <= 5; level++) for (let seed = 1; seed < 40; seed++) {
      const q = makeQuestion(s.id, level, seed * 7919 + level);
      expect(Number.isFinite(q.answer)).toBe(true);
      expect(isRight(q, q.answerText)).toBe(true);
      expect(q.steps.length).toBeGreaterThan(0);
    }
  });
  it('is the same question for the same seed', () => {
    expect(makeQuestion('equations', 3, 42)).toEqual(makeQuestion('equations', 3, 42));
  });
  it('moves the level up after 3 right and down after 2 wrong', () => {
    expect(nextLevel(2, [true, true, true])).toBe(3);
    expect(nextLevel(2, [true, false, false])).toBe(1);
    expect(nextLevel(5, [true, true, true])).toBe(5);
    expect(nextLevel(1, [false, false])).toBe(1);
    expect(nextLevel(3, [true, false])).toBe(3);
  });
});
