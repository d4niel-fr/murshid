'use client';

import Link from 'next/link';
import { Bell, BellRing, Check, ClipboardList, Heart, Megaphone, MessageCircle, Star } from 'lucide-react';
import { Popover } from 'radix-ui';
import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Ago } from '@/components/shared/ago';
import { getInbox, markRead, type Inbox, type Note } from '@/lib/notify';
import { cn } from '@/lib/utils';

const ICON: Record<string, typeof Bell> = { assignment: ClipboardList, reminder: BellRing, marked: Star, returned: ClipboardList, message: MessageCircle, announcement: Megaphone, feelings: Heart };

/** The bell in the top bar: what teachers, Murshid and the school sent, newest first. */
export function NotificationBell() {
  const { tx, client, locale } = useApp();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { try { setInbox(await getInbox(client.devUser)); } catch { /* offline: keep what we have */ } }, [client.devUser]);
  useEffect(() => {
    void load();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 60_000);
    const vis = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', vis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', vis); };
  }, [load]);
  const readAll = async () => { if (!inbox?.unread) return; setInbox({ ...inbox, unread: 0, items: inbox.items.map((n) => ({ ...n, read: true })) }); await markRead(undefined, client.devUser).catch(() => undefined); };
  const openOne = (n: Note) => { setOpen(false); if (!n.read) void markRead([n.id], client.devUser).then(() => load()).catch(() => undefined); };
  const unread = inbox?.unread ?? 0;
  return (
    <Popover.Root open={open} onOpenChange={(v) => { setOpen(v); if (v) void load(); }}>
      <Popover.Trigger asChild>
        <button className="relative inline-flex size-10 items-center justify-center rounded-full bg-surface text-muted-foreground transition-colors hover:text-foreground" aria-label={unread ? tx(`Notifications, ${unread} new`, `الإشعارات، ${unread} جديدة`) : tx('Notifications', 'الإشعارات')}>
          <Bell className="size-[18px]" />
          {unread > 0 && <span className="absolute -end-0.5 -top-0.5 grid min-w-[1.125rem] place-items-center rounded-full bg-[var(--danger)] px-1 text-[0.625rem] font-semibold leading-[1.125rem] text-white">{unread > 9 ? '9+' : unread}</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={8} collisionPadding={12} className="z-50 flex max-h-[min(70dvh,32rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-[24px] bg-popover shadow-lift">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-medium">{tx('Notifications', 'الإشعارات')}</p>
            <div className="flex items-center gap-1">
              {unread > 0 && <button type="button" onClick={() => void readAll()} className="inline-flex h-8 items-center gap-1 rounded-full px-2.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground"><Check className="size-3.5" />{tx('Mark all read', 'تحديد الكل كمقروء')}</button>}
              <Link href="/app/settings#notifications" onClick={() => setOpen(false)} className="inline-flex h-8 items-center rounded-full px-2.5 text-xs text-muted-foreground hover:bg-surface hover:text-foreground">{tx('Settings', 'الإعدادات')}</Link>
            </div>
          </div>
          <ul className="flex-1 overflow-y-auto overscroll-contain p-1.5">
            {!inbox?.items.length && <li className="px-4 py-10 text-center text-sm text-muted-foreground">{tx('Nothing new. New work, marks and messages from teachers show up here.', 'لا جديد. تظهر هنا الأعمال الجديدة والدرجات ورسائل المعلمين.')}</li>}
            {inbox?.items.slice(0, 40).map((n) => {
              const I = ICON[n.kind] ?? Bell;
              return (
                <li key={n.id}>
                  <Link href={n.url.startsWith('/') ? n.url : '/app'} onClick={() => openOne(n)} className={cn('flex gap-3 rounded-[18px] px-3 py-2.5 transition-colors hover:bg-surface', !n.read && 'bg-[color-mix(in_oklab,var(--brand)_7%,transparent)]')}>
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface"><I className="size-4" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.875rem] font-medium leading-snug" dir="auto">{n.title}</span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-xs text-muted-foreground" dir="auto">{n.body}</span>}
                      <span className="mt-1 block text-[0.6875rem] text-muted-foreground"><Ago ts={Date.parse(n.at)} locale={locale} /></span>
                    </span>
                    {!n.read && <span className="mt-2 size-2 shrink-0 rounded-full bg-[var(--brand)]" aria-label={tx('New', 'جديد')} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
