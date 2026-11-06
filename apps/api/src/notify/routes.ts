/**
 * Notification routes: my inbox, push on this device, email on or off, and the daily reminder job (cron).
 */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { Ctx } from '../lib/context';
import type { Api } from '../lib/router';
import { safeEqual } from '../lib/security';
import { addDays, dubaiDate } from '../lib/time';
import { streamItems, streamsOf, weeklyReport } from '../schools/engine';
import type { SchoolStore } from '../schools/store';
import type { DemoStore } from '../v1/store';
import type { NotificationHub } from './hub';

/**
 * Push endpoints belong to the browser makers' push services. The server POSTs to whatever is saved here, so any other
 * host is refused (otherwise a subscription could point the server at internal or third-party addresses: SSRF).
 */
export const PUSH_HOSTS = /^(fcm\.googleapis\.com|android\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9-]+\.push\.apple\.com|[a-z0-9-]+\.notify\.windows\.com|wns2?-[a-z0-9-]+\.notify\.windows\.com)$/;
export const pushEndpointOk = (u: string) => { try { const x = new URL(u); return x.protocol === 'https:' && !x.port && !x.username && !x.password && PUSH_HOSTS.test(x.hostname); } catch { return false; } };
const Sub = z.object({ endpoint: z.string().url().max(1000).refine(pushEndpointOk, 'push endpoints must be a browser push service (https)'), keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }) });
const Read = z.object({ ids: z.array(z.string().max(40)).max(200).optional() });
const Email = z.object({ on: z.boolean() });
const Unsub = z.object({ endpoint: z.string().url().max(1000) });


export function registerNotifications(api: Api, hub: NotificationHub, schools: SchoolStore, store: DemoStore, env: Record<string, string | undefined>) {
  /** whose inbox: students by app id, teachers by teacher id, everyone else by account */
  const who = async (c: Ctx): Promise<{ key: string; email: string | null }> => {
    const { config, whoami } = c.get('deps');
    if (whoami && !(config.authMode === 'dev' && !c.req.header('authorization'))) {
      const me = await whoami(c);
      const key = me.role === 'student' ? me.studentId : me.role === 'teacher' ? me.teacherId : me.accountId ?? me.authUserId;
      if (!key) throw new HTTPException(403, { message: 'finish setting up your account first', cause: { code: 'needs_setup' } });
      return { key, email: me.email };
    }
    if (c.req.header('x-dev-role') === 'teacher') return { key: c.req.header('x-dev-user-id') ?? 'dev-teacher', email: null };
    const id = c.req.header('x-dev-user') ?? c.req.header('x-dev-user-id');
    if (!id) throw new HTTPException(401, { message: 'authentication required' });
    return { key: id, email: null };
  };

  api.route({ method: 'get', path: '/me/notifications', tag: 'notify', auth: 'custom', summary: 'My notifications (newest first), unread count, and what can reach me (push, email)' },
    async (c) => {
      const w = await who(c);
      return c.json({ items: hub.inbox[w.key] ?? [], unread: hub.unread(w.key), channels: hub.channels, pushKey: hub.pushKey, email: { on: Boolean(hub.email[w.key]?.on), address: w.email } });
    });
  api.route({ method: 'post', path: '/me/notifications/read', tag: 'notify', auth: 'custom', body: Read, summary: 'Mark notifications read (all, or the ids given)' },
    async (c, { body }) => { const w = await who(c); hub.markRead(w.key, (body as z.output<typeof Read>).ids); return c.json({ unread: hub.unread(w.key) }); });
  api.route({ method: 'post', path: '/me/push', tag: 'notify', auth: 'custom', body: Sub, summary: 'Turn on push for this device (a Web Push subscription)' },
    async (c, { body }) => {
      if (!hub.pushKey) throw new HTTPException(404, { message: 'push is not set up on this server', cause: { code: 'push_off' } });
      const w = await who(c); hub.subscribe(w.key, body as z.output<typeof Sub>); return c.json({ ok: true }, 201);
    });
  api.route({ method: 'delete', path: '/me/push', tag: 'notify', auth: 'custom', body: Unsub, summary: 'Turn off push for this device' },
    async (c, { body }) => { const w = await who(c); hub.unsubscribe(w.key, (body as z.output<typeof Unsub>).endpoint); return c.json({ ok: true }); });
  api.route({ method: 'put', path: '/me/notifications/email', tag: 'notify', auth: 'custom', body: Email, summary: 'Email me my notifications (to my sign-in email)' },
    async (c, { body }) => {
      const w = await who(c);
      if (!w.email) throw new HTTPException(400, { message: 'there is no email on this account', cause: { code: 'no_email' } });
      hub.email[w.key] = { address: w.email, on: (body as z.output<typeof Email>).on };
      return c.json({ on: hub.email[w.key]!.on, address: w.email });
    });

  /**
   * Daily job (Vercel cron, Authorization: Bearer CRON_SECRET): reminds students about work due tomorrow that is not
   * handed in, and on Sundays sends each parent a summary of their child's week. Each reminder is sent once.
   */
  const run = async (c: Ctx) => {
    const secret = env.CRON_SECRET?.trim();
    const got = (c.req.header('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!safeEqual(got, secret)) throw new HTTPException(401, { message: 'cron secret required' });
    const now = c.get('deps').now(); const today = dubaiDate(now); const tomorrow = addDays(today, 1);
    const sent = hub.sentKeys;
    let reminders = 0; let summaries = 0;
    for (const org of schools.orgs.filter((o) => o.real && o.kind === 'school')) {
      const school = schools.school(org.id);
      for (const r of school.roster.filter((x) => x.appId)) {
        for (const st of streamsOf(school, r.id)) {
          for (const it of streamItems(school, st, today).filter((x) => x.posted && x.dueDate === tomorrow)) {
            if (schools.classroom.handins[it.id]?.[r.id]) continue;
            const k = `due:${it.id}:${r.id}`; if (sent[k]) continue;
            sent[k] = today; reminders++;
            hub.notify(r.appId!, { kind: 'reminder', title: `Due tomorrow: ${it.title}`, body: `${st.name} · ${it.dueTime}`, url: `/app/school/assignments/${encodeURIComponent(it.id)}` });
          }
        }
      }
    }
    // Sunday (Dubai): the week for each parent
    if (new Date(`${today}T12:00:00Z`).getUTCDay() === 0) {
      for (const acc of schools.accounts.filter((a) => a.role === 'parent' && a.studentIds.length)) {
        for (const id of acc.studentIds) {
          const k = `week:${today}:${acc.id}:${id}`; if (sent[k] || !store.has(id)) continue;
          sent[k] = today;
          const r = schools.rosterByApp(id);
          const summary = r ? weeklyReport(schools.school(r.orgId), r, today, 18 * 60).summary : `${store.view(id, now).profile.preferredName}'s week is ready in Murshid.`;
          hub.notify(acc.id, { kind: 'weekly', title: `${store.view(id, now).profile.preferredName}'s week`, body: summary, url: '/app' });
          summaries++;
        }
      }
    }
    // forget sends older than three weeks
    for (const [k, d] of Object.entries(sent)) if (d < addDays(today, -21)) delete sent[k];
    return c.json({ ok: true, reminders, summaries });
  };
  api.route({ method: 'get', path: '/cron/reminders', tag: 'notify', auth: 'custom', durable: 'tx', summary: 'Daily reminder job (cron secret)' }, run);
  api.route({ method: 'post', path: '/cron/reminders', tag: 'notify', auth: 'custom', summary: 'Daily reminder job (cron secret)' }, run);
}
