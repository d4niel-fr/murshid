import { describe, expect, it, vi } from 'vitest';
import {
  createChannelAdapters,
  ExpoPushAdapter,
  InAppAdapter,
  MemoryInAppStore,
  MockAdapter,
  ResendEmailAdapter,
  sanitizeWaParam,
  WHATSAPP_TEMPLATES,
  WhatsAppCloudAdapter,
  renderTaskReminder,
  type FetchLike,
  type OutboundMessage,
} from '../src/index.js';
import { aishaRecipient, dubai } from './fixtures.js';

const content = renderTaskReminder({
  firstName: 'Aisha',
  taskId: 't-1',
  taskTitle: 'Physics lab report',
  dueAt: dubai('2026-10-14 20:00').toISOString(),
  offset: '24h',
  sendAt: dubai('2026-10-13 20:00').toISOString(),
});

const msg = (channel: OutboundMessage['channel'], extra: Partial<OutboundMessage> = {}): OutboundMessage => ({
  channel,
  recipient: aishaRecipient,
  template: 'task_due_reminder',
  dedupeKey: 'task:t-1:24h:student:stu-aisha:' + channel,
  push: content.push,
  email: content.email,
  whatsapp: content.whatsapp,
  inApp: content.inApp,
  ...extra,
});

function mockFetch(status: number, body: unknown) {
  return vi.fn<FetchLike>(async () => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }));
}

describe('ExpoPushAdapter', () => {
  it('sends to valid tokens and reports dead ones', async () => {
    const client = {
      chunkPushNotifications: (m: unknown[]) => [m],
      sendPushNotificationsAsync: vi.fn(async (m: unknown[]) =>
        m.map((_, i) =>
          i === 0 ? { status: 'ok' as const, id: 'ticket-1' } : { status: 'error' as const, message: 'gone', details: { error: 'DeviceNotRegistered' as const } },
        ),
      ),
    };
    const a = new ExpoPushAdapter({ client: client as never });
    const res = await a.send(msg('push', { recipient: { ...aishaRecipient, expoPushTokens: ['ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', 'not-a-token'] } }));
    expect(res).toMatchObject({ ok: true, providerId: 'ticket-1' });
    expect(res.invalidTokens).toEqual(['not-a-token', 'ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]']);
    const sent = client.sendPushNotificationsAsync.mock.calls[0]![0] as { title: string; data: { dedupeKey: string } }[];
    expect(sent[0]!.title).toBe('Due tomorrow');
    expect(sent[0]!.data.dedupeKey).toContain('task:t-1');
  });

  it('fails cleanly without tokens', async () => {
    const a = new ExpoPushAdapter({ client: { chunkPushNotifications: () => [], sendPushNotificationsAsync: async () => [] } });
    expect(await a.send(msg('push', { recipient: { ...aishaRecipient, expoPushTokens: [] } }))).toMatchObject({ ok: false, error: 'no_valid_push_token' });
  });
});

describe('ResendEmailAdapter', () => {
  it('posts to the Resend REST API with idempotency key', async () => {
    const f = mockFetch(200, { id: 'email-123' });
    const a = new ResendEmailAdapter({ apiKey: 're_test', from: 'Murshid <hello@example.com>', fetch: f });
    expect(await a.send(msg('email'))).toEqual({ ok: true, providerId: 'email-123' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    expect(init.headers['Idempotency-Key']).toContain('task:t-1');
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(['aisha.test@example.com']);
    expect(body.subject).toContain('Physics lab report');
    expect(body.html).toContain('<strong>Physics lab report</strong>');
  });

  it('marks 5xx retryable and 4xx not', async () => {
    const a5 = new ResendEmailAdapter({ apiKey: 'k', from: 'f@example.com', fetch: mockFetch(503, {}) });
    expect(await a5.send(msg('email'))).toMatchObject({ ok: false, retryable: true });
    const a4 = new ResendEmailAdapter({ apiKey: 'k', from: 'f@example.com', fetch: mockFetch(422, {}) });
    expect(await a4.send(msg('email'))).toMatchObject({ ok: false, retryable: false });
  });
});

describe('WhatsAppCloudAdapter', () => {
  const make = (f: FetchLike, templates = WHATSAPP_TEMPLATES) =>
    new WhatsAppCloudAdapter({ token: 'wa_test', phoneNumberId: '123456', apiVersion: 'v21.0', templates, fetch: f });

  it('sends an approved utility template', async () => {
    const f = mockFetch(200, { messages: [{ id: 'wamid.1' }] });
    expect(await make(f).send(msg('whatsapp'))).toEqual({ ok: true, providerId: 'wamid.1' });
    const [url, init] = f.mock.calls[0]!;
    expect(url).toBe('https://graph.facebook.com/v21.0/123456/messages');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({ messaging_product: 'whatsapp', to: '971500000001', type: 'template' });
    expect(body.template.name).toBe('murshid_task_reminder');
    expect(body.template.components[0].parameters).toHaveLength(3);
  });

  it('refuses without opt-in, for marketing templates, and on bad params', async () => {
    const f = mockFetch(200, {});
    expect(await make(f).send(msg('whatsapp', { recipient: { ...aishaRecipient, whatsappOptIn: { optedIn: false } } }))).toMatchObject({ ok: false, error: 'whatsapp_no_opt_in' });
    const promo = { murshid_task_reminder: { name: 'murshid_task_reminder', category: 'MARKETING' as const, params: 3 } };
    expect(await make(f, promo).send(msg('whatsapp'))).toMatchObject({ ok: false, error: 'non_utility_template_refused' });
    expect(await make(f).send(msg('whatsapp', { whatsapp: { ...content.whatsapp, bodyParams: ['x'] } }))).toMatchObject({ ok: false, error: 'param_count_mismatch' });
    expect(f).not.toHaveBeenCalled();
    expect(sanitizeWaParam('a\nb\t c      d')).toBe('a b c d');
  });
});

describe('InAppAdapter + factory', () => {
  it('writes to the in-app store', async () => {
    const store = new MemoryInAppStore();
    await new InAppAdapter(store, () => dubai('2026-10-13 20:00')).send(msg('in_app'));
    expect(store.items[0]).toMatchObject({ studentId: 'stu-aisha', title: 'Due tomorrow', readAt: null });
  });

  it('defaults to mock mode and validates live env', () => {
    const a = createChannelAdapters({});
    expect(a.push).toBeInstanceOf(MockAdapter);
    expect(a.email.mode).toBe('mock');
    expect(() => createChannelAdapters({ NOTIFY_MODE: 'live' })).toThrow(/RESEND_API_KEY/);
    const mixed = createChannelAdapters({ NOTIFY_MODE: 'live', NOTIFY_WHATSAPP_MODE: 'mock', RESEND_API_KEY: 'k', RESEND_FROM: 'f@example.com' });
    expect(mixed.email).toBeInstanceOf(ResendEmailAdapter);
    expect(mixed.whatsapp).toBeInstanceOf(MockAdapter);
  });
});
