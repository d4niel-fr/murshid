import { describe, expect, it } from 'vitest';
import { briefingToEmail, briefingToPush, briefingToWhatsAppParams, composeWeeklyBriefing } from '../src/index.js';
import { aisha, application, dubai, events, exams, goals, guardianGranted, opportunity, tasks } from './fixtures.js';

const now = dubai('2026-10-11 18:00'); // Sunday
const input = {
  student: aisha,
  tasks,
  exams,
  events,
  applications: [{ application, opportunity }],
  newOpportunities: [
    { ...opportunity, id: 'o-2', title: 'Test Science Olympiad' },
    { ...opportunity, id: 'o-3', title: 'Closed one', status: 'closed' as const },
  ],
  goals,
  previousGoalProgress: { 'g-1': 40, 'g-2': 30 },
  now,
};

describe('composeWeeklyBriefing', () => {
  const b = composeWeeklyBriefing({ ...input, audience: 'student' });

  it('counts tests (deduped across exams + calendar), deadlines, new opportunities, overdue', () => {
    expect(b.counts).toEqual({ tests: 2, deadlines: 3, newOpportunities: 1, overdue: 1, activeGoals: 2 });
    expect(b.items.map((i) => i.title)).toEqual(['Maths quiz', 'English essay draft', 'Physics lab report', 'Chemistry unit test', 'Test Youth Hackathon']);
    expect(b.headline).toBe('Busy week: 5 things due');
  });

  it('reports goal progress with weekly deltas', () => {
    expect(b.goals).toEqual([
      { id: 'g-1', title: 'A* in Physics', progress: 55, delta: 15 },
      { id: 'g-2', title: 'Learn Python', progress: 30, delta: 0 },
    ]);
    expect(b.tips.join(' ')).toMatch(/overdue/);
    expect(b.tips.join(' ')).toMatch(/Learn Python/);
  });

  it('renders push within platform limits', () => {
    const p = briefingToPush(b);
    expect(p.title.length).toBeLessThanOrEqual(50);
    expect(p.body.length).toBeLessThanOrEqual(178);
    expect(p.body).toContain('2 tests, 3 deadlines, 1 new opportunity');
  });

  it('renders WhatsApp params without newlines', () => {
    const params = briefingToWhatsAppParams(b);
    expect(params).toHaveLength(6);
    expect(params.slice(0, 4)).toEqual(['Aisha', '2', '3', '1']);
    expect(params.every((p) => !/[\n\t]/.test(p))).toBe(true);
    expect(params[4]).toBe('A* in Physics 55% (+15); Learn Python 30%');
  });

  it('renders email HTML + text', () => {
    const e = briefingToEmail(b);
    expect(e.subject).toContain('Your week ahead');
    expect(e.html).toContain('Physics lab report');
    expect(e.html).toContain('A* in Physics');
    expect(e.text).toContain('- Maths quiz');
  });

  it('guardian briefing is summary-only (no item titles, no tips)', () => {
    const g = composeWeeklyBriefing({ ...input, audience: 'guardian', guardianName: guardianGranted.name });
    expect(g.items).toEqual([]);
    expect(g.greetingName).toBe('Mariam');
    const e = briefingToEmail(g);
    expect(e.html).not.toContain('Physics lab report');
    expect(e.subject).toContain("Aisha's week ahead");
    expect(briefingToWhatsAppParams(g)[5]).toContain("Aisha's summary");
  });

  it('escapes HTML in titles', () => {
    const x = composeWeeklyBriefing({ ...input, audience: 'student', tasks: [{ ...tasks[0]!, title: '<script>x</script>' }] });
    expect(briefingToEmail(x).html).not.toContain('<script>x');
  });

  it('handles an empty week', () => {
    const e = composeWeeklyBriefing({ student: aisha, audience: 'student', tasks: [], now });
    expect(e.headline).toBe('A lighter week ahead');
    expect(briefingToWhatsAppParams(e)[5]).toBe('nothing scheduled');
  });
});
