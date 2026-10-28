import { DEFAULT_QUIET_HOURS, localParts, placeOutsideQuietHours, type QuietHoursConfig } from '../quiet-hours.js';
import { firstName } from '../format.js';
import { renderApplicationDeadline, renderTaskReminder, type RenderedContent } from '../templates.js';
import type { Application, Opportunity, Student, Task } from '../types.js';

const H = 3_600_000;

export interface ReminderRules {
  /** Hours before a task's due_at. */
  taskOffsetsH: number[];
  /** Hours before an application's opportunity deadline. */
  applicationOffsetsH: number[];
  /** A planned reminder more than this late is dropped (its wording would be wrong). */
  maxLatenessH: number;
}

export const DEFAULT_RULES: ReminderRules = {
  taskOffsetsH: [48, 24, 2],
  applicationOffsetsH: [168, 72, 24],
  maxLatenessH: 3,
};

export interface PlannedReminder {
  dedupeKey: string;
  kind: 'task_due' | 'application_deadline';
  entityId: string;
  offsetH: number;
  /** due - offset */
  plannedAt: Date;
  /** plannedAt moved outside quiet hours (never later than the due time). */
  sendAt: Date;
  notAfter: Date;
  template: string;
  content: RenderedContent;
  payload: Record<string, unknown>;
}

const offsetLabel = (h: number) => `${h}h`;

export function planTaskReminders(
  student: Student,
  tasks: Task[],
  rules: ReminderRules = DEFAULT_RULES,
  quiet: QuietHoursConfig = DEFAULT_QUIET_HOURS,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const fname = firstName(student.full_name, student.preferred_name);
  for (const t of tasks) {
    if (!t.due_at || t.status === 'done' || t.status === 'skipped') continue;
    const due = new Date(t.due_at);
    for (const h of rules.taskOffsetsH) {
      const plannedAt = new Date(due.getTime() - h * H);
      const placed = placeOutsideQuietHours(plannedAt, 'push', { notAfter: due }, quiet);
      const payload = { firstName: fname, taskId: t.id, taskTitle: t.title, dueAt: t.due_at, offset: offsetLabel(h), sendAt: placed.at.toISOString(), timeZone: quiet.timeZone };
      out.push({
        dedupeKey: `task:${t.id}:${t.due_at}:${offsetLabel(h)}`,
        kind: 'task_due',
        entityId: t.id,
        offsetH: h,
        plannedAt,
        sendAt: placed.at,
        notAfter: due,
        template: 'task_due_reminder',
        content: renderTaskReminder(payload),
        payload,
      });
    }
  }
  return out;
}

export function planApplicationReminders(
  student: Student,
  apps: { application: Application; opportunity: Opportunity }[],
  rules: ReminderRules = DEFAULT_RULES,
  quiet: QuietHoursConfig = DEFAULT_QUIET_HOURS,
): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const fname = firstName(student.full_name, student.preferred_name);
  for (const { application: a, opportunity: o } of apps) {
    if (!o.deadline || (a.status !== 'saved' && a.status !== 'preparing') || o.status === 'closed') continue;
    const deadline = new Date(o.deadline);
    for (const h of rules.applicationOffsetsH) {
      const plannedAt = new Date(deadline.getTime() - h * H);
      const placed = placeOutsideQuietHours(plannedAt, 'push', { notAfter: deadline }, quiet);
      const payload = {
        firstName: fname,
        applicationId: a.id,
        opportunityTitle: o.title,
        deadline: o.deadline,
        daysLeft: Math.round(h / 24),
        checklistDone: a.checklist.filter((c) => c.done).length,
        checklistTotal: a.checklist.length,
        sendAt: placed.at.toISOString(),
        timeZone: quiet.timeZone,
      };
      out.push({
        dedupeKey: `application:${a.id}:${o.deadline}:${offsetLabel(h)}`,
        kind: 'application_deadline',
        entityId: a.id,
        offsetH: h,
        plannedAt,
        sendAt: placed.at,
        notAfter: deadline,
        template: 'application_deadline',
        content: renderApplicationDeadline(payload),
        payload,
      });
    }
  }
  return out;
}

/**
 * Which planned reminders should go out at `now`. Per entity only the most recent due offset counts
 * (if the 2h reminder is due, a missed 24h one is never sent late). Stale or post-deadline ones drop.
 */
export function selectDue(planned: PlannedReminder[], now: Date, rules: ReminderRules = DEFAULT_RULES): PlannedReminder[] {
  const byEntity = new Map<string, PlannedReminder>();
  for (const p of planned) {
    if (p.sendAt.getTime() > now.getTime()) continue;
    const k = `${p.kind}:${p.entityId}`;
    const cur = byEntity.get(k);
    if (!cur || p.offsetH < cur.offsetH) byEntity.set(k, p);
  }
  return [...byEntity.values()].filter(
    (p) => now.getTime() < p.notAfter.getTime() && now.getTime() - p.sendAt.getTime() <= rules.maxLatenessH * H,
  );
}

// ---------------------------------------------------------------- weekly briefing timing

export interface WeeklySchedule {
  /** 0=Sun */
  weekday: number;
  time: string; // HH:MM local
  timeZone: string;
}

export const DEFAULT_WEEKLY: WeeklySchedule = { weekday: 0, time: '18:00', timeZone: 'Asia/Dubai' };

/** Inngest/cron expression, e.g. "TZ=Asia/Dubai 0 18 * * 0". */
export function weeklyCron(s: WeeklySchedule = DEFAULT_WEEKLY): string {
  const [h, m] = s.time.split(':').map(Number);
  return `TZ=${s.timeZone} ${m ?? 0} ${h ?? 0} * * ${s.weekday}`;
}

/** True when `now` is within `windowMin` minutes after the weekly slot (for plain 15-min crons). */
export function isWeeklyBriefingDue(now: Date, s: WeeklySchedule = DEFAULT_WEEKLY, windowMin = 15): boolean {
  const p = localParts(now, s.timeZone);
  const [h, m] = s.time.split(':').map(Number);
  const slot = (h ?? 0) * 60 + (m ?? 0);
  return p.weekday === s.weekday && p.minutes >= slot && p.minutes < slot + windowMin;
}

/** Local date of this week's briefing, used in its dedupe key. */
export function briefingWeekKey(now: Date, timeZone = 'Asia/Dubai'): string {
  return localParts(now, timeZone).date;
}
