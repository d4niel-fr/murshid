'use client';

/** Notifications: my inbox, and push on this device (a service worker + Web Push). */
import { request } from './http';

export interface Note { id: string; kind: string; title: string; body: string; url: string; at: string; read: boolean }
export interface Inbox { items: Note[]; unread: number; channels: { push: boolean; email: boolean }; pushKey: string | null; email: { on: boolean; address: string | null } }

export const getInbox = (devUser?: string) => request<Inbox>('/me/notifications', { headers: devUser ? { 'x-dev-user': devUser } : undefined, timeoutMs: 8000, retries: 0 });
export const markRead = (ids?: string[], devUser?: string) => request<{ unread: number }>('/me/notifications/read', { method: 'POST', body: ids ? { ids } : {}, headers: devUser ? { 'x-dev-user': devUser } : undefined });
export const setEmail = (on: boolean) => request<{ on: boolean }>('/me/notifications/email', { method: 'PUT', body: { on } });

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const b64ToBytes = (b64: string) => {
  const s = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(s); const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

/** Ask for permission and subscribe this device. Returns why it did not work, or null. */
export async function enablePush(key: string, devUser?: string): Promise<null | 'unsupported' | 'denied' | 'failed'> {
  if (!pushSupported()) return 'unsupported';
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return 'denied';
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await request('/me/push', { method: 'POST', body: { endpoint: j.endpoint, keys: j.keys }, headers: devUser ? { 'x-dev-user': devUser } : undefined });
    return null;
  } catch { return 'failed'; }
}

export async function disablePush(devUser?: string) {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration('/');
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await request('/me/push', { method: 'DELETE', body: { endpoint: sub.endpoint }, headers: devUser ? { 'x-dev-user': devUser } : undefined }).catch(() => undefined);
  await sub.unsubscribe();
}

export async function pushOn(): Promise<boolean> {
  if (!pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return Boolean(await reg?.pushManager.getSubscription());
}
