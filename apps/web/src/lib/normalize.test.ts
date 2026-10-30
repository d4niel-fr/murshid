import { describe, expect, it } from 'vitest';
import { parseSSE } from './api';
import { normalizeToolArgs, toAcademics, toDashboard, toLinks } from './normalize';

const v1Dashboard = {
  student: { id: 'demo-g9', name: 'Priya Menon', preferredName: 'Priya', nameAr: 'بريا مينون', grade: 9, band: 'g9-10', classLabel: 'Class IX', school: 'Crescent (demo)' },
  band: 'g9-10',
  today: [{ id: 't1', title: 'Science revision', kind: 'study', date: '2026-10-10', time: '17:00', durationMinutes: 45, status: 'todo', done: false, area: null }],
  upcoming: [{ id: 'u1', kind: 'assessment', title: 'Periodic Test 1', date: '2026-10-12', daysLeft: 2 }],
  progress: {
    academics: { average: 86, target: 90, delta12w: 2, trend: 'up', subjects: [] },
    extracurriculars: { thisWeekMinutes: 150, last7dMinutes: 160, weeklyTargetMinutes: 300, activities: [] },
    goals: [{ progress: 0.5 }, { progress: 0.25 }],
  },
  streaks: { studyDays: 21, longestStudyDays: 30, activityWeeks: 4, byActivity: {} },
  highlights: [{ id: 'h', kind: 'x', text: 'Squat PB', textAr: 'رقم قياسي', area: 'gym' }],
};

describe('v1 API normalisers', () => {
  it('maps the v1 dashboard to the contract shape', () => {
    const d = toDashboard(v1Dashboard)!;
    expect(d.student.firstName).toBe('Priya');
    expect(d.today[0]).toMatchObject({ id: 't1', due: '17:00', minutes: 45, done: false, area: 'academics' });
    expect(d.upcoming[0]!.type).toBe('test');
    expect(d.progress).toEqual({ academics: 96, extracurriculars: 53, goals: 38 });
    expect(d.streaks).toEqual({ current: 21, best: 30 });
    expect(toDashboard(v1Dashboard, 'ar')!.highlights[0]).toBe('رقم قياسي');
    expect(toDashboard({ nope: 1 })).toBeNull();
  });
  it('maps v1 academics (grades history → trend)', () => {
    const a = toAcademics({ term: { label: 'Term 1' }, average: 85, subjects: [{ id: 'maths', name: 'Mathematics', current: 91, target: 95, delta12w: 3, trend: 'up', grades: [{ percent: 86 }, { percent: 88 }, { percent: 90 }, { percent: 91 }] }] })!;
    expect(a.term).toBe('Term 1');
    expect(a.subjects[0]!.trend).toEqual([86, 88, 90, 91]);
  });
  it('maps links and tool args', () => {
    expect(toLinks({ linkedin: null, github: 'https://github.com/x', instagram: null, portfolio: null, connectedAt: { github: '2026-10-01' }, restrictions: {} })!.github).toBe('https://github.com/x');
    const o = normalizeToolArgs('show_opportunities', { opportunities: [{ id: 'o1', title: 'Hack', organizer: 'Org', type: 'summer-program', deadline: '2026-11-01', emirateLabel: 'Dubai', matchScore: 0.82, tags: ['x'], url: 'u' }] });
    expect((o.opportunities as Array<{ kind: string; match: number; org: string }>)[0]).toMatchObject({ kind: 'summer', match: 82, org: 'Org' });
  });
  it('parses v1 named SSE events', () => {
    const body = 'event: meta\ndata: {"intent":"chart"}\n\nevent: text-delta\ndata: {"delta":"Hi "}\n\nevent: text-delta\ndata: {"delta":"there"}\n\nevent: tool-call\ndata: {"name":"render_chart","args":{"id":"c"}}\n\n';
    expect(parseSSE(body)).toEqual({ text: 'Hi there', toolCalls: [{ name: 'render_chart', args: { id: 'c' } }] });
  });
});
