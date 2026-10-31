import { describe, expect, it } from 'vitest';
import type { CalendarEvent, Task } from '../src/domain';
import { planWeek } from '../src/services/planner';
import { NOW, setup } from './helpers';

const WEEK = '2026-10-12'; // Monday
let n = 0;
const task = (p: Partial<Task>): Task => ({
  id: `t${++n}`, student_id: 's', title: `Task ${n}`, kind: 'study', due_at: null, est_minutes: 60, status: 'todo',
  linked_goal_id: null, linked_material_id: null, linked_opportunity_id: null, ai_use_level: 'none', ...p,
});
const ev = (title: string, start: string, end: string): CalendarEvent => ({
  id: title, student_id: 's', title, start_at: start, end_at: end, source: 'manual', external_id: null,
});
const blocksOf = (plan: ReturnType<typeof planWeek>, id: string) => plan.days.flatMap((d) => d.blocks.filter((b) => b.task_id === id));
const ms = (s: string) => Date.parse(s);

describe('planner (unit)', () => {
  it('builds a Mon–Sun week with UAE windows', () => {
    const plan = planWeek([], [], { weekStart: WEEK, now: new Date('2026-10-11T00:00:00Z') });
    expect(plan.days.map((d) => d.weekday)).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
    expect(plan.days[0]!.free_minutes).toBe(300); // 16:00–21:00
    expect(plan.days[4]!.free_minutes).toBe(420); // Friday 14:00–21:00
    expect(plan.days[5]!.free_minutes).toBe(600); // Saturday 10:00–20:00
    expect(plan.days[0]!.window!.start_at).toBe('2026-10-12T16:00:00+04:00');
  });

  it('never overlaps calendar events (incl. 15 min buffer)', () => {
    const events = [ev('Football', '2026-10-12T12:00:00Z', '2026-10-12T13:30:00Z')]; // 16:00–17:30 Dubai
    const plan = planWeek([task({ id: 'a', est_minutes: 60, due_at: '2026-10-12T19:00:00Z' })], events, { weekStart: WEEK, now: NOW });
    const [b] = blocksOf(plan, 'a');
    expect(b!.start_at).toBe('2026-10-12T17:45:00+04:00');
    for (const d of plan.days) for (const bl of d.blocks) for (const e of events) {
      expect(ms(bl.end_at) <= ms(e.start_at) || ms(bl.start_at) >= ms(e.end_at)).toBe(true);
    }
  });

  it('orders by due date and finishes work before the deadline', () => {
    const late = task({ id: 'late', est_minutes: 60, due_at: '2026-10-17T19:59:00Z' });
    const soon = task({ id: 'soon', est_minutes: 60, due_at: '2026-10-13T19:59:00Z' });
    const plan = planWeek([late, soon], [], { weekStart: WEEK, now: NOW });
    expect(plan.days[0]!.blocks[0]!.task_id).toBe('soon');
    for (const b of blocksOf(plan, 'soon')) expect(ms(b.end_at)).toBeLessThanOrEqual(ms(soon.due_at!));
  });

  it('spreads a large task across days (one block per day first)', () => {
    const big = task({ id: 'big', est_minutes: 180, due_at: '2026-10-18T19:59:00Z' });
    const plan = planWeek([big], [], { weekStart: WEEK, now: NOW });
    const b = blocksOf(plan, 'big');
    expect(b.map((x) => x.minutes)).toEqual([60, 60, 60]);
    expect(new Set(b.map((x) => x.start_at.slice(0, 10))).size).toBe(3);
  });

  it('respects the daily cap and reports what does not fit before the deadline', () => {
    const tasks = [task({ id: 'x', est_minutes: 300, due_at: '2026-10-12T20:00:00Z' })]; // due Mon 24:00 Dubai
    const plan = planWeek(tasks, [], { weekStart: WEEK, now: NOW, maxMinutesPerDay: 120 });
    expect(plan.days[0]!.planned_minutes).toBe(120);
    // partially planned: listed once, in partially_scheduled, never also in unscheduled
    expect(plan.unscheduled).toEqual([]);
    expect(plan.partially_scheduled).toEqual([expect.objectContaining({ task_id: 'x', scheduled_minutes: 120, remaining_minutes: 180, reason: 'not_enough_time_before_due' })]);
    expect(plan.stats.unscheduled_minutes).toBe(180);
  });

  it('schedules overdue tasks ASAP and flags them; skips done/skipped tasks', () => {
    const plan = planWeek([
      task({ id: 'od', est_minutes: 30, due_at: '2026-10-10T19:59:00Z' }),
      task({ id: 'done', status: 'done' }),
      task({ id: 'skip', status: 'skipped' }),
    ], [], { weekStart: WEEK, now: NOW });
    expect(plan.stats.tasks_considered).toBe(1);
    expect(blocksOf(plan, 'od')[0]).toMatchObject({ overdue: true, start_at: '2026-10-12T16:00:00+04:00', minutes: 30 });
  });

  it('does not schedule in the past and uses default minutes for unestimated tasks', () => {
    const now = new Date('2026-10-13T15:00:00Z'); // Tue 19:00 Dubai
    const plan = planWeek([task({ id: 'u', est_minutes: null })], [], { weekStart: WEEK, now });
    expect(plan.days[0]!.blocks).toHaveLength(0);
    expect(blocksOf(plan, 'u')[0]).toMatchObject({ start_at: '2026-10-13T19:00:00+04:00', minutes: 30 });
  });

  it('marks week_full when nothing fits at all', () => {
    const tasks = Array.from({ length: 30 }, (_, i) => task({ id: `w${i}`, est_minutes: 120 }));
    const plan = planWeek(tasks, [], { weekStart: WEEK, now: NOW });
    expect(plan.unscheduled.length).toBeGreaterThan(0);
    expect(plan.unscheduled.every((u) => u.reason === 'week_full')).toBe(true);
    for (const d of plan.days) expect(d.planned_minutes).toBeLessThanOrEqual(180);
  });

  it('never lists a task with blocks in unscheduled (regression)', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => task({ id: `p${i}`, est_minutes: 150 }));
    const plan = planWeek(tasks, [], { weekStart: WEEK, now: NOW, maxMinutesPerDay: 60 });
    const scheduled = new Set(plan.days.flatMap((d) => d.blocks.map((b) => b.task_id)));
    expect(plan.unscheduled.length).toBeGreaterThan(0);
    expect(plan.partially_scheduled.length).toBeGreaterThan(0);
    for (const u of plan.unscheduled) expect(scheduled.has(u.task_id)).toBe(false);
    for (const p of plan.partially_scheduled) {
      expect(scheduled.has(p.task_id)).toBe(true);
      expect(blocksOf(plan, p.task_id).reduce((s, b) => s + b.minutes, 0)).toBe(p.scheduled_minutes);
    }
  });

  it('adds breaks between consecutive blocks', () => {
    const plan = planWeek([task({ id: 'a', est_minutes: 60, due_at: '2026-10-12T19:00:00Z' }), task({ id: 'b', est_minutes: 60, due_at: '2026-10-12T19:30:00Z' })], [], { weekStart: WEEK, now: NOW });
    const [a, b] = plan.days[0]!.blocks;
    expect(ms(b!.start_at) - ms(a!.end_at)).toBe(10 * 60_000);
  });
});

describe('GET /planner/week', () => {
  it('plans the seeded student week around her calendar', async () => {
    const { aisha } = await setup();
    const r = await aisha('GET', '/planner/week');
    expect(r.status).toBe(200);
    expect(r.body.week_start).toBe('2026-10-12');
    expect(r.body.stats.tasks_considered).toBe(5);
    expect(r.body.unscheduled).toEqual([]);
    const mon = r.body.days[0];
    expect(mon.events[0].title).toBe('Football training');
    expect(mon.blocks.every((b: any) => Date.parse(b.start_at) >= Date.parse('2026-10-12T17:45:00+04:00'))).toBe(true);
  });

  it('accepts options and validates the query', async () => {
    const { aisha } = await setup();
    const r = await aisha('GET', '/planner/week?start=2026-10-19&max_minutes_per_day=60&weekday_start=15:00');
    expect(r.body.week_start).toBe('2026-10-19');
    expect(r.body.days[0].window.start_at).toBe('2026-10-19T15:00:00+04:00');
    expect(r.body.days.every((d: any) => d.planned_minutes <= 60)).toBe(true);
    expect((await aisha('GET', '/planner/week?start=next-week')).status).toBe(400);
  });
});
