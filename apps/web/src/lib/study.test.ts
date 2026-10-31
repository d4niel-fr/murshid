import { describe, expect, it } from 'vitest';
import { cardsFromText, isDue, preview, readingMinutes, review, studyStreak, type Card, type StudyState } from './study';
import { fuzzy, rank } from './fuzzy';
import { headings, slug } from './markdown';
import { ago } from './ago';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 30, 12);
const card = (p: Partial<Card> = {}): Card => ({ id: 'c', deckId: 'd', front: 'F', back: 'B', createdAt: NOW, due: NOW, interval: 0, ease: 2.5, reps: 0, lapses: 0, ...p });

describe('spaced repetition', () => {
  it('brings a missed card back in 10 minutes and lowers its ease', () => {
    const c = review(card({ reps: 3, interval: 8 }), 0, NOW);
    expect(c.due - NOW).toBe(10 * 60_000);
    expect(c).toMatchObject({ reps: 0, interval: 0, lapses: 1, ease: 2.3 });
  });
  it('spaces good answers out: 1 day, 3 days, then interval × ease', () => {
    let c = review(card(), 2, NOW); expect(c.interval).toBe(1);
    c = review(c, 2, NOW); expect(c.interval).toBe(3);
    c = review(c, 2, NOW); expect(c.interval).toBe(Math.round(3 * 2.5));
    expect(isDue(c, NOW + 7 * DAY)).toBe(false);
    expect(isDue(c, NOW + 8 * DAY)).toBe(true);
  });
  it('never lets ease fall below 1.3', () => {
    let c = card({ ease: 1.35 });
    for (let i = 0; i < 5; i++) c = review(c, 0, NOW);
    expect(c.ease).toBe(1.3);
  });
  it('labels each button with what it would schedule', () => {
    expect(preview(card(), NOW)).toEqual({ 0: '10m', 1: '1d', 2: '1d', 3: '3d' });
  });
});

describe('notes to flashcards', () => {
  it('turns "term :: meaning" lines into cards and ignores everything else', () => {
    expect(cardsFromText('# Forces\n- Inertia :: resistance to change in motion\nplain line\nWork :: F × d\n :: empty front\nbad::')).toEqual([
      ['Inertia', 'resistance to change in motion'], ['Work', 'F × d'],
    ]);
  });
  it('estimates reading time at 200 words a minute, at least 1', () => {
    expect(readingMinutes('word '.repeat(10))).toBe(1);
    expect(readingMinutes('word '.repeat(1000))).toBe(5);
  });
});

describe('study streak', () => {
  const at = (daysAgo: number) => NOW - daysAgo * DAY;
  const state = (days: number[]): StudyState => ({ decks: [], cards: [], notes: [], topics: [], quizzes: [], sessions: days.map((d, i) => ({ id: `s${i}`, startedAt: at(d), minutes: 25, label: '' })) });
  it('counts consecutive days ending today', () => expect(studyStreak(state([0, 1, 2, 4]), new Date(NOW))).toBe(3));
  it('still counts if today has nothing yet but yesterday does', () => expect(studyStreak(state([1, 2]), new Date(NOW))).toBe(2));
  it('is 0 after a missed day', () => expect(studyStreak(state([2, 3]), new Date(NOW))).toBe(0));
});

describe('smart search', () => {
  it('ranks whole words above scattered letters', () => {
    const r = rank('plan', ['Opportunities', 'Planner', 'Explain a topic'], (x) => x);
    expect(r[0]!.item).toBe('Planner');
  });
  it('matches letters in order and returns their positions', () => {
    expect(fuzzy('fcm', 'Forces and motion')?.hits).toEqual([0, 3, 11]);
    expect(fuzzy('xyz', 'Forces and motion')).toBeNull();
  });
});

describe('notes outline', () => {
  it('lists h2 and h3 headings with stable ids (Arabic too)', () => {
    expect(headings('# Title\n## The three laws\ntext\n### Worked example\n## مراجعة')).toEqual([
      { id: 'the-three-laws', text: 'The three laws', level: 2 },
      { id: 'worked-example', text: 'Worked example', level: 3 },
      { id: slug('مراجعة'), text: 'مراجعة', level: 2 },
    ]);
  });
});

describe('relative times', () => {
  it('says how long ago within a week, then gives a date', () => {
    expect(ago(NOW - 20_000, 'en', NOW)).toBe('just now');
    expect(ago(NOW - 3 * DAY, 'en', NOW)).toMatch(/3 days ago/);
    expect(ago(NOW - 12 * DAY, 'en', NOW)).toBe('18 Oct');
    expect(ago(NOW - 400 * DAY, 'en', NOW)).toBe('25 Sept 2025');
  });
});
