import type { ChannelAdapter, OutboundMessage } from './channels/types.js';
import { defaultConsentHook, type ConsentHook } from './consent.js';
import { DEFAULT_QUIET_HOURS, isQuiet, nextAllowed, quietReason, type QuietHoursConfig } from './quiet-hours.js';
import type { RenderedContent } from './templates.js';
import type { Channel, Guardian, NotificationRecord, Recipient, Student } from './types.js';

/** Persistence port for Notification rows (db team implements with Supabase). */
export interface NotificationStore {
  /** True if a row with this dedupe key already has status 'sent'. */
  wasSent(dedupeKey: string): Promise<boolean>;
  save(record: NotificationRecord): Promise<void>;
}

export class MemoryNotificationStore implements NotificationStore {
  records: NotificationRecord[] = [];
  async wasSent(key: string) {
    return this.records.some((r) => r.dedupe_key === key && r.status === 'sent');
  }
  async save(r: NotificationRecord) {
    this.records.push(r);
  }
}

export interface DeliveryRequest {
  student: Student;
  recipient: Recipient;
  guardian?: Guardian | null;
  channels: Channel[];
  template: string;
  content: RenderedContent;
  /** Base key; the channel is appended so each channel is idempotent on its own. */
  dedupeKey: string;
  payload?: Record<string, unknown>;
  /** What to do if a channel is in quiet hours right now. Default: defer. */
  onQuiet?: 'defer' | 'skip';
}

export type ChannelOutcome =
  | { channel: Channel; status: 'sent'; providerId?: string }
  | { channel: Channel; status: 'duplicate' }
  | { channel: Channel; status: 'blocked'; reason: string }
  | { channel: Channel; status: 'deferred'; until: string; reason: string }
  | { channel: Channel; status: 'failed'; error: string; retryable: boolean };

export interface NotifierDeps {
  adapters: Partial<Record<Channel, ChannelAdapter>>;
  store: NotificationStore;
  consent?: ConsentHook;
  quietHours?: QuietHoursConfig;
  clock?: () => Date;
  /** Called with Expo tokens the provider says are dead, so the app can delete them. */
  onInvalidTokens?: (studentId: string, tokens: string[]) => Promise<void> | void;
  idGen?: () => string;
}

export class Notifier {
  private consent: ConsentHook;
  private quiet: QuietHoursConfig;
  private clock: () => Date;
  private idGen: () => string;
  constructor(private deps: NotifierDeps) {
    this.consent = deps.consent ?? defaultConsentHook;
    this.quiet = deps.quietHours ?? DEFAULT_QUIET_HOURS;
    this.clock = deps.clock ?? (() => new Date());
    this.idGen = deps.idGen ?? (() => globalThis.crypto.randomUUID());
  }

  async deliver(req: DeliveryRequest): Promise<ChannelOutcome[]> {
    const out: ChannelOutcome[] = [];
    for (const channel of req.channels) out.push(await this.deliverOne(req, channel));
    return out;
  }

  private async record(req: DeliveryRequest, channel: Channel, key: string, now: Date, patch: Partial<NotificationRecord>) {
    await this.deps.store.save({
      id: this.idGen(),
      student_id: req.student.id,
      channel,
      template: req.template,
      payload: req.payload ?? {},
      scheduled_at: now.toISOString(),
      sent_at: null,
      status: 'scheduled',
      dedupe_key: key,
      recipient_kind: req.recipient.kind,
      ...patch,
    });
  }

  private async deliverOne(req: DeliveryRequest, channel: Channel): Promise<ChannelOutcome> {
    const now = this.clock();
    const key = `${req.dedupeKey}:${req.recipient.kind}:${req.recipient.guardianId ?? req.recipient.studentId}:${channel}`;
    if (await this.deps.store.wasSent(key)) return { channel, status: 'duplicate' };

    const decision = await this.consent({
      student: req.student,
      recipient: req.recipient,
      channel,
      guardian: req.guardian,
      now,
    });
    if (!decision.allowed) {
      await this.record(req, channel, key, now, { status: 'blocked', error: decision.reason });
      return { channel, status: 'blocked', reason: decision.reason };
    }

    if (isQuiet(now, channel, this.quiet)) {
      const reason = quietReason(now, this.quiet) ?? 'night';
      const until = nextAllowed(now, this.quiet).toISOString();
      if (req.onQuiet === 'skip') return { channel, status: 'blocked', reason: `quiet_hours:${reason}` };
      await this.record(req, channel, key, now, { status: 'deferred', scheduled_at: until, error: `quiet_hours:${reason}` });
      return { channel, status: 'deferred', until, reason };
    }

    const adapter = this.deps.adapters[channel];
    if (!adapter) {
      await this.record(req, channel, key, now, { status: 'failed', error: 'no_adapter' });
      return { channel, status: 'failed', error: 'no_adapter', retryable: false };
    }

    const msg: OutboundMessage = {
      channel,
      recipient: req.recipient,
      template: req.template,
      dedupeKey: key,
      push: channel === 'push' ? req.content.push : undefined,
      email: channel === 'email' ? req.content.email : undefined,
      whatsapp: channel === 'whatsapp' ? req.content.whatsapp : undefined,
      inApp: channel === 'in_app' ? req.content.inApp : undefined,
    };
    const res = await adapter.send(msg).catch((e: Error) => ({ ok: false as const, error: e.message, retryable: true }));
    if ('invalidTokens' in res && res.invalidTokens?.length) await this.deps.onInvalidTokens?.(req.student.id, res.invalidTokens);
    if (res.ok) {
      await this.record(req, channel, key, now, { status: 'sent', sent_at: now.toISOString() });
      return { channel, status: 'sent', providerId: res.providerId };
    }
    await this.record(req, channel, key, now, { status: 'failed', error: res.error });
    return { channel, status: 'failed', error: res.error, retryable: res.retryable };
  }
}
