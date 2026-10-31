import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';
import type { Channel } from '../types.js';
import type { ChannelAdapter, FetchLike, OutboundMessage, SendResult } from './types.js';

// ---------------------------------------------------------------- mock

/** Records every message instead of sending. Default in tests and when NOTIFY_MODE=mock. */
export class MockAdapter implements ChannelAdapter {
  readonly mode = 'mock' as const;
  readonly outbox: OutboundMessage[] = [];
  constructor(
    readonly channel: Channel,
    private behaviour: (msg: OutboundMessage) => SendResult = () => ({ ok: true, providerId: `mock-${Math.random().toString(36).slice(2, 10)}` }),
  ) {}
  async send(msg: OutboundMessage): Promise<SendResult> {
    this.outbox.push(msg);
    return this.behaviour(msg);
  }
}

// ---------------------------------------------------------------- push (Expo)

export interface ExpoLike {
  chunkPushNotifications(messages: ExpoPushMessage[]): ExpoPushMessage[][];
  sendPushNotificationsAsync(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]>;
}

export class ExpoPushAdapter implements ChannelAdapter {
  readonly channel = 'push' as const;
  readonly mode = 'live' as const;
  private client: ExpoLike;
  constructor(opts: { accessToken?: string; client?: ExpoLike } = {}) {
    this.client = opts.client ?? new Expo({ accessToken: opts.accessToken });
  }

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!msg.push) return { ok: false, error: 'missing_push_content', retryable: false };
    const tokens = msg.recipient.expoPushTokens ?? [];
    const valid: string[] = tokens.filter((t) => Expo.isExpoPushToken(t));
    const invalidTokens: string[] = tokens.filter((t) => !Expo.isExpoPushToken(t));
    if (!valid.length) return { ok: false, error: 'no_valid_push_token', retryable: false, invalidTokens };

    const messages: ExpoPushMessage[] = valid.map((to) => ({
      to,
      title: msg.push!.title,
      body: msg.push!.body,
      data: { ...msg.push!.data, template: msg.template, dedupeKey: msg.dedupeKey },
      sound: 'default',
      priority: 'default',
      channelId: 'reminders',
    }));
    const tickets: ExpoPushTicket[] = [];
    try {
      for (const chunk of this.client.chunkPushNotifications(messages)) {
        tickets.push(...(await this.client.sendPushNotificationsAsync(chunk)));
      }
    } catch (e) {
      return { ok: false, error: `expo_error: ${(e as Error).message}`, retryable: true, invalidTokens };
    }
    tickets.forEach((t, i) => {
      if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') invalidTokens.push(valid[i]!);
    });
    const okTickets = tickets.filter((t) => t.status === 'ok');
    if (!okTickets.length) {
      const first = tickets.find((t) => t.status === 'error');
      return { ok: false, error: first && first.status === 'error' ? first.message : 'expo_no_ticket', retryable: true, invalidTokens };
    }
    // NOTE: receipts (getPushNotificationReceiptsAsync) should be checked ~15 min later; see README.
    return { ok: true, providerId: okTickets.map((t) => (t.status === 'ok' ? t.id : '')).join(','), invalidTokens };
  }
}

// ---------------------------------------------------------------- email (Resend REST)

export class ResendEmailAdapter implements ChannelAdapter {
  readonly channel = 'email' as const;
  readonly mode = 'live' as const;
  constructor(
    private opts: { apiKey: string; from: string; replyTo?: string; fetch?: FetchLike; baseUrl?: string },
  ) {}

  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!msg.email) return { ok: false, error: 'missing_email_content', retryable: false };
    if (!msg.recipient.email) return { ok: false, error: 'no_email_address', retryable: false };
    const f = this.opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const res = await f(`${this.opts.baseUrl ?? 'https://api.resend.com'}/emails`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': msg.dedupeKey.slice(0, 256),
      },
      body: JSON.stringify({
        from: this.opts.from,
        to: [msg.recipient.email],
        subject: msg.email.subject,
        html: msg.email.html,
        text: msg.email.text,
        reply_to: this.opts.replyTo,
        tags: [{ name: 'template', value: msg.template.replace(/[^a-zA-Z0-9_-]/g, '_') }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `resend_${res.status}: ${body.slice(0, 200)}`, retryable: res.status === 429 || res.status >= 500 };
    }
    const data = (await res.json()) as { id?: string };
    return { ok: true, providerId: data.id };
  }
}

// ---------------------------------------------------------------- WhatsApp Cloud API

/** Only UTILITY-category templates may be sent (transactional reminders). Marketing is refused. */
export interface WhatsAppTemplateSpec {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  params: number;
}

export class WhatsAppCloudAdapter implements ChannelAdapter {
  readonly channel = 'whatsapp' as const;
  readonly mode = 'live' as const;
  constructor(
    private opts: {
      token: string;
      phoneNumberId: string;
      apiVersion?: string;
      templates: Record<string, WhatsAppTemplateSpec>;
      fetch?: FetchLike;
    },
  ) {}

  async send(msg: OutboundMessage): Promise<SendResult> {
    const wa = msg.whatsapp;
    if (!wa) return { ok: false, error: 'missing_whatsapp_content', retryable: false };
    // Defence in depth: the consent hook checks opt-in too.
    if (!msg.recipient.whatsappOptIn?.optedIn) return { ok: false, error: 'whatsapp_no_opt_in', retryable: false };
    if (!msg.recipient.phone || !/^\+\d{8,15}$/.test(msg.recipient.phone)) return { ok: false, error: 'invalid_phone', retryable: false };
    const spec = this.opts.templates[wa.template];
    if (!spec) return { ok: false, error: `unknown_template:${wa.template}`, retryable: false };
    if (spec.category !== 'UTILITY') return { ok: false, error: 'non_utility_template_refused', retryable: false };
    if (wa.bodyParams.length !== spec.params) return { ok: false, error: 'param_count_mismatch', retryable: false };

    const f = this.opts.fetch ?? (globalThis.fetch as unknown as FetchLike);
    const url = `https://graph.facebook.com/${this.opts.apiVersion ?? 'v21.0'}/${this.opts.phoneNumberId}/messages`;
    const res = await f(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.opts.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: msg.recipient.phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: wa.template,
          language: { code: wa.language },
          components: [{ type: 'body', parameters: wa.bodyParams.map((text) => ({ type: 'text', text: sanitizeWaParam(text) })) }],
        },
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      return { ok: false, error: `whatsapp_${res.status}: ${body.slice(0, 200)}`, retryable: res.status === 429 || res.status >= 500 };
    }
    const data = (await res.json()) as { messages?: { id: string }[] };
    return { ok: true, providerId: data.messages?.[0]?.id };
  }
}

/** Meta rejects template params with newlines, tabs or >4 consecutive spaces; cap length too. */
export function sanitizeWaParam(s: string): string {
  return s.replace(/\s+/g, ' ').trim().slice(0, 1000);
}

// ---------------------------------------------------------------- in-app

export interface InAppItem {
  id: string;
  studentId: string;
  recipientKind: 'student' | 'guardian';
  title: string;
  body: string;
  link?: string;
  template: string;
  createdAt: string;
  readAt: string | null;
}

/** Storage port; the db team backs this with the notifications table / a feed view. */
export interface InAppStore {
  insert(item: InAppItem): Promise<void>;
}

export class MemoryInAppStore implements InAppStore {
  items: InAppItem[] = [];
  async insert(item: InAppItem) {
    this.items.push(item);
  }
}

export class InAppAdapter implements ChannelAdapter {
  readonly channel = 'in_app' as const;
  readonly mode = 'live' as const;
  constructor(private store: InAppStore, private clock: () => Date = () => new Date()) {}
  async send(msg: OutboundMessage): Promise<SendResult> {
    if (!msg.inApp) return { ok: false, error: 'missing_in_app_content', retryable: false };
    const id = `inapp_${msg.dedupeKey}`;
    await this.store.insert({
      id,
      studentId: msg.recipient.studentId,
      recipientKind: msg.recipient.kind,
      title: msg.inApp.title,
      body: msg.inApp.body,
      link: msg.inApp.link,
      template: msg.template,
      createdAt: this.clock().toISOString(),
      readAt: null,
    });
    return { ok: true, providerId: id };
  }
}
