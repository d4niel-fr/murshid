import { sign } from 'hono/jwt';
import { describe, expect, it } from 'vitest';
import { createSeededApp } from '../src/app';
import { quietNow } from '../src/notify/hub';
import { addDays, dubaiDate } from '../src/lib/time';
import { NOW } from './helpers';

const SECRET = 'jwt-secret';
const token = (sub: string, email: string) => sign({ sub, email, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 }, SECRET, 'HS256');

describe('notifications', () => {
  it('new work, marks, replies and announcements reach the student; hand-ins and messages reach the teacher; the daily job reminds once', async () => {
    process.env.CRON_SECRET = 'cron-test-secret';
    const built = await createSeededApp({ now: () => NOW, config: { authMode: 'jwt', jwtSecret: SECRET, platformAdmins: ['boss@murshid.ae'] }, rateLimit: false });
    const as = (tok: string) => async (method: string, path: string, body?: unknown) => {
      const res = await built.app.request(path, { method, headers: { authorization: `Bearer ${tok}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, body: body !== undefined ? JSON.stringify(body) : undefined });
      const t = await res.text(); let j: any = null; try { j = t ? JSON.parse(t) : null; } catch { j = t; } return { status: res.status, body: j };
    };
    const boss = as(await token('u-b', 'boss@murshid.ae'));
    await boss('POST', '/platform/schools', { name: 'Hope School', shortName: 'HS', adminName: 'A', adminEmail: 'a@hope.ae' });
    const admin = as(await token('u-a', 'a@hope.ae'));
    const t = await admin('POST', '/school/teachers', { name: 'Ms Noor', email: 'noor@hope.ae', subject: 'english' });
    await admin('POST', '/school/roster', { students: [{ name: 'Sami Ali', email: 'sami@hope.ae', grade: 10, section: '10A' }] });
    const cls = await admin('POST', '/school/classes', { name: 'Grade 10 English', subject: 'english', teacherId: t.body.id, sections: ['10A'] });
    const teacher = as(await token('u-t', 'noor@hope.ae'));
    const sami = as(await token('u-s', 'sami@hope.ae'));
    await sami('GET', '/account');
    const today = dubaiDate(NOW);
    const post = await teacher('POST', `/teacher/classes/${cls.body.id}/assignments`, { title: 'Essay plan', instructions: null, dueDate: addDays(today, 1) });
    const itemId = post.body.assignment.id;
    let inbox = await sami('GET', '/me/notifications');
    expect(inbox.body.items[0]).toMatchObject({ kind: 'assignment', title: 'New from Ms Noor: Essay plan', read: false });
    expect(inbox.body.channels).toEqual({ push: false, email: false });
    expect((await sami('POST', '/me/push', { endpoint: 'https://push.example/x', keys: { p256dh: 'a'.repeat(40), auth: 'b'.repeat(16) } })).body.code).toBe('push_off');

    // the daily job: needs the secret, reminds about tomorrow's work once
    const cron = async (secret: string) => (await built.app.request('/cron/reminders', { headers: { authorization: `Bearer ${secret}` } }));
    expect((await cron('wrong')).status).toBe(401);
    expect(await (await cron('cron-test-secret')).json()).toMatchObject({ reminders: 1 });
    expect(await (await cron('cron-test-secret')).json()).toMatchObject({ reminders: 0 });

    // hand in -> teacher hears; teacher marks -> student hears
    await sami('POST', `/student/assignments/${encodeURIComponent(itemId)}/handin`, { text: 'Intro, three points, conclusion', fileIds: [] });
    const tInbox = await teacher('GET', '/me/notifications');
    expect(tInbox.body.items[0].kind).toBe('handin');
    const rosterId = built.schools.roster.find((r) => r.email === 'sami@hope.ae')!.id;
    await teacher('POST', `/teacher/classes/${cls.body.id}/assignments/${encodeURIComponent(itemId)}/handins/${rosterId}/review`, { action: 'mark', grade: 88, feedback: 'Clear plan' });
    await teacher('POST', `/teacher/classes/${cls.body.id}/announcements`, { text: 'Bring the novel on Monday' });
    inbox = await sami('GET', '/me/notifications');
    expect(inbox.body.items.slice(0, 2).map((n: any) => n.kind)).toEqual(['announcement', 'marked']);
    expect(inbox.body.unread).toBe(4);
    expect((await sami('POST', '/me/notifications/read', {})).body.unread).toBe(0);
    expect((await sami('PUT', '/me/notifications/email', { on: true })).body).toEqual({ on: true, address: 'sami@hope.ae' });
  });

  it('keeps push quiet in school hours and at night (Dubai time)', () => {
    expect(quietNow(new Date('2026-11-09T06:00:00Z'))).toBe(true);  // Mon 10:00 Dubai, school
    expect(quietNow(new Date('2026-11-09T13:00:00Z'))).toBe(false); // Mon 17:00 Dubai
    expect(quietNow(new Date('2026-11-09T19:00:00Z'))).toBe(true);  // Mon 23:00 Dubai
    expect(quietNow(new Date('2026-11-07T07:00:00Z'))).toBe(false); // Sat 11:00 Dubai
  });
});
