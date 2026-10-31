import type { Channel } from '../types.js';
import { WHATSAPP_TEMPLATES } from '../templates.js';
import {
  ExpoPushAdapter,
  InAppAdapter,
  MemoryInAppStore,
  MockAdapter,
  ResendEmailAdapter,
  WhatsAppCloudAdapter,
  type InAppStore,
} from './adapters.js';
import type { ChannelAdapter, FetchLike } from './types.js';

export type Env = Record<string, string | undefined>;

function need(env: Env, key: string): string {
  const v = env[key];
  if (!v) throw new Error(`@murshid/notify: ${key} is required when NOTIFY_MODE=live (see .env.example)`);
  return v;
}

/**
 * Build the channel adapters. NOTIFY_MODE=mock (default) records messages in memory;
 * NOTIFY_MODE=live talks to Expo / Resend / WhatsApp Cloud API. Per-channel override:
 * NOTIFY_<CHANNEL>_MODE=mock|live (e.g. NOTIFY_WHATSAPP_MODE=mock while the WA number is pending).
 */
export function createChannelAdapters(
  env: Env = process.env,
  opts: { inAppStore?: InAppStore; fetch?: FetchLike } = {},
): Record<Channel, ChannelAdapter> {
  const global = env.NOTIFY_MODE === 'live' ? 'live' : 'mock';
  const mode = (c: string) => (env[`NOTIFY_${c.toUpperCase()}_MODE`] ?? global) === 'live';
  return {
    push: mode('push') ? new ExpoPushAdapter({ accessToken: env.EXPO_ACCESS_TOKEN }) : new MockAdapter('push'),
    email: mode('email')
      ? new ResendEmailAdapter({ apiKey: need(env, 'RESEND_API_KEY'), from: need(env, 'RESEND_FROM'), replyTo: env.RESEND_REPLY_TO, fetch: opts.fetch })
      : new MockAdapter('email'),
    whatsapp: mode('whatsapp')
      ? new WhatsAppCloudAdapter({
          token: need(env, 'WHATSAPP_TOKEN'),
          phoneNumberId: need(env, 'WHATSAPP_PHONE_NUMBER_ID'),
          apiVersion: env.WHATSAPP_API_VERSION,
          templates: WHATSAPP_TEMPLATES,
          fetch: opts.fetch,
        })
      : new MockAdapter('whatsapp'),
    // In-app always writes to the store; "mock" just means the in-memory store.
    in_app: new InAppAdapter(opts.inAppStore ?? new MemoryInAppStore()),
  };
}
