/**
 * Local user state (ticked tasks, logged sessions, connected links, applications…) layered on top of the
 * bundled mock world. Pure, so it is unit-testable and memoizable.
 */
import type { MockWorld } from './mock/data';
import type { Application, Goal, ProfileLinks, Session, Task } from './types';

export interface PlannerBlock {
  id: string;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  minutes: number;
  title: string;
  area: Task['area'];
}

export interface UserState {
  taskDone: Record<string, boolean>;
  extraTasks: Task[];
  sessions: Record<string, Session[]>;
  links: ProfileLinks | null;
  appStatus: Record<string, Application['status']>;
  appChecklist: Record<string, boolean>; // `${appId}:${itemId}`
  newApps: Application[];
  savedOpps: string[];
  milestones: Record<string, boolean>;
  extraGoals: Goal[];
  planner: PlannerBlock[];
  plannerDone: Record<string, boolean>;
}

export const EMPTY_USER: UserState = {
  taskDone: {}, extraTasks: [], sessions: {}, links: null, appStatus: {}, appChecklist: {}, newApps: [], savedOpps: [],
  milestones: {}, extraGoals: [], planner: [], plannerDone: {},
};

export function applyTaskState(tasks: Task[], u: UserState): Task[] {
  return [...tasks, ...u.extraTasks].map((t) => (t.id in u.taskDone ? { ...t, done: u.taskDone[t.id]! } : t));
}

export function mergeWorld(base: MockWorld, u: UserState): MockWorld {
  const activities = base.extracurriculars.activities.map((a) => {
    const extra = u.sessions[a.id];
    if (!extra?.length) return a;
    const sessions = [...a.sessions, ...extra].sort((x, y) => x.date.localeCompare(y.date));
    return { ...a, sessions, totalHours: Math.round((sessions.reduce((m, x) => m + x.minutes, 0) / 60) * 10) / 10 };
  });

  const goals = [...base.goals, ...u.extraGoals].map((g) => {
    const milestones = g.milestones.map((m) => (m.id in u.milestones ? { ...m, done: u.milestones[m.id]! } : m));
    const touched = g.milestones.some((m) => m.id in u.milestones);
    const progress = touched && milestones.length ? milestones.filter((m) => m.done).length / milestones.length : g.progress;
    return { ...g, milestones, progress };
  });

  const applications = [...base.applications, ...u.newApps].map((a) => ({
    ...a,
    status: u.appStatus[a.id] ?? a.status,
    checklist: a.checklist.map((c) => {
      const k = `${a.id}:${c.id}`;
      return k in u.appChecklist ? { ...c, done: u.appChecklist[k]! } : c;
    }),
  }));

  const last28 = new Date(Date.parse(base.today) - 27 * 86400000).toISOString().slice(0, 10);
  const recentMin = activities.reduce((m, a) => m + a.sessions.filter((x) => x.date >= last28).reduce((k, x) => k + Math.min(x.minutes, 180), 0), 0);
  const targetMin = activities.reduce((m, a) => m + a.weeklyTargetMinutes * 4, 0);

  return {
    ...base,
    extracurriculars: { activities },
    goals,
    applications,
    links: u.links ?? base.links,
    dashboard: {
      ...base.dashboard,
      today: applyTaskState(base.dashboard.today, u),
      progress: {
        ...base.dashboard.progress,
        extracurriculars: Math.min(100, Math.round((recentMin / Math.max(1, targetMin)) * 100)),
        goals: Math.round((goals.reduce((m, g) => m + g.progress, 0) / Math.max(1, goals.length)) * 100),
      },
    },
  };
}
