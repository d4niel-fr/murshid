import { z } from 'zod';
import {
  AchievementCategory, AchievementCreate, AchievementUpdate, CalendarEventCreate, CalendarEventUpdate, TaskCreate,
  TaskKind, TaskStatus, TaskUpdate, type Achievement, type CalendarEvent, type Task,
} from '../domain';
import { badRequest } from '../lib/context';
import type { Api } from '../lib/router';
import { ownedCrud } from './crud';

const csv = (v?: string) => (v ? v.split(',').map((x) => x.trim()).filter(Boolean) : undefined);
const iso = (v: string) => new Date(v).getTime();

export function registerTasks(api: Api) {
  ownedCrud(api, {
    path: '/tasks', tag: 'tasks', name: 'task', key: 'tasks', create: TaskCreate, update: TaskUpdate,
    listQuery: z.object({
      status: z.string().optional().describe(`comma list of ${TaskStatus.options.join('|')}`),
      kind: TaskKind.optional(),
      due_before: z.string().optional(),
      due_after: z.string().optional(),
      linked_goal_id: z.string().optional(),
    }),
    filter: (rows: Task[], q) => {
      const statuses = csv(q.status);
      return rows
        .filter((t) => !statuses || statuses.includes(t.status))
        .filter((t) => !q.kind || t.kind === q.kind)
        .filter((t) => !q.linked_goal_id || t.linked_goal_id === q.linked_goal_id)
        .filter((t) => !q.due_before || (t.due_at && iso(t.due_at) < iso(q.due_before)))
        .filter((t) => !q.due_after || (t.due_at && iso(t.due_at) >= iso(q.due_after)))
        .sort((a, b) => (a.due_at ?? '9999').localeCompare(b.due_at ?? '9999'));
    },
  });
}

export function registerCalendar(api: Api) {
  const checkRange = (_c: unknown, body: Record<string, unknown>, existing?: CalendarEvent) => {
    const start = (body.start_at as string | undefined) ?? existing?.start_at;
    const end = (body.end_at as string | undefined) ?? existing?.end_at;
    if (start && end && iso(end) <= iso(start)) badRequest('end_at must be after start_at');
  };
  ownedCrud(api, {
    path: '/calendar', tag: 'calendar', name: 'calendar event', key: 'calendarEvents',
    create: CalendarEventCreate, update: CalendarEventUpdate, validate: checkRange,
    listQuery: z.object({ from: z.string().optional(), to: z.string().optional(), source: z.string().optional() }),
    filter: (rows: CalendarEvent[], q) => rows
      .filter((e) => !q.from || iso(e.end_at) > iso(q.from))
      .filter((e) => !q.to || iso(e.start_at) < iso(q.to))
      .filter((e) => !q.source || e.source === q.source)
      .sort((a, b) => iso(a.start_at) - iso(b.start_at)),
  });
}

export function registerAchievements(api: Api) {
  ownedCrud(api, {
    path: '/achievements', tag: 'achievements', name: 'achievement', key: 'achievements',
    create: AchievementCreate, update: AchievementUpdate,
    listQuery: z.object({ category: AchievementCategory.optional() }),
    filter: (rows: Achievement[], q) => rows
      .filter((a) => !q.category || a.category === q.category)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')),
  });
}
