import { describe, expect, it } from 'vitest';
import { CRISIS_RE, routeByRules } from '../src/sub-agents';

describe('crisis detection runs before any model', () => {
  const crisis = [
    'i want to kill myself', 'sometimes I want to die', 'kms this is too much', 'thinking about unaliving myself',
    "I'm going to end it all", 'everyone would be better off without me', "I don't want to exist anymore",
    "there's no point in living", 'I started cutting myself again', 'i want to hurt myself', 'I took an overdose',
    'my uncle touches me inappropriately', 'someone online asked me to send nudes', 'he threatened to share my photos',
    'I am being hit at home', 'أريد أن أموت', 'أفكر في الانتحار', 'ابي اموت', 'أجرح نفسي',
  ];
  it.each(crisis)('flags: %s', (m) => {
    expect(CRISIS_RE.test(m)).toBe(true);
    expect(routeByRules(m).router).toBe('safety');
  });

  const ordinary = [
    'this homework is killing me', 'I died laughing at the physics video', 'my phone is dead', 'kill the lights before the movie',
    'how do I cut the fraction down', 'deadline for the hackathon', 'the plot of Romeo and Juliet ends with a death', 'أريد أن أدرس الرياضيات',
  ];
  it.each(ordinary)('does not flag: %s', (m) => expect(CRISIS_RE.test(m)).toBe(false));
});
