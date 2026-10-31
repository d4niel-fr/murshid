import { describe, expect, it } from 'vitest';
import {
  createChannelAdapters,
  createCronHandler,
  isWeeklyBriefingDue,
  MemoryInAppStore,
  MemoryNotificationStore,
  MockAdapter,
  Notifier,
  planTaskReminders,
  planApplicationReminders,
  registerInngestFunctions,
  runReminderTick,
  runWeeklyBriefing,
  selectDue,
  weeklyCron,
  type SchedulerDataSource,
} from '../src/index.js';
import {
  aisha,
  aishaRecipient,
  application,
  dubai,
  events,
  exams,
  goals,
  guardianGranted,
  guardianPending,
  guardianRecipient,
  opportunity,
  tasks,
} from './fixtures.js';

const iso = (d: Date) => d.toISOString();

describe('reminder rules', () => {
  const planned = planTaskReminders(aisha, tasks);

  it('plans 48h/24h/2h for open tasks only', () => {
    expect(planned.filter((p) => p.entityId === 't-physics').map((p) => p.offsetH)).toEqual([48, 24, 2]);
    expect(planned.some((p) => p.entityId === 't-done')).toBe(false);
  });

  it('moves reminders out of school hours, never past the due time', () => {
    const eng = planned.filter((p) => p.entityId === 't-english'); // due Tue 14:00
    const by = Object.fromEntries(eng.map((p) => [p.offsetH, iso(p.sendAt)]));
    expect(by[24]).toBe(iso(dubai('2026-10-12 14:30'))); // Mon 14:00 → after school
    expect(by[2]).toBe(iso(dubai('2026-10-13 07:25'))); // Tue 12:00 → before school
    const two = eng.find((p) => p.offsetH === 2)!;
    expect(two.content.push.title).toBe('Due today'); // wording follows the real send time
    expect(by[48]).toBe(iso(dubai('2026-10-11 14:00'))); // Sunday: not a school day
  });

  it('selects only the most recent due offset per task, and drops stale ones', () => {
    const at = dubai('2026-10-14 18:05'); // physics 2h reminder due 18:00
    const due = selectDue(planned, at).filter((p) => p.entityId === 't-physics');
    expect(due.map((p) => p.offsetH)).toEqual([2]);
    expect(selectDue(planned, dubai('2026-10-14 21:30')).some((p) => p.entityId === 't-physics')).toBe(false); // past due
    expect(selectDue(planned, dubai('2026-10-13 23:59')).some((p) => p.entityId === 't-physics')).toBe(false); // 24h one is >3h late
  });

  it('plans application deadline reminders (7d/3d/1d) for unsubmitted applications', () => {
    const p = planApplicationReminders(aisha, [{ application, opportunity }]);
    expect(p.map((x) => x.offsetH)).toEqual([168, 72, 24]);
    expect(p[2]!.content.push.body).toContain('1/2 checklist items done');
    expect(planApplicationReminders(aisha, [{ application: { ...application, status: 'submitted' }, opportunity }])).toEqual([]);
  });

  it('weekly schedule helpers', () => {
    expect(weeklyCron()).toBe('TZ=Asia/Dubai 0 18 * * 0');
    expect(isWeeklyBriefingDue(dubai('2026-10-11 18:05'))).toBe(true);
    expect(isWeeklyBriefingDue(dubai('2026-10-11 18:20'))).toBe(false);
    expect(isWeeklyBriefingDue(dubai('2026-10-12 18:05'))).toBe(false);
  });
});

function setup(nowRef: { now: Date }) {
  const adapters = createChannelAdapters({}, { inAppStore: new MemoryInAppStore() });
  const store = new MemoryNotificationStore();
  const notifier = new Notifier({ adapters, store, clock: () => nowRef.now });
  const data: SchedulerDataSource = {
    reminderBundles: async () => [
      { student: aisha, recipient: aishaRecipient, channels: ['push', 'in_app'], tasks, applications: [{ application, opportunity }] },
    ],
    briefingBundles: async () => [
      {
        student: aisha,
        recipient: aishaRecipient,
        channels: ['push', 'email'],
        guardians: [
          { guardian: guardianGranted, recipient: guardianRecipient(guardianGranted), channels: ['email', 'whatsapp'] },
          { guardian: guardianPending, recipient: guardianRecipient(guardianPending), channels: ['email'] },
        ],
        tasks,
        exams,
        events,
        applications: [{ application, opportunity }],
        newOpportunities: [],
        goals,
      },
    ],
  };
  return { adapters, store, notifier, deps: { data, notifier, clock: () => nowRef.now } };
}

describe('runReminderTick', () => {
  it('sends due reminders once (idempotent across ticks)', async () => {
    const ref = { now: dubai('2026-10-14 18:05') };
    const { adapters, deps } = setup(ref);
    const first = await runReminderTick(deps);
    const physics = first.outcomes.find((o) => o.dedupeKey.startsWith('task:t-physics'))!;
    expect(physics.results.map((r) => r.status)).toEqual(['sent', 'sent']);
    const pushes = (adapters.push as MockAdapter).outbox.length;
    const second = await runReminderTick(deps);
    expect(second.outcomes.flatMap((o) => o.results).every((r) => r.status === 'duplicate')).toBe(true);
    expect((adapters.push as MockAdapter).outbox.length).toBe(pushes);
  });

  it('defers push in quiet hours if a send is forced then (safety net)', async () => {
    const ref = { now: dubai('2026-10-13 10:00') };
    const { notifier } = setup(ref);
    const [p] = planTaskReminders(aisha, tasks);
    const res = await notifier.deliver({ student: aisha, recipient: aishaRecipient, channels: ['push', 'email'], template: p!.template, content: p!.content, dedupeKey: 'x' });
    expect(res[0]).toMatchObject({ status: 'deferred', reason: 'school_hours', until: iso(dubai('2026-10-13 14:30')) });
    expect(res[1]).toMatchObject({ status: 'sent' });
  });
});

describe('runWeeklyBriefing', () => {
  it('briefs the student and only consenting guardians', async () => {
    const ref = { now: dubai('2026-10-11 18:00') };
    const { adapters, store, deps } = setup(ref);
    const s = await runWeeklyBriefing(deps);
    const statuses = s.outcomes.map((o) => o.results.map((r) => `${r.channel}:${r.status}`));
    expect(statuses).toEqual([['push:sent', 'email:sent'], ['email:sent', 'whatsapp:sent'], ['email:blocked']]);
    const email = (adapters.email as MockAdapter).outbox;
    expect(email.map((m) => m.recipient.email)).toEqual(['aisha.test@example.com', 'mariam.test@example.com']);
    expect(email[1]!.email!.html).not.toContain('Physics lab report');
    expect((adapters.whatsapp as MockAdapter).outbox[0]!.whatsapp!.template).toBe('murshid_weekly_briefing');
    expect(store.records.find((r) => r.status === 'blocked')?.error).toBe('guardian_consent_missing');
    // re-run in same week → nothing new
    const again = await runWeeklyBriefing(deps);
    expect(again.outcomes.flatMap((o) => o.results).filter((r) => r.status === 'sent')).toEqual([]);
  });
});

describe('triggers', () => {
  it('cron handler checks the secret and runs the weekly job in its window', async () => {
    const ref = { now: dubai('2026-10-11 18:05') };
    const { deps } = setup(ref);
    const handler = createCronHandler(deps, { secret: 's3cret' });
    expect((await handler(new Request('https://x/cron'))).status).toBe(401);
    const res = await handler(new Request('https://x/cron', { headers: { authorization: 'Bearer s3cret' } }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(['reminders', 'weeklyBriefing']);
  });

  it('registers Inngest functions with cron triggers', async () => {
    const ref = { now: dubai('2026-10-14 18:05') };
    const { deps } = setup(ref);
    const created: { config: { id: string }; trigger: { cron: string }; handler: (ctx: never) => unknown }[] = [];
    registerInngestFunctions({ createFunction: (config, trigger, handler) => created.push({ config, trigger, handler } as never) }, deps);
    expect(created.map((c) => [c.config.id, c.trigger.cron])).toEqual([
      ['murshid-reminders-tick', 'TZ=Asia/Dubai */15 * * * *'],
      ['murshid-weekly-briefing', 'TZ=Asia/Dubai 0 18 * * 0'],
    ]);
    const step = { run: async <T,>(_id: string, fn: () => Promise<T>) => fn() };
    const out = (await created[0]!.handler({ step } as never)) as { considered: number };
    expect(out.considered).toBeGreaterThan(0);
  });
});
