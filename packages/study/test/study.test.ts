import { describe, expect, it } from 'vitest';
import { buildQuiz, checkAnswer, cleanText, definition, explainCard, generateCards, generateNotes, keyTerms, levelOf, outline, pairsFromText, sentences, summarise } from '../src/index';

const PHYSICS = `Forces and Motion

Momentum is the product of an object's mass and its velocity. It is measured in kg m/s.
Momentum: p = mv
The constant speed reached when drag equals weight is called terminal velocity.
Newton's second law states that the resultant force equals mass times acceleration, F = ma.
For example, a 2 kg trolley pushed with a resultant force of 4 N accelerates at 2 m/s².

Newton's laws
- An object stays at rest unless a resultant force acts on it
- Force equals mass times acceleration
- Every action has an equal and opposite reaction

Impulse is the change in momentum, equal to force multiplied by the time it acts.`;

describe('text helpers', () => {
  it('cleans PDF text and splits sentences without breaking decimals or e.g.', () => {
    expect(cleanText('accel-\neration\n\n\n\n12\nnext')).toBe('acceleration\n\nnext');
    expect(sentences('It weighs 3.5 kg, e.g. a bag. Next one!')).toEqual(['It weighs 3.5 kg, e.g. a bag.', 'Next one!']);
  });
  it('finds headings and their lines', () => {
    const o = outline(PHYSICS);
    expect(o.map((s) => s.heading)).toContain("Newton's laws");
  });
  it('picks key terms', () => {
    const t = keyTerms(PHYSICS).map((x) => x.toLowerCase());
    expect(t.some((x) => x.includes('momentum'))).toBe(true);
  });
});

describe('definitions', () => {
  it('reads "X is Y" and "Y is called X"', () => {
    expect(definition('Momentum is the product of mass and velocity.')).toMatchObject({ front: 'Momentum', back: 'The product of mass and velocity' });
    expect(definition('The constant speed reached when drag equals weight is called terminal velocity.')).toMatchObject({ front: 'Terminal velocity' });
    expect(definition('The test is very hard.')).toBeNull();
    expect(definition('It is a good idea to revise.')).toBeNull();
  });
});

describe('cards', () => {
  it('builds definition, formula, list and fill-in-the-blank cards from a passage', () => {
    const cards = generateCards(PHYSICS);
    const kinds = new Set(cards.map((c) => c.kind));
    expect(kinds.has('definition')).toBe(true);
    expect(kinds.has('formula')).toBe(true);
    expect(kinds.has('list')).toBe(true);
    expect(cards.find((c) => c.kind === 'formula')!.back).toBe('p = mv');
    const fronts = cards.map((c) => c.front.toLowerCase());
    expect(new Set(fronts).size).toBe(fronts.length);
  });
  it('keeps a pasted Quizlet / Anki export as it is', () => {
    const q = 'Enjambment\tA sentence running past the end of a line\nCaesura\tA pause mid-line\nVolta\tA turn in thought\nImagery\tLanguage for the senses';
    expect(generateCards(q)).toHaveLength(4);
    expect(pairsFromText('Monopoly - one firm with high barriers\nOligopoly :: a few large firms')).toEqual([
      { front: 'Monopoly', back: 'one firm with high barriers', kind: 'pair' }, { front: 'Oligopoly', back: 'a few large firms', kind: 'pair' },
    ]);
  });
});

describe('notes', () => {
  it('writes notes with a summary, key terms, formulas and a flashcard section', () => {
    const n = generateNotes(PHYSICS);
    expect(n.title).toBe('Forces and Motion');
    for (const h of ['## Summary', '## Key terms', '## Formulas', '## Check yourself', '## Flashcards']) expect(n.body).toContain(h);
    expect(n.body).toMatch(/Momentum :: /);
    expect(summarise(PHYSICS, 2)).toHaveLength(2);
  });
});

describe('quiz and grading', () => {
  const cards = generateCards(PHYSICS).map((c, i) => ({ id: `c${i}`, ...c }));
  it('mixes question types with four distinct options', () => {
    expect(cards.length).toBeGreaterThanOrEqual(7);
    const q = buildQuiz(cards, { seed: 7, count: 7 });
    expect(q).toHaveLength(7);
    const mc = q.find((x) => x.type === 'mc')!;
    expect(new Set(mc.options).size).toBe(4);
    expect(mc.options).toContain(mc.answer);
    const tf = q.find((x) => x.type === 'tf')!;
    expect(tf.truth).toBe(tf.statement === tf.answer);
  });
  it('grades typed answers kindly but honestly', () => {
    expect(checkAnswer('terminal velocty', 'Terminal velocity').verdict).toBe('right');
    expect(checkAnswer('the product of mass and velocity', 'The product of an object’s mass and its velocity').verdict).toBe('right');
    expect(checkAnswer('mass', 'The product of an object’s mass and its velocity').verdict).not.toBe('right');
    expect(checkAnswer('banana', 'p = mv').verdict).toBe('wrong');
  });
});

describe('explain and XP', () => {
  it('explains a card from the student’s material', () => {
    const e = explainCard('Momentum', 'The product of mass and velocity', PHYSICS);
    expect(e.simple).toMatch(/^Momentum, in short: the product/);
    expect(explainCard("Newton's laws: the 3 key points", '• Stays at rest\n• Force equals mass\n• Equal reaction').mnemonic).toMatch(/S F E/);
  });
  it('turns XP into levels', () => {
    expect(levelOf(0)).toEqual({ level: 1, into: 0, need: 100 });
    expect(levelOf(260)).toEqual({ level: 3, into: 10, need: 200 });
  });
});

describe('material from slides and PDFs', () => {
  it('reads glyph bullets with no space and strips bullets from definitions', () => {
    const slides = "## Market failure\n- Market failure occurs when the free market fails to allocate resources efficiently.\n- Public goods are non-excludable and non-rival.\n\n## Government responses\n•Taxes on demerit goods\n•Subsidies for merit goods\n•Regulation and legislation";
    const cards = generateCards(slides);
    expect(cards.map((c) => c.front)).toEqual(expect.arrayContaining(['Market failure', 'Public goods', 'Government responses: the 3 key points']));
    expect(cards.some((c) => c.front.startsWith('-'))).toBe(false);
    expect(cards.filter((c) => c.kind === 'list')).toHaveLength(1);
  });
});
