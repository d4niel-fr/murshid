/**
 * Rule-based weekly planner (no AI). AI-LATER: an agent may re-rank or annotate this plan,
 * but this deterministic scheduler stays the source of truth for time slots.
 *
 * Algorithm
 *  1. Build study windows per day (Asia/Dubai): Mon–Thu after school, Fri shorter school day,
 *     Sat/Sun daytime. Windows are clipped to "now" and have calendar events (plus a buffer) removed.
 *  2. Open tasks (todo/doing) are ordered earliest-due-first (undated last, then bigger first).
 *  3. Each task's est_minutes (default 30) is split into blocks of <= blockMinutes.
 *     Pass 1 ("spread"): at most one block per task per day, placed in the earliest free slot that
 *     ends before the task's due time. Pass 2 ("fill"): any remaining minutes, same deadline rule.
 *     Overdue tasks ignore the deadline (scheduled ASAP and flagged).
 *  4. Days never exceed maxMinutesPerDay of planned work; a short break follows every block.
 *  5. Every open task lands in exactly one bucket: fully planned (blocks only), `partially_scheduled`
 *     (some blocks placed, the rest did not fit) or `unscheduled` (no block at all). A task with
 *     blocks is never listed in `unscheduled`.
 */
import type { CalendarEvent, Task } from '../domain';
import { addDays, addMinutes, dubaiInstant, toDubaiIso, weekday } from '../lib/time';

export interface PlannerOptions {
  weekStart: string; // YYYY-MM-DD (Monday recommended)
  now: Date;
  /** minutes after midnight, Dubai time */
  weekdayWindow?: [number, number];
  fridayWindow?: [number, number];
  weekendWindow?: [number, number];
  maxMinutesPerDay?: number;
  blockMinutes?: number;
  minBlockMinutes?: number;
  breakMinutes?: number;
  eventBufferMinutes?: number;
  defaultTaskMinutes?: number;
}

export interface PlannedBlock {
  task_id: string;
  title: string;
  kind: Task['kind'];
  start_at: string;
  end_at: string;
  minutes: number;
  due_at: string | null;
  overdue: boolean;
}

export interface PlannedDay {
  date: string;
  weekday: string;
  window: { start_at: string; end_at: string } | null;
  free_minutes: number;
  planned_minutes: number;
  blocks: PlannedBlock[];
  events: { id: string; title: string; start_at: string; end_at: string }[];
}

export interface UnscheduledTask {
  task_id: string;
  title: string;
  due_at: string | null;
  remaining_minutes: number;
  reason: 'not_enough_time_before_due' | 'week_full';
}

export interface PartiallyScheduledTask {
  task_id: string;
  title: string;
  due_at: string | null;
  scheduled_minutes: number;
  remaining_minutes: number;
  reason: UnscheduledTask['reason'];
}

export interface WeekPlan {
  week_start: string;
  week_end: string;
  timezone: 'Asia/Dubai';
  generated_at: string;
  days: PlannedDay[];
  unscheduled: UnscheduledTask[];
  partially_scheduled: PartiallyScheduledTask[];
  stats: { tasks_considered: number; planned_minutes: number; unscheduled_minutes: number; free_minutes: number };
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Interval { start: number; end: number } // epoch ms

function subtract(intervals: Interval[], cut: Interval): Interval[] {
  const out: Interval[] = [];
  for (const iv of intervals) {
    if (cut.end <= iv.start || cut.start >= iv.end) { out.push(iv); continue; }
    if (cut.start > iv.start) out.push({ start: iv.start, end: cut.start });
    if (cut.end < iv.end) out.push({ start: cut.end, end: iv.end });
  }
  return out;
}

const MIN = 60_000;

export function planWeek(tasks: Task[], events: CalendarEvent[], opts: PlannerOptions): WeekPlan {
  const o = {
    weekdayWindow: [16 * 60, 21 * 60] as [number, number],
    fridayWindow: [14 * 60, 21 * 60] as [number, number],
    weekendWindow: [10 * 60, 20 * 60] as [number, number],
    maxMinutesPerDay: 180,
    blockMinutes: 60,
    minBlockMinutes: 15,
    breakMinutes: 10,
    eventBufferMinutes: 15,
    defaultTaskMinutes: 30,
    ...opts,
  };
  const nowMs = Math.ceil(o.now.getTime() / (5 * MIN)) * 5 * MIN; // round up to 5 min
  const weekEndDate = addDays(o.weekStart, 6);
  const weekEndMs = dubaiInstant(addDays(o.weekStart, 7)).getTime();

  // 1. free intervals per day
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = addDays(o.weekStart, i);
    const wd = weekday(date);
    const [ws, we] = wd === 0 || wd === 6 ? o.weekendWindow : wd === 5 ? o.fridayWindow : o.weekdayWindow;
    const winStart = dubaiInstant(date, ws).getTime();
    const winEnd = dubaiInstant(date, we).getTime();
    let free: Interval[] = [{ start: Math.max(winStart, nowMs), end: winEnd }].filter((iv) => iv.end > iv.start);
    const dayStart = dubaiInstant(date).getTime();
    const dayEnd = dubaiInstant(addDays(date, 1)).getTime();
    const dayEvents = events.filter((e) => Date.parse(e.start_at) < dayEnd && Date.parse(e.end_at) > dayStart);
    for (const e of dayEvents) {
      free = subtract(free, {
        start: Date.parse(e.start_at) - o.eventBufferMinutes * MIN,
        end: Date.parse(e.end_at) + o.eventBufferMinutes * MIN,
      });
    }
    free = free.filter((iv) => iv.end - iv.start >= o.minBlockMinutes * MIN);
    const freeMinutes = free.reduce((s, iv) => s + (iv.end - iv.start) / MIN, 0);
    return {
      date, wd, winStart, winEnd, free, freeMinutes, planned: 0,
      blocks: [] as PlannedBlock[],
      events: dayEvents
        .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))
        .map((e) => ({ id: e.id, title: e.title, start_at: e.start_at, end_at: e.end_at })),
    };
  });

  // 2. order tasks
  const open = tasks
    .filter((t) => t.status === 'todo' || t.status === 'doing')
    .map((t) => {
      const total = t.est_minutes ?? o.defaultTaskMinutes;
      return { t, total, remaining: total, due: t.due_at ? Date.parse(t.due_at) : null };
    })
    .filter((x) => x.total > 0)
    .sort((a, b) => {
      if (a.due !== null && b.due !== null && a.due !== b.due) return a.due - b.due;
      if (a.due === null && b.due !== null) return 1;
      if (a.due !== null && b.due === null) return -1;
      return b.remaining - a.remaining || a.t.title.localeCompare(b.t.title);
    });

  // 3. allocate
  const place = (x: (typeof open)[number], perDayCap: number) => {
    const overdue = x.due !== null && x.due <= nowMs;
    const deadline = overdue || x.due === null ? Infinity : x.due;
    for (const day of days) {
      if (x.remaining <= 0) return;
      let placedToday = day.blocks.filter((b) => b.task_id === x.t.id).reduce((s, b) => s + b.minutes, 0);
      for (const iv of day.free) {
        if (x.remaining <= 0) break;
        const dayLeft = o.maxMinutesPerDay - day.planned;
        const capLeft = perDayCap - placedToday;
        const ivEnd = Math.min(iv.end, deadline);
        const ivLen = Math.floor((ivEnd - iv.start) / MIN);
        const len = Math.min(x.remaining, o.blockMinutes, dayLeft, capLeft, ivLen);
        if (len <= 0 || len < Math.min(o.minBlockMinutes, x.remaining)) continue;
        const start = new Date(iv.start);
        const end = addMinutes(start, len);
        day.blocks.push({
          task_id: x.t.id, title: x.t.title, kind: x.t.kind, start_at: toDubaiIso(start), end_at: toDubaiIso(end),
          minutes: len, due_at: x.t.due_at, overdue,
        });
        day.planned += len;
        placedToday += len;
        x.remaining -= len;
        iv.start = end.getTime() + o.breakMinutes * MIN;
      }
      day.free = day.free.filter((iv) => iv.end - iv.start >= o.minBlockMinutes * MIN);
    }
  };
  for (const x of open) place(x, o.blockMinutes); // pass 1: spread across days
  for (const x of open) place(x, Infinity); // pass 2: fill

  const reasonFor = (x: (typeof open)[number]): UnscheduledTask['reason'] =>
    x.due !== null && x.due > nowMs && x.due < weekEndMs ? 'not_enough_time_before_due' : 'week_full';
  const leftover = open.filter((x) => x.remaining > 0);
  const unscheduled: UnscheduledTask[] = leftover
    .filter((x) => x.remaining === x.total)
    .map((x) => ({ task_id: x.t.id, title: x.t.title, due_at: x.t.due_at, remaining_minutes: x.remaining, reason: reasonFor(x) }));
  const partially_scheduled: PartiallyScheduledTask[] = leftover
    .filter((x) => x.remaining < x.total)
    .map((x) => ({
      task_id: x.t.id, title: x.t.title, due_at: x.t.due_at, scheduled_minutes: x.total - x.remaining,
      remaining_minutes: x.remaining, reason: reasonFor(x),
    }));

  const outDays: PlannedDay[] = days.map((d) => ({
    date: d.date,
    weekday: DAY_NAMES[d.wd]!,
    window: { start_at: toDubaiIso(new Date(d.winStart)), end_at: toDubaiIso(new Date(d.winEnd)) },
    free_minutes: Math.round(d.freeMinutes),
    planned_minutes: d.planned,
    blocks: d.blocks.sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at)),
    events: d.events,
  }));
  const planned = outDays.reduce((s, d) => s + d.planned_minutes, 0);
  return {
    week_start: o.weekStart,
    week_end: weekEndDate,
    timezone: 'Asia/Dubai',
    generated_at: o.now.toISOString(),
    days: outDays,
    unscheduled,
    partially_scheduled,
    stats: {
      tasks_considered: open.length,
      planned_minutes: planned,
      unscheduled_minutes: leftover.reduce((s, x) => s + x.remaining, 0),
      free_minutes: outDays.reduce((s, d) => s + d.free_minutes, 0),
    },
  };
}
