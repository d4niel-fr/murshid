import { DEFAULT_WEEKLY, isWeeklyBriefingDue, weeklyCron, type WeeklySchedule } from './rules.js';
import { runReminderTick, runWeeklyBriefing, type SchedulerDeps } from './runner.js';

export const REMINDER_CRON = '*/15 * * * *';

/**
 * Inngest function definitions, kept dependency-free. Wire them up in apps/api with:
 *   for (const f of inngestFunctionDefs(deps)) inngest.createFunction(f.config, f.trigger, f.handler)
 * (or call registerInngestFunctions(inngest, deps)).
 */
export function inngestFunctionDefs(deps: SchedulerDeps, weekly: WeeklySchedule = DEFAULT_WEEKLY) {
  return [
    {
      config: { id: 'murshid-reminders-tick', name: 'Task & application reminders', concurrency: { limit: 1 } },
      trigger: { cron: `TZ=${weekly.timeZone} ${REMINDER_CRON}` },
      handler: async ({ step }: { step?: { run<T>(id: string, fn: () => Promise<T>): Promise<T> } }) =>
        step ? step.run('reminder-tick', () => runReminderTick(deps)) : runReminderTick(deps),
    },
    {
      config: { id: 'murshid-weekly-briefing', name: 'Weekly briefing (Sunday 18:00 Dubai)', concurrency: { limit: 1 } },
      trigger: { cron: weeklyCron(weekly) },
      handler: async ({ step }: { step?: { run<T>(id: string, fn: () => Promise<T>): Promise<T> } }) =>
        step ? step.run('weekly-briefing', () => runWeeklyBriefing(deps)) : runWeeklyBriefing(deps),
    },
  ] as const;
}

export interface InngestLike {
  createFunction(config: unknown, trigger: unknown, handler: (ctx: never) => unknown): unknown;
}

export function registerInngestFunctions(inngest: InngestLike, deps: SchedulerDeps, weekly?: WeeklySchedule) {
  return inngestFunctionDefs(deps, weekly).map((f) => inngest.createFunction(f.config, f.trigger, f.handler as (ctx: never) => unknown));
}

/**
 * Plain HTTP cron handler (Vercel Cron / Supabase pg_cron + pg_net / GitHub Actions) for when
 * Inngest isn't used. Call it every 15 minutes; it runs reminders and, in the Sunday 18:00 window,
 * the weekly briefing. Requires `Authorization: Bearer $CRON_SECRET`.
 */
export function createCronHandler(deps: SchedulerDeps, opts: { secret: string; weekly?: WeeklySchedule }) {
  return async (req: Request): Promise<Response> => {
    if (!opts.secret || req.headers.get('authorization') !== `Bearer ${opts.secret}`) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
    }
    const now = (deps.clock ?? (() => new Date()))();
    const url = new URL(req.url);
    const job = url.searchParams.get('job');
    const result: Record<string, unknown> = {};
    if (!job || job === 'reminders') result.reminders = await runReminderTick(deps);
    if (job === 'weekly-briefing' || (!job && isWeeklyBriefingDue(now, opts.weekly ?? DEFAULT_WEEKLY))) {
      result.weeklyBriefing = await runWeeklyBriefing(deps);
    }
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}
