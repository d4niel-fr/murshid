import type { Channel, Recipient } from '../types.js';

export interface PushContent {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}
export interface WhatsAppContent {
  /** Pre-approved Meta template name (UTILITY category). */
  template: string;
  language: string;
  /** Body {{1}}..{{n}} parameters, in order. */
  bodyParams: string[];
}
export interface InAppContent {
  title: string;
  body: string;
  link?: string;
}

export interface OutboundMessage {
  channel: Channel;
  recipient: Recipient;
  template: string;
  /** Stable key for idempotency (also sent as Resend Idempotency-Key). */
  dedupeKey: string;
  push?: PushContent;
  email?: EmailContent;
  whatsapp?: WhatsAppContent;
  inApp?: InAppContent;
}

export type SendResult =
  | { ok: true; providerId?: string; invalidTokens?: string[] }
  | { ok: false; error: string; retryable: boolean; invalidTokens?: string[] };

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly mode: 'mock' | 'live';
  send(msg: OutboundMessage): Promise<SendResult>;
}

/** Minimal fetch signature so tests can inject a mock without network. */
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;
