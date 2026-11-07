/**
 * Notifications: an inbox in the app for everyone, plus push to the phone or computer (Web Push, when VAPID keys are
 * set) and email (Resend, when RESEND_API_KEY is set). Saved with the rest of the state; outside sends only happen
 * after a change is saved (Durable.afterCommit), so a request that is re-run never notifies twice.
 *
 * Who: app students by their app id, teachers by teacher id, parents and admins by account id.
 * Quiet hours (Asia/Dubai): no push during the school day (07:30-14:30, Mon-Fri) or at night (21:30-06:30);
 * those wait in the inbox and email instead.
 */
import webpush from 'web-push';

export type NoteKind = 'assignment' | 'returned' | 'marked' | 'message' | 'announcement' | 'reminder' | 'handin' | 'weekly' | 'feelings' | 'points' | 'attendance' | 'report' | 'system';
export interface Note { id: string; kind: NoteKind; title: string; body: string; url: string; at: string; read: boolean }
export interface PushSub { endpoint: string; keys: { p256dh: string; auth: string }; at: string }

export interface NotifyConfig {
  vapid: { publicKey: string; privateKey: string; subject: string } | null;
  resend: { apiKey: string; from: string; replyTo?: string } | null;
  webUrl: string;
}
export function notifyFromEnv(env: Record<string, string | undefined>): NotifyConfig {
  const pub = env.WEB_PUSH_PUBLIC_KEY?.trim(); const priv = env.WEB_PUSH_PRIVATE_KEY?.trim();
  const key = env.RESEND_API_KEY?.trim();
  return {
    vapid: pub && priv ? { publicKey: pub, privateKey: priv, subject: env.WEB_PUSH_SUBJECT?.trim() || 'mailto:hello@murshid.ae' } : null,
    resend: key ? { apiKey: key, from: env.RESEND_FROM?.trim() || 'Murshid <hello@murshid.ae>', replyTo: env.RESEND_REPLY_TO?.trim() || undefined } : null,
    webUrl: (env.PUBLIC_WEB_URL?.trim() || (env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')).replace(/\/+$/, ''),
  };
}

/** Dubai time quiet hours for push. */
export function quietNow(d: Date): boolean {
  const dubai = new Date(d.getTime() + 4 * 3_600_000);
  const day = dubai.getUTCDay(); const m = dubai.getUTCHours() * 60 + dubai.getUTCMinutes();
  if (m < 6 * 60 + 30 || m >= 21 * 60 + 30) return true;
  return day >= 1 && day <= 5 && m >= 7 * 60 + 30 && m < 14 * 60 + 30;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export class NotificationHub {
  inbox: Record<string, Note[]> = {};
  push: Record<string, PushSub[]> = {};
  /** who wants email, and the address */
  email: Record<string, { address: string; on: boolean }> = {};
  /** reminders already sent (key -> Dubai date), so the daily job sends each one once */
  sentKeys: Record<string, string> = {};
  private seq = 0;
  /** runs a send once the change is saved (Durable.afterCommit); without saved state, right away */
  later: ((fn: () => Promise<void>) => void) | null = null;

  constructor(private cfg: NotifyConfig, private now: () => Date = () => new Date()) {}

  get pushKey() { return this.cfg.vapid?.publicKey ?? null; }
  get channels() { return { push: Boolean(this.cfg.vapid), email: Boolean(this.cfg.resend) }; }

  /** Add a note for someone. Returns it. */
  notify(who: string, n: { kind: NoteKind; title: string; body: string; url: string }): Note {
    const note: Note = { ...n, id: `n${(++this.seq).toString(36)}${Date.now().toString(36)}`, at: this.now().toISOString(), read: false };
    const list = (this.inbox[who] ??= []);
    list.unshift(note);
    if (list.length > 100) list.length = 100;
    const job = () => this.send([{ who, note }]);
    if (this.later) this.later(job); else void job().catch((e) => console.error('[notify]', (e as Error).message));
    return note;
  }

  unread(who: string) { return (this.inbox[who] ?? []).filter((n) => !n.read).length; }
  markRead(who: string, ids?: string[]) { for (const n of this.inbox[who] ?? []) if (!ids || ids.includes(n.id)) n.read = true; }

  subscribe(who: string, s: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    const list = (this.push[who] ??= []).filter((x) => x.endpoint !== s.endpoint);
    list.push({ ...s, at: this.now().toISOString() });
    this.push[who] = list.slice(-5);
  }
  unsubscribe(who: string, endpoint: string) { this.push[who] = (this.push[who] ?? []).filter((x) => x.endpoint !== endpoint); }

  /** Send queued notes out (push now unless it is quiet; email when the person turned it on). */
  async send(batch: { who: string; note: Note }[], fetchImpl: typeof fetch = fetch) {
    const quiet = quietNow(this.now());
    for (const { who, note } of batch) {
      const url = `${this.cfg.webUrl}${note.url}`;
      if (this.cfg.vapid && !quiet) {
        for (const sub of this.push[who] ?? []) {
          try {
            await webpush.sendNotification(sub, JSON.stringify({ title: note.title, body: note.body, url: note.url, tag: note.kind }), {
              vapidDetails: this.cfg.vapid, TTL: 60 * 60 * 24, urgency: note.kind === 'reminder' ? 'high' : 'normal',
            });
          } catch (e) {
            const code = (e as { statusCode?: number }).statusCode;
            if (code === 404 || code === 410) this.unsubscribe(who, sub.endpoint); // the browser dropped it
          }
        }
      }
      const mail = this.email[who];
      if (this.cfg.resend && mail?.on && mail.address) {
        await fetchImpl('https://api.resend.com/emails', {
          method: 'POST',
          headers: { authorization: `Bearer ${this.cfg.resend.apiKey}`, 'content-type': 'application/json', 'idempotency-key': `${who}:${note.id}` },
          body: JSON.stringify({
            from: this.cfg.resend.from, to: [mail.address], reply_to: this.cfg.resend.replyTo, subject: note.title,
            text: `${note.body}\n\n${url}\n\nYou get these because email is on in Murshid settings.`,
            html: `<div style="font-family:system-ui,sans-serif;max-width:520px"><p style="font-size:16px;margin:0 0 8px"><b>${esc(note.title)}</b></p><p style="font-size:15px;line-height:1.5;color:#333">${esc(note.body)}</p><p><a href="${esc(url)}" style="display:inline-block;background:#0f2f63;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Open Murshid</a></p><p style="font-size:12px;color:#777">You get these because email is on in your Murshid settings.</p></div>`,
          }),
        }).catch((e) => console.error('[notify] email failed', (e as Error).message));
      }
    }
  }
}
