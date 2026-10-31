import { composeWeeklyBriefing, renderBriefing, type BriefingInput } from '../briefing.js';
import type { ChannelOutcome, Notifier } from '../notifier.js';
import { DEFAULT_QUIET_HOURS, type QuietHoursConfig } from '../quiet-hours.js';
import type { Application, CalendarEvent, Channel, Goal, Guardian, Material, Opportunity, Recipient, Student, Task } from '../types.js';
import {
  briefingWeekKey,
  DEFAULT_RULES,
  planApplicationReminders,
  planTaskReminders,
  selectDue,
  type ReminderRules,
} from './rules.js';

export interface GuardianTarget {
  guardian: Guardian;
  recipient: Recipient;
  channels: Channel[];
}

export interface ReminderBundle {
  student: Student;
  recipient: Recipient;
  /** Student's enabled channels, in preference order. */
  channels: Channel[];
  tasks: Task[];
  applications: { application: Application; opportunity: Opportunity }[];
}

export interface BriefingBundle {
  student: Student;
  recipient: Recipient;
  channels: Channel[];
  guardians: GuardianTarget[];
  tasks: Task[];
  exams: Material[];
  events: CalendarEvent[];
  applications: { application: Application; opportunity: Opportunity }[];
  newOpportunities: Opportunity[];
  goals: Goal[];
  previousGoalProgress?: Record<string, number>;
}

/** Data port: apps/api or the db team implements this over Supabase (service role, RLS-aware views). */
export interface SchedulerDataSource {
  /** Students with open tasks/applications due within the next ~8 days. */
  reminderBundles(now: Date): Promise<ReminderBundle[]>;
  briefingBundles(now: Date): Promise<BriefingBundle[]>;
}

export interface SchedulerDeps {
  data: SchedulerDataSource;
  notifier: Notifier;
  rules?: ReminderRules;
  quietHours?: QuietHoursConfig;
  clock?: () => Date;
}

export interface TickSummary {
  students: number;
  considered: number;
  outcomes: { dedupeKey: string; results: ChannelOutcome[] }[];
}

/** Run every 5–15 minutes. Idempotent: dedupe keys stop double sends across overlapping runs. */
export async function runReminderTick(deps: SchedulerDeps): Promise<TickSummary> {
  const now = (deps.clock ?? (() => new Date()))();
  const rules = deps.rules ?? DEFAULT_RULES;
  const quiet = deps.quietHours ?? DEFAULT_QUIET_HOURS;
  const bundles = await deps.data.reminderBundles(now);
  const summary: TickSummary = { students: bundles.length, considered: 0, outcomes: [] };
  for (const b of bundles) {
    const planned = [
      ...planTaskReminders(b.student, b.tasks, rules, quiet),
      ...planApplicationReminders(b.student, b.applications, rules, quiet),
    ];
    const due = selectDue(planned, now, rules);
    summary.considered += due.length;
    for (const p of due) {
      const results = await deps.notifier.deliver({
        student: b.student,
        recipient: b.recipient,
        channels: b.channels,
        template: p.template,
        content: p.content,
        dedupeKey: p.dedupeKey,
        payload: p.payload,
      });
      summary.outcomes.push({ dedupeKey: p.dedupeKey, results });
    }
  }
  return summary;
}

/** Run at the weekly slot (Sunday 18:00 Asia/Dubai by default). Sends to student, then consenting guardians. */
export async function runWeeklyBriefing(deps: SchedulerDeps): Promise<TickSummary> {
  const now = (deps.clock ?? (() => new Date()))();
  const tz = (deps.quietHours ?? DEFAULT_QUIET_HOURS).timeZone;
  const week = briefingWeekKey(now, tz);
  const bundles = await deps.data.briefingBundles(now);
  const summary: TickSummary = { students: bundles.length, considered: 0, outcomes: [] };
  for (const b of bundles) {
    const base: Omit<BriefingInput, 'audience'> = {
      student: b.student,
      tasks: b.tasks,
      exams: b.exams,
      events: b.events,
      applications: b.applications,
      newOpportunities: b.newOpportunities,
      goals: b.goals,
      previousGoalProgress: b.previousGoalProgress,
      now,
      timeZone: tz,
    };
    const sb = composeWeeklyBriefing({ ...base, audience: 'student' });
    const key = `briefing:${b.student.id}:${week}`;
    summary.considered++;
    summary.outcomes.push({
      dedupeKey: key,
      results: await deps.notifier.deliver({
        student: b.student,
        recipient: b.recipient,
        channels: b.channels,
        template: 'weekly_briefing',
        content: renderBriefing(sb),
        dedupeKey: key,
        payload: { counts: sb.counts, week },
      }),
    });
    for (const g of b.guardians) {
      const gb = composeWeeklyBriefing({ ...base, audience: 'guardian', guardianName: g.guardian.name });
      summary.considered++;
      summary.outcomes.push({
        dedupeKey: key,
        results: await deps.notifier.deliver({
          student: b.student,
          recipient: g.recipient,
          guardian: g.guardian,
          channels: g.channels,
          template: 'guardian_weekly_briefing',
          content: renderBriefing(gb),
          dedupeKey: key,
          payload: { counts: gb.counts, week },
        }),
      });
    }
  }
  return summary;
}
