/**
 * Automated action when a teacher posts work: for every student in the class, Murshid
 *   1. reads the post and the student's timetable/calendar (tests, fixtures, events, sport),
 *   2. works out the student's load per day across ALL subjects (engine.loadByDay),
 *   3. schedules a work session on the lightest day before the due date (replans the week),
 *   4. sets a reminder for the evening before it is due,
 *   5. flags overload (a day over capacity in the window, or 2+ tests) back to the teacher.
 * Deterministic (no model calls) and explained step by step in a WorkTrace.
 */
import type { WorkTrace } from '@murshid/core';
import { addDays } from '../lib/time';
import type { RosterStudent } from './catalog';
import { atRiskReason, capacity, crunchTests, loadByDay, shortDay, studentWork, type School, type WorkItem } from './engine';
import { GUARDRAILS, TOOL_LABELS } from '../v1/trace';

export interface ReplanResult {
  studentId: string;
  sessionDate: string;
  sessionMinutes: number;
  reminderDate: string;
  overloaded: boolean;
  overloadReason: string | null;
  peak: { date: string; minutes: number; capacity: number };
  trace: WorkTrace;
}

export function replanForPost(school: School, st: RosterStudent, item: WorkItem, today: string): ReplanResult {
  const t0 = Date.now();
  const work = studentWork(school, st, today);
  const start = item.setDate > today ? item.setDate : today;
  // load from everything else, computed exactly as the best-day model does (from today; this post and the class's own
  // not-yet-set homework excluded, since the post takes the place of that homework)
  const horizon = Math.max(1, Math.round((Date.parse(item.dueDate) - Date.parse(today)) / 86_400_000)) + 1;
  const load = loadByDay(work, today, horizon, (it) => it.id === item.id || (it.streamId === item.streamId && !it.posted && it.setDate > today));
  const window: string[] = [];
  for (let d = start; d < item.dueDate; d = addDays(d, 1)) window.push(d);
  if (!window.length) window.push(start);
  const free = (d: string) => capacity(d) - (load[d]?.minutes ?? 0);
  // lightest day (most free minutes); ties go to the earlier day so work is not left to the last night
  const sessionDate = [...window].sort((a, b) => free(b) - free(a) || a.localeCompare(b))[0]!;
  const reminderDate = addDays(item.dueDate, -1) >= start ? addDays(item.dueDate, -1) : start;

  const withNew = (d: string) => (load[d]?.minutes ?? 0) + (d === sessionDate ? item.minutes : 0);
  const peakDate = [...window].sort((a, b) => withNew(b) / capacity(b) - withNew(a) / capacity(a))[0]!;
  const peak = { date: peakDate, minutes: Math.round(withNew(peakDate)), capacity: capacity(peakDate) };
  const tests = window.flatMap((d) => load[d]?.tests ?? []);
  const events = window.flatMap((d) => load[d]?.events ?? []);
  // at risk (the same rule the best-day model uses): even the lightest day before it is due has no room for it, or a
  // test crunch (2+ tests) right before it is due
  const room = Math.round(free(sessionDate));
  const crunch = crunchTests(load, item.dueDate);
  const overloadReason = atRiskReason(load, start, item.dueDate, item.minutes);
  const overloaded = overloadReason !== null;

  const tools = [
    { id: 'read_teacher_post', access: 'read' as const },
    { id: 'read_timetable', access: 'read' as const },
    { id: 'read_workload', access: 'read' as const },
    { id: 'schedule_work_session', access: 'write' as const },
    { id: 'set_reminder', access: 'write' as const },
    { id: 'flag_overload', access: 'read' as const },
  ].map((t) => ({ ...t, label: TOOL_LABELS[t.id]!, ok: true, ms: 0, calls: 1 }));

  const actions = [
    `Scheduled a ${item.minutes}-min work session on ${shortDay(sessionDate)} (${Math.max(0, Math.round(free(sessionDate)))} min free that day, the most before it is due).`,
    `Set a reminder for ${shortDay(reminderDate)} at 19:00: due ${shortDay(item.dueDate)} ${item.dueTime}.`,
    overloaded ? `Flagged to the teacher as at risk (extra support): ${overloadReason}.` : `Not at risk: ${shortDay(sessionDate)} has room (${room} min free before this task); ${crunch.length} test${crunch.length === 1 ? '' : 's'} in the 2 days before it is due.`,
  ];
  const trace: WorkTrace = {
    kind: 'automation',
    goal: `New work posted ("${item.title}", due ${shortDay(item.dueDate)}): fit it into ${st.name.split(' ')[0]}'s week without overloading any day.`,
    plan: [
      'Read the teacher\'s post (title, minutes, due date).',
      `Read the timetable and calendar for ${shortDay(start)} to ${shortDay(item.dueDate)}: ${tests.length} test${tests.length === 1 ? '' : 's'}, ${events.length} event${events.length === 1 ? '' : 's'}, sport on its usual days.`,
      'Add up the load per day across every subject against the after-school capacity (240 min on school days, 330 at weekends).',
      'Pick the lightest day before the due date for a work session and set a reminder.',
      'Check if the student is at risk: no day with enough free time before it is due, or 2+ tests in the 2 days before it is due (the same rule the best-day model uses).',
    ],
    tools,
    actions,
    result: overloaded ? 'Plan updated; the teacher sees this student as at risk (extra support), with the reason.' : 'Plan updated; the week stays within capacity.',
    engine: { mode: 'rules', router: 'automation', models: [], note: 'Deterministic scheduling rules on the school\'s own data (no model calls).', ms: Date.now() - t0 },
    guardrails: GUARDRAILS.slice(0, 2),
  };
  return { studentId: st.id, sessionDate, sessionMinutes: item.minutes, reminderDate, overloaded, overloadReason, peak, trace };
}
